# -*- coding: utf-8 -*-
"""
Rendu : projette le meuble 3D sur la photo, teste la profondeur de la pièce,
ajoute une ombre portée au sol, un reflet léger, et un éclairage simple.
"""
from __future__ import annotations

import cv2
import numpy as np
import trimesh


def _couleur_ambiante(teinte: float) -> np.ndarray:
    """teinte 0 = bleu froid, 1 = ambre chaud."""
    froid = np.array([0.82, 0.88, 1.00])
    chaud = np.array([1.00, 0.90, 0.72])
    t = float(np.clip(teinte, 0.0, 1.0))
    return (1.0 - t) * froid + t * chaud


def _normales_faces(vertices: np.ndarray, faces: np.ndarray) -> np.ndarray:
    p0 = vertices[faces[:, 0]]
    p1 = vertices[faces[:, 1]]
    p2 = vertices[faces[:, 2]]
    n = np.cross(p1 - p0, p2 - p0)
    normes = np.linalg.norm(n, axis=1, keepdims=True) + 1e-9
    return n / normes


def _projeter(points_cam: np.ndarray, k: np.ndarray) -> np.ndarray:
    z = np.maximum(points_cam[:, 2], 1e-4)
    u = k[0, 0] * points_cam[:, 0] / z + k[0, 2]
    v = k[1, 1] * points_cam[:, 1] / z + k[1, 2]
    return np.stack([u, v, z], axis=1)


def rasteriser_meuble(
    photo_rvb: np.ndarray,
    profondeur_scene: np.ndarray,
    mesh_camera: trimesh.Trimesh,
    matrice_k: np.ndarray,
    reglages_rendu: dict,
    qualite: str,
) -> tuple[np.ndarray, np.ndarray]:
    """
    Dessine le meuble par algorithme du peintre (triangles loin → près)
    puis masque les pixels derrière la scène (occultation).
    Retour : (image uint8, masque meuble bool).
    """
    hauteur, largeur = photo_rvb.shape[:2]
    facteur_res = {"basse": 0.45, "normale": 0.70, "haute": 1.00}.get(qualite, 0.70)
    rw, rh = max(64, int(largeur * facteur_res)), max(64, int(hauteur * facteur_res))
    k_petit = matrice_k.copy()
    k_petit[0, :] *= rw / largeur
    k_petit[1, :] *= rh / hauteur

    vertices = np.asarray(mesh_camera.vertices, np.float64)
    faces = np.asarray(mesh_camera.faces, np.int32)
    if len(faces) == 0:
        return photo_rvb.copy(), np.zeros((hauteur, largeur), dtype=bool)

    uvz = _projeter(vertices, k_petit)
    normales = _normales_faces(vertices, faces)
    direction_lumiere = np.array([-0.35, -0.80, -0.45], np.float64)
    direction_lumiere /= np.linalg.norm(direction_lumiere)
    force = float(reglages_rendu.get("force_eclairage", 1.0))
    ambiant = _couleur_ambiante(float(reglages_rendu.get("teinte_ambiant", 0.72)))
    lambert = np.clip(normales @ (-direction_lumiere), 0.05, 1.0)
    intensite = (0.28 * 1.0 + 0.72 * lambert) * force
    intensite = np.clip(intensite, 0.08, 1.6)

    # Couleur de base (bois) modulée par la lumière
    if hasattr(mesh_camera.visual, "vertex_colors") and mesh_camera.visual.vertex_colors is not None:
        coul_vert = mesh_camera.visual.vertex_colors[:, :3].astype(np.float64) / 255.0
        coul_faces = coul_vert[faces].mean(axis=1)
    else:
        coul_faces = np.tile(np.array([[0.76, 0.62, 0.42]]), (len(faces), 1))
    couleurs = np.clip(coul_faces * intensite[:, None] * ambiant[None, :], 0, 1)

    centroides_z = vertices[faces].mean(axis=1)[:, 2]
    ordre = np.argsort(-centroides_z)  # loin d’abord

    calque = np.zeros((rh, rw, 3), np.float32)
    zbuf = np.full((rh, rw), np.inf, np.float32)
    masque = np.zeros((rh, rw), np.uint8)

    # Profondeur scène 0..1 → comparable au Z caméra : on ré-étale sur le Z du mesh
    z_mesh_min, z_mesh_max = float(np.percentile(centroides_z, 5)), float(np.percentile(centroides_z, 95))
    prof = cv2.resize(profondeur_scene, (rw, rh), interpolation=cv2.INTER_LINEAR)
    # Inverse : dans notre convention profondeur relative 1 = loin = grand Z
    z_scene = z_mesh_min + prof * max(z_mesh_max - z_mesh_min, 0.2)

    for indice_face in ordre:
        pts = uvz[faces[indice_face]]
        if np.any(pts[:, 2] < 0.05):
            continue
        polygone = np.round(pts[:, :2]).astype(np.int32)
        if cv2.contourArea(polygone) < 1.5:
            continue
        # Bounding box
        x0, y0 = polygone[:, 0].min(), polygone[:, 1].min()
        x1, y1 = polygone[:, 0].max(), polygone[:, 1].max()
        if x1 < 0 or y1 < 0 or x0 >= rw or y0 >= rh:
            continue
        mini = np.zeros((rh, rw), np.uint8)
        cv2.fillConvexPoly(mini, polygone, 1)
        ys, xs = np.where(mini == 1)
        if ys.size == 0:
            continue
        z_tri = float(pts[:, 2].mean())
        visible = z_tri <= (z_scene[ys, xs] + 0.08)
        if not np.any(visible):
            continue
        ys, xs = ys[visible], xs[visible]
        plus_proche = z_tri <= zbuf[ys, xs]
        ys, xs = ys[plus_proche], xs[plus_proche]
        if ys.size == 0:
            continue
        zbuf[ys, xs] = z_tri
        calque[ys, xs] = couleurs[indice_face]
        masque[ys, xs] = 1

    calque_u8 = np.clip(calque * 255.0, 0, 255).astype(np.uint8)
    if (rw, rh) != (largeur, hauteur):
        calque_u8 = cv2.resize(calque_u8, (largeur, hauteur), interpolation=cv2.INTER_LINEAR)
        masque = cv2.resize(masque, (largeur, hauteur), interpolation=cv2.INTER_NEAREST)

    masque_b = masque.astype(bool)
    image = photo_rvb.copy()
    if np.any(masque_b):
        image[masque_b] = calque_u8[masque_b]
    return image, masque_b


