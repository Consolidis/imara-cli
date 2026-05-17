SPECIFICATIONS TECHNIQUES — TRACK 005

MODULES TOUCHES :
- `src/api/imara-client.ts` (interception d'erreurs, intégration du retry et du circuit-breaker)
- `src/utils/retry.ts` (nouveau - boucle avec exponentiel backoff et full jitter)
- `src/utils/circuit-breaker.ts` (nouveau - persistance dans `~/.imara/circuit-breaker.json`)
- `src/ui/components/status-bar.ts` (positionnement fixe, rafraîchissement au prompt, masquage à la soumission)
- `src/cli/commands/chat.command.ts` (nettoyage des appels de status-bar et gestion de la saisie)
- `src/agent/agent.ts` (adaptation pour éviter le rafraîchissement intrusif en cours d'exécution)
- `src/utils/events.ts` (nouveau - bus d'événements global `networkEvents` pour coupler le circuit-breaker à la status-bar)

---

### 1. RETRY EXPONENTIEL ET JITTER (`src/utils/retry.ts`)

- **Fonction** : `executeWithRetry<T>(fn: () => Promise<T>, config?: RetryConfig): Promise<T>`
- **Algorithme de Backoff** :
  - Formule *Full Jitter* : `temp = min(maxDelayMs, baseDelayMs * 2^attempt)`
  - Délai réel = `Math.random() * temp`
- **Configuration par défaut** :
  - `maxRetries` : 3
  - `baseDelayMs` : 1000 ms
  - `maxDelayMs` : 8000 ms
  - `retryableStatusCodes` : `[408, 429, 500, 502, 503, 504]`
- **Classification des erreurs** :
  - Les timeouts (erreur de fetch jetée après dépassement du signal) et erreurs système de connexion (DNS / ETIMEDOUT / ECONNREFUSED) sont classés comme erreurs réseau éligibles au retry.

---

### 2. CIRCUIT BREAKER PERSISTANT (`src/utils/circuit-breaker.ts`)

- **États** : `CLOSED` (Normal), `OPEN` (Indisponibilité persistante), `HALF_OPEN` (Test de reprise)
- **Persistance** : Fichier JSON global `~/.imara/circuit-breaker.json`.
  - Contient : état actuel, compteur d'échecs consécutifs, timestamp du dernier échec, timestamp de la dernière requête réussie.
- **Paramètres** :
  - `failureThreshold` : 5 échecs consécutifs passent le circuit à `OPEN`.
  - `successThreshold` : 2 succès consécutifs dans l'état `HALF_OPEN` ramènent le circuit à `CLOSED`.
  - `timeoutMs` : 60 000 ms (durée pendant laquelle les requêtes sont bloquées immédiatement).
- **Fonctionnement** :
  - Si le circuit est `OPEN` et que le `timeoutMs` est écoulé, l'état transite temporairement à `HALF_OPEN` pour la prochaine tentative.
  - Si le circuit est `OPEN` et le timeout n'est pas écoulé, toute tentative de requête est immédiatement court-circuitée et rejette une `CircuitBreakerOpenError`.

---

### 3. MODE DÉGRADÉ & CACHE DE REPLI

- **Stockage** : Utilisation de l'existant `CacheManager<T>` configuré pour sauvegarder les réponses de chat persistées sur disque.
- **Clé de cache** :
  - Générée par un hash SHA-256 du tableau complet `messages: Message[]` de la requête (ce qui garantit l'exactitude contextuelle).
- **Politique de fallback** :
  - Si le Circuit Breaker est `OPEN`, ou si la requête a échoué après tous les retries avec une erreur réseau, on tente de récupérer la réponse correspondante dans le cache.
  - Si une réponse en cache est trouvée, on la renvoie et on notifie la status bar de l'état dégradé (`contextState = 'warning'` ou indicateur de mode dégradé).
  - Si aucune réponse n'est en cache, on lève l'erreur originale.

---

### 4. STATUS BAR FIXE ET SANS DUPLICATION (`src/ui/components/status-bar.ts`)

- **Problème résolu** : Actuellement, chaque écriture de la status-bar est imprimée en ligne, créant des doublons gênants dans l'historique lors du défilement.
- **Solution de rendu fixe ("Footer de prompt")** :
  - La status bar est dessinée **uniquement juste en dessous de la ligne de saisie** (le prompt `› `).
  - Lors de l'affichage du prompt :
    1. Effacer la status-bar précédente s'il y en avait une.
    2. Imprimer la status-bar sous la ligne de saisie.
    3. Utiliser les codes escape ANSI `\x1b[A` (déplacement vers le haut) et `\x1b[G` (déplacement au début de la ligne) pour repositionner le curseur du terminal sur la ligne du prompt `› `, permettant à l'utilisateur de saisir son texte normalement.
  - Dès que l'utilisateur valide sa commande (événement `line` de readline) :
    1. Effacer immédiatement la status-bar en effaçant les lignes du dessous à l'aide de codes ANSI (`\x1b[J` - effacer jusqu'à la fin de l'écran).
    2. Cela garantit que la status-bar n'est **jamais** écrite dans l'historique permanent de la session de chat.
- **Indicateur Réseau** :
  - Ajout d'une pastille colorée :
    - `● EN LIGNE` (Vert - CLOSED)
    - `● DÉGRADÉ` (Orange - HALF_OPEN / Serve depuis le cache)
    - `● HORS-LIGNE` (Rouge - OPEN)

---

### 5. DÉPENDANCES ET SYSTÈME D'ÉVÉNEMENTS

- Les changements d'état du Circuit Breaker émettent des événements sur `networkEvents` (de `events.ts`).
- La barre de statut s'abonne à ces événements pour mettre à jour son indicateur réseau de manière dynamique.
