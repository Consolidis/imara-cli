# Plan — Audit et hardening sécurité

## Phase 1 — Fondations sécurité (utils)
- [ ] Créer `src/utils/security.ts` : validateurs URL, API key, scrubber
- [ ] Créer `src/utils/fetch-with-timeout.ts` : timeout 30s + retry
- [ ] Ajouter les tests correspondants

## Phase 2 — Hardening crédentiels
- [ ] Modifier `keychain.ts` : erreurs explicites, fallback sécurisé
- [ ] Modifier `config.ts` : permissions 0o600, validation URL/key
- [ ] Modifier `imara-client.ts` : utiliser fetch robuste + validateurs
- [ ] Modifier `env.ts` : respect IMARA_SECURE_MODE
- [ ] Ajouter les tests

## Phase 3 — Supply chain & packaging
- [ ] Corriger `dotenv` en `^16.4.5` dans `package.json`
- [ ] Ajouter `.npmrc` avec `engine-strict=true`
- [ ] Vérifier build et tests passent

## Phase 4 — Clôture
- [ ] Documenter les changements sécurité dans README
- [ ] Archiver le track
