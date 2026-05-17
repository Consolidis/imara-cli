PLAN D'EXECUTION — TRACK 005

PHASE 1 — CONSTITUTION DU BUS D'ÉVÉNEMENTS & STATUS BAR FIXE

- [x] 1.1 Créer le bus d'événements global `src/utils/events.ts` (`networkEvents`) pour communiquer les statuts réseau.
- [x] 1.2 Refactoriser `src/ui/components/status-bar.ts` pour implémenter le mode "Footer fixe de prompt" utilisant des escapes codes ANSI (`\x1b[A`, `\x1b[G`, `\x1b[J`) et les pastilles colorées (`● EN LIGNE`, `● DÉGRADÉ`, `● HORS-LIGNE`).
- [x] 1.3 Intégrer les fonctions d'affichage et d'effacement automatique de la status bar dans `src/cli/commands/chat.command.ts` (effacer à la soumission, réafficher à l'inactivité).
- [x] 1.4 Adapter `src/agent/agent.ts` pour qu'il émette les métriques système sans imprimer de doublons perturbants de la barre au milieu de l'écran.

PHASE 2 — RETRY EXPONENTIEL (EXPONENTIAL BACKOFF + JITTER)

- [x] 2.1 Créer le module `src/utils/retry.ts` avec la fonction `executeWithRetry` et l'algorithme *Full Jitter*.
- [x] 2.2 Configurer les paramètres par défaut (`maxRetries: 3`, `baseDelayMs: 1000ms`, `maxDelayMs: 8000ms`, codes 408/429/500/502/503/504).
- [x] 2.3 Identifier et classer les erreurs réseau, timeouts DNS/TCP dans `ImaraClient` pour déclencher les retries intelligemment.
- [x] 2.4 Intégrer `executeWithRetry` dans `ImaraClient` pour envelopper les appels `/v1/agent/chat` et `/v1/agent/profile`.

PHASE 3 — CIRCUIT BREAKER PERSISTANT

- [x] 3.1 Créer `src/utils/circuit-breaker.ts` avec la logique d'états `CLOSED`, `OPEN` et `HALF_OPEN`.
- [x] 3.2 Implémenter la persistance globale dans le fichier `~/.imara/circuit-breaker.json`.
- [x] 3.3 Configurer les seuils (`failureThreshold: 5`, `successThreshold: 2`, `timeoutMs: 60s`).
- [x] 3.4 Intercepter les appels dans `ImaraClient` : bloquer immédiatement les requêtes et lancer une `CircuitBreakerOpenError` si le circuit est `OPEN`.

PHASE 4 — CACHE DE REPLI SUR HASH DE CONTEXTE

- [x] 4.1 Implémenter le calcul de signature contextuelle (hachage SHA-256 du tableau `messages[]` nettoyé) dans `src/utils/cache.ts`.
- [x] 4.2 Stocker la réponse dans le cache local (SQLite ou SQLite + fichier) à chaque appel réussi.
- [x] 4.3 Détecter l'erreur `CircuitBreakerOpenError` ou toute erreur de type `offline` / timeout dans `ImaraClient` pour déclencher la recherche dans le cache.
- [x] 4.4 Renvoyer la réponse en cache si disponible, avec une mention visuelle claire "● CACHÉ" dans le stream et le flag `cached: true` ou similaire.tut réseau comme `DÉGRADÉ`.

PHASE 5 — TESTS & VALIDATION QUALITÉ

- [x] 5.1 Écrire les tests unitaires complets (`vitest`) pour `retry.ts`, `circuit-breaker.ts` et le cache de repli.
- [x] 5.2 Valider la couverture de tests (> 80% sur ces nouveaux fichiers).
- [x] 5.3 Réaliser un smoke test interactif de la CLI pour valider visuellement que le status bar reste fixe sans aucune duplication à l'écran.

---
### DEFINITION OF DONE :
- La status bar est parfaitement fixe sous la zone de saisie et s'efface proprement lors de l'envoi du message. Plus de doublons de barre de statut dans le journal d'échange !
- Les timeouts et coupures réseau sont gérés via retries exponentiels avec jitter.
- En cas de crash prolongé du serveur (5 échecs), le Circuit Breaker bloque immédiatement les appels et persiste son état globalement.
- Si une requête échoue ou que le circuit est coupé, la CLI sert des réponses en cache basées sur le contexte précis de la discussion sans interruption brutale.
- Couverture de test > 80% sur les nouveaux modules de résilience.

[checkpoint: 0dd7788]
