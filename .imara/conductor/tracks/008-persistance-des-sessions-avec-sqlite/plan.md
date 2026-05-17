# Plan — Persistance SQLite Unifiée des Sessions et du Contexte

Ce plan est la source de vérité unique pour la mise en œuvre de la persistance locale via SQLite, issue de la fusion des tracks 004, 008, 009 et 010.

---

## 🟢 PHASE 1 — FONDATIONS & SCHÉMAS SQL
- [x] Ajouter la dépendance `better-sqlite3` et ses types `@types/better-sqlite3` au `package.json` de la CLI.
- [x] Créer le provider de stockage `src/storage/sqlite-provider.ts` :
  - Initialisation de la base de données dans `.imara/data/imara.db`.
  - Gestion automatique des migrations (versioning de schéma SQL).
- [x] Définir l'interface de stockage standard dans `src/types/storage.ts`.
- [x] Créer les tables SQL :
  - `sessions` : `id` (UUID/Text), `title` (Text), `activeTrackId` (Text), `model` (Text), `createdAt` (Datetime), `updatedAt` (Datetime)
  - `messages` : `id` (UUID/Text), `sessionId` (Text), `role` (Text), `content` (Text), `promptTokens` (Integer), `completionTokens` (Integer), `costFcfa` (Real), `createdAt` (Datetime)
  - `context_summaries` : `id` (UUID/Text), `sessionId` (Text), `summaryText` (Text), `tokenCount` (Integer), `createdAt` (Datetime)

---

## 🟢 PHASE 2 — INTÉGRATION DU NOYAU & RÉSILIENCE
- [ ] Connecter le provider SQLite au gestionnaire de sessions [session-manager.ts](file:///c:/Users/tiffa/Documents/App/IMARA_AI/imara-cli/src/context/session-manager.ts).
- [ ] Adapter [context-window.ts](file:///c:/Users/tiffa/Documents/App/IMARA_AI/imara-cli/src/context/context-window.ts) pour lire et écrire l'état de la fenêtre contextuelle de l'agent en base SQLite.
- [ ] Ajouter l'option de configuration globale `persistHistory` (boolean, par défaut `true`) dans `src/config/config.ts`.
- [ ] Mettre en œuvre le **Graceful Degradation** : si l'ouverture de la base de données échoue (ex: verrouillage de fichier), basculer proprement sur un mode mémoire non-persistant avec un avertissement de diagnostic non-bloquant pour l'utilisateur.

---

## 🟢 PHASE 3 — INTERFACE REPL, AUTO-RESUME & GC
- [ ] Ajouter les commandes interactives au REPL d'IMARA :
  - `/sessions` : Affiche un tableau formaté élégant récapitulant les sessions passées avec leur ID, titre, modèle actif et date.
  - `/load <id|nom>` : Restaure intégralement l'état historique de la session choisie et rafraîchit le contexte actif de l'agent.
  - `/clear` ou `/clear-history` : Supprime toutes les données de la base SQLite de façon sécurisée.
- [ ] Implémenter le **Auto-Resume** au démarrage :
  - Au lancement de la CLI, chercher s'il existe une session active récente.
  - Proposer interactivement à l'utilisateur de la reprendre pour gagner du temps.
- [ ] Activer le **Garbage Collector (GC) asynchrone** au démarrage : purger silencieusement les sessions et messages vieux de plus de 30 jours pour éviter que la base n'occupe de l'espace disque inutilement.

---

## 🟢 PHASE 4 — QUALITÉ, TESTS & NETTOYAGE
- [ ] Écrire la suite de tests unitaires et d'intégration :
  - Validation du CRUD du provider SQLite (sessions et messages).
  - Validation du comportement et de la désactivation via `persistHistory = false`.
  - Validation du mode dégradé (Graceful degradation).
- [ ] Supprimer tout le code historique de sauvegarde JSON temporaire ou d'anciennes structures de données héritées pour garder le noyau léger.
- [ ] Mettre à jour la documentation globale dans `README.md`.
