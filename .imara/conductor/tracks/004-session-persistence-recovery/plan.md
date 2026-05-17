# Plan — Session Persistence & Recovery

## Phase 1 — Modele de Donnees
1.1 [ ] Definir schema Session (UUID, titre, createdAt, updatedAt, messages[], fileContext[], activeTrackId).
1.2 [ ] Definir format de stockage (JSONL ligne par message + fichier meta).
1.3 [ ] Implementer SessionStore dans `src/context/store.ts`.
## Phase 2 — Sauvegarde Automatique
2.1 [ ] Hook auto-save apres chaque tour agent (debounce 2s).
2.2 [ ] Serializer les messages avec role, content, tool_calls.
2.3 [ ] Sauvegarder les fichiers attaches (snapshot path + hash).
## Phase 3 — Commandes Interactives
3.1 [ ] Ajouter `/save [nom]` au REPL (`src/cli/repl.ts`).
3.2 [ ] Ajouter `/load [id | nom]` au REPL.
3.3 [ ] Ajouter `/sessions` pour lister les sessions disponibles.
## Phase 4 — Restauration & Nettoyage
4.1 [ ] Charger la derniere session au demarrage si flag `autoResume`.
4.2 [ ] Implementer garbage collector (supprimer sessions > 30j).
## Phase 5 — Tests & Stabilisation
5.1 [ ] Tests unitaires SessionStore (creer, lire, lister, supprimer).
5.2 [ ] Tests integration chargement/restauration dans REPL.
