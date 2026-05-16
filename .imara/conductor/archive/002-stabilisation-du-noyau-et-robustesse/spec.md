SPECIFICATIONS TECHNIQUES -- Stabilisation du noyau et robustesse

1. AUDIT ARCHITECTURAL

1.1 Vue d'ensemble du projet
- Monorepo npm controlsé (workspace imara-core non corpésent ou grille quand nifiant comme nom fractière, il nexiste que src/ à la racine)
- TypeScript strict activé mais contourné massivement via `any` et `as`
- Point d'entrée unique : src/index.ts -> program.ts -> commandes
- Flux principal : CLI -> Agent -> API distante <- Messages <- Outils

1.2 Cartographie des dépendances

  CLI (program.ts)
    ├── run.command.ts     -> Agent.runOnce(prompt)
    ├── chat.command.ts    -> Agent.runStream(prompt) + boucle REPL
    ├── login.command.ts   -> auth/login.ts
    ├── logout.command.ts  -> auth/logout.ts
    ├── whoami.command.ts  -> api/imara-client.ts
    ├── config.command.ts  -> fs ~/.imara/config.json
    ├── track.command.ts   -> context/conductor/track-manager.ts
    └── init-conductor     -> context/conductor/track-manager.ts

  Agent (agent.ts)
    ├── API                <- imara-client.ts (HTTP stream)
    ├── Auth               <- keychain.ts (credentials)
    ├── Context            <- context-builder.ts + session-manager.ts
    ├── Outils             <- tools/index.ts (18 outils filesystem/git/conductor/web)
    ├── UI                 <- renderer.ts + confirm.ts + spinner.ts
    ├── Conductor          <- track-logger.ts
    └── Utils              <- env.ts

  API (imara-client.ts)
    ├── Utils              <- env.ts (URL, clé, debug)
    └── Agent types        <- agent.types.ts (Message, ToolCall, AgentResponse)

  Context (context/)
    ├── ProjectAnalyzer    -> fast-glob, fs, child_process
    ├── SessionManager     -> fs ~/.imara/sessions/
    ├── ContextBuilder     -> ProjectAnalyzer + conductor TrackManager
    └── TrackManager       -> fs .imara/conductor/

  Tools (agent/tools/)
    ├── Filesystem         -> fs (read, write, append, list, search)
    ├── Git                -> child_process (diff, log, status)
    ├── Conductor          -> track-manager.ts
    ├── Web                -> fetch (recherche web)
    └── ClearContext       -> manipulation message[]

1.3 Points de fragilite par severite

CRITIQUE [C1] Typage `any` massif
  - 58 occurrences de `any` dans src/ (hors tests)
  - Types cles non contraints : ToolCall.arguments = any, tool args = any,
    error catch = any, response.json() = any, UI components args = any
  - Contournement systematique de `strict: true`
  - Impact : runtime errors masquées, refactorisation impossible

CRITIQUE [C2] Assertions de type forcees `as`
  - ImaraClient : `response.json() as any` x2
  - BuildContext : `parsed as any` x3
  - Agent : message structure `as any`
  - Impact : données corrompues passes silencieusement, crash potentiel

CRITIQUE [C3] Gestion d'erreurs silencieuse
  - `catch { /* ignore */ }` dans env.ts (config JSON corrompue ignore)
  - `catch { return '' }` dans git-utils.ts x3 (erreur Git masquées)
  - `catch { return null }` dans track-manager.ts (track actif perdu)
  - `catch { this.messages = [] }` dans session-manager.ts
  - `catch (_e) { /* ignore parse errors */ }` dans imara-client.ts
  - Impact : perte de données utilisateur, comportements indefinis

HAUTE [H1] Parsing JSON sans validation schema
  - Reponses API imara : `JSON.parse()` sans schema
  - `build-context.ts` : donnees du projet serializees/parsées sans verification
  - Config JSON utilisateur : `JSON.parse()` sans try-catch robuste
  - Impact : crash si schema API change, injection potentielle

HAUTE [H2] Execution de commandes shell via `run_command`
  - Pas de sandbox, pas de whitelist, pas de timeout configurable
  - Commande passe directement à execSync / spawn
  - Impact : execution arbitraire de code sur la machine de l'utilisateur

HAUTE [H3] Bufferisation des messages sans limite
  - SessionManager stocke tous les messages sur disque
  - Pas de limite de tokens ni de rotation
  - Agent boucle `while (iterations < maxIterations)` sans gestion
    de token count reel
  - Impact : debordement memoire/disque, couts API imprevisibles

MOYENNE [M1] Configuration fragmentee
  - `env.ts` : process.env + ~/.imara/config.json
  - `config.command.ts` : manipulation manuelle de JSON
  - Pas de schema de validation centralise
  - Pas de typage fort des cles de config
  - Impact : config invalide silencieuse, comportements erratiques

MOYENNE [M2] Absence de retry sur erreurs reseau
  - ImaraClient gere le retry uniquement pour 429 (rate limit)
  - Pas de retry sur timeout, ECONNRESET, 5xx
  - Impact : echec de session sur reseau instable

MOYENNE [M3] Interface utilisateur fragile (stdin)
  - `confirmAction` lit directement sur stdin avec `once('data')`
  - Risque de collision avec le loop REPL principal
  - Pas de gestion de SIGINT propre en mode stream
  - Impact : UX degradee, processus fige

1.4 Recommandations strategiques

Priorite 1 (Phase 3 du present track) :
  A. Remplacer tous les `any` par des types stricts dans agent.types.ts
     et propager aux modules dependants
  B. Introduire un systeme de Result<T, E> pour la gestion d'erreurs
  C. Valider toutes les entrees JSON avec un schema (zod ou typebox)
  D. Centraliser la configuration avec validation + valeurs par defaut

Priorite 2 (Track suivant ou Phase 4) :
  E. Securiser run_command avec whitelist/denylist + timeout
  F. Implementer la gestion de contexte par fenetre glissante
     (smart truncation, relevance scoring)
  G. Ajouter retry exponentiel sur toutes les erreurs reseau
  H. Refactoriser la gestion stdin pour eviter les collisions
