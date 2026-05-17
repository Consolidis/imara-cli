# Specifications — Session Persistence & Recovery

## 1. Contexte & Enjeux
Le systeme actuel sauvegarde les sessions en JSON flat dans ~/.imara/sessions/.
Aucun listing, aucun chargement, aucune restauration automatique au demarrage.
Ce track remplace la persistance legacy par SQLite via le StorageProvider existant
et ajoute les commandes interactives au REPL.

## 2. Architecture
- SQLiteStorageProvider (deja implemente) pourra remplacer les ecritures JSON.
- SessionManagerUpdate : adapter l'API pour utiliser le provider.
- ChatCommand : ajouter /load, /sessions, hook auto-save.
- Garbage Collector : tache asynchrone nettoyer sessions > 30j.

## 3. Acceptance Criteria
- [ ] /save enregistre session + messages dans SQLite.
- [ ] /sessions liste toutes les sessions avec date, nombre messages, etat.
- [ ] /load <nom/id> restaure la conversation dans l'agent.
- [ ] Auto-resume au demarrage detecte is_active, recharge la derniere session.
- [ ] GC supprime en background sessions inactives depuis > 30j.
- [ ] Tests passants sur le nouveau SessionStore SQLite.
