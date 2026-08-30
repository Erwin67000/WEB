# -*- coding: utf-8 -*-
"""
Chargement OBJ / STL, conversion en mètres, axe vertical vers le haut (Y monde).
Dans l’espace caméra OpenCV, le « haut » est -Y.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
import trimesh


def _vers_metres(mesh: trimesh.Trimesh) -> trimesh.Trimesh:
    """Si le bbox dépasse 10 unités, on suppose des millimètres (cas Philae)."""
    plus_grand_cote = float(np.max(mesh.extents)) if mesh.extents is not None else 1.0
    if plus_grand_cote > 10.0:
        mesh.apply_scale(0.001)  # mm → m
    elif plus_grand_cote < 0.05:
        mesh.apply_scale(100.0)  # probablement des mètres trop petits / cm
    return mesh


def _axe_vertical_vers_y_objet(mesh: trimesh.Trimesh) -> trimesh.Trimesh:
    """
    Philae / SketchUp : Z vers le haut. Un STL « plat » a souvent Y ou Z up.
    On choisit l’axe dont l’étendue ressemble le plus à une hauteur de meuble
    (ni la plus fine, souvent l’épaisseur).
    """
    etendues = np.asarray(mesh.extents, dtype=np.float64)
    # indice de l’axe « hauteur » : le plus grand en général pour une bibliothèque,
    # le médian pour un buffet bas. On prend le max.
    axe_haut = int(np.argmax(etendues))
    if axe_haut == 1:
        return mesh  # déjà Y-up objet
    if axe_haut == 2:
        # Z-up → rotation -90° autour de X : (x,y,z) → (x,-z,y) wait
        # trimesh : rotation around X by -90° : Y→Z, Z→-Y... 
        # On veut Z objet → Y objet.
        matrice = trimesh.transformations.rotation_matrix(np.deg2rad(-90.0), [1, 0, 0])
        mesh.apply_transform(matrice)
        return mesh
    # X était le plus grand : rotation 90° autour de Z puis on re-teste
    matrice = trimesh.transformations.rotation_matrix(np.deg2rad(-90.0), [0, 0, 1])
    mesh.apply_transform(matrice)
    return mesh


def charger_modele_3d(chemin: str | Path) -> trimesh.Trimesh:
    """Charge un OBJ ou STL, nettoie, convertit en mètres, Y objet = haut."""
    chemin = Path(chemin)
    if not chemin.exists():
        raise FileNotFoundError(f"Modèle introuvable : {chemin}")
    suffixe = chemin.suffix.lower()
    if suffixe not in {".obj", ".stl", ".ply"}:
        raise ValueError("Format non supporté. Utilisez un fichier .obj, .stl ou .ply.")

    charge = trimesh.load(str(chemin), force="mesh", skip_materials=False)
    if isinstance(charge, trimesh.Scene):
        mesh = trimesh.util.concatenate(
            [g for g in charge.geometry.values() if isinstance(g, trimesh.Trimesh)]
        )
    else:
        mesh = charge
    if mesh is None or mesh.vertices is None or len(mesh.vertices) < 8:
        raise ValueError("Le fichier 3D ne contient pas assez de géométrie.")

    mesh = mesh.copy()
    mesh.merge_vertices()
    mesh = _vers_metres(mesh)
    mesh = _axe_vertical_vers_y_objet(mesh)
    mesh.rezero()  # coin min → origine
    # Centre en X/Z objet, pose le dessous à Y=0
    bounds = mesh.bounds
    translation = [
        -(bounds[0, 0] + bounds[1, 0]) * 0.5,
        -bounds[0, 1],
        -(bounds[0, 2] + bounds[1, 2]) * 0.5,
    ]
    mesh.apply_translation(translation)
    if not mesh.visual.kind:
        mesh.visual.vertex_colors = [196, 165, 116, 255]
    return mesh


def simplifier_selon_qualite(mesh: trimesh.Trimesh, qualite: str) -> trimesh.Trimesh:
    """Réduit le nombre de faces pour le rendu temps réel."""
    cible = {"basse": 4000, "normale": 12000, "haute": 40000}.get(qualite, 12000)
    if len(mesh.faces) <= cible:
        return mesh
    try:
        reduit = mesh.simplify_quadric_decimation(cible)
        if reduit is not None and len(reduit.faces) > 10:
            return reduit
    except Exception:
        pass
    # Repli : sous-échantillonner les faces au hasard (moins joli, toujours visible)
    rng = np.random.default_rng(0)
    choix = rng.choice(len(mesh.faces), size=cible, replace=False)
    return trimesh.Trimesh(
        vertices=mesh.vertices,
        faces=mesh.faces[choix],
        process=False,
    )
