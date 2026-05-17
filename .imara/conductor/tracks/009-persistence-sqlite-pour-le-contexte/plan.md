PLAN : 009-persistence-sqlite-pour-le-contexte

ETAPE 1 - FONDATIONS
- [ ] Ajouter better-sqlite3 et @types/better-sqlite3 aux deps
- [x] Implementer le SQLiteStorageProvider (src/storage/sqlite-provider.ts)
- [ ] Implementer le schema de base (init + migrations)
- [ ] Implementer les operations CRUD (messages, sessions, variables, summaries)

ETAPE 2 - INTEGRATION AU MODULE CONTEXT
- [ ] Creer l interface StorageProvider (src/types/storage.ts)
- [ ] Adapter ContextWindow pour sauvegarder/charger les messages via provider
- [ ] Adapter SessionSummary pour auto-sync avec la base
- [ ] Ajouter les methodes save/load au SessionManager

ETAPE 3 - CONFIGURATION ET GRACEFUL DEGRADATION
- [ ] Ajouter l option sqlite.enabled dans la config (src/config/config.ts)
- [ ] Implementer la logique d activation/desactivation
- [ ] Implementer le graceful degradation (warning si indisponible, mode memoire)
- [ ] Creer le repertoire .imara/data/ au demarrage si necessaire

ETAPE 4 - TESTS ET DOCUMENTATION
- [ ] Rediger les tests unitaires (CRUD, transactions, degradation)
- [ ] Verifier la compilation TypeScript (npm run build)
- [ ] Verifier la suite de tests (npm test)
- [ ] Mettre a jour la documentation du projet
