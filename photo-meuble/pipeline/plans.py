# -*- coding: utf-8 -*-
"""
Étape 2 — détection des plans.
- Sol : RANSAC 3D sur les pixels les plus « profonds » (loin + bas de l’image).
- Murs : segmentation sémantique ADE20K (SegFormer, même 150 classes que DeepLabV3-ADE20K)
  puis RANSAC d’un plan vertical.
"""
from __future__ import annotations

import os
from functools import lru_cache

import numpy as np

from pipeline.config import (
    CLASSES_MUR_ADE20K,
    CLASSES_SOL_ADE20K,
    DOSSIER_POIDS,
    ID_MODELE_SEGMENTATION,
)

os.environ.setdefault("HF_HOME", str(DOSSIER_POIDS))


@lru_cache(maxsize=1)
def charger_modele_segmentation(local_uniquement: bool = True):
    """SegFormer-B0 entraîné sur ADE20K (150 classes, dont wall=0, floor=3)."""
    import torch
    from transformers import AutoImageProcessor, AutoModelForSemanticSegmentation

    DOSSIER_POIDS.mkdir(parents=True, exist_ok=True)
    processeur = AutoImageProcessor.from_pretrained(
        ID_MODELE_SEGMENTATION,
        cache_dir=str(DOSSIER_POIDS),
        local_files_only=local_uniquement,
    )
    modele = AutoModelForSemanticSegmentation.from_pretrained(
        ID_MODELE_SEGMENTATION,
        cache_dir=str(DOSSIER_POIDS),
        local_files_only=local_uniquement,
    )
    modele.eval()
    appareil = "cuda" if torch.cuda.is_available() else "cpu"
    modele.to(appareil)
    return processeur, modele, appareil


def segmenter_scene(
    photo_rvb: np.ndarray,
    local_uniquement: bool = True,
) -> np.ndarray:
    """Retourne une carte d’indices ADE20K (int32) de la taille de la photo."""
    import torch
    from PIL import Image

    hauteur, largeur = photo_rvb.shape[:2]
    image_pil = Image.fromarray(photo_rvb)
    processeur, modele, appareil = charger_modele_segmentation(local_uniquement)
    entrees = processeur(images=image_pil, return_tensors="pt")
    entrees = {cle: tenseur.to(appareil) for cle, tenseur in entrees.items()}
    with torch.no_grad():
        logits = modele(**entrees).logits
        logits = torch.nn.functional.interpolate(
            logits,
            size=(hauteur, largeur),
            mode="bilinear",
            align_corners=False,
        )
        classes = logits.argmax(dim=1).squeeze().cpu().numpy().astype(np.int32)
    return classes


def deprojeter_pixels(
    carte_profondeur: np.ndarray,
    matrice_intrinseque: np.ndarray,
    echelle_metrique: float,
) -> np.ndarray:
    """
    Transforme chaque pixel (colonne u, ligne v, profondeur relative)
    en un point 3D caméra OpenCV (X droite, Y bas, Z devant), en mètres.
    """
    hauteur, largeur = carte_profondeur.shape
    fx = float(matrice_intrinseque[0, 0])
    fy = float(matrice_intrinseque[1, 1])
    cx = float(matrice_intrinseque[0, 2])
    cy = float(matrice_intrinseque[1, 2])
    colonnes, lignes = np.meshgrid(np.arange(largeur), np.arange(hauteur))
    # Profondeur relative 0..1 → mètres (étalonnée plus tard par la hauteur caméra)
    z_metres = np.maximum(carte_profondeur, 1e-4) * float(echelle_metrique)
    x_metres = (colonnes - cx) * z_metres / max(fx, 1e-6)
    y_metres = (lignes - cy) * z_metres / max(fy, 1e-6)
    points = np.stack([x_metres, y_metres, z_metres], axis=-1)
    return points.astype(np.float32)


