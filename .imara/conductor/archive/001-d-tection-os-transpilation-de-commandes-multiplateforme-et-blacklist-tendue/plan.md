# Plan — Détection OS, transpilation de commandes multiplateforme et blacklist étendue

## Tâches

- [x] **A — Détection OS dans le system prompt** : Modifier `ContextBuilder.buildSystemPrompt()` pour détecter et afficher le système d'exploitation (Windows/Linux/macOS, version, distribution, WSL)
- [x] **B — Transpileur de commandes** : Créer `transpileCommand(cmd, platform)` dans `run-command.tool.ts` avec les tables de conversion Unix <-> Windows. Appliquer la transpilation avant exécution et signaler dans le résultat.
- [x] **C — Blacklist étendue** : Remplacer le tableau `BLACKLISTED_COMMANDS` par un système basé sur des patterns avec niveaux de sévérité (`block` / `warn`). Couvrir : formatage disque, suppression système, shutdown, téléchargement+exécution, etc.
- [x] **Test et validation** : Vérifier tous les tests existants (npm test)

## Ordre d'exécution

1. A — Détection OS dans ContextBuilder (indépendant, modifie le prompt)
2. B — Transpileur (modifie run-command.tool.ts)
3. C — Blacklist étendue (modifie run-command.tool.ts)
4. Tests
