Track 007 — Support Multi-Modeles & Swapping Dynamique

Statut : En cours
Cree : 2026-05-17

Objectif
Permettre a l'utilisateur de switcher dynamiquement entre differents modeles de langage (OpenAI, Anthropic, Mistral, etc.) au cours d'une session. Definir un mappage de capacites par modele pour adapter automatiquement les appels API et les prompts.

Scope
- Fichier de configuration des modeles supports (models.json).
- Commande /model pour lister et changer de modele a la volee.
- Abstraction de l'API client pour supporter plusieurs providers.
- Mapping des capacites : context window, token limit, tool support, vision.
- Adaptation automatique des prompts systeme selon le modele actif.