def _ransac_plan_numpy(
    points_xyz: np.ndarray,
    seuil_distance: float = 0.03,
    nb_tirages: int = 400,
) -> tuple[np.ndarray, np.ndarray] | None:
    """
    RANSAC simple : tire 3 points, construit un plan, compte les inliers.
    Retour : (normale unitaire 3, d) pour normale·X + d = 0, ou None.
    """
    if points_xyz.shape[0] < 30:
        return None
    meilleur_score = -1
    meilleur_plan = None
    generateur = np.random.default_rng(0)
    n_points = points_xyz.shape[0]
    for _ in range(nb_tirages):
        choix = generateur.choice(n_points, size=3, replace=False)
        p0, p1, p2 = points_xyz[choix]
        normale = np.cross(p1 - p0, p2 - p0)
        norme = np.linalg.norm(normale)
        if norme < 1e-8:
            continue
        normale = normale / norme
        d_plan = -float(np.dot(normale, p0))
        distances = np.abs(points_xyz @ normale + d_plan)
        score = int(np.sum(distances < seuil_distance))
        if score > meilleur_score:
            meilleur_score = score
            meilleur_plan = (normale.astype(np.float32), np.float32(d_plan))
    if meilleur_plan is None or meilleur_score < 20:
        return None
    return meilleur_plan


def _ajuster_plan_inliers(points_xyz: np.ndarray, plan: tuple, seuil: float = 0.03):
    """Affine la normale par SVD sur les inliers."""
    normale, d_plan = plan
    distances = np.abs(points_xyz @ normale + d_plan)
    inliers = points_xyz[distances < seuil]
    if inliers.shape[0] < 10:
        return plan
    centre = inliers.mean(axis=0)
    _, _, vh = np.linalg.svd(inliers - centre, full_matrices=False)
    normale2 = vh[-1]
    normale2 = normale2 / (np.linalg.norm(normale2) + 1e-9)
    # Garde le même sens que la première normale
    if np.dot(normale2, normale) < 0:
        normale2 = -normale2
    d2 = -float(np.dot(normale2, centre))
    return normale2.astype(np.float32), np.float32(d2)


def detecter_plan_sol(
    photo_rvb: np.ndarray,
    carte_profondeur: np.ndarray,
    points_3d: np.ndarray,
    carte_classes: np.ndarray | None,
) -> tuple[dict, str]:
    """
    Détecte un plan de sol (plutôt horizontal).
    Retour : (plan_dict, message_utilisateur).
    plan_dict : {normale, d, methode, masque}
    """
    hauteur, largeur = carte_profondeur.shape
    bande_bas = np.zeros((hauteur, largeur), dtype=bool)
    bande_bas[int(hauteur * 0.55) :, :] = True

    # Pixels « les plus profonds » = loin (quantile haut) ET dans le bas de l’image
    seuil_loin = float(np.percentile(carte_profondeur[bande_bas], 55.0))
    masque_profonds = bande_bas & (carte_profondeur >= seuil_loin)

    if carte_classes is not None:
        masque_semantique = np.isin(carte_classes, list(CLASSES_SOL_ADE20K))
        masque_combine = masque_profonds | (masque_semantique & bande_bas)
    else:
        masque_combine = masque_profonds

    # Sous-échantillonne pour accélérer le RANSAC
    points_candidats = points_3d[masque_combine]
    if points_candidats.shape[0] > 8000:
        idx = np.random.default_rng(1).choice(points_candidats.shape[0], 8000, replace=False)
        points_candidats = points_candidats[idx]

    plan = _ransac_plan_numpy(points_candidats, seuil_distance=0.04, nb_tirages=500)
    message = ""
    methode = "ransac_profonds"

    if plan is None:
        # Fallback : plan horizontal (normale ≈ -Y caméra, vers le haut monde)
        # passant par la médiane des points du bas de l’image.
        message = (
            "La détection automatique du sol a échoué. "
            "Un plan horizontal a été posé sur la bande du bas de la photo. "
            "Vérifiez que le sol est bien visible, sans tapis trop chargé, "
            "et que la photo n’est pas trop plongeante."
        )
        methode = "fallback_bande_bas"
        points_bas = points_3d[bande_bas]
        if points_bas.shape[0] == 0:
            y_med = 1.0
        else:
            y_med = float(np.median(points_bas[:, 1]))
        # Normale vers le haut monde ≈ -Y (OpenCV Y pointe vers le bas)
        normale = np.array([0.0, -1.0, 0.0], np.float32)
        d_plan = np.float32(-np.dot(normale, np.array([0.0, y_med, 0.0])))
        plan = (normale, d_plan)
    else:
        plan = _ajuster_plan_inliers(points_candidats, plan, 0.04)
        normale, d_plan = plan
        # Le sol doit être plutôt horizontal : |normale · (0,-1,0)| grand
        haut_camera = np.array([0.0, -1.0, 0.0], np.float32)
        if abs(float(np.dot(normale, haut_camera))) < 0.45:
            # Plan trop vertical : on force un fallback horizontal
            message = (
                "Le plan trouvé n’était pas assez horizontal (peut-être un mur). "
                "Repli sur la bande du bas de l’image. Vérifiez votre photo."
            )
            methode = "fallback_bande_bas"
            points_bas = points_3d[bande_bas]
            y_med = float(np.median(points_bas[:, 1])) if points_bas.size else 1.0
            normale = haut_camera.copy()
            d_plan = np.float32(-np.dot(normale, np.array([0.0, y_med, 0.0])))
            plan = (normale, d_plan)
        else:
            # Oriente la normale vers le haut (vers -Y)
            if np.dot(normale, haut_camera) < 0:
                normale = -normale
                d_plan = -d_plan
                plan = (normale, d_plan)

    normale, d_plan = plan
    return (
        {
            "normale": np.asarray(normale, np.float32),
            "d": float(d_plan),
            "methode": methode,
            "masque": masque_combine,
        },
        message,
    )


