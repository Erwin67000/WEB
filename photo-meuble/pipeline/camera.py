# -*- coding: utf-8 -*-
"""
Caméra pinhole à partir de la taille de la photo + FOV, et échelle métrique
déduite de la hauteur de la caméra au-dessus du sol.
"""
from __future__ import annotations

import numpy as np

from pipeline.config import FOV_HORIZONTAL_DEGRES, HAUTEUR_CAMERA_METRES


def matrice_intrinseque(largeur: int, hauteur: int, fov_deg: float = FOV_HORIZONTAL_DEGRES) -> np.ndarray:
    """K 3×3 : fx, fy, cx, cy. FOV horizontal en degrés."""
    fov_rad = np.deg2rad(float(fov_deg))
    fx = (largeur * 0.5) / np.tan(fov_rad * 0.5)
    fy = fx  # pixels carrés
    cx = (largeur - 1) * 0.5
    cy = (hauteur - 1) * 0.5
    k = np.array([[fx, 0.0, cx], [0.0, fy, cy], [0.0, 0.0, 1.0]], dtype=np.float64)
    return k


def distance_origine_au_plan(normale: np.ndarray, d_plan: float) -> float:
    """Distance de la caméra (origine) au plan normale·X + d = 0."""
    nrm = float(np.linalg.norm(normale)) + 1e-9
    return abs(float(d_plan)) / nrm


def etalonner_echelle_par_hauteur_camera(
    plan_sol: dict,
    echelle_actuelle_points: float,
    hauteur_camera_m: float = HAUTEUR_CAMERA_METRES,
) -> float:
    """
    Les points 3D ont été construits avec Z = profondeur_relative * echelle_actuelle.
    On veut que la distance caméra → sol vaille hauteur_camera_m.
    On renvoie le multiplicateur à appliquer à echelle_actuelle.
    """
    distance_actuelle = distance_origine_au_plan(plan_sol["normale"], plan_sol["d"])
    if distance_actuelle < 1e-4:
        return 1.0
    # points_3d ∝ echelle_actuelle, donc distance ∝ echelle_actuelle
    facteur = hauteur_camera_m / distance_actuelle
    return float(np.clip(facteur, 0.2, 8.0))
