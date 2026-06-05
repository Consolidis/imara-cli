# Tracks Registry

## In Progress
(None)

## Backlog
(None - tous les tracks sont completes ou archives.)

## Archived
- **008-persistance-des-sessions-avec-sqlite**: [x] 100% (Base de données SQLite unifiée dans ~/.imara/data/imara.db avec migrations, confinement et isolation par chemin de projet courant, auto-resume interactif résilient, démon GC asynchrone de 30 jours, et 146 tests verts)
- **001-test-feature**: [x] 100% (Track temporaire de test sans contenu fonctionnel — Archivé)
- **003-wit-phase-2-acc-s-contexte-et-integration-conversation**: [x] 100% (Modèle de spécification initial non utilisé et obsolète — Archivé)
- **002-test-feature**: [x] 100% (Track de test sans contenu fonctionnel)
- **002-stabilisation-du-noyau-et-robustesse**: [x] 100% (Noyau stable, 43 tests, Result<T,E>, ConfigManager)
- **003-experience-utilisateur-et-ux**: [x] 100% (Theme, status-bar, error-panel, tool-call spinner)
- **004-intelligence-contexte-et-tokens**: [x] 100% (Token counting, context window, session summaries)
- **005-nettoyage-du-statut-thinking-et-synchronisation-ui**: [x] 100% (Type Phase, icon sync, build clean)
- **005-audit-et-hardening-securite-credentials-variables-env-et-robustesse**: [x] 100% (Security audit hardening, DevEx audit)
- **005-reseau-resilience-graceful-degradation**: [x] 100% (Résilience réseau avec Full Jitter, Circuit Breaker persistant global, cache fallback sur hash SHA-256 de contexte, et barre de statut fixe en footer du prompt)
- **010-optimisation-sessionmanager-et-am-lioration-des-r-sum-s-de-session**: [x] 100% (Track 010 terminé : SessionManager refactorisé avec flush asynchrone et compression, SessionSummary enrichi avec detection d'intention, comptage de tokens batch optimisé avec cache, tests session-manager/session-summary écrits et passants (105/105). context-builder.ts n'etait pas un fantome, il est activement utilise dans agent.ts.)
- **006-onboarding-premiere-experience-utilisateur**: [x] 100% (Onboarding initial avec Wizard interactif sécurisé et tutoriel ASCII paginé, filtrage des commandes slash (token-saver), et contrôle d'interruption robuste avec Échap/Ctrl+C pour l'agent sans interruption de session REPL)
- **007-support-multi-modeles-swapping-dynamique**: [x] 100% (Modèles non-natifs supportés sur CLI et Backend NestJS avec coût forfaitaire fixe de 5 FCFA, guardrail de solde insuffisant, traduction d'erreurs conviviale orientée recharge de crédit sur imara.consolidis.com, panneau visuel d'avertissement et menu interactif d'aide /model épuré des détails d'arrière-plan)

- **001-correction-du-circuit-d-authentification-api-key-trimming-fallback-keychain-compatibilit-linux**: [x] 100% (5 bugs corrigés : trimming clé login, fallback FileKeychain pour Linux sans libsecret, requireAuth() lit ConfigManager, sauvegarde apiKey dans ConfigManager au login/wizard, priorité ImaraClient corrigée. 173 tests passent.)
- **001-am-lioration-interruption-echap-cache-outils-git-commit-parall-lisation-lecture-pr-chargement-contexte**: [x] 100% (P0-AbortController partagé (ECHAP arrête le fetch en cours), P1-ToolCache LRU (cache 30s outils read-only), P2-git_commit tool avec support multi-repo, P3-parallélisation des outils read-only, P4-préchargement contexte au démarrage. 173 tests passent.)
- **001-d-tection-os-transpilation-de-commandes-multiplateforme-et-blacklist-tendue**: [x] 100% (A-Détection OS déjà présente (getOSInfo avec Windows/Linux/macOS/WSL/distribution). B-Transpileur de commandes Unix<->Windows (ls->dir, cat->type, grep->findstr, etc.) avec notification dans le résultat. C-Blacklist étendue (~45 patterns) avec sévérité block/warn couvrant formatage disque, suppression système, shutdown, curl-bash, iptables, etc. 173 tests passent.)
- **001-amelioration-des-outils-cli-suite-au-fichier-amelioration-md**: [x] 100% (6 taches implementees : (1) git_commit all silencieux, (2) atomic_section_replace, (3) line endings dans read_file_range/inspect_file, (4) batch_import_add, (5) validate_file auto-adaptatif au langage + hook optionnel, (6) smart_read mode JSX avec detection de balises non fermees. 174 tests verts.)
- **001-interruption-echap-amelioration-messages-d-erreur-et-correction-doublement-affichage**: [x] 100% (3 taches realisees : (1) correction du doublement d'affichage des erreurs en supprimant l'affichage dans agent.ts, (2) amelioration du format d'erreur avec icones, cadre visuel et messages d'action personnalises par categorie, (3) interruption Echap renforcee (ecoute permanente, pas conditionnee a isProcessing, message d'interruption plus clair). 174 tests verts.)
