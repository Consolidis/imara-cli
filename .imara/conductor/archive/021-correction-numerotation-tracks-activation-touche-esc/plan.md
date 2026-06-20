# Plan — Correction numérotation tracks + activation touche Esc

## Tâches

- [x] Étape 1 : Corriger la numérotation dans `TrackManager.newTrack()` (max id + 1 au lieu de length + 1)
- [x] Étape 2 : Activer `readline.emitKeypressEvents(process.stdin)` + `setRawMode(true)` dans `chat.command.ts`
- [x] Étape 3 : Restaurer le mode raw à la fermeture (listener 'close' de readline)
- [x] Étape 4 : Vérifier la compilation TypeScript
- [x] Étape 5 : Tester la non-régression
