# 🏗️ Conductor Methodology (Imara AI)

Conductor est une méthodologie de développement structurée intégrée nativement dans l'agent **Imara**. Elle transforme l'IA d'un simple générateur de code en un **Ingénieur Lead Autonome** qui suit un cycle de vie rigoureux pour garantir la qualité, la cohérence et la maintenabilité de vos projets.

---

## 🚀 Philosophie : "Mesurer deux fois, Coder une fois"

L'objectif de Conductor est d'éviter les erreurs coûteuses en forçant une phase de réflexion et de planification avant toute modification de code. L'agent ne peut pas écrire de fichier ou exécuter de commande destructrice tant que vous n'avez pas validé son plan d'action.

---

## 🔄 Le Cycle de Vie Conductor

Chaque tâche complexe suit ces 4 étapes systématiques :

### 1. 🔍 Inquiry (Enquête)
L'IA analyse votre demande et explore le code existant. Elle vous posera des questions de clarification pour comprendre les contraintes techniques et les objectifs métier.
- **But** : Zéro ambiguïté avant de commencer.

### 2. 📝 Planning (Planification)
L'IA crée un **Track** (un dossier de suivi) et génère deux documents :
- `spec.md` : Spécifications techniques et choix d'architecture.
- `plan.md` : Liste détaillée des tâches étape par étape.
- **But** : Établir une "Source of Truth" partagée.

### 3. ✅ Approval (Validation)
L'agent s'arrête et attend votre feu vert. Vous devez examiner le plan.
- **Action** : Utilisez la commande slash `/approve` dans le chat pour débloquer l'exécution.
- **But** : Garder le contrôle total sur les changements.

### 4. ⚡ Execution (Exécution)
L'IA implémente le code par petites itérations (max 50 lignes par fichier pour éviter la corruption). Elle met à jour le statut des tâches dans `plan.md` en temps réel.
- **But** : Précision chirurgicale et feedback constant.

---

## 🛠️ Commandes CLI Rapides

| Commande | Action |
| :--- | :--- |
| `imara init-conductor` | Initialise le framework dans un nouveau projet (interactif). |
| `imara track new "titre"` | Crée un nouvel objectif de travail. |
| `imara track implement <id>` | Active un track et lance l'analyse automatique de l'IA. |
| `imara track status` | Affiche l'avancement du plan et les logs récents. |
| `imara track list` | Liste tous les tracks (actifs, finis, archivés). |

---

## 💬 Commandes Slash (Dans le Chat)

Optimisez votre workflow sans quitter la session de chat :

- `/track` : Affiche l'état du track courant et le plan.
- `/approve` : Valide le plan et autorise l'IA à coder.
- `/archive` : Termine le track et nettoie la session.
- `/files` : Liste les fichiers actuellement en contexte.

---

## 📂 Structure du Dossier `.imara/conductor/`

- `product.md` : La vision globale de votre produit.
- `tracks.md` : Le registre de tous vos tracks passés et présents.
- `workflow.md` : Rappel des règles de la méthodologie.
- `tracks/` : Contient un sous-dossier par track avec son propre `plan.md` et `spec.md`.

---

> **Note :** Conductor est conçu pour les développeurs qui exigent de la rigueur. En suivant ce flux, vous réduisez les régressions et facilitez la collaboration entre vous et l'IA.
