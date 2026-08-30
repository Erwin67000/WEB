# -*- coding: utf-8 -*-
"""
Rails de contrainte : le meuble reste sur le sol et plaqué contre le mur.
Il ne flotte pas, il ne traverse pas le mur.
"""
from __future__ import annotations

import numpy as np
import trimesh


def _intersection_deux_plans(plan_a: dict, plan_b: dict) -> tuple[np.ndarray, np.ndarray]:
    """
    Ligne d’intersection : point + t * direction.
    direction = normale_a × normale_b
    """
    n1 = np.asarray(plan_a["normale"], np.float64)
    n2 = np.asarray(plan_b["normale"], np.float64)
    d1 = float(plan_a["d"])
    d2 = float(plan_b["d"])
    direction = np.cross(n1, n2)
    norme = np.linalg.norm(direction)
    if norme < 1e-8:
        # Plans presque parallèles : direction de secours le long de X caméra
        direction = np.array([1.0, 0.0, 0.0])
        norme = 1.0
    direction = direction / norme

    # Un point de la ligne : résoudre n1·x = -d1, n2·x = -d2, dir·x = 0
    a = np.stack([n1, n2, direction], axis=0)
    b = np.array([-d1, -d2, 0.0])
    try:
        point = np.linalg.solve(a, b)
    except np.linalg.LinAlgError:
        point = np.array([0.0, 0.0, 2.0])
    return point.astype(np.float64), direction.astype(np.float64)


def _bornes_t_visibles(
    point_ligne: np.ndarray,
    direction: np.ndarray,
    matrice_k: np.ndarray,
    largeur: int,
    hauteur: int,
) -> tuple[float, float]:
    """Paramètres t pour lesquels la ligne sol/mur traverse encore l’image."""
    ts = []
    for t in np.linspace(-8.0, 8.0, 81):
        p = point_ligne + t * direction
        if p[2] < 0.15:
            continue
        u = matrice_k[0, 0] * p[0] / p[2] + matrice_k[0, 2]
        v = matrice_k[1, 1] * p[1] / p[2] + matrice_k[1, 2]
        if 0 <= u < largeur and 0 <= v < hauteur:
            ts.append(t)
    if len(ts) < 2:
        return -1.0, 1.0
    return float(min(ts)), float(max(ts))


