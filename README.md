# 🚀 Imara CLI

**Imara CLI** est un agent de codage IA d'élite pour votre terminal. Propulsé par Imara AI, il intègre la méthodologie **Conductor** pour transformer vos sessions de chat en cycles de développement structurés et de haute qualité.

## ✨ Caractéristiques

- 🧠 **Intelligence d'Élite** : Modèles spécialisés pour le codage et l'analyse.
- 🏗️ **Méthodologie Conductor** : Workflow intégré (Inquiry, Planning, Approval, Execution).
- 🛡️ **Guardrails de Sécurité** : L'IA ne code qu'après votre validation du plan.
- 📂 **Analyse de Contexte** : Compréhension automatique de l'arborescence et de la stack technique.
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

## 🏗️ Méthodologie Conductor

Pour une explication détaillée de la méthodologie, consultez [CONDUCTOR.md](./CONDUCTOR.md).

## 🛠️ Développement Local

```bash
git clone https://github.com/Consolidis/imara-cli.git
cd imara-cli
npm install
npm run build
npm link
```

## 📄 Licence

Ce projet est sous licence MIT - voir le fichier [LICENSE](./LICENSE) pour plus de détails. 

---
Propulsé par [Imara AI - Consolidis](https://imara.consolidis.com/chat)
