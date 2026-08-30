# -*- coding: utf-8 -*-
"""
Réglages par défaut, sauvegarde / chargement JSON, export « figé » dans le code.
Tout est local : aucun appel réseau ici.
"""
from __future__ import annotations

import json
from pathlib import Path
from datetime import datetime

# Dossier de ce fichier → racine du projet photo-meuble/
RACINE_PROJET = Path(__file__).resolve().parent.parent
DOSSIER_CONFIGS = RACINE_PROJET / "configs"
DOSSIER_POIDS = RACINE_PROJET / "poids"
DOSSIER_EXPORTS = RACINE_PROJET / "exports"
FICHIER_VALEURS_FIGEES = RACINE_PROJET / "pipeline" / "valeurs_figees.py"

# Modèles Hugging Face (téléchargés une fois, puis cache local)
ID_MODELE_PROFONDEUR = "depth-anything/Depth-Anything-V2-Small-hf"
ID_MODELE_SEGMENTATION = "nvidia/segformer-b0-finetuned-ade-512-512"

# Classes ADE20K (150 classes) utiles pour le sol et les murs
# https://github.com/CSAILVision/sceneparsing/blob/master/objectInfo150.csv
CLASSES_MUR_ADE20K = {
    0,   # wall
    1,   # building
    8,   # windowpane
    14,  # door
    22,  # painting
    25,  # mirror
    43,  # column
    145, # bulletin board
}
CLASSES_SOL_ADE20K = {
    3,   # floor
    6,   # road
    9,   # grass
    13,  # earth
    28,  # rug
    29,  # rug / carpet
}

# Hauteur de caméra supposée (mètres) pour passer d’une profondeur relative
# à une échelle métrique. 1,50 m = personne debout qui photographie une pièce.
HAUTEUR_CAMERA_METRES = 1.50

# Champ de vue horizontal approximatif d’un smartphone (degrés)
FOV_HORIZONTAL_DEGRES = 60.0


def reglages_par_defaut() -> dict:
    """Valeurs raisonnables pour tous les curseurs de l’interface."""
    return {
        "placement": {
            # 0 = un bout du mur, 1 = l’autre bout (le long de l’intersection sol/mur)
            "glisser_le_long_du_mur": 0.45,
            # mètres, perpendiculaire au mur (négatif = vers le mur)
            "decalage_lateral_m": 0.02,
            "rotation_verticale_deg": 0.0,
            "hauteur_au_dessus_du_sol_m": 0.0,
        },
        "echelle": {
            # 1.0 = proposition automatique. 0.3 … 2.5 autour de cette proposition.
            "facteur": 1.0,
        },
        "rendu": {
            "intensite_ombre": 0.40,
            "intensite_reflets": 0.12,
            "force_eclairage": 1.00,
            # 0 = froid (bleu), 1 = chaud (ambre)
            "teinte_ambiant": 0.72,
        },
        "qualite": {
            # côté long de l’image envoyée au réseau de profondeur
            "resolution_profondeur": 384,
            # basse | normale | haute
            "qualite_modele_3d": "normale",
        },
    }


def garantir_dossiers() -> None:
    """Crée les dossiers de travail s’ils n’existent pas encore."""
    DOSSIER_CONFIGS.mkdir(parents=True, exist_ok=True)
    DOSSIER_POIDS.mkdir(parents=True, exist_ok=True)
    DOSSIER_EXPORTS.mkdir(parents=True, exist_ok=True)


def fusionner_avec_defauts(partiel: dict | None) -> dict:
    """Complète une config chargée avec les défauts (clés manquantes)."""
    complet = reglages_par_defaut()
    if not partiel:
        return complet
    for section, valeurs in complet.items():
        recu = partiel.get(section) or {}
        for cle, defaut in valeurs.items():
            if cle in recu:
                valeurs[cle] = recu[cle]
    return complet


def sauvegarder_configuration(chemin: str | Path, reglages: dict, extra: dict | None = None) -> Path:
    """Écrit un JSON local. Retourne le chemin écrit."""
    garantir_dossiers()
    chemin = Path(chemin)
    if not chemin.is_absolute():
        chemin = DOSSIER_CONFIGS / chemin
    if chemin.suffix.lower() != ".json":
        chemin = chemin.with_suffix(".json")
    paquet = {
        "version": 1,
        "date": datetime.now().isoformat(timespec="seconds"),
        "reglages": fusionner_avec_defauts(reglages),
        "extra": extra or {},
    }
    chemin.parent.mkdir(parents=True, exist_ok=True)
    chemin.write_text(json.dumps(paquet, indent=2, ensure_ascii=False), encoding="utf-8")
    return chemin


def charger_configuration(chemin: str | Path) -> dict:
    """Lit un JSON local et renvoie les réglages (fusionnés aux défauts)."""
    chemin = Path(chemin)
    if not chemin.is_absolute():
        chemin = DOSSIER_CONFIGS / chemin
    brut = json.loads(chemin.read_text(encoding="utf-8"))
    if "reglages" in brut:
        return fusionner_avec_defauts(brut["reglages"])
    return fusionner_avec_defauts(brut)


def exporter_valeurs_figees(reglages: dict) -> Path:
    """
    Écrit pipeline/valeurs_figees.py pour figer un réglage de production.
    Au prochain lancement, ces valeurs remplacent les défauts si le fichier existe.
    """
    r = fusionner_avec_defauts(reglages)
    contenu = (
        "# -*- coding: utf-8 -*-\n"
        '"""Valeurs figées exportées depuis l’interface (production)."""\n'
        "REGGLAGES_FIGES = " + json.dumps(r, indent=4, ensure_ascii=False) + "\n"
    )
    # orthographe volontairement simple pour l’import
    contenu = contenu.replace("REGGLAGES_FIGES", "REGLAGES_FIGES")
    FICHIER_VALEURS_FIGEES.write_text(contenu, encoding="utf-8")
    return FICHIER_VALEURS_FIGEES


def charger_valeurs_figees_si_presentes() -> dict:
    """Si un export de production existe, on part de lui, sinon des défauts."""
    if not FICHIER_VALEURS_FIGEES.exists():
        return reglages_par_defaut()
    try:
        # import local du fichier généré
        from pipeline.valeurs_figees import REGLAGES_FIGES  # type: ignore

        return fusionner_avec_defauts(REGLAGES_FIGES)
    except Exception:
        return reglages_par_defaut()
