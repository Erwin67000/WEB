# Philae WEB — site + configurateur (V5)

Version unifiée visible en local sur **http://localhost:3102/**  
Prête pour GitHub → Cloudflare.

## Local

```bash
npm install
npm run dev
```

→ **http://localhost:3102/**

```bash
npm run build
npm run preview
```

## Contenu

| Zone | Rôle |
|------|------|
| `src/pages` | Accueil, Boutique, Article, Concept, Contact, Configurateur |
| `src/store` | Main + session boutique (Zustand) |
| `src/1_STRUCTURE` | Matrices, ossature, panneaux, `matrice_catalogue` |
| `src/2_BUILD` | Scène 3D |
| `public/structure/.../matrice_catalogue.csv` | Gamme boutique (prod) |
| `wrangler.toml` | Déploiement Cloudflare Workers (assets = `dist/`) |

## Cloudflare (nouveau projet `WEB`)

### Option A — Pages (recommandé, simple)

**Push GitHub ≠ mise en ligne.** Le Worker `philaedesign2` se déploie par `npm run deploy` (local) ou par GitHub Actions (`.github/workflows/deploy.yml`).

Secrets GitHub à créer une fois (Settings du repo → Secrets → Actions) :

- `CLOUDFLARE_API_TOKEN` — [Créer un jeton](https://dash.cloudflare.com/profile/api-tokens) (modèle « Edit Cloudflare Workers »)
- `CLOUDFLARE_ACCOUNT_ID` — `587779ab28b7fbf3b38a730c732a7b56`

Ensuite chaque push sur `main` met à jour philae.design. En attendant : `npm run deploy` depuis ce dossier.

1. Cloudflare → **Workers & Pages** → **Create** → **Pages** → Connect GitHub  
2. Repo : **`Erwin67000/WEB`**  
3. Settings :
   - **Build command :** `npm run build`
   - **Build output directory :** `dist`
   - **Root directory :** `/`
   - Node : 20  
4. Deploy  
5. **Custom domains** → ajouter `philae.design` et `www.philae.design`  
   (retirer d’abord le domaine de l’ancien projet `philaedesign2` si besoin)

### Option B — Workers + assets (comme l’ancien setup)

1. Create Worker / connect Git  
2. Build command : `npm install && npm run build`  
3. Deploy command : **`npx wrangler deploy`**  
   (pas seulement `versions upload` — sinon la version n’est pas en production)  
4. Vérifier `wrangler.toml` : `name` = nom du projet Cloudflare, `assets.directory = "./dist"`

### Important

- L’ancien monorepo servait `04_build/site/dist` (V3).  
- Ce repo sert **`./dist`** à la racine (V5 = localhost:3102).  
- Après deploy : **Purge cache** Cloudflare + test en navigation privée.

## Domaine philae.design

1. Sur l’**ancien** projet `philaedesign2` : retirer custom domains `philae.design` / `www`  
2. Sur le **nouveau** projet `WEB` : Custom domains → Add `philae.design`  
3. DNS déjà chez Cloudflare → validation automatique  
