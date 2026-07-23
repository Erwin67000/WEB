# Publipostage devis Word → PDF (Philae)

## Objectif

Générer automatiquement un **document Word** (puis plus tard PDF) à partir :

1. du **template** `devis.docx` (mise en page Philae) ;
2. des **données matrice** (client, meubles, prix, finitions).

---

## Architecture (déjà en place)

| Élément | Chemin |
|--------|--------|
| Template source | `src/2_BUILD/document/devis.docx` |
| Template servi au navigateur | `public/document/devis.docx` |
| Liste des champs | `src/2_BUILD/document/mergeFields.js` |
| Moteur de remplissage | `src/2_BUILD/document/fillDevisTemplate.js` |
| Régénérer le template de base | `node scripts/build-devis-template.mjs` |

**Librairie :** [docxtemplater](https://docxtemplater.com/) + PizZip  
**Syntaxe des balises :** `{nom_du_champ}` (accolades simples, **pas** les champs Word classiques « MERGEFIELD »).

> Le PDF automatique (conversion Word → PDF) n’est **pas** possible purement dans le navigateur sans service.  
> Étape actuelle : **DOCX rempli téléchargé**. PDF = étape 2 (Cloudflare Worker + LibreOffice, ou CloudConvert, ou impression PDF manuelle).

---

## Guide pas à pas — ajouter des zones de texte

### Étape 1 — Ouvrir le template

1. Ouvrez `src/2_BUILD/document/devis.docx` avec **Microsoft Word** (ou LibreOffice Writer).
2. Ne renommez pas le fichier tant que le code pointe dessus.

### Étape 2 — Placer une balise

1. Cliquez à l’endroit où la donnée doit apparaître.
2. Tapez **exactement** le nom du champ entre accolades, par exemple :

```text
{client_nom}
{quote_ref}
{meuble_dims}
{prix_ttc}
```

3. **Important :**
   - une seule balise d’un coup : `{client_nom}` OK ;
   - **ne pas** couper la balise avec des styles au milieu (`{cli` en gras + `ent_nom}` normal) — sélectionnez toute la balise et appliquez le style d’un bloc ;
   - pas d’espaces : `{ client_nom }` peut échouer → utilisez `{client_nom}`.

### Étape 3 — Champs disponibles (extrait)

| Balise | Contenu |
|--------|---------|
| `{quote_ref}` | Réf. devis PHL-… |
| `{date_devis}` | Date JJ/MM/AAAA |
| `{client_fullname}` | Prénom + Nom |
| `{client_email}` | E-mail |
| `{client_tel}` | Téléphone |
| `{client_adresse}` | Adresse |
| `{client_cp}` `{client_ville}` | CP / Ville |
| `{meuble_label}` | Libellé meuble actif |
| `{meuble_dims}` | L × P × H mm |
| `{meuble_finition}` | Brut / Vernis clair / … |
| `{meuble_panneaux}` | Liste panneaux |
| `{meuble_modules}` | Tablettes / tiroirs |
| `{epaisseur_panneau}` | mm |
| `{prix_ht}` `{prix_tva}` `{prix_ttc}` | Montants |
| `{notes}` | Notes client |

Liste complète maintenue dans `mergeFields.js` → `MERGE_FIELD_DEFS`.

### Étape 4 — Boucles (plusieurs meubles / lignes)

Pour un **tableau de lignes de prix**, le template de base utilise :

```text
{#lignes}{designation} | {detail} | {qte} | {pu} | {total}{/lignes}
```

- `{#lignes}` ouvre la boucle  
- `{/lignes}` la ferme  
- À l’intérieur : champs de **chaque ligne** (`designation`, `detail`, `qte`, `pu`, `total`)

Pour la liste des meubles :

```text
{#meubles}
• {label} — {dims} — finition {finition}
{/meubles}
```

### Étape 5 — Ajouter un **nouveau** champ (données + Word)

1. **Code** — dans `mergeFields.js`, fonction `buildMergeData` :

```js
// Exemple
mon_nouveau_champ: state.quelqueChose || '',
```

2. **Doc** — ajoutez l’entrée dans `MERGE_FIELD_DEFS` (documentation).
3. **Word** — placez `{mon_nouveau_champ}` dans le template.
4. Enregistrez `devis.docx`.
5. Copiez vers `public/document/` :

```bash
# Windows PowerShell
Copy-Item src\2_BUILD\document\devis.docx public\document\devis.docx -Force
```

ou regénérez uniquement si vous n’avez pas encore personnalisé la mise en page :

```bash
node scripts/build-devis-template.mjs
```

> ⚠️ `build-devis-template.mjs` **écrase** le template.  
> Dès que votre mise en page Word est peaufinée, **ne relancez plus** ce script : éditez seulement le `.docx` à la main et copiez-le dans `public/document/`.

### Étape 6 — Tester

1. `npm run dev`
2. Configurateur → remplir un client + dimensions
3. Bouton **Devis** → un fichier `Philae_Devis_….docx` se télécharge
4. Ouvrir le fichier : les balises doivent être remplacées par les vraies valeurs

### Étape 7 — PDF (plus tard)

Options possibles :

| Option | Avantage | Complexité |
|--------|----------|------------|
| Client imprime le DOCX en PDF | Immédiat | Aucune |
| Worker Cloudflare + LibreOffice | Auto, votre domaine | Moyen |
| API CloudConvert / Gotenberg | Simple | Coût / dépendance |
| HTML → PDF (autre template) | Full control web | Double maintenance |

On branchera une option au moment de l’activation production.

---

## Catalogue : colonne texture = finition client

Dans `matrice_catalogue.csv` :

| Colonne | Rôle |
|---------|------|
| `wood_finish` | Essence atelier (souvent `chene`) — non choisie client |
| `texture` | **Finition client** : `brut` \| `vernis_clair` \| `vernis_fonce` \| `huile` |

Source monorepo synchronisée au build :

`01_structure/08_bibliotheque/models/boutique/matrice_catalogue.csv`
