SPECIFICATIONS - Track 004 : Intelligence contexte et tokens

PROBLEMATIQUE :
L'Agent stocke l'integralite de l'historique conversationnel (messages[]) en memoire.
- Pas de comptage de tokens reel (estimation naïve 4 chars/token)
- Pas de limite de fenetre de contexte : accumulation jusqu'a erreur 400 de l'API
- Pas de strategie de compaction ni de resume
- La status bar n'affiche pas le cout ni le volume en temps reel

OBJECTIF :
Implémenter une gestion pro-active et intelligente de la fenetre de contexte LLM.

FONCTIONNALITES :

1. COMPTEUR DE TOKENS REEL
   - Remplacer l'estimation naïve par js-tiktoken (cl100k_base pour gpt-4/claude)
   - Compter tokens par message individuel
   - Compter tokens total de l'historique complet
   - Exposer les stats par role (system / user / assistant / tool)

2. FENETRE DE CONTEXT INTELLIGENTE
   Seuils declenchés AVANT chaque appel API, sur le total tokens de l'historique :
   - VERT  (< 50% limite) : operation normale
   - JAUNE (50% a 70%)   : warning discret dans status bar
   - ORANGE (70% a 85%)  : avertissement visible a l'utilisateur
   - ROUGE (> 85%)       : compaction automatique des anciens messages
   Stratégie de compaction :
   - Conserver TOUJOURS : message system + 2 derniers echanges complets
   - Résumer les messages entre system et les 2 derniers echanges en un message synthetique
   - Si > 90% apres tentative de resume : suppression des messages anciens (garde system + 2 derniers)

3. RESUMES DE SESSION
   - Module SessionSummary qui resume un bloc de messages en un paragraphe synthetique
   - Les resumes sont injectes comme message system supplementaire
   - Format : "RESUME DES ECHANGES PRECEDENTS : <synthese>"

4. STATUS BAR EN TEMPS REEL
   - Afficher [tokens: X / YK] [cout: X FCFA] [msg: N]
   - Code couleur : vert/jaune/orange/rouge selon le niveau de remplissage
   - Mise a jour a chaque tour de conversation

5. CONFIGURATION
   - Ajouter tokenWarningThreshold (50%) et tokenCompactThreshold (85%) dans ConfigSchema
   - Valeurs par defaut raisonnables, overridables via config CLI

ARCHITECTURE :

src/utils/token-counter.ts  (ETENDU)
  + countTokens(text: string): number           // comptage precis Tiktoken
  + countMessageTokens(msg: Message): number    // comptage par message
  + countHistoryTokens(msgs: Message[]): number // comptage historique complet
  + HistoryTokenStats interface                 // repartition par role

src/context/context-window.ts  (NOUVEAU)
  ContextWindow
    constructor(maxTokens: number, warningThreshold: number, compactThreshold: number)
    check(messages: Message[]): ContextWindowState
      // evalue l'etat et retourne action recommandee
    compact(messages: Message[]): Message[]
      // applique la strategie de compaction
    getStats(messages: Message[]): WindowStats
      // stats affichables

  ContextWindowState = 'ok' | 'warning' | 'critical' | 'compacted'
  WindowStats = { totalTokens, systemTokens, userTokens, assistantTokens, toolTokens, remainingTokens, state }

src/context/session-summary.ts  (NOUVEAU)
  SessionSummary
    static summarize(messages: Message[]): string
      // resume un bloc de messages (exclusion system) en paragraphe synthetique

src/ui/components/status-bar.ts  (ETENDU)
  + renderContextStats(stats: WindowStats)  // affichage avec code couleur

src/agent/agent.ts  (ETENDU)
  - Integrer ContextWindow dans runLoop()
  - Appeler compact() si etat critical
  - Mettre a jour status bar avec stats a chaque tour

CONTRAINTES :
- js-tiktoken est une dependance additionnelle (legere, pure JS)
- La compaction ne doit PAS supprimer le dernier message user (la requete en cours)
- Les resumes ne doivent pas etre envoyes a l'API (ils restent côté client dans l'historique local)
- 100% retro-compatible : si js-tiktoken echoue, fallback sur estimation naïve

DEPENDANCES :
- js-tiktoken : ^1.0.11
