# -*- coding: utf-8 -*-
"""
Interface Gradio — une photo, un modèle 3D, des curseurs, un rendu en direct.
Point d’entrée recommandé : python lancer.py
"""
from __future__ import annotations

from pathlib import Path

import gradio as gr
import numpy as np
from PIL import Image

from pipeline.config import (
    DOSSIER_CONFIGS,
    charger_configuration,
    charger_valeurs_figees_si_presentes,
    exporter_valeurs_figees,
    fusionner_avec_defauts,
    garantir_dossiers,
    sauvegarder_configuration,
)
from pipeline.etat import (
    appliquer_clic,
    charger_mesh_dans_etat,
    nouvel_etat,
    reconstruire_scene,
    rendre_etat,
)

# Mémoire de la session (une pièce + un meuble à la fois)
SESSION = {
    "etat": nouvel_etat(),
    "reglages": charger_valeurs_figees_si_presentes(),
}


def _photo_vers_numpy(photo) -> np.ndarray | None:
    if photo is None:
        return None
    if isinstance(photo, np.ndarray):
        if photo.dtype != np.uint8:
            photo = np.clip(photo, 0, 255).astype(np.uint8)
        if photo.ndim == 2:
            photo = np.stack([photo] * 3, axis=-1)
        return photo[:, :, :3]
    image = Image.fromarray(photo).convert("RGB")
    return np.asarray(image)


def _lire_sliders(
    glisser, decalage, rotation, hauteur, echelle,
    ombre, reflets, eclairage, teinte,
    res_prof, qualite_3d,
) -> dict:
    r = fusionner_avec_defauts(SESSION["reglages"])
    r["placement"]["glisser_le_long_du_mur"] = float(glisser)
    r["placement"]["decalage_lateral_m"] = float(decalage)
    r["placement"]["rotation_verticale_deg"] = float(rotation)
    r["placement"]["hauteur_au_dessus_du_sol_m"] = float(hauteur)
    r["echelle"]["facteur"] = float(echelle)
    r["rendu"]["intensite_ombre"] = float(ombre)
    r["rendu"]["intensite_reflets"] = float(reflets)
    r["rendu"]["force_eclairage"] = float(eclairage)
    r["rendu"]["teinte_ambiant"] = float(teinte)
    r["qualite"]["resolution_profondeur"] = int(res_prof)
    r["qualite"]["qualite_modele_3d"] = str(qualite_3d)
    SESSION["reglages"] = r
    return r


def _essayer_reconstruction(photo_np, resolution, message_accueil=None):
    """Tente en local_files_only, puis télécharge si le cache est vide (1er lancement)."""
    try:
        return reconstruire_scene(SESSION["etat"], photo_np, resolution, local_uniquement=True)
    except OSError:
        SESSION["etat"]["message"] = "Premier lancement : téléchargement des poids (une seule fois)…"
        return reconstruire_scene(SESSION["etat"], photo_np, resolution, local_uniquement=False)


def importer_photo(photo, res_prof):
    photo_np = _photo_vers_numpy(photo)
    if photo_np is None:
        return None, SESSION["etat"]["message"]
    SESSION["etat"] = _essayer_reconstruction(photo_np, int(res_prof))
    rendu = rendre_etat(SESSION["etat"], SESSION["reglages"])
    return rendu, SESSION["etat"]["message"]


def importer_modele(fichier, qualite_3d):
    if fichier is None:
        return None, SESSION["etat"]["message"]
    chemin = fichier.name if hasattr(fichier, "name") else str(fichier)
    try:
        SESSION["etat"] = charger_mesh_dans_etat(SESSION["etat"], chemin, str(qualite_3d))
    except Exception as exc:
        SESSION["etat"]["message"] = f"Impossible de lire le modèle 3D : {exc}"
        return SESSION["etat"].get("photo"), SESSION["etat"]["message"]
    rendu = rendre_etat(SESSION["etat"], SESSION["reglages"])
    return rendu, SESSION["etat"]["message"]


