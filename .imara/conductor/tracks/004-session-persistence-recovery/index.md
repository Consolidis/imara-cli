# Track 004 — Session Persistence & Recovery

**Statut :** 🟡 En cours
**Créé :** 2026-05-17

## Objectif
Permettre la sauvegarde automatique et manuelle de l'état d'une session de conversation, et permettre sa reprise complète après fermeture du CLI. Cela inclut l'historique des messages, les fichiers attachés/contextuels, l'état des tracks et la configuration active.

## Scope
- Persistence sur disque du contexte de session (SQLite ou JSONL).
- Commandes `/save`, `/load`, `/ls` dans le REPL.
- Restauration transparente de la conversation au redémarrage du CLI.
- Gestion de l'expiration et du nettoyage des sessions anciennes.
