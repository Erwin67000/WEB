# Tester le parcours premier client (local)

Deux terminaux :

```bash
npm run dev
npm run dev:api
```

Puis `http://localhost:3102`.

## 1. Google (2 minutes)

1. [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → créer un projet → **ID client OAuth** → type **Application Web**.
2. Origines JavaScript autorisées :
   - `http://localhost:3102`
3. URI de redirection autorisés :
   - `http://localhost:3102/api/auth/callback/google`
4. Écran de consentement : externe, ton e-mail en utilisateur de test.
5. Dans `.dev.vars` (jamais committer) :

```
GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxx
```

6. Relancer `npm run dev:api`.

## Live (philae.design) — pas `.dev.vars`

`.dev.vars` ne sert **qu’en local**. En production :

```bash
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put SITE_URL
```

`SITE_URL` = `https://www.philae.design`

Mêmes origines / redirects Google, plus :

- `https://www.philae.design`
- `https://philae.design`
- `https://www.philae.design/api/auth/callback/google`
- `https://philae.design/api/auth/callback/google`

Pas besoin de redéployer le code après un `secret put` : le Worker relit les secrets.

## 2. E-mails réels (optionnel)

Stripe en **mode test** envoie déjà un reçu si `receipt_email` est renseigné (ton e-mail).

Pour les e-mails PHILAE (lien magique + confirmation atelier) : compte [Resend](https://resend.com), clé dans `.dev.vars` :

```
RESEND_API_KEY=re_xxxxx
MAIL_FROM=PHILAE <noreply@philae.design>
```

Sans Resend, le lien magique s’affiche sur la page (lien de test).

## 3. Scénario

1. Configurateur → compose le meuble → **Acheter**.
2. `/commande` : **Continuer avec Google** (ou invité / lien e-mail).
3. Première fois : cocher les CGV.
4. Adresse : Chrome / Edge proposent tes adresses enregistrées (saisie automatique).
5. **Payer** → Stripe Checkout.
6. Carte test : `4242 4242 4242 4242`, date future, CVC 123.
7. Page succès + reçu Stripe (et e-mail PHILAE si Resend).
8. Menu **Compte** : commande + « Reprendre ce meuble ».

## 4. Webhook local (confirmation D1 « paid »)

```bash
stripe listen --forward-to localhost:8787/api/webhooks/stripe
```

Coller le `whsec_…` dans `.dev.vars` (`STRIPE_WEBHOOK_SECRET`). Sinon la page succès déclenche quand même l’e-mail de confirmation.
