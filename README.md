# 🚀 Imara CLI

**Imara CLI** est un agent de codage IA d'élite pour votre terminal. Propulsé par Imara AI, il intègre la méthodologie **Conductor** pour transformer vos sessions de chat en cycles de développement structurés et de haute qualité.

## ✨ Caractéristiques

- 🧠 **Intelligence d'Élite** : Modèles spécialisés pour le codage et l'analyse.
- 🏗️ **Méthodologie Conductor** : Workflow intégré (Inquiry, Planning, Approval, Execution).
- 🛡️ **Guardrails de Sécurité** : L'IA ne code qu'après votre validation du plan.
- 📂 **Analyse de Contexte** : Compréhension automatique de l'arborescence et de la stack technique.
- 📊 **Gestion Intelligente du Contexte** : Comptage précis de tokens, fenêtre de contexte auto-compactée, résumés de session, statut temps réel.
- ⚡ **Performance** : Exécution optimisée pour la rapidité et la précision.

## 📦 Installation

Pour installer Imara globalement sur votre système :

```bash
npm install -g @consolidis/imara-cli
```

## 🚀 Démarrage Rapide

### 1. Connexion
```bash
imara login --key VOTRE_CLE_API
```

### 2. Initialisation d'un projet (Conductor)
```bash
imara init-conductor
```

### 3. Créer un objectif
```bash
imara track new "Ajouter un système de notifications"
```

### 4. Lancer l'implémentation
```bash
imara track implement 001
```

## 💾 Persistance des Sessions, Historique & Isolation

IMARA CLI intègre un moteur de stockage local ultra-robuste et performant basé sur **SQLite** (`better-sqlite3` en mode WAL avec clés étrangères indexées). Toutes vos interactions, historiques et résumés contextuels sont stockés en sécurité à un emplacement centralisé.

### 1. Base de Données Unifiée & Mode Volatile
* **Fichier Unique** : Toute l'activité est écrite de façon transactionnelle dans `~/.imara/data/imara.db`.
* **Mode Volatile** : Si vous ne souhaitez pas persister votre historique localement, vous pouvez à tout moment désactiver l'écriture SQL via la configuration globale :
  ```bash
  imara config set persistHistory false
  ```
* **Résilience native (Graceful Degradation)** : Si la base est verrouillée ou inaccessible, la CLI bascule automatiquement en mode mémoire volatile non-bloquant avec un avertissement de diagnostic.

### 2. Isolation des Espaces de Travail (Workspaces)
Pour votre sécurité et la propreté de vos projets, **l'historique des conversations est strictement confiné par dossier de projet** (`process.cwd()`).
* Les sessions ouvertes dans le Projet A ne seront jamais visibles ni rechargeables dans le Projet B.
* Le chargement croisé d'une session externe via `/load` est bloqué par un panneau de sécurité.

### 3. Commandes Interactives REPL de Session
Pendant que vous discutez dans le chat interactif d'IMARA, vous disposez de commandes slash spécialisées pour piloter vos sessions :
* `/sessions` : Affiche un superbe tableau formaté en grille ASCII récapitulant les sessions passées de votre dossier courant (ID, Titre, Modèle actif, Date).
* `/load <id|nom>` : Recharge instantanément l'historique complet d'une session passée (dans la limite du projet courant).
* `/clear-history` : Purge définitivement toutes les sessions et messages stockés pour le projet courant, après confirmation interactive de sécurité `y/N`.

### 4. Auto-Resume Intelligent
Au démarrage du chat interactif, si une session active récente est détectée pour ce projet, IMARA vous propose de reprendre là où vous vous étiez arrêté :
`Souhaitez-vous reprendre votre dernière session active "session_123" ? (y/N) :`
En saisissant `y`, vous restaurez instantanément tout le contexte de travail. En saisissant `n`, une session vierge est démarrée.

### 5. Garbage Collector Asynchrone (GC)
Afin d'éviter que la base de données ne prenne de l'espace disque inutilement, un démon automatique s'exécute silencieusement en tâche de fond **1 seconde après le démarrage de la CLI** et supprime définitivement toutes les sessions inactives de plus de **30 jours**.

## 🌐 Conductor Fédéré & Multi-Dépôts Git (Support Monorepo & Multi-App)

IMARA CLI intègre un support de pointe pour les architectures complexes, les monorepos et les projets composés de plusieurs applications autonomes (ex: `backend`, `frontend`, `cli`) possédant chacun leur propre dépôt Git (`.git`).

### 1. Découverte Ascendante Dynamique (Dynamic Upward Discovery)
Lorsque vous lancez une commande `imara chat` ou `imara track` depuis un sous-dossier (par exemple, profondément niché dans `imara-cli/src/`), la CLI grimpe automatiquement et récursivement les répertoires parents pour localiser la racine de l'orchestration globale.
* Elle recherche les dossiers `conductor/`, `backend/conductor/` ou `.imara/conductor/`.
* Une fois trouvée, cette racine devient la **Source of Truth** centralisée pour tous vos fichiers de track (plans, spécifications, statuts, historique).

### 2. Scanner Multi-Dépôts Git (Unified Multi-Git Status)
Au cours de l'analyse, IMARA explore dynamiquement votre workspace (parents et enfants immédiats) pour détecter tous les dépôts Git indépendants.
* Elle identifie la branche courante et le statut des fichiers modifiés/stades/non suivis de chaque application distincte (`backend/`, `frontend/`, `imara-cli/`).
* Ces métadonnées sont consolidées et injectées de manière transparente dans le prompt système de l'agent ReAct. L'IA a donc une **compréhension transversale, globale et temps réel** des modifications Git de toute la base de code.

### 3. Opérations Shell Ciblées & Sécurisées (`run_command`)
L'outil `run_command` à disposition de l'agent a été étendu avec un paramètre optionnel `cwd` pour permettre des opérations ultra-précises :
* **Ciblage de Dépôt** : L'IA peut orchestrer des commits, attacher des `git notes` d'audit ou installer des dépendances spécifiquement dans un sous-dépôt en fournissant `cwd: "backend"`.
* **Garde-Fou de Sécurité** : Une barrière de confinement valide systématiquement le chemin `cwd` et bloque immédiatement toute exécution ciblant des répertoires situés hors des limites physiques du projet.

## 🏗️ Méthodologie Conductor

Pour une explication détaillée de la méthodologie, consultez [CONDUCTOR.md](./CONDUCTOR.md).

## 🛠️ Développement Local

```bash
git clone https://github.com/Consolidis/imara-cli.git
cd imara-cli
npm install
npm run test
npm run build
npm link
```

## 📄 Licence

Ce projet est sous licence MIT - voir le fichier [LICENSE](./LICENSE) pour plus de détails. 

---
Propulsé par [Imara AI - Consolidis](https://imara.consolidis.com)
