# Bibliothèque Philae

## Boutique — éditer le CSV

Source unique : **`modele_boutique.csv`** (vrai CSV UTF-8, virgules).

Pas le `.xlsx`. Ouvre le CSV dans VS Code avec **Rainbow CSV** (colonnes colorées).

En-têtes utiles : `Boutique` (O = visible), `socle` (O = panneau dessous), `Pied` (`petit` | `moyen` | `grand`).

Après une modification de géométrie (L/P/H, panneaux, modules, pieds) :

```
npm run boutique
```

Puis recharger `/boutique` (Ctrl+F5). En `npm run dev`, les cellules texte (noms, descriptions, Pied…) sont lues directement depuis ce CSV.

Dossiers prévus :

- `modele_document/` — facture vierge, logo, plan 2D
- `scenes/` — environnements GLB (chambre, salon…)
- `texture/` — textures bois

Les scènes procédurales (chambre / salon) sont générées dans le configurateur 3D tant que les GLB ne sont pas fournis.
