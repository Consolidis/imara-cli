PLAN D'EXECUTION — TRACK 007
Support Multi-Modèles & Swapping Dynamique

PHASE 1 — ABSTRACTION ET TRANSFERT DU MODÈLE SUR LA CLI
- [x] 1.1 Modifier mapModel() dans src/api/imara-client.ts pour permettre aux modèles non-natifs de passer sans filtrage local.
- [x] 1.2 Mettre en place un traducteur d'erreurs d'API dans base-client pour renvoyer une suggestion de recharge conviviale en cas de solde insuffisant.

PHASE 2 — LOGIQUE DE FACTURATION ET DE ROUTAGE DANS LE BACKEND
- [x] 2.1 Mettre à jour processChat dans backend/src/ai/agent.service.ts pour accepter tous les identifiants de modèles.
- [x] 2.2 Mapper dynamiquement les modèles non-natifs vers Kimi/Moonshot sous le capot pour garantir le succès de la complétion Cloudflare.
- [x] 2.3 Appliquer le tarif forfaitaire de 5.00 FCFA pour tout modèle non-natif.
- [x] 2.4 Bloquer la transaction et lever une exception si le solde du wallet de l'utilisateur est inférieur au coût (guardrail).

PHASE 3 — NOTIFICATION ET SWAP VISUEL EN CLI
- [x] 3.1 Définir une fonction utilitaire isNativeModel dans src/ui/screens/welcome.ts.
- [x] 3.2 Afficher un panneau d'avertissement encadré jaune (⚠️ MODÈLE NON-NATIF ACTIF) si le modèle sélectionné au démarrage est non-natif.
- [x] 3.3 Rafraîchir dynamiquement l'écran de bienvenue avec son panneau de notification lors d'un changement en cours de session (/model <id>).

PHASE 4 — TESTS ET INTEGRATION
- [~] 4.1 Valider le bon comportement de l'ensemble de la suite de tests (126 tests).
- [ ] 4.2 Ajouter un test d'intégration pour confirmer la facturation non-native.

DEFINITION OF DONE :
- Tout modèle valide (natif ou non) peut être swappé dynamiquement.
- Une notification stylisée avertit l'utilisateur des tarifs non-natifs (5 FCFA).
- Les guardrails de solde bloquent le service et informent l'utilisateur de manière conviviale.
- Le cycle de test unitaire et d'intégration est 100% au vert.
