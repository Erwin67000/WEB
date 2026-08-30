# -*- coding: utf-8 -*-
"""
État de session : photo, profondeur, plans, mesh. Recalcul sélectif.
"""
from __future__ import annotations

import numpy as np

from pipeline.camera import (
    etalonner_echelle_par_hauteur_camera,
    matrice_intrinseque,
)
from pipeline.config import HAUTEUR_CAMERA_METRES, fusionner_avec_defauts
from pipeline.contraintes import pixel_vers_parametre_mur, poser_meuble_sur_les_rails
from pipeline.maillage import charger_modele_3d, simplifier_selon_qualite
from pipeline.plans import (
    deprojeter_pixels,
    detecter_plan_mur,
    detecter_plan_sol,
    segmenter_scene,
)
from pipeline.profondeur import estimer_profondeur
from pipeline.rendu import composer


def nouvel_etat() -> dict:
    return {
        "photo": None,
        "chemin_modele": None,
        "mesh": None,
        "profondeur": None,
        "classes": None,
        "points_3d": None,
        "plan_sol": None,
        "plan_mur": None,
        "matrice_k": None,
        "echelle_points": 4.0,
        "message": "Importez une photo de pièce, puis un modèle 3D (OBJ ou STL).",
        "pret": False,
    }


def reconstruire_scene(
    etat: dict,
    photo_rvb: np.ndarray,
    resolution_profondeur: int,
    local_uniquement: bool = True,
) -> dict:
    """Profondeur + segmentation + plans. À lancer quand la photo change (ou Recalculer)."""
    hauteur, largeur = photo_rvb.shape[:2]
    k = matrice_intrinseque(largeur, hauteur)
    profondeur = estimer_profondeur(
        photo_rvb,
        resolution_cote_long=int(resolution_profondeur),
        local_uniquement=local_uniquement,
    )
    classes = segmenter_scene(photo_rvb, local_uniquement=local_uniquement)

    # Premier nuage avec une échelle arbitraire, puis on étalonne
    echelle = 4.0
    points = deprojeter_pixels(profondeur, k, echelle)
    plan_sol, message_sol = detecter_plan_sol(photo_rvb, profondeur, points, classes)
    facteur = etalonner_echelle_par_hauteur_camera(
        plan_sol, echelle, HAUTEUR_CAMERA_METRES
    )
    echelle = echelle * facteur
    points = deprojeter_pixels(profondeur, k, echelle)
    plan_sol, message_sol = detecter_plan_sol(photo_rvb, profondeur, points, classes)
    plan_mur = detecter_plan_mur(photo_rvb, profondeur, points, classes, plan_sol)

    etat["photo"] = photo_rvb
    etat["profondeur"] = profondeur
    etat["classes"] = classes
    etat["points_3d"] = points
    etat["plan_sol"] = plan_sol
    etat["plan_mur"] = plan_mur
    etat["matrice_k"] = k
    etat["echelle_points"] = echelle
    if message_sol:
        etat["message"] = message_sol
    elif plan_mur is None:
        etat["message"] = (
            "Sol détecté, mais aucun mur net. Le meuble sera posé au sol "
            "sans coller à un mur. Cadrez un mur bien visible si possible."
        )
    else:
        etat["message"] = "Scène prête. Glissez le meuble, ou bougez les curseurs."
    etat["pret"] = etat["mesh"] is not None
    return etat


def charger_mesh_dans_etat(etat: dict, chemin_modele: str, qualite: str) -> dict:
    mesh = charger_modele_3d(chemin_modele)
    etat["chemin_modele"] = str(chemin_modele)
    etat["mesh"] = simplifier_selon_qualite(mesh, qualite)
    etat["pret"] = etat["photo"] is not None and etat["plan_sol"] is not None
    if etat["pret"] and "Sol" not in (etat.get("message") or "") and "mur" not in (etat.get("message") or "").lower():
        etat["message"] = "Modèle chargé. Ajustez l’échelle et la position."
    return etat


def rendre_etat(etat: dict, reglages: dict) -> np.ndarray | None:
    """Rendu interactif : ne recalcule ni profondeur ni plans."""
    if etat.get("photo") is None or etat.get("mesh") is None or etat.get("plan_sol") is None:
        return etat.get("photo")
    reglages = fusionner_avec_defauts(reglages)
    h, w = etat["photo"].shape[:2]
    mesh_simple = simplifier_selon_qualite(etat["mesh"], reglages["qualite"]["qualite_modele_3d"])
    mesh_pose = poser_meuble_sur_les_rails(
        mesh_simple,
        etat["plan_sol"],
        etat["plan_mur"],
        etat["matrice_k"],
        (h, w),
        reglages["placement"],
        float(reglages["echelle"]["facteur"]),
    )
    return composer(
        etat["photo"],
        etat["profondeur"],
        mesh_pose,
        etat["plan_sol"],
        etat["matrice_k"],
        reglages,
    )


def appliquer_clic(etat: dict, reglages: dict, u: int, v: int) -> dict:
    """Glisser-déposer : un clic sur le rendu met à jour glisser_le_long_du_mur."""
    if etat.get("plan_sol") is None:
        return reglages
    h, w = etat["photo"].shape[:2]
    t = pixel_vers_parametre_mur(
        u, v, etat["plan_sol"], etat["plan_mur"], etat["matrice_k"], (h, w)
    )
    if t is not None:
        reglages["placement"]["glisser_le_long_du_mur"] = t
    return reglages
