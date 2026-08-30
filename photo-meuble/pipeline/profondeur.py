# -*- coding: utf-8 -*-
"""
Étape 1 — estimation de profondeur (Depth Anything V2 Small).
Le modèle est lu depuis le cache local (dossier poids/). Pas d’appel réseau
si les fichiers sont déjà là.
"""
from __future__ import annotations

import os
from functools import lru_cache

import numpy as np
from PIL import Image

from pipeline.config import DOSSIER_POIDS, ID_MODELE_PROFONDEUR

# Force le cache Hugging Face dans notre dossier local
os.environ.setdefault("HF_HOME", str(DOSSIER_POIDS))
os.environ.setdefault("HUGGINGFACE_HUB_CACHE", str(DOSSIER_POIDS / "hub"))


@lru_cache(maxsize=1)
def charger_modele_profondeur(local_uniquement: bool = True):
    """
    Charge le réseau une seule fois (mémoire).
    local_uniquement=True : échoue si les poids n’ont pas été téléchargés
    (runtime). L’installeur passe False pour le premier téléchargement.
    """
    import torch
    from transformers import AutoImageProcessor, AutoModelForDepthEstimation

    DOSSIER_POIDS.mkdir(parents=True, exist_ok=True)
    processeur = AutoImageProcessor.from_pretrained(
        ID_MODELE_PROFONDEUR,
        cache_dir=str(DOSSIER_POIDS),
        local_files_only=local_uniquement,
    )
    modele = AutoModelForDepthEstimation.from_pretrained(
        ID_MODELE_PROFONDEUR,
        cache_dir=str(DOSSIER_POIDS),
        local_files_only=local_uniquement,
    )
    modele.eval()
    appareil = "cuda" if torch.cuda.is_available() else "cpu"
    modele.to(appareil)
    return processeur, modele, appareil


def estimer_profondeur(
    photo_rvb: np.ndarray,
    resolution_cote_long: int = 384,
    local_uniquement: bool = True,
) -> np.ndarray:
    """
    Calcule une carte de profondeur relative (plus grand = plus loin).
    photo_rvb : image uint8 H×W×3 (R, V, B)
    Retour : float32 H×W, même taille que la photo d’origine.
    """
    import torch

    hauteur_origine, largeur_origine = photo_rvb.shape[:2]
    cote_long = max(hauteur_origine, largeur_origine)
    facteur = min(1.0, float(resolution_cote_long) / float(max(cote_long, 1)))
    if facteur < 0.999:
        nouvelle_largeur = max(32, int(largeur_origine * facteur))
        nouvelle_hauteur = max(32, int(hauteur_origine * facteur))
        image_pil = Image.fromarray(photo_rvb).resize(
            (nouvelle_largeur, nouvelle_hauteur),
            Image.Resampling.BILINEAR,
        )
    else:
        image_pil = Image.fromarray(photo_rvb)

    processeur, modele, appareil = charger_modele_profondeur(local_uniquement)
    entrees = processeur(images=image_pil, return_tensors="pt")
    entrees = {cle: tenseur.to(appareil) for cle, tenseur in entrees.items()}

    with torch.no_grad():
        sortie = modele(**entrees)
        # Depth Anything V2 : predicted_depth
        profondeur_petite = sortie.predicted_depth
        if profondeur_petite.ndim == 3:
            profondeur_petite = profondeur_petite.unsqueeze(1)
        profondeur_petite = torch.nn.functional.interpolate(
            profondeur_petite,
            size=(hauteur_origine, largeur_origine),
            mode="bilinear",
            align_corners=False,
        )
        carte = profondeur_petite.squeeze().cpu().numpy().astype(np.float32)

    # Normalise en [0, 1] tout en gardant l’ordre (loin = élevé)
    mini = float(np.percentile(carte, 1.0))
    maxi = float(np.percentile(carte, 99.0))
    if maxi - mini < 1e-6:
        return np.ones((hauteur_origine, largeur_origine), np.float32) * 0.5
    carte = np.clip((carte - mini) / (maxi - mini), 0.0, 1.0)
    return carte.astype(np.float32)
