# Stabiliser le projet Philae (anti-écrasement VS Code)

## Source de vérité panneau

| Fichier | Rôle |
|---------|------|
| `src/1_STRUCTURE/00_matrice/matrice_panneau_grok.js` | **SEULE** logique panneau (4 fonctions + defs) |
| `src/1_STRUCTURE/00_matrice/matrice_panneau.js` | Shim : `export * from './matrice_panneau_grok.js'` |

## Quand VS Code demande « Comparer / Écraser »

1. **Toujours cliquer « Comparer »** (ou Annuler), jamais Écraser à l’aveugle.
2. Si le fichier est `matrice_panneau_grok.js` → **protéger** ta version avec `ligne_rectangle`, `makeRectangle*`, `computeQuatreRectangles`.
3. Si le fichier est `matrice_panneau.js` et qu’il a du pseudo-code `point1` → **remplacer tout le fichier** par le shim de 20 lignes (voir ci-dessous).

### Shim `matrice_panneau.js` (à coller si écrasé)

```js
export * from './matrice_panneau_grok.js'
export { default } from './matrice_panneau_grok.js'
```

## Workflow recommandé

1. Un seul éditeur à la fois : soit VS Code, soit Agent Grok — pas les deux en parallèle sur le même fichier.
2. Après un état qui marche :

```powershell
cd C:\Users\phila\philae
git add .
git commit -m "stable: panneau_grok source de verite"
```

3. Si ça casse :

```powershell
git checkout -- src/1_STRUCTURE/00_matrice/matrice_panneau_grok.js
git checkout -- src/1_STRUCTURE/00_matrice/matrice_panneau.js
```

## Vérif rapide

```powershell
cd C:\Users\phila\philae
npm run build
npm run dev
```

Console navigateur : plus d’erreur `point1 is not defined` ni `ligne_rectangle`.

## DevTools Chrome — temps de chargement « énormes »

Sur la capture Network, tu avais :

1. **Throttle = Slow 4G** → simule un réseau lent (normal d’avoir 30–45 s)
2. **Disable cache** coché → tout est re-téléchargé à chaque F5

**À faire pour du local rapide :**

- Network → throttle = **No throttling**
- Décocher **Disable cache** (sauf debug ponctuel)
- Onglet Console : s’il y a une erreur rouge, c’est un crash de code, pas la lenteur réseau

En dev sans throttle, le 1er chargement peut prendre 2–5 s (three.js) ; les suivants via HMR = quasi instantané.

## Après un commit Git

1. Ne redémarre `npm run dev` **que si** le serveur s’est arrêté.
2. Sinon : **Ctrl+F5** dans le navigateur suffit.
3. Si écran blanc : ouvre la Console (F12) et regarde l’erreur rouge (souvent un fichier écrasé / import cassé).
