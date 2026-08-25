# Politique cookies et traceurs

Dernière mise à jour : 25 août 2026.

Cette page complète la [politique de confidentialité](/confidentialite). Elle décrit les cookies et traceurs du site **https://www.philae.design/**, édité par **ATELIER PHILAE**.

## 1. Position actuelle du Site

Le Site utilise, de son fait :

- ce qui est **nécessaire au fonctionnement** et à la **mémorisation de la langue** (FR / EN) ;
- une **mesure d’audience** **Plausible** (sans cookie, sans identifiant publicitaire) ;
- éventuellement, si le visiteur clique le **bouton facultatif** du parcours d’achat : événements enrichis Plausible + inscription newsletter.

Aucun bandeau publicitaire n’est affiché. Le bouton d’opt-in **n’est pas requis** pour commander. Refuser ou ne pas cliquer est aussi simple qu’accepter.

**Google Fonts.** Le Site charge Oswald et Stardos Stencil depuis Google. Ce n’est pas un cookie posé par ATELIER PHILAE, mais un appel à un **tiers** qui reçoit l’adresse IP. Recommandation interne : auto-héberger ces polices.

Stripe n’est **pas encore activé** : aucun cookie de paiement n’est déposé par le Site tant que le checkout n’est pas ouvert.

## 2. Qu’est-ce qu’un cookie / un traceur

Un cookie est un petit fichier déposé sur le terminal. Sont assimilés : stockage local (`localStorage`), pixels, identifiants. Hors exceptions, un **consentement préalable** est requis (art. 82 de la loi Informatique et Libertés).

**Exemptés** : les traceurs **strictement nécessaires** à fournir un service expressément demandé (langue, session, sécurité).

## 3. Traceurs utilisés

### 3.1. Strictement nécessaires (pas de consentement)

| Nom / type | Finalité | Durée indicative | Éditeur |
|---|---|---|---|
| Session / protection CDN | Routage, sécurité (Cloudflare) | Session à quelques semaines | Cloudflare, Inc. |
| Préférence de langue (`philae-lang`) | Se souvenir du choix FR / EN | Jusqu’à 12 mois | ATELIER PHILAE |
| Couleur panneau boutique | Mémoriser le choix de couleur | Local | ATELIER PHILAE |
| Configuration locale | Garder le kit configuré | Session / local | ATELIER PHILAE |
| `philae-consent-extras` | Mémoriser l’opt-in facultatif (newsletter + événements enrichis) | Jusqu’au retrait | ATELIER PHILAE |

### 3.2. Mesure d’audience : Plausible

| Appel | Finalité | Consentement | Éditeur |
|---|---|---|---|
| Pages vues (script Plausible, **sans cookie**) | Statistique d’audience agrégée | Non requis (mesure exemptée / intérêt légitime) | Plausible Insights OÜ |
| Événements enrichis (tagged events) | Comprendre le parcours (fiche produit, intention d’achat, etc.) | **Oui** — bouton facultatif, non requis pour payer | Plausible Insights OÜ |

Le script est chargé depuis `plausible.io` (`data-domain="philae.design"`). Aucun cookie publicitaire n’est déposé. Voir [plausible.io/privacy](https://plausible.io/privacy).

### 3.3. Tiers actuellement chargé : Google Fonts

| Appel | Finalité | Éditeur |
|---|---|---|
| Polices Google | Affichage typographique | Google Ireland / Google LLC |

### 3.4. Non déployé à ce jour

Pas de Google Analytics, pas de Meta Pixel, pas de tag manager publicitaire. **Stripe** : cookies de paiement uniquement **lorsque** le checkout sera activé ; cette page sera alors mise à jour.

## 4. Bandeau de consentement

- Nécessaires + langue + Plausible pages vues (sans cookie) : pas de bandeau publicitaire obligatoire.
- Newsletter et événements enrichis : **bouton d’opt-in** sur la fiche produit et le configurateur, distinct de la case CGV, **non requis** pour commander. Un second clic retire le consentement.

## 5. Comment limiter

Changer la langue sur le Site. Recliquer le bouton d’opt-in pour le désactiver, ou effacer le stockage local du navigateur pour philae.design (clés `philae-lang` et `philae-consent-extras`). Bloquer les cookies tiers peut dégrader l’affichage des polices. Un bloqueur de scripts peut empêcher Plausible de mesurer les visites.

## 6. Contact

contact@philae.design — CNIL : https://www.cnil.fr
