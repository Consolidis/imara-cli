# Spécifications — Correction du circuit d'authentification API key

## 1. Contexte & Enjeux

Un utilisateur Linux ne peut pas utiliser sa clé API, pourtant valide, avec IMARA CLI. L'échec de connexion se traduit par un message "Clé API invalide (code 401)" alors que la clé est correcte.

L'audit du code révèle 5 bugs en cascade qui expliquent le comportement.

## 2. Bugs identifiés

### Bug A — Absence de trimming dans la commande login
Fichier : `src/cli/commands/login.command.ts`
La clé extraite de `options.key` est utilisée brute, sans `.trim()`. Si l'utilisateur colle avec un espace, une tabulation ou un retour à la ligne (copier/coller depuis un terminal, un email, un gestionnaire de mots de passe), la clé stockée est polluée.

### Bug B — keytar = dépendance native non résiliente sur Linux
Fichier : `src/auth/keychain.ts`
`keytar` utilise `libsecret` (libsecret-1.so). Sur les distributions Linux sans cette bibliothèque (ou sans les dev headers à l'installation), keytar échoue silencieusement :
- `setPassword()` ne lève pas d'erreur mais n'écrit rien
- `getPassword()` retourne `null`
- Aucune alternative de stockage n'existe

### Bug C — requireAuth() ignore ConfigManager
Fichier : `src/auth/auth.ts`
La fonction `requireAuth()` ne lit que `Keychain.get()` et `process.env.IMARA_API_KEY`. Elle ignore totalement `ConfigManager.get().apiKey` qui est pourtant un champ défini dans le schéma.

### Bug D — Stockage de la clé absent dans ConfigManager
Fichiers : `src/cli/commands/login.command.ts`, `src/cli/wizard.ts`
Lors du login ou du wizard, la clé API est sauvée uniquement via `Keychain.save()`. Le `ConfigManager.set()` n'est appelé que pour `userName` et `userEmail`. La clé n'est jamais écrite dans `~/.imara/config.json`.

### Bug E — Priorité inversée dans ImaraClient
Fichier : `src/api/imara-client.ts`
```ts
this.apiKey = getApiKey() || apiKey;
```
La variable d'environnement `IMARA_API_KEY` écrase la clé passée explicitement en paramètre. Si l'env contient une valeur obsolète ou incorrecte, la validation serveur échoue.

## 3. Solution technique

### A — Trimming systématique
Ajouter `.trim()` sur toute entrée de clé API, que ce soit depuis la CLI ou le wizard.

### B — FileKeychain (fallback résilient)
Créer un système de stockage fichier (`~/.imara/api-key`) qui sert de fallback quand keytar est absent ou échoue :
- Au write : tente keytar, si échec -> écrit dans le fichier (600 permissions)
- Au read : tente keytar, si null -> lit le fichier

### C — requireAuth() étendu avec fallback complet
Nouvel ordre : Keychain.get() > ConfigManager.get().apiKey > getApiKey()
Comme ça même sans keytar ni env, la clé stockée dans config.json est trouvée.

### D — Persistance de la clé dans ConfigManager
Au login et dans le wizard, en plus de Keychain.save(), faire `ConfigManager.set({ apiKey })`.

### E — Correction de la priorité dans ImaraClient
Remplacer `getApiKey() || apiKey` par `apiKey || getApiKey()` pour que le paramètre explicite prime sur l'env.

## 4. Critères d'Acceptation

- [ ] Une clé collée avec des espaces ou sauts de ligne est correctement nettoyée avant stockage
- [ ] Sur Linux sans libsecret, la clé est stockée dans `~/.imara/api-key` et lue correctement
- [ ] `requireAuth()` réussit si la clé est présente dans ConfigManager (même sans keytar ni env)
- [ ] La clé API est écrite dans `ConfigManager` lors de `imara login` et du wizard
- [ ] `ImaraClient(maBonneCle)` utilise bien `maBonneCle` même si `IMARA_API_KEY` est défini avec une autre valeur
- [ ] Aucune régression dans les tests existants (vérifier avec `npm test`)
