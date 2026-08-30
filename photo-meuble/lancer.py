# -*- coding: utf-8 -*-
"""
Point d’entrée unique : ouvre l’interface Gradio dans le navigateur.
Aucune ligne de commande n’est demandée à l’utilisateur ensuite.
"""
from __future__ import annotations

import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parent
sys.path.insert(0, str(RACINE))


def main() -> None:
    from app import lancer_interface

    print("Ouverture de l’interface sur http://127.0.0.1:7860 …")
    lancer_interface()


if __name__ == "__main__":
    main()
