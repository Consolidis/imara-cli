# Spécifications — Amélioration interruption ECHAP, cache outils, git_commit, parallélisation lecture, préchargement contexte

## 1. Contexte

Cinq améliorations pour la CLI IMARA afin de la rendre plus réactive, plus efficiente et plus fiable dans son usage quotidien.

## 2. P0 — Interruption ECHAP instantanée (AbortController partagé)

### Problème
Actuellement, `agent.cancel()` pose un flag `cancelled = true`. Mais si l'IA est en train d'attendre une réponse réseau (`await client.chat()`), le flag n'est pas vérifié et l'appel API continue jusqu'à la fin ou au timeout. L'utilisateur appuie sur ECHAP... et rien ne se passe pendant 10-30s.

### Solution
- Ajouter un `AbortController` partagé dans `ImaraClient`
- `ImaraClient.chat()` et `validateApiKey()` passent ce signal à `fetchWithTimeout`
- `Agent.cancel()` appelle `client.abort()` qui déclenche `abortController.abort()`
- Dans `agent.run()`, après `cancel()`, attendre que l'appel API se termine par l'AbortError, ensuite interrompre proprement

### Fichiers impactés
- `src/api/imara-client.ts` : ajout d'un AbortController, méthode `abort()`, passage du signal dans les fetch()
- `src/agent/agent.ts` : `cancel()` appelle `this.client?.abort()`, gestion de l'AbortError sans stack trace
- `src/utils/fetch-with-timeout.ts` : accepter un signal externe optionnel (AbortSignal) en plus de son AbortController interne

## 3. P1 — Tool Cache LRU (lectures pures mises en cache)

### Problème
L'IA appelle `read_file` 2-3 fois sur le même fichier dans un même tour de boucle. Chaque appel relit le fichier du disque. Idem pour `inspect_file`, `code_map`, `git_diff`.

### Solution
- Créer un `ToolCache` dans `src/cache/tool-cache.ts` : cache LRU avec TTL par session
- Les outils "purs" (sans side-effect) utilisent ce cache : `read_file`, `read_file_range`, `inspect_file`, `code_map`, `git_diff`, `smart_read`, `list_directory`
- Les outils d'écriture (`write_file`, `replace_in_file`, `batch_replace`, `append_file`) invalident les entrées dont le `path` correspond
- Clé de cache : `{toolName}:{hash(args)}`. TTL : 30s.

### Fichiers impactés
- `src/cache/tool-cache.ts` : nouvelle classe ToolCache (LRU + TTL)
- `src/cache/index.ts` : export du nouveau cache
- `src/agent/tools/index.ts` : wrapper chaque outil pure avec lecture cache avant exécution, écriture cache après résultat
- Chaque tool runner : pas de modification nécessaire, le cache est dans le dispatcher

## 4. P2 — Outil git_commit avec support multi-repo

### Problème
Actuellement, pour commiter, l'IA utilise `run_command("git add . && git commit -m \"message\"")`. Le parsing des messages est hasardeux (guillemets, multilignes, caractères spéciaux). Et `run_command` est bloqué si le track n'est pas validé.

