# Spécifications — Audit et hardening sécurité

## 1. Contexte & Enjeux
L'audit a révélé plusieurs fragilités :
- Clé API potentiellement stockée en clair dans `.imara/config.json`
- Aucune validation du format de l'API key ni de l'URL de l'API
- `dotenv` en version `^17.4.2` inexistante (risque supply-chain)
- Pas de timeout ni de retry sur les requêtes `fetch`
- Les logs de debug peuvent exposer des données utilisateur
- `keytar` peut échouer silencieusement sur Linux sans libsecret

## 2. Architecture & Choix Techniques
- Module `src/utils/security.ts` : validateurs d'URL, de clé API, scrubber de logs
- Module `src/utils/fetch-with-timeout.ts` : wrapper `fetch` avec timeout et retry exponentiel
- Hardening `Keychain` : gestion d'erreurs explicite, fallback en mémoire uniquement si `IMARA_SECURE_MODE=false`
- `config.json` : permissions restrictives `0o600`
- `.npmrc` avec `engine-strict=true`

## 3. Critères d'Acceptation
- [ ] L'API key est validée (longueur minimale, caractères autorisés)
- [ ] L'URL de l'API accepte uniquement `https://`
- [ ] Toute requête `fetch` possède un timeout de 30s et 1 retry
- [ ] Les logs debug masquent automatiquement les credentials
- [ ] `config.json` est créé avec les permissions `0o600`
- [ ] La version `dotenv` est corrigée en `^16.4.5`
- [ ] `keytar` lève une erreur explicite si le keyring est indisponible
- [ ] Variable `IMARA_SECURE_MODE=true` bloque la lecture de `IMARA_API_KEY`
- [ ] Tests passent à 100%
