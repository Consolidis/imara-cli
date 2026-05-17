# Spécification Technique — Écosystème SQLite Persistant

Cette spécification technique est le document de référence de la conception de la persistance locale via SQLite pour IMARA-CLI.

---

## 1. Contexte & Objectifs

Aujourd'hui, l'historique des discussions et l'état des sessions IMARA-CLI sont volatils. Lorsque l'utilisateur ferme son terminal, son historique de conversation est définitivement effacé. 

Le but de cette spécification est de concevoir un écosystème de **persistance locale robuste, léger, et transparent** s'appuyant sur SQLite. Cet écosystème permettra :
* De conserver l'historique complet des sessions de chat et de charger n'importe quelle discussion passée.
* D'auto-sauvegarder chaque message échangé.
* De restaurer une session non clôturée dès le redémarrage.
* D'offrir une interface de requêtage relationnelle propre pour gérer le cycle de vie de la base.

---

## 2. Choix Technologiques & Emplacement

*   **Moteur SQL** : Utilisation de **`better-sqlite3`**. Cette bibliothèque Node.js est synchrone (ce qui évite la complexité des promesses asynchrones dans la CLI lors de la fermeture ou du traitement des signaux système), ultra-rapide et compile nativement.
*   **Fichier de Base de Données** : La base de données sera stockée localement dans le répertoire utilisateur sous :
    `~/.imara/data/imara.db` (en production) ou `./.imara/data/imara.db` (en développement).

---

## 3. Schéma de Base de Données

Le schéma initial comprend trois tables clés :

### 3.1 Table `sessions`
Stocke les métadonnées de chaque session de chat.
```sql
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,             -- UUID généré
  title TEXT NOT NULL,             -- Titre auto-généré ou personnalisé
  activeTrackId TEXT,              -- Track Conductor actif (optionnel)
  model TEXT NOT NULL,             -- Modèle actif pour cette session (ex: zuri)
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 3.2 Table `messages`
Enregistre chaque message de la session avec des métriques de consommation et coûts en FCFA.
```sql
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,             -- UUID généré
  sessionId TEXT NOT NULL,         -- Clé étrangère vers sessions
  role TEXT NOT NULL,              -- 'user' | 'assistant' | 'system' | 'tool'
  content TEXT NOT NULL,           -- Message brut
  promptTokens INTEGER DEFAULT 0,  -- Tokens consommés en entrée
  completionTokens INTEGER DEFAULT 0, -- Tokens consommés en sortie
  costFcfa REAL DEFAULT 0.0,       -- Coût estimé en FCFA
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(sessionId) REFERENCES sessions(id) ON DELETE CASCADE
);
```

### 3.3 Table `context_summaries`
Stocke les résumés compressés de contextes historiques générés par l'agent.
```sql
CREATE TABLE IF NOT EXISTS context_summaries (
  id TEXT PRIMARY KEY,
  sessionId TEXT NOT NULL,
  summaryText TEXT NOT NULL,
  tokenCount INTEGER NOT NULL,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(sessionId) REFERENCES sessions(id) ON DELETE CASCADE
);
```

### 3.4 Versioning & Migrations
Un mécanisme d'initiation et de migration incrémentale sera codé en dur dans `src/storage/sqlite-provider.ts` via une table système `schema_migrations` :
```sql
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  appliedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## 4. Interfaces & Résilience (Graceful Degradation)

### 4.1 Interface `StorageProvider`
```typescript
export interface StorageProvider {
  initialize(): void;
  createSession(id: string, title: string, model: string, activeTrackId?: string): void;
  saveMessage(sessionId: string, message: StorageMessage): void;
  getMessages(sessionId: string): StorageMessage[];
  listSessions(): StorageSession[];
  deleteSession(sessionId: string): void;
  clearHistory(): void;
}
```

### 4.2 Tolérance aux Pannes
Si l'initialisation de `better-sqlite3` échoue (ex: bibliothèque native absente, corruption du fichier, ou problèmes d'accès en écriture dans le répertoire de l'utilisateur), la CLI doit :
1.  Afficher une erreur de diagnostic discrète et non-bloquante au démarrage.
2.  Basculer sur un `InMemoryStorageProvider` temporaire pour préserver le fonctionnement de l'application en mode dégradé (sans faire planter la CLI).

---

## 5. Spécification de l'Interface utilisateur (UX/REPL)

### 5.1 Commande `/sessions`
Affiche une table textuelle soignée récapitulant les 10 dernières sessions :
```text
  🤖 HISTORIQUE DES SESSIONS :
  ┌──────────────────────────────────────┬──────────────────────────────────┬──────────────┬─────────────────────┐
  │ ID Session                           │ Titre / Description              │ Modèle       │ Date                │
  ├──────────────────────────────────────┼──────────────────────────────────┼──────────────┼─────────────────────┐
  │ abc842c1-d412-4eb2-a9b1-aef47dc12903 │ Correction des bugs d'API        │ zuri         │ 17/05/2026 14:20    │
  │ fcb01931-e129-4b12-b9c1-ddc19f201089 │ Test de résilience réseau        │ flash        │ 17/05/2026 12:05    │
  └──────────────────────────────────────┴──────────────────────────────────┴──────────────┴─────────────────────┘
  👉 Tapez /load <id> pour reprendre une session.
```

### 5.2 Commande `/load <id>`
*   Charge la session depuis la base de données.
*   Vide et recharge l'état du `SessionManager` et de la `ContextWindow`.
*   Affiche l'écran d'accueil avec l'historique restauré dans la mémoire de l'agent.

### 5.3 Commande `/clear-history`
Efface complètement toutes les sessions et tous les messages stockés après confirmation interactive de l'utilisateur (`y/N`).

### 5.4 Auto-Resume & Garbage Collector
*   **Auto-Resume** : Si la dernière session de chat a été quittée de manière inopinée (non clôturée) il y a moins de 24h, le chat invite l'utilisateur : *« Souhaitez-vous reprendre votre dernière session active ? (y/N) »*.
*   **Garbage Collector** : Lors du lancement, un processus asynchrone élimine de la base de données toutes les sessions et messages dont le `updatedAt` est supérieur à 30 jours, optimisant ainsi l'espace disque.
