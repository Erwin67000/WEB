# Stripe Checkout — Philae (paiement ponctuel)

Implémentation alignée sur le blueprint Stripe  
**« Acceptez un paiement ponctuel par le biais de Checkout »**.

## Séquence API (source de vérité)

| Étape domaine | API Stripe | Module Worker |
|---|---|---|
| **createProduct** | `POST /v1/products` + `default_price_data` | `worker/createProduct.js` |
| **createCheckoutSession** | `POST /v1/checkout/sessions` `mode=payment` + `line_items[{price, quantity}]` | `worker/createCheckoutSession.js` |
| **completeCheckout** | client ouvre `session.url` | front `requestAcheter` / fiche boutique |
| **handleCheckoutCompleted** | webhook `checkout.session.completed` | `worker/handleCheckoutCompleted.js` |

Les identifiants Stripe (`stripe_product_id`, `stripe_price_id`, `stripe_session_id`, `stripe_customer_id`, `stripe_payment_intent`) sont **persistés en D1** et liés à la commande Philae (`orders.id`, `quote_ref`, config meuble).

```
[Configurateur / Boutique]
        │  POST /api/checkout  (ou /api/create-checkout-session)
        ▼
[Worker]
  1. createProductWithDefaultPrice  → product + default_price
  2. createCheckoutSession(price)   → session.url
  3. INSERT/UPDATE orders (pending)
        │
        ▼
  Client paie sur Stripe Checkout
        │
        ▼  webhook checkout.session.completed
  handleCheckoutSessionCompleted → orders.status = paid
        │
        ▼
  /commande/succes
```

## Variables d’environnement

**Ne jamais committer les clés.** Les obtenir dans le [Dashboard Stripe → Clés API](https://dashboard.stripe.com/apikeys).

### Local (`.dev.vars` — copier depuis `.dev.vars.example`)

```bash
STRIPE_SECRET_KEY=sk_test_...          # obligatoire (Worker)
STRIPE_PUBLISHABLE_KEY=pk_test_...     # optionnel (Checkout redirect n’en a pas besoin)
STRIPE_WEBHOOK_SECRET=whsec_...        # recommandé même en local
SITE_URL=http://localhost:3102
```

### Production (Wrangler secrets)

```bash
npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler secret put STRIPE_WEBHOOK_SECRET
npx wrangler secret put SITE_URL
# valeur SITE_URL = https://votre-domaine
```

Front Vite (optionnel) : `.env` / `.env.local`

```bash
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

## Base D1 (plus tard — désactivée par défaut)

Le binding D1 est **commenté** dans `wrangler.toml` tant que Stripe n’est pas activé
(sinon le deploy échoue sur un `database_id` placeholder).

```bash
npx wrangler d1 create philae-orders
# coller database_id dans wrangler.toml + décommenter [[d1_databases]]

npm run db:init:local
npm run db:init:remote
```

Colonnes Stripe notables : `stripe_product_id`, `stripe_price_id`, `stripe_session_id`, `stripe_customer_id`, `stripe_payment_intent`.

## Webhook

1. Dashboard → **Développeurs → Webhooks → Ajouter**
2. URL : `https://VOTRE_DOMAINE/api/webhooks/stripe`
3. Événement : **`checkout.session.completed`** (snapshot)
4. Secret → `STRIPE_WEBHOOK_SECRET`

Local (Stripe CLI) :

```bash
stripe listen --forward-to localhost:8787/api/webhooks/stripe
# coller whsec_… dans .dev.vars
```

## Dev

```bash
# Terminal A
npm run dev:api

# Terminal B
npm run dev
```

Santé : `GET http://localhost:8787/api/health`

## Routes

| Méthode | Chemin | Action |
|---|---|---|
| POST | `/api/checkout` | produit + session (alias Philae) |
| POST | `/api/create-checkout-session` | même handler (nom blueprint) |
| POST | `/api/webhooks/stripe` | `checkout.session.completed` |
| GET | `/api/orders/:id` | statut commande |
| GET | `/api/health` | config (sans secrets) |

## Montants & TVA

- Calcul Philae : HT, TVA 20 %, TTC
- Produit Stripe : `unit_amount` = centimes **TTC** (`tax_behavior: inclusive`)
- Acompte (plus tard) : `paymentMode: "deposit"` + `depositPercent`

## Qonto

Stripe → Paramètres → compte bancaire = IBAN **Qonto** (payouts automatiques).

## Sécurité

- Clé secrète **uniquement** côté Worker
- Commencer en **mode test** (`sk_test_…`, carte `4242…`)
- Compte Stripe **dédié** (pas un compte géré uniquement WordPress.com) pour l’API custom
