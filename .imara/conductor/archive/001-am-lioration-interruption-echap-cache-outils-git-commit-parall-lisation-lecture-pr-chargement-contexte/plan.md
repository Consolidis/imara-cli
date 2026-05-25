# Plan — Amélioration interruption ECHAP, cache outils, git_commit, parallélisation lecture, préchargement contexte

## Tâches

- [x] **P0 — AbortController partagé** : Ajouter `client.abort()` dans ImaraClient, passer un AbortController partagé, connecter `agent.cancel()` à `client.abort()`, gérer l'AbortError
- [x] **P1 — ToolCache LRU** : Créer `src/cache/tool-cache.ts` avec cache LRU + TTL. Wrapper les outils purs dans `ToolExecutor` avec lecture/écriture cache. Invalidation sur write.
- [x] **P2 — git_commit tool** : Créer `src/agent/tools/git-commit.tool.ts`. Paramètres : message (string, requis), files (string[], opt.), all (boolean, opt. false). Détection auto du repo courant ou multi-repo via discoverGitRepos(). Ajouter dans `TOOLS_DEFINITIONS` et `ToolExecutor`. Exempter du guard Conductor.
- [x] **P3 — Parallélisation read-only** : Modifier `runLoop()` dans `agent.ts` pour bufferiser les outils read-only et les exécuter par batch `Promise.all()` en préservant l'ordre.
- [x] **P4 — Préchargement contexte** : Ajouter `agent.initContext()` pour pré-construire le system prompt. Lancer dans `chat.command.ts` en arrière-plan après le welcome.
- [x] **Test et validation** : Vérifier tous les tests existants + comportement attendu (npm test)

## Ordre d'exécution

1. P0 — AbortController (change la mécanique d'annulation, tout le monde en dépend)
2. P1 — ToolCache (indépendant, peut être testé seul)
3. P2 — git_commit (indépendant, outil supplémentaire)
4. P3 — Parallélisation (dépend de P1 si on veut éviter les races conditions)
5. P4 — Préchargement (indépendant)
6. npm test — validation finale
