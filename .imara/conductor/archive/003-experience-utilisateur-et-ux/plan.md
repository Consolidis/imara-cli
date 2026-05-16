Plan -- Expérience utilisateur et UX

Phase 1 - Audit UX existant
- [x] Cartographie des ecrans et flux utilisateur actuels
- [x] Identification des frictions et des ecrans non informatifs
- [x] Benchmark visuel (Claude Code, Gemini CLI, kimi Code)

Phase 2 - Design system et theming
- [x] Consolidation du theme.ts avec palette exhaustive
- [x] Definition des styles par composant (message, tool, erreur, statut)
- [x] Support fallback pour terminaux basiques (16 couleurs)

Phase 3 - Composants interactifs
- [x] Barre de statut en bas de session (model, tokens, cout, track)
- [x] Animation des tool calls avec spinner et overwrite de ligne
- [x] Scrollback et historique visuel dans le chat
- [x] Messages d'erreur contextualises avec suggestions d'action

Phase 4 - Integration et tests
- [x] Raccordement de la barre de statut dans chat.command.ts
- [x] Tests visuels / smoke sur les nouveaux composants
- [x] Verification du build et des tests existants (43+)

Phase 5 - Consolidation
- [ ] Archivage du track et transition au track Intelligence (contexte/tokens)