def mettre_a_jour(
    glisser, decalage, rotation, hauteur, echelle,
    ombre, reflets, eclairage, teinte,
    res_prof, qualite_3d,
):
    reglages = _lire_sliders(
        glisser, decalage, rotation, hauteur, echelle,
        ombre, reflets, eclairage, teinte,
        res_prof, qualite_3d,
    )
    rendu = rendre_etat(SESSION["etat"], reglages)
    return rendu, SESSION["etat"]["message"]


def recalculer_echelle(photo, res_prof):
    """Relance uniquement profondeur + plans + nouvelle proposition d’échelle (facteur = 1)."""
    photo_np = _photo_vers_numpy(photo)
    if photo_np is None:
        return None, "Importez d’abord une photo.", 1.0
    SESSION["etat"] = _essayer_reconstruction(photo_np, int(res_prof))
    SESSION["reglages"]["echelle"]["facteur"] = 1.0
    rendu = rendre_etat(SESSION["etat"], SESSION["reglages"])
    return rendu, SESSION["etat"]["message"] + " Échelle réinitialisée à 1.0 (proposition auto).", 1.0


def clic_sur_rendu(evt: gr.SelectData, *curseurs):
    """Glisser-déposer : un clic pose le meuble le long du mur, sous le curseur."""
    if evt is None or getattr(evt, "index", None) is None:
        rendu, message = mettre_a_jour(*curseurs)
        return rendu, message, curseurs[0]
    try:
        u, v = int(evt.index[0]), int(evt.index[1])
    except Exception:
        rendu, message = mettre_a_jour(*curseurs)
        return rendu, message, curseurs[0]
    SESSION["reglages"] = appliquer_clic(SESSION["etat"], SESSION["reglages"], u, v)
    glisser = SESSION["reglages"]["placement"]["glisser_le_long_du_mur"]
    liste = list(curseurs)
    liste[0] = glisser
    rendu, message = mettre_a_jour(*liste)
    return rendu, message, glisser


def sauvegarder(nom_fichier, *curseurs):
    _lire_sliders(*curseurs)
    garantir_dossiers()
    nom = (nom_fichier or "").strip() or "ma-config"
    chemin = sauvegarder_configuration(nom, SESSION["reglages"], extra={"message": SESSION["etat"]["message"]})
    return f"Configuration enregistrée : {chemin}"


def charger(fichier_json, *curseurs):
    if fichier_json is None:
        return (*_sorties_curseurs(SESSION["reglages"]), SESSION["etat"].get("photo"), "Choisissez un fichier JSON.")
    chemin = fichier_json.name if hasattr(fichier_json, "name") else str(fichier_json)
    SESSION["reglages"] = charger_configuration(chemin)
    r = SESSION["reglages"]
    rendu = rendre_etat(SESSION["etat"], r)
    msg = f"Configuration chargée depuis {Path(chemin).name}."
    return (*_sorties_curseurs(r), rendu, msg)


def exporter(*curseurs):
    _lire_sliders(*curseurs)
    chemin = exporter_valeurs_figees(SESSION["reglages"])
    return f"Valeurs figées écrites dans {chemin}. Elles serviront de défaut au prochain lancement."


def _sorties_curseurs(r: dict) -> tuple:
    p, e, rd, q = r["placement"], r["echelle"], r["rendu"], r["qualite"]
    return (
        p["glisser_le_long_du_mur"],
        p["decalage_lateral_m"],
        p["rotation_verticale_deg"],
        p["hauteur_au_dessus_du_sol_m"],
        e["facteur"],
        rd["intensite_ombre"],
        rd["intensite_reflets"],
        rd["force_eclairage"],
        rd["teinte_ambiant"],
        int(q["resolution_profondeur"]),
        q["qualite_modele_3d"],
    )