def ajouter_ombre_et_reflet(
    photo_avec_meuble: np.ndarray,
    masque_meuble: np.ndarray,
    plan_sol: dict,
    matrice_k: np.ndarray,
    mesh_camera: trimesh.Trimesh,
    reglages_rendu: dict,
) -> np.ndarray:
    """Ombre portée (tache sombre au sol) + reflet vertical très léger."""
    image = photo_avec_meuble.astype(np.float32)
    hauteur, largeur = masque_meuble.shape
    intensite_ombre = float(np.clip(reglages_rendu.get("intensite_ombre", 0.4), 0.0, 1.0))
    intensite_reflet = float(np.clip(reglages_rendu.get("intensite_reflets", 0.12), 0.0, 1.0))

    if intensite_ombre > 0.01 and np.any(masque_meuble):
        ys, xs = np.where(masque_meuble)
        if ys.size > 8:
            x_min, x_max = int(xs.min()), int(xs.max())
            y_bas = int(np.percentile(ys, 92))
            largeur_tache = max(12, x_max - x_min)
            hauteur_tache = max(8, int(largeur_tache * 0.22))
            cx = int(xs.mean())
            cy = min(hauteur - 2, y_bas + 4)
            ombre = np.zeros((hauteur, largeur), np.float32)
            cv2.ellipse(
                ombre,
                (cx, cy),
                (largeur_tache // 2, hauteur_tache // 2),
                0,
                0,
                360,
                1.0,
                -1,
            )
            ombre = cv2.GaussianBlur(ombre, (0, 0), sigmaX=max(3, largeur_tache / 14))
            ombre = np.clip(ombre, 0, 1)
            # L’ombre ne recouvre pas le meuble lui-même
            ombre[masque_meuble] = 0
            image *= (1.0 - intensite_ombre * ombre)[:, :, None]

    if intensite_reflet > 0.01 and np.any(masque_meuble):
        # Reflet : copie retournée sous le contact au sol, atténuée
        ys, xs = np.where(masque_meuble)
        y_contact = int(np.percentile(ys, 95)) if ys.size else hauteur - 1
        bande = masque_meuble.copy()
        bande[: max(0, y_contact - 8), :] = False
        if np.any(bande):
            reflet = np.zeros_like(image)
            h_ref = min(80, hauteur - y_contact - 1)
            if h_ref > 6:
                morceau = image[y_contact - h_ref : y_contact, :, :]
                if morceau.shape[0] == h_ref:
                    morceau_flip = morceau[::-1]
                    dest = reflet[y_contact : y_contact + h_ref, :, :]
                    h_ok = min(dest.shape[0], morceau_flip.shape[0])
                    reflet[y_contact : y_contact + h_ok] = morceau_flip[:h_ok]
                    poids = np.linspace(intensite_reflet, 0.0, h_ok).reshape(-1, 1, 1)
                    zone = image[y_contact : y_contact + h_ok]
                    image[y_contact : y_contact + h_ok] = (1.0 - poids) * zone + poids * reflet[y_contact : y_contact + h_ok]

    return np.clip(image, 0, 255).astype(np.uint8)


def composer(
    photo_rvb: np.ndarray,
    profondeur_scene: np.ndarray,
    mesh_camera: trimesh.Trimesh,
    plan_sol: dict,
    matrice_k: np.ndarray,
    reglages: dict,
) -> np.ndarray:
    """Pipeline de rendu complet à partir d’un mesh déjà posé dans l’espace caméra."""
    qualite = reglages["qualite"]["qualite_modele_3d"]
    image, masque = rasteriser_meuble(
        photo_rvb,
        profondeur_scene,
        mesh_camera,
        matrice_k,
        reglages["rendu"],
        qualite,
    )
    image = ajouter_ombre_et_reflet(
        image, masque, plan_sol, matrice_k, mesh_camera, reglages["rendu"]
    )
    return image
