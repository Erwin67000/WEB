# -*- coding: utf-8 -*-
"""
Installation automatique (débutant) :
1. Vérifie Python
2. Installe les dépendances (pip)
3. Télécharge les poids Depth Anything V2 Small + SegFormer ADE20K
   dans le dossier local ./poids  (une seule fois)
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parent
FICHIER_REQ = RACINE / "requirements.txt"


def verifier_python() -> None:
    version = sys.version_info
    print(f"Python détecté : {version.major}.{version.minor}.{version.micro}  ({sys.executable})")
    if version < (3, 10):
        print("ERREUR : il faut Python 3.10 ou plus récent.")
        print("Téléchargez-le sur https://www.python.org/downloads/  (cochez « Add Python to PATH »).")
        sys.exit(1)


def installer_dependances() -> None:
    print("\n=== Installation des bibliothèques (peut prendre plusieurs minutes) ===")
    commande = [sys.executable, "-m", "pip", "install", "--upgrade", "pip"]
    subprocess.check_call(commande)
    commande = [sys.executable, "-m", "pip", "install", "-r", str(FICHIER_REQ)]
    subprocess.check_call(commande)
    print("Dépendances OK.")


def telecharger_poids() -> None:
    print("\n=== Téléchargement des poids (une seule fois, puis 100 % hors-ligne) ===")
    # Import après pip install
    sys.path.insert(0, str(RACINE))
    from pipeline.profondeur import charger_modele_profondeur
    from pipeline.plans import charger_modele_segmentation

    print("→ Depth Anything V2 Small…")
    charger_modele_profondeur(local_uniquement=False)
    print("→ SegFormer ADE20K (murs / sol)…")
    charger_modele_segmentation(local_uniquement=False)
    print("Poids enregistrés dans :", RACINE / "poids")


def main() -> None:
    print("==============================================")
    print("  Photo + meuble 3D — installation locale")
    print("==============================================")
    verifier_python()
    installer_dependances()
    telecharger_poids()
    print("\nInstallation terminée.")
    print("Lancez maintenant :  python lancer.py")
    print("ou double-cliquez sur lancer.bat (Windows).")


if __name__ == "__main__":
    try:
        main()
    except subprocess.CalledProcessError as exc:
        print("Une commande pip a échoué :", exc)
        print("Vérifiez votre connexion pour cette première installation, puis réessayez.")
        sys.exit(1)
