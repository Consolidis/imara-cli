SPEC : Persistance SQLite pour le contexte IMARA

OBJECTIF : Permettre a IMARA de sauvegarder et restaurer son contexte (historique, etat des variables, resume de session) dans une base SQLite locale, meme apres redemarrage.

CONTEXTE : Actuellement, le contexte est entierement volatile (memoire vive). Tout redemarrage de l agent perd l historique, les variables cles, et les resumes de session.

EXIGENCES FONCTIONNELLES :

1. SCHEMA DE BASE DE DONNEES
   - Table messages : id, session_id, role (system/user/assistant), content, timestamp, token_count, metadata (JSON)
   - Table sessions : id, name, created_at, updated_at, project_path, context_snapshot (JSON), is_active
   - Table variables : id, session_id, key, value, type, updated_at, scope (session/global)
   - Table summaries : id, session_id, content, token_count, created_at, version

2. CRUD COMPLET
   - Insertion de messages avec comptage de tokens
   - Mise a jour du resume de session avec conflit sur session_id (upsert)
   - Lecture paginee des messages (offset/limit)
   - Suppression conditionnelle (par session, par date, par relevance)

3. INTEGRATION AU MODULE CONTEXT EXISTANT
   - ContextWindow expose deux nouvelles methodes :
     - saveToStorage(provider: StorageProvider) : Promise<void>
     - loadFromStorage(provider: StorageProvider) : Promise<void>
   - StorageProvider : interface abstraite permettant de connecter SQLite
   - SessionSummary se synchronise automatiquement avec la base a chaque update()

4. PERFORMANCE ET ROBUSTESSE
   - Transactions SQLite pour garantir la coherence
   - Requetes preparees pour eviter les injections SQL
   - Tests unitaires pour toutes les operations CRUD (vitest)
   - Compilation TypeScript strict (tsconfig strict)

5. COMPATIBILITE CLER
   - Activation/desactivation via une option dans imara.config.json (enabled: boolean)
   - Graceful degradation : si SQLite est indisponible ou mal configure, l agent
     continue en mode memoire avec un warning dans le terminal (pas d erreur fatale).

EXIGENCES NON FONCTIONNELLES :
- Base stockee dans .imara/data/imara.db (ensureDir au demarrage)
- Migrations automatiques au demarrage si le schema evolue (version controlee)
- Tests isoles en memoire (:memory:) pour la CI
- Pas de dependance driver natif (better-sqlite3 OK)

DEPENDANCES A AJOUTER :
- better-sqlite3 (driver synchrone, performant, compatible Node 18+)
- @types/better-sqlite3 (typage TS)

CRITERES D ACCEPTATION :
- [ ] La suite de tests passe (npm test) avec au moins 6 nouveaux tests
- [ ] Le build TypeScript passe sans erreur (npm run build)
- [ ] L activation/desactivation via config fonctionne
- [ ] La degradation graceeue est verifiable (simuler absence de fichier)
- [ ] La documentation (README ou spec) indique la location et le format de la base

DETTE TECHNIQUE RESOLUE :
- ContextWindow et SessionSummary aveugles : ils ne savent pas comment sauvegarder.
  Solution : pattern Strategy (interface StorageProvider).
- Couplage fort : on ne couple pas directement à better-sqlite3 dans context-window.ts.
  Solution : le provider est injecte, la base est une impl concrte separatee.

EVOLUTIONS FUTURES :
- Export/Import JSON pour portabilite des sessions
- Chiffrement de la base pour les credentials
- Sync cloud (raison d etre du format SQLite standardise)
