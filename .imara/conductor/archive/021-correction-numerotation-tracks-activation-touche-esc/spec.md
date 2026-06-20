# Spécifications — Correction numérotation tracks + activation touche Esc

## 1. Problème 1 : Numérotation des tracks non unique

**Constat :** La méthode `TrackManager.newTrack()` dans `src/context/conductor/track-manager.ts` calcule le prochain numéro de track avec `existingTracks.length + 1`. Cette approche produit des IDs en doublon si des tracks sont supprimés ou archivés.

**Racine :** Ligne 133 : `const nextNum = String(existingTracks.length + 1).padStart(3, '0');`

**Solution :** Parcourir les IDs existants, extraire le préfixe numérique, prendre le maximum + 1.

## 2. Problème 2 : Touche Esc inactive

**Constat :** Le fichier `src/cli/commands/chat.command.ts` définit un `keypressHandler` qui écoute la touche Esc pour annuler le traitement de l'agent (lignes 152-160). Cependant, `process.stdin` n'est jamais configuré en mode raw, donc les événements `keypress` ne sont pas émis.

**Racine :** Absence de `readline.emitKeypressEvents(process.stdin)` et `process.stdin.setRawMode(true)` avant l'attachement du listener.

**Solution :** Activer le mode raw au démarrage du chat, restaurer le mode normal à la fermeture.

## 3. Critères d'Acceptation

- [x] Créer deux tracks à la suite donne des IDs distincts (ex: 049-xxx puis 050-yyy)
- [x] Après suppression manuelle d'un track, le prochain ID ne recycle pas un ancien numéro
- [x] La touche Esc annule le traitement de l'agent (équivalent à Ctrl+C mais sans tuer le processus)
- [x] Après annulation par Esc, l'utilisateur peut saisir une nouvelle question
- [x] Le mode raw du terminal est correctement restauré à la fermeture du chat
