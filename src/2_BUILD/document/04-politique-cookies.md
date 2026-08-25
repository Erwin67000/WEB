# Politique cookies et traceurs

*Brouillon opérationnel à faire relire par Romain ; ne se substitue pas à un conseil d’avocat.*

Dernière mise à jour : 24 août 2026.

Cette page complète la [politique de confidentialité](/politique-confidentialite). Elle décrit les cookies et traceurs du site **https://www.philae.design/**, édité par **ATELIER PHILAE**.

## 1. Position actuelle du Site

Le Site déclare n’utiliser que ce qui est **nécessaire au fonctionnement** et à la **mémorisation de la langue** (FR / EN).

Aucun bandeau de consentement n’est affiché sur le shell de l’application. Cette pratique n’est tenable **que si** :

- aucun traceur publicitaire, de mesure d’audience non exemptée, ni pixel social n’est chargé ;
- les cookies restants sont **strictement nécessaires** au service demandé par l’utilisateur (CNIL : exemption).

**Point d’attention — Google Fonts.** Le Site charge les polices **Oswald** et **Stardos** depuis Google (`fonts.googleapis.com` / `fonts.gstatic.com`). Ce n’est **pas** un cookie posé par ATELIER PHILAE, mais un appel à un **tiers** qui reçoit l’adresse IP. Selon le comportement réel de Google (cookie, identifiant, transfert hors UE), cela **dépasse** le discours « uniquement des cookies nécessaires ».

**Recommandation :** auto-héberger Oswald et Stardos (fichiers servis depuis le domaine philae.design ou le CDN sans appel à Google). Cela permet, en l’absence d’analytics, de **se passer d’un bandeau de consentement**. Tant que Google Fonts est chargé depuis Google, ne pas écrire que « aucun tiers n’est contacté ».

Prestataires éventuellement concernés : Google Fonts (Oswald, Stardos Stencil), chargées depuis fonts.googleapis.com (constat : Google Fonts uniquement ; ne pas inventer GA ou Meta).

## 2. Qu’est-ce qu’un cookie / un traceur

Un cookie est un petit fichier déposé sur le terminal. Sont assimilés : stockage local (`localStorage`), pixels, identifiants publicitaires, certains SDK. La lecture ou l’écriture d’informations dans le terminal suppose en France, hors exceptions, un **consentement préalable** (art. 82 de la loi Informatique et Libertés).

**Exemptés** (pas de bandeau) : les traceurs **strictement nécessaires** à fournir un service de communication en ligne expressément demandé, ou à la conservation du panier / de la session / de la langue si c’est le service demandé.

## 3. Traceurs utilisés ou prévus

### 3.1. Strictement nécessaires (pas de consentement)

| Nom / type | Finalité | Durée indicative | Éditeur |
|---|---|---|---|
| Session / protection CDN | Routage, sécurité, mitigation d’abus (Cloudflare peut poser un cookie technique, ex. pendant un défi de sécurité) | Session à quelques semaines selon incident | Cloudflare, Inc. |
| Préférence de langue | Se souvenir du choix FR / EN | Session ou 6 à 12 mois | ATELIER PHILAE |
| Panier / configuration locale (si applicable) | Garder le kit configuré avant paiement | Session ou quelques jours | ATELIER PHILAE |
| Cookie du prestataire de paiement au checkout | Encaissement, 3-D Secure | Selon Stripe | Prestataire de paiement |

Ces traceurs ne servent pas à de la publicité.

### 3.2. Tiers actuellement chargé sans bandeau : Google Fonts

| Appel | Finalité affichée | Risque | Éditeur |
|---|---|---|---|
| Feuilles et fichiers de polices Google | Affichage typographique | IP transmise à Google ; possible cookie Google ; transfert hors UE | Google Ireland / Google LLC |

**Tant que cet appel existe**, ATELIER PHILAE :

- l’assume dans cette politique ;
- recommande l’**auto-hébergement** pour revenir à un socle « nécessaires + langue » ;
- n’active pas d’autre mesure d’audience sans mettre à jour cette page **et** un bandeau conforme (refuser aussi simple qu’accepter, pas de traceurs non essentiels avant choix).

### 3.3. Ce qui n’est pas déployé (à ce jour)

Pas de Google Analytics, pas de Meta Pixel, pas de tag manager publicitaire, pas de reciblage — **sauf ajout ultérieur** expressément listé ici.

## 4. Bandeau de consentement

- **Si** uniquement nécessaires + langue **et** polices auto-hébergées : pas de bandeau obligatoire.
- **Si** Google Fonts reste en l’état : juger, après un test (onglet Réseau / cookies), si Google dépose un cookie. En cas de doute, auto-héberger plutôt que d’ajouter un bandeau pour des polices.
- **Si** un outil d’analytics ou de pub est ajouté : bandeau **avant** dépôt, bouton refuser, conservation du choix, registre de consentement.

## 5. Comment retirer ou limiter

- Préférence de langue : changer la langue sur le Site, ou effacer les cookies / le stockage local du navigateur pour philae.design.
- Navigateur : paramétrer le blocage des cookies tiers (utile contre Google Fonts si les polices ne sont pas encore auto-hébergées ; le rendu typographique peut alors se dégrader).
- Cloudflare / sécurité : un cookie technique peut réapparaître pour protéger le Site ; le bloquer peut empêcher l’accès.
- Checkout : bloquer les cookies du prestataire de paiement peut empêcher de payer.

## 6. Contact

Questions : contact@philae.design ou contact@philae.design.

CNIL : https://www.cnil.fr — cookies et autres traceurs.

