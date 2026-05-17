PLAN : Optimisation SessionManager et resumes de session

PHASE 1 : SessionManager
- [x] Refactoriser SessionManager avec flush asynchrone, compression et ecriture atomique

PHASE 2 : SessionSummary
- [x] Enrichir la strategie de resume avec detection d'intention technique

PHASE 3 : ContextWindow
- [x] Optimiser le comptage de tokens en mode batch

PHASE 4 : Tests et cleanup
- [x] Ajouter les tests pour session-manager et session-summary
- [x] Nettoyer le fichier fantome context-builder.ts