### Contexte multi-repo
Le `ProjectAnalyzer.discoverGitRepos()` détecte déjà :
- Le repo parent (jusqu'à 3 niveaux au-dessus du cwd)
- Les sous-repos enfants immédiats (backend, frontend, etc.)
- Chaque sous-dossier avec son propre `.git` est un dépôt indépendant

### Solution
- Créer `src/agent/tools/git-commit.tool.ts` avec 3 paramètres :
  - `message` (string, requis) : le message de commit
  - `files` (string[], optionnel) : fichiers spécifiques à ajouter (relatifs à la racine du repo cible). Si absent = `git add -A`
  - `all` (boolean, optionnel, défaut: false) : si true, commit dans TOUS les repos modifiés découverts automatiquement
- Logique de découverte du repo cible :
  1. Si `all` est true : découvrir tous les repos (parent + enfants), pour chacun avec des unstaged changes, exécuter `git add -A && git commit -m "message"` dans son dossier
  2. Si `all` est false : détecter le repo courant. Si le cwd a un `.git`, c'est lui. Sinon, chercher un sous-repo enfant contenant des changements non commités
  3. Se positionner dans le dossier du repo avant d'exécuter les commandes git
- L'outil exécute `git add <files>` (ou `git add -A` si non spécifié) puis `git commit -m <message>` dans le répertoire cible
- Protection : si `all` est false et qu'aucun repo modifié n'est trouvé, retourner une erreur claire
- Ajouter au Conductor guard : autoriser `git_commit` même si track non validé (c'est un outil de gestion, pas une modif de code)
- Ajouter dans `TOOLS_DEFINITIONS` et `ToolExecutor`

### Fichiers impactés
- `src/agent/tools/git-commit.tool.ts` : nouveau fichier
- `src/agent/tools/index.ts` : import + case switch + definition
- `src/agent/tools/index.ts` : guardConductor : ajouter git_commit dans les outils autorisés sans validation de track

## 5. P3 — Parallélisation des outils read-only

### Problème
Dans une boucle d'outils, l'IA appelle `read_file -> inspect_file -> code_map -> read_file` en séquence. Chaque appel attend le résultat du précédent. Ces outils sont des lectures pures sans dépendance entre elles.

### Solution
- Dans `runLoop()` de `agent.ts`, détecter quand une séquence d'outils ne contient que des outils "read-only" (lecture pure)
- Les exécuter via `Promise.all()` au lieu de `for...of`
- Critère : outil read-only si pas dans l'ensemble des outils d'écriture (write, replace, append, batch, run_command)
- Attention : ne pas paralléliser si un outil read-only dépend du résultat d'un outil d'écriture précédent dans la MÊME boucle (mais dans la pratique, l'IA ne fait pas ça)

### Fichiers impactés
- `src/agent/agent.ts` : modifier `runLoop()` pour bufferiser les outils read-only et les exécuter par batch de Promise.all()
- Garder l'ordre des résultats pour les push dans le contexte

## 6. P4 — Préchargement du contexte au démarrage du chat

### Problème
Quand l'utilisateur lance `imara`, avant la première interaction, le system prompt est construit (ProjectAnalyzer, git log, etc.). Cela prend ~500ms et retarde la première réponse.

### Solution
- Dans `chat.command.ts`, lancer `ContextBuilder.buildSystemPrompt()` dès que le chat démarre, en parallèle de l'affichage du welcome
- L'agent commence la construction de son contexte immédiatement, pas au premier `agent.run()`
- Si le contexte est prêt avant la première requête utilisateur, le gain est de 500ms
- Si l'utilisateur tape avant la fin du préchargement : `agent.run()` attend la promesse résolue

### Fichiers impactés
- `src/agent/agent.ts` : ajouter `initContext()` qui pré-construit le system prompt et le stocke, `run()` l'utilise si déjà prêt
- `src/cli/commands/chat.command.ts` : lancer `agent.initContext()` en arrière-plan après l'affichage du welcome

## 7. Critères d'Acceptation

- [P0] ECHAP pendant un appel API long (ex: modèle lent) : l'appel fetch est annulé en < 1s, pas d'attente résiduelle
- [P0] Pas de crash après annulation : l'agent peut reprendre après ECHAP
- [P1] 3 appels consécutifs à `read_file` sur le même fichier : 1 lecture disque, 2 retours cache
- [P1] Après `write_file` sur un fichier, le cache de `read_file` pour ce path est invalidé
- [P2] `git_commit` avec message fonctionne, le commit est créé avec l'utilisateur et l'email config
- [P2] `git_commit` fonctionne même si aucun track validé
- [P3] Une séquence de 3 `read_file` indépendants : exécutés en parallèle, temps total = max des 3, pas somme
- [P3] L'ordre des résultats dans le contexte est préservé (même ordre que la séquence d'appel)
- [P4] Première réponse utilisateur : temps d'attente réduit de ~500ms (le system prompt est pré-construit)
- Tous les tests existants passent (npm test)
