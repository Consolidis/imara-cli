# PLAN: Nettoyage du statut thinking et synchronisation UI

## Etapes

- [ ] Corriger la coherence du type `phase` dans `src/ui/components/status-bar.ts`
- [ ] Remplacer `'thinking'` par `'tool'` dans `src/cli/commands/chat.command.ts`
- [ ] Nettoyer l'icone de phase dans `status-bar.ts` si `'thinking'` est retire
- [ ] Verifier la compilation TypeScript

## Notes
Le fichier `status-bar.ts` est dans un etat incoherent actuellement :
- Le type `phase` a ete modifie pour exclure `'thinking'`
- Mais la logique `phaseIcon` y fait toujours reference
Cette etape deplombee sera resolue en premier.
