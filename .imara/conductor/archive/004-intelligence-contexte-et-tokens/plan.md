PLAN DE TRAVAIL - Track 004 : Intelligence contexte et tokens

DEPENDANCES : aucune (track autonome)

PHASE 1 : FONDATIONS
- [x] Ajouter js-tiktoken au projet et implementer comptage precis dans token-counter.ts
- [ ] Etendre les tests de token-counter pour le comptage precis
- [x] Ajouter les parametres de configuration (tokenWarningThreshold, tokenCompactThreshold) dans ConfigSchema

PHASE 2 : GESTION DE LA FENETRE
- [x] Creer src/context/context-window.ts avec ContextWindow, compilation et strategie de compaction
- [x] Creer src/context/session-summary.ts avec SessionSummary.summarize()
- [x] Tests unitaires pour ContextWindow et SessionSummary

PHASE 3 : INTEGRATION AGENT
- [x] Integrer ContextWindow dans Agent.runLoop()
- [x] Mettre a jour la status bar pour afficher les stats de contexte en temps reel avec code couleur
- [x] Tester integration end-to-end

PHASE 4 : VALIDATION ET DOCUMENTATION
- [x] Executer la suite de tests complete (vitest run)
- [x] Verifier que la build TypeScript passe sans erreur
- [ ] Mettre a jour le README si necessaire
- [ ] Valider et archiver le track
