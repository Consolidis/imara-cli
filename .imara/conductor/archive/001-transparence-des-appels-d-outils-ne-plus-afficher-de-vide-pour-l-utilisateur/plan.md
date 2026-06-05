# Plan - Transparence des appels d'outils

## Taches

- [x] T1 : Ameliorer `formatToolAction` dans tool-labels.ts pour detecter les
      arguments vides et afficher "(requete vide)", "(aucun chemin)" etc.
- [x] T2 : Ameliorer `showToolResult()` dans renderer.ts pour afficher un
      extrait du contenu (premiere ligne, max 80 caracteres) au lieu de le
      jeter.
- [x] T3 : Ameliorer `showToolCall()` dans tool-call.ts pour supporter
      l'affichage d'un extrait de resultat.
- [x] T4 : Corriger `executeReadOnlyBatch` dans agent.ts pour transmettre le
      contenu a l'UI (resultat visible).
- [x] T5 : Corriger le fallback Imara de `web-search.tool.ts` pour faire un
      vrai appel API ou retourner une erreur explicite.
- [x] T6 : Lancer les tests et verifier la compilation.