def construire_interface() -> gr.Blocks:
    garantir_dossiers()
    d = SESSION["reglages"]
    p, e, rd, q = d["placement"], d["echelle"], d["rendu"], d["qualite"]

    with gr.Blocks(title="Photo + meuble 3D") as demo:
        gr.Markdown(
            """
# Photo + meuble 3D (local)
1. Importez **une photo de pièce**.  
2. Importez **un meuble OBJ ou STL**.  
3. Cliquez dans l’image pour glisser le meuble le long du mur, ou utilisez les curseurs.  
Tout se passe sur votre ordinateur, sans internet après le premier téléchargement des poids.
            """
        )
        with gr.Row():
            with gr.Column(scale=1):
                photo_in = gr.Image(label="Photo de la pièce", type="numpy")
                modele_in = gr.File(label="Modèle 3D (OBJ ou STL)", file_types=[".obj", ".stl", ".ply"])
                message = gr.Markdown(SESSION["etat"]["message"])
                nom_config = gr.Textbox(label="Nom de la configuration", value="ma-config")
                with gr.Row():
                    btn_sauver = gr.Button("Sauvegarder la configuration")
                    btn_exporter = gr.Button("Exporter les valeurs figées")
                json_in = gr.File(label="Charger une configuration (JSON)", file_types=[".json"])
                statut_config = gr.Markdown("")
            with gr.Column(scale=2):
                apercu = gr.Image(label="Rendu (cliquez pour glisser le meuble)", type="numpy")

        with gr.Accordion("Placement", open=True):
            glisser = gr.Slider(0, 1, value=p["glisser_le_long_du_mur"], step=0.01, label="Glisser le long du mur")
            decalage = gr.Slider(-0.4, 1.5, value=p["decalage_lateral_m"], step=0.01, label="Éloignement du mur (m)")
            rotation = gr.Slider(-180, 180, value=p["rotation_verticale_deg"], step=1, label="Rotation verticale (°)")
            hauteur = gr.Slider(0, 0.6, value=p["hauteur_au_dessus_du_sol_m"], step=0.01, label="Hauteur au-dessus du sol (m)")
        with gr.Accordion("Échelle", open=True):
            echelle = gr.Slider(0.3, 2.5, value=e["facteur"], step=0.01, label="Redimensionner (1 = auto)")
            btn_recalc = gr.Button("Recalculer l’échelle")
        with gr.Accordion("Rendu", open=False):
            ombre = gr.Slider(0, 1, value=rd["intensite_ombre"], step=0.01, label="Intensité de l’ombre portée")
            reflets = gr.Slider(0, 1, value=rd["intensite_reflets"], step=0.01, label="Intensité des reflets")
            eclairage = gr.Slider(0.2, 2.0, value=rd["force_eclairage"], step=0.01, label="Force de l’éclairage")
            teinte = gr.Slider(0, 1, value=rd["teinte_ambiant"], step=0.01, label="Teinte de l’éclairage ambiant (froid → chaud)")
        with gr.Accordion("Qualité", open=False):
            res_prof = gr.Slider(256, 768, value=int(q["resolution_profondeur"]), step=64, label="Résolution de la carte de profondeur")
            qualite_3d = gr.Radio(["basse", "normale", "haute"], value=q["qualite_modele_3d"], label="Qualité du rendu 3D")

        curseurs = [
            glisser, decalage, rotation, hauteur, echelle,
            ombre, reflets, eclairage, teinte,
            res_prof, qualite_3d,
        ]

        photo_in.upload(importer_photo, [photo_in, res_prof], [apercu, message])
        modele_in.upload(importer_modele, [modele_in, qualite_3d], [apercu, message])
        for widget in curseurs:
            widget.change(mettre_a_jour, curseurs, [apercu, message])
        apercu.select(clic_sur_rendu, curseurs, [apercu, message, glisser])
        btn_recalc.click(recalculer_echelle, [photo_in, res_prof], [apercu, message, echelle])
        btn_sauver.click(sauvegarder, [nom_config] + curseurs, statut_config)
        json_in.upload(charger, [json_in] + curseurs, curseurs + [apercu, message])
        btn_exporter.click(exporter, curseurs, statut_config)

    return demo


def lancer_interface() -> None:
    garantir_dossiers()
    demo = construire_interface()
    demo.queue().launch(server_name="127.0.0.1", server_port=7860, inbrowser=True, show_error=True)


if __name__ == "__main__":
    lancer_interface()
