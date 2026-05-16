Spec Track 003 — Experience Utilisateur et UX

OBJECTIF :
Transformer l'experience CLI d'Imara pour qu'elle soit fluide, informative et professionnelle — au niveau des references (Claude Code, Gemini CLI, kimi Code CLI).

PERIMETRE :
1. Barre de statut contextuelle
   - Modele actif, tokens utilises, cout total FCFA, track actif
   - Persiste en bas de l'ecran pendant toute la session

2. Historique visuel avec scrollback
   - Affichage continu des messages utilisateur / agent
   - Tool calls avec animation d'entree et de sortie

3. Indicateurs de progression
   - Spinner personnalise par phase (Analyse vs Synthese)
   - Animation des tool calls en cours d'execution
   - Duree d'execution affichee a cote de chaque resultat

4. Theming coherent
   - Palette unifiee sur tous les composants
   - Support des terminaux 256 couleurs et basiques
   - Pas de dependance lourde (eviter ink si possible)

5. Messages d'erreur contextualises
   - Erreurs metier avec suggestion d'action (ex: "Lancez imara login")
   - Sanitization des traces techniques (deja partiellement en place)

NON-PERIMETRE :
- Pas de GUI native (reste terminal pur)
- Pas de refonte des outils agentiques (stabilises au track 002)
- Pas de redesign complet de la boucle chat (iterations deja OK)

CONTRAINTES :
- Compatibilite Windows / macOS / Linux
- Gestion correcte des codes ANSI sur tous les terminaux
- Bundle leger (pas de React/ink si alternative raisonnable)

CRITERES D'ACCEPTATION :
- [ ] La session de chat affiche une barre de statut en bas
- [ ] Les tool calls montrent une animation fluide (spinner + result)
- [ ] Les erreurs affichent un contexte d'aide
- [ ] Le theme est coherent sur tous les ecrans
- [ ] Le build et les 43+ tests restent verts

DEPENDANCES :
- Track 002 (stabilise le noyau et les types)
