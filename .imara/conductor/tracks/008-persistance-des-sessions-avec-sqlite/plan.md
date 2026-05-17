PLAN : Persistance des sessions avec SQLite

PHASE 1 - FONDATIONS
- [ ] Ajouter dependance better-sqlite3 au package.json
- [ ] Creer src/db/database.ts : connexion, migrations, versionning schema
- [ ] Creer src/db/session-store.ts : CRUD sessions + messages
- [ ] Creer src/db/track-store.ts : CRUD tracks

PHASE 2 - INTEGRATION
- [ ] Ajouter persistHistory dans ConfigSchema (defaut true)
- [ ] Integrer SessionStore dans ChatCommand (creation/recuperation session)
- [ ] Persister chaque message echange dans addMessage()
- [ ] Integrer TrackStore dans TrackManager
- [ ] Mettre a jour le StatusBar avec indicateur persistance

PHASE 3 - EXPERIENCE UTILISATEUR
- [ ] Commande --sessions pour lister les sessions passees
- [ ] Commande --resume <session_id> pour reprendre une session
- [ ] Commande clear-history

PHASE 4 - ROBUSTESSE ET TESTS
- [ ] Tests unitaires SessionStore (creation, message, listing)
- [ ] Tests unitaires TrackStore (insert, update, retrieve)
- [ ] Test du comportement quand persistHistory=false
- [ ] Validation build et execution manuelle

PHASE 5 - DOCUMENTATION
- [ ] Mettre a jour README.md section configuration
- [ ] Archiver le track