def poser_meuble_sur_les_rails(
    mesh: trimesh.Trimesh,
    plan_sol: dict,
    plan_mur: dict | None,
    matrice_k: np.ndarray,
    taille_image: tuple[int, int],
    reglages_placement: dict,
    facteur_echelle: float,
) -> trimesh.Trimesh:
    """
    Copie le mesh, applique échelle / rotation / translation.
    - Y objet (haut du meuble) est aligné sur la normale du sol (haut monde).
    - Le dos du meuble est plaqué sur le mur (si un mur a été trouvé).
    - glisser_le_long_du_mur ∈ [0, 1] parcourt l’intersection sol/mur visible.
    """
    pose = mesh.copy()
    pose.apply_scale(float(np.clip(facteur_echelle, 0.15, 4.0)))

    normale_sol = np.asarray(plan_sol["normale"], np.float64)
    normale_sol = normale_sol / (np.linalg.norm(normale_sol) + 1e-9)

    # Espace objet : +Y = haut. Espace caméra : haut = normale_sol.
    y_objet = np.array([0.0, 1.0, 0.0])
    axe_rot = np.cross(y_objet, normale_sol)
    nrm_axe = np.linalg.norm(axe_rot)
    if nrm_axe > 1e-6:
        axe_rot = axe_rot / nrm_axe
        cosang = float(np.clip(np.dot(y_objet, normale_sol), -1.0, 1.0))
        angle = np.arccos(cosang)
        rot = trimesh.transformations.rotation_matrix(angle, axe_rot)
        pose.apply_transform(rot)

    # Rotation demandée par l’utilisateur autour de la verticale (normale sol)
    angle_user = np.deg2rad(float(reglages_placement.get("rotation_verticale_deg", 0.0)))
    if abs(angle_user) > 1e-6:
        rot_u = trimesh.transformations.rotation_matrix(angle_user, normale_sol)
        pose.apply_transform(rot_u)

    hauteur_img, largeur_img = taille_image
    if plan_mur is not None:
        point_ligne, direction = _intersection_deux_plans(plan_sol, plan_mur)
        t_min, t_max = _bornes_t_visibles(
            point_ligne, direction, matrice_k, largeur_img, hauteur_img
        )
        glisser = float(np.clip(reglages_placement.get("glisser_le_long_du_mur", 0.45), 0.0, 1.0))
        t = t_min + glisser * (t_max - t_min)
        pied = point_ligne + t * direction

        normale_mur = np.asarray(plan_mur["normale"], np.float64)
        normale_mur = normale_mur / (np.linalg.norm(normale_mur) + 1e-9)
        # Décale du mur vers l’intérieur de la pièce (normale mur pointe vers la caméra)
        # On recule le centre du meuble de la moitié de sa profondeur le long de -normale_mur
        # pour ne pas traverser : le dos (côté mur) arrive au plan.
        profondeur_meuble = float(np.max(pose.extents)) * 0.35
        decalage = float(reglages_placement.get("decalage_lateral_m", 0.02))
        # « décalage latéral » = éloignement du mur (positif = vers la pièce)
        pied = pied + normale_mur * (profondeur_meuble + max(0.0, decalage))
    else:
        # Pas de mur : on pose le meuble au centre, un peu devant la caméra, sur le sol
        pied = np.array([0.0, 0.0, 2.2], np.float64)
        # Projette sur le sol
        # normale·x + d = 0 → x := x - normale * (n·x + d)
        n = normale_sol
        d = float(plan_sol["d"])
        pied = pied - n * (np.dot(n, pied) + d)
        pied = pied + np.array(
            [float(reglages_placement.get("decalage_lateral_m", 0.0)), 0.0, 0.0]
        )

    # Plaque le dessous sur le sol (Y objet déjà à 0) : le point « pied » est sur le sol
    # Le mesh a son dessous à 0 le long de l’axe objet Y, aligné sur normale_sol.
    hauteur_plus = float(reglages_placement.get("hauteur_au_dessus_du_sol_m", 0.0))
    pied = pied + normale_sol * max(0.0, hauteur_plus)

    pose.apply_translation(pied)
    return pose


def pixel_vers_parametre_mur(
    u: int,
    v: int,
    plan_sol: dict,
    plan_mur: dict | None,
    matrice_k: np.ndarray,
    taille_image: tuple[int, int],
) -> float | None:
    """
    Clic dans l’image → valeur glisser_le_long_du_mur ∈ [0, 1].
    Intersection rayon caméra / sol, puis projection sur la ligne sol-mur.
    """
    if plan_mur is None:
        return None
    fx, fy = matrice_k[0, 0], matrice_k[1, 1]
    cx, cy = matrice_k[0, 2], matrice_k[1, 2]
    direction_rayon = np.array([(u - cx) / fx, (v - cy) / fy, 1.0], np.float64)
    direction_rayon /= np.linalg.norm(direction_rayon) + 1e-9

    n = np.asarray(plan_sol["normale"], np.float64)
    d = float(plan_sol["d"])
    denom = float(np.dot(n, direction_rayon))
    if abs(denom) < 1e-8:
        return None
    t_ray = -d / denom
    if t_ray < 0.05:
        return None
    point_sol = direction_rayon * t_ray

    point_ligne, dir_ligne = _intersection_deux_plans(plan_sol, plan_mur)
    # Projection du point_sol sur la ligne
    t = float(np.dot(point_sol - point_ligne, dir_ligne))
    hauteur_img, largeur_img = taille_image
    t_min, t_max = _bornes_t_visibles(
        point_ligne, dir_ligne, matrice_k, largeur_img, hauteur_img
    )
    if abs(t_max - t_min) < 1e-6:
        return 0.5
    return float(np.clip((t - t_min) / (t_max - t_min), 0.0, 1.0))
