# Track 005 — Audit et hardening sécurité

**Statut :** 🟡 En cours  
**Créé :** 2026-05-17

## Objectif
Identifier et corriger les failles de sécurité du CLI : stockage des credentials, validation des entrées, robustesse réseau, supply chain.

## Points d'audit identifiés
1. Config JSON sans permissions restrictives
2. Aucune validation du format API key / URL
3. `dotenv` version inexistante (`^17.4.2`)
4. `fetch` sans timeout ni retry
5. Logs debug pouvant exposer des données sensibles
6. `keytar` sans gestion d'erreur explicite
7. Variable `IMARA_API_KEY` toujours lue sans mode sécurisé optionnel
