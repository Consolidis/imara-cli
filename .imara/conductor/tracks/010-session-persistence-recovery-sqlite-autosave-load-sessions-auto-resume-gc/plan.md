# Plan — Session Persistence & Recovery

## Phase 1 — Adapteur SQLite pour SessionManager
- [x] Synchroniser session-manager.ts avec SQLiteStorageProvider.
- [~] Adapter les types Message agent -> types Message storage.
- [ ] Implementer createSession, saveMessages, loadMessages.

## Phase 2 — Commandes REPL
- [ ] /sessions affiche table formatee des sessions stockees.
- [ ] /load <nom/id> restaure et setMessages dans l'agent.
- [ ] Detecter conflit /save session vs sauvegarde JSON legacy.

## Phase 3 — Auto-resume & GC
- [ ] Hook demarrage chat : chercher session is_active, proposer reprise.
- [ ] GC asynchrone supprime sessions > 30j au lancement.

## Phase 4 — Tests & Nettoyage
- [ ] Tests pour le store SQLite (CRUD session + messages).
- [ ] Supprimer code JSON legacy apres validation.
