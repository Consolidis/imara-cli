# PLAN D'ÉCULATION — TRACK 006 (ONBOARDING)

Ce document sert de source de vérité pour le statut et la progression des tâches de l'implémentation de l'onboarding.

---

## 📅 PLAN DE ROUTE & ÉTAPES

### PHASE 1 — DÉTECTION DU PREMIER LANCEMENT
- [x] 1.1 Ajouter la propriété optionnelle `onboardingDone?: boolean` dans `src/config/config-manager.ts` (schéma et valeurs par défaut).
- [x] 1.2 Implémenter la fonction `isFirstLaunch()` dans `src/config/config-manager.ts` (détectant l'absence de config ou le flag `onboardingDone` à false).
- [x] 1.3 Écrire des tests unitaires pour valider les comportements de détection dans `src/__tests__/config-manager.test.ts`.

### PHASE 2 — WIZARD DE CONFIGURATION INTERACTIF (READLINE)
- [x] 2.1 Créer le module `src/cli/wizard.ts` abritant la fonction asynchrone `runSetupWizard()`.
- [x] 2.2 Développer une fonction de saisie masquée (non-echo input) native `readline` pour l'API Key.
- [x] 2.3 Intégrer l'appel à `ImaraClient.validateApiKey()` dans le wizard pour valider en direct la clé saisie, avec bouclage et affichage rouge d'erreur en cas d'échec.
- [x] 2.4 Limiter le workspace par défaut au répertoire courant d'exécution (`process.cwd()`) avec blocage strict d'accès (aucun échappement autorisé vers les répertoires parents).
- [x] 2.5 Sauvegarder automatiquement les entrées via le `ConfigManager`.

### PHASE 3 — TUTORIEL REPL INTERACTIF (ASCII PREMIUM)
- [x] 3.1 Créer le module `src/ui/tutorial.ts` abritant la structure `TutorialSlide` et la fonction `showTutorial()`.
- [x] 3.2 Designer les 3 slides ASCII stylisées :
  * **Slide 1** : Présentation d'IMARA AI et de l'assistant autonome de code.
  * **Slide 2** : Les commandes clés (`/help`, `/clear`, `/files`, `/welcome`).
  * **Slide 3** : Le concept de **Track Conductor** (protection du code, Inquiry -> Planning -> Approval -> Execution).
- [x] 3.3 Implémenter l'attente de la touche `Entrée` pour naviguer entre les diapositives et nettoyer le terminal à chaque slide.
- [x] 3.4 Marquer `onboardingDone = true` dans la configuration une fois le tutoriel terminé.

### PHASE 4 — INTÉGRATION LOGIQUE & GLOBAL OPTIONS
- [x] 4.1 Modifier `src/cli/commands/chat.command.ts` pour intercepter le démarrage : si `isFirstLaunch()` est vrai, lancer séquentiellement le Wizard puis le Tutoriel avant d'initier le chat.
- [x] 4.2 Ajouter le support de l'option globale `--setup` en ligne de commande principale pour ré-exécuter le wizard.
- [x] 4.3 Ajouter le support de la commande spéciale de chat `/welcome` et `/setup` pour rejouer le tutoriel interactif et relancer le wizard.

### PHASE 5 — TESTS D'ONBOARDING & QA GATES
- [x] 5.1 Écrire `src/__tests__/onboarding.test.ts` simulant la saisie de clé API et validant les transitions d'état.
- [x] 5.2 Valider l'enchaînement complet (aucun blocage terminal, masquage robuste, rejeu stable).
- [x] 5.3 Lancer le script de test global (`npm test`) pour s'assurer qu'aucun test existant n'est cassé.
- [x] 5.4 Lancer une compilation de production (`npm run build`) et s'assurer que le typage TypeScript est parfait.

---

## 🏁 DEFINITION OF DONE :
- Un nouvel utilisateur arrivant sans configuration est pris en charge de façon autonome et guidé étape par étape.
- La clé API est saisie de manière sécurisée (masquée) et validée en direct avec le backend d'IMARA.
- Le workspace de base est sécurisé, verrouillé sur le dossier courant et ne permet aucune fuite vers le haut.
- L'esthétique visuelle du tutoriel REPL est premium, engageante et s'affiche dans des panneaux ASCII calibrés.
- Couverture de test unitaire supérieure à 80% sur ces nouveaux modules d'onboarding.
