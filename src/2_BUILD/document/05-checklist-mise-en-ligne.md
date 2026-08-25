# Checklist mise en ligne — boutique PHILAE

Document interne. À cocher avant d’ouvrir le paiement. Date de passage : __________

## A. Pages et pied de page

Quatre liens **permanents**, visibles sans compte, sur **toutes** les pages (y compris checkout et configurateur) :

- [x] Mentions légales
- [x] CGV
- [x] Politique de confidentialité
- [x] Politique cookies

Également :

- [ ] E-mail de contact réel dans le pied de page : contact@philae.design
- [ ] Pas de SIREN / SIRET de l’EI 947 729 182
- [ ] SASU ATELIER PHILAE, 28 rue Kuhn, 67000 Strasbourg, SIRET 105 007 066 00019
- [ ] Pages accessibles en français (version EN : traduction fidèle, pas un stub qui contredit les CGV FR)

## B. Mentions légales

- [x] Capital social 1 000 € (RCS) — recouper Kbis
- [ ] TVA FR33 105 007 066 vérifiée **VIES**
- [x] Pas de téléphone publié (e-mail seul)
- [ ] Hébergeur : Cloudflare, Inc., 101 Townsend St, San Francisco, CA 94107 — [[CONFIRMER_ENTITE_HEBERGEUR]] (Inc. vs France SAS)
- [x] Téléphone Cloudflare +1 (650) 319-8930
- [ ] Président / DDP : Romain FLEURY
- [ ] Crédits 3D / photos / polices

## C. Checkout

- [x] Case **obligatoire** : « J’accepte les CGV » + lien cliquable vers les CGV
- [x] Stripe **activé** (`STRIPE_ENABLED = true`) — mode test tant que les clés `sk_test_` / `pk_test_` sont utilisées
- [ ] **Avertissement rétractation**, lisible **avant** le paiement, distinct ou clairement inclus :
  - modèle **catalogue non personnalisé** : droit de 14 jours à réception ;
  - pièce **configurée / à mes specs** : pas de droit légal de rétractation **une fois la fabrication commencée** (art. L. 221-28 3°) ;
  - geste commercial **48 h** tant que l’atelier n’a pas lancé la production
- [ ] Le configurateur et le SKU catalogue ne doivent pas partager le même texte d’exclusion si le panier est un SKU non modifié
- [ ] Recap : prix TTC, **dont éco-participation**, livraison (ou « chiffrée à part / devis »), délai confirmé ou plage
- [ ] Prix boutique amont restés **indicatifs hors livraison**, cohérents avec les CGV
- [ ] E-mail de confirmation : même information + formulaire / lien rétractation **uniquement** si 9.2 s’applique

## D. Formulaire 14 jours

- [ ] Annexe A des CGV publiée ou formulaire dédié (page ou PDF)
- [ ] Adresse de retour / consigne meuble volumineux expliquée (frais de retour à la charge du client **hors** garanties légales)
- [ ] Process interne : qui reçoit l’e-mail, délai de remboursement 14 jours, pas de « restockage » punitif

## E. Éco-participation

- [x] Adhésion **Ecomaison** (DEA) — éco-participation **uniquement si livraison en France**
- [ ] Porter l’**identifiant unique (IDU)** exact sur la facture (à coller dès réception)
- [ ] Affichage sur **chaque** fiche produit : prix TTC **dont éco-participation X,XX €**
- [ ] Idem panier, checkout, facture
- [ ] Luminaires : vérifier si une autre filière (DEA / éco-organisme éclairage) s’ajoute

## F. Cookies et polices

- [ ] Décision : **auto-héberger Oswald et Stardos** (recommandé) **ou** assumer Google Fonts dans la politique
- [ ] Après auto-hébergement : vérifier l’onglet Réseau (plus d’appel `googleapis` / `gstatic`)
- [ ] Si seulement nécessaires + langue : pas de bandeau
- [x] **Plausible** (`philae.design`) : pages vues sans cookie ; newsletter via **bouton facultatif** (pas requis pour payer)
- [ ] Si pixel pub ajouté : bandeau CNIL **avant** dépôt, refus aussi visible qu’acceptation
- [ ] Ne pas écrire « nous n’utilisons aucun cookie » (Cloudflare + langue)

## G. Paiement, facture, atelier

- [ ] Stripe au nom de **ATELIER PHILAE** SASU (pas l’EI)
- [ ] Mentions facture : dénomination, SIRET, TVA, siège, n° facture, date, éco-part, CGV
- [x] Délai **6 à 8 semaines** aligné CGV / boutique / fiche produit ; le ferme est celui de la confirmation
- [ ] Kit : notice de montage jointe (quelques minutes, sans colle/vis/clous)
- [ ] Transporteur nommé ; zone France métropolitaine, UE sur devis
- [ ] Process 48 h « pas encore en production » : qui coupe la mise en fabrication

## H. RGPD et médiation

- [ ] contact@philae.design = boîte lue (peut = contact)
- [ ] Mini registre des traitements (même un tableur)
- [ ] DPA Cloudflare + prestataire de paiement
- [x] **CM2C** : coordonnées et lien de saisine dans les CGV et mentions légales
- [ ] Lien ODR https://ec.europa.eu/consumers/odr dans les CGV

## I. Pièges

- [ ] Aucun 1 000 € de capital publié sans Kbis
- [ ] Aucun téléphone d’annuaire non vérifié
- [ ] Aucune « garantie 10 ans » ou « satisfait ou remboursé 30 jours » inventée
- [ ] Exception L. 221-28 3° **non** collée sur les SKU non personnalisés
- [ ] Vendeur = SASU, jamais EI 947 729 182

Quand toutes les cases critiques (A, C, E, I, médiateur) sont cochées : publication des pages 01–04.
