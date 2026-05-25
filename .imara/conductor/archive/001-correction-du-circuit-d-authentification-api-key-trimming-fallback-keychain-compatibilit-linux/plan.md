# Plan — Correction du circuit d'authentification API key

## Tâches

- [x] **T1 — Trimming dans login.command.ts** : Ajouter `.trim()` sur `options.key` avant utilisation et stockage
- [x] **T2 — FileKeychain fallback** : Créer une classe `FileKeychain` qui stocke la clé dans `~/.imara/api-key`. Modifier `Keychain.save/get/delete` pour tenter keytar d'abord, puis tomber sur le fichier
- [x] **T3 — requireAuth() lit ConfigManager** : Ajouter `ConfigManager.get().apiKey` dans la chaîne de fallback de `requireAuth()`
- [x] **T4 — Stocker apiKey dans ConfigManager au login et wizard** : Ajouter `ConfigManager.set({ apiKey })` dans `login.command.ts` et `wizard.ts`
- [x] **T5 — Correction priorité ImaraClient** : Inverser l'ordre : `apiKey || getApiKey()` au lieu de `getApiKey() || apiKey`
- [x] **T6 — Test et validation** : Vérifier les tests existants, lancer `npm test`, s'assurer qu'il n'y a pas de régression

## Ordre d'exécution

1. T1 (trivial, 1 ligne)
2. T5 (trivial, 1 ligne)
3. T2 (modification du keychain, besoin de création fichier et vérification existance keytar)
4. T3 (modification de auth.ts)
5. T4 (modification login.command.ts + wizard.ts)
6. T6 (validation finale)
