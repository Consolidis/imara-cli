# Plan — Remplacer DuckDuckGo par API Imara pour web_search + extraction contenu sites

## Tâches

- [~] Étape 1 : Supprimer `duckduckgo-search` de package.json et `src/types/duckduckgo-search.d.ts`
- [x] Étape 2 : Reecrire `web-search.tool.ts` avec API Imara comme source unique + extraction contenu URL
- [x] Étape 3 : Supprimer le type `SearchResult` du module duckduckgo-search importe dans web-search.tool.ts
- [x] Étape 4 : Mettre a jour la description de l'outil dans la definition
- [x] Étape 5 : Verifier compilation TypeScript
- [x] Étape 6 : Verifier les tests