def detecter_plan_mur(
    photo_rvb: np.ndarray,
    carte_profondeur: np.ndarray,
    points_3d: np.ndarray,
    carte_classes: np.ndarray,
    plan_sol: dict,
) -> dict | None:
    """
    Plan vertical (mur) à partir des pixels ADE20K « wall » + RANSAC.
    La normale est orientée vers la caméra (pièce intérieure).
    """
    masque_mur = np.isin(carte_classes, list(CLASSES_MUR_ADE20K))
    # On ignore le tout bas (souvent le sol mal classé)
    hauteur = carte_classes.shape[0]
    masque_mur[: int(hauteur * 0.12), :] = False
    masque_mur[int(hauteur * 0.88) :, :] = False

    points_mur = points_3d[masque_mur]
    if points_mur.shape[0] < 80:
        return None
    if points_mur.shape[0] > 8000:
        idx = np.random.default_rng(2).choice(points_mur.shape[0], 8000, replace=False)
        points_mur = points_mur[idx]

    plan = _ransac_plan_numpy(points_mur, seuil_distance=0.05, nb_tirages=500)
    if plan is None:
        return None
    plan = _ajuster_plan_inliers(points_mur, plan, 0.05)
    normale, d_plan = plan

    # Un mur est vertical : normale presque perpendiculaire au haut
    haut = plan_sol["normale"]
    if abs(float(np.dot(normale, haut))) > 0.35:
        # Trop penché : on orthogonalise par rapport au sol
        normale = normale - np.dot(normale, haut) * haut
        nrm = np.linalg.norm(normale)
        if nrm < 1e-6:
            return None
        normale = (normale / nrm).astype(np.float32)
        # Recalcule d sur le centroïde des points mur
        centre = points_mur.mean(axis=0)
        d_plan = float(-np.dot(normale, centre))

    # Oriente la normale vers la caméra (origine) : normale·origine + d > 0
    # origine = (0,0,0) → d doit être > 0 si la normale pointe vers la caméra
    # On veut que le mur soit devant : les points du mur ont Z > 0.
    # normale pointe vers la pièce (vers -Z à peu près) : normale_z < 0 souvent.
    centre = points_mur.mean(axis=0)
    vers_camera = -centre
    if np.dot(normale, vers_camera) < 0:
        normale = -normale
        d_plan = -d_plan

    return {
        "normale": np.asarray(normale, np.float32),
        "d": float(d_plan),
        "masque": masque_mur,
        "methode": "ade20k_ransac",
    }
