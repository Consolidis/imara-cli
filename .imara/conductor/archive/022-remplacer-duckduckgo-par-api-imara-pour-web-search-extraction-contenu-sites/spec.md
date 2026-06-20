# Spécifications — Remplacer DuckDuckGo par API Imara pour web_search + extraction contenu sites

## 1. Problème

L'outil `web_search` utilise actuellement DuckDuckGo (`duckduckgo-search` package) comme source principale, avec un fallback vers l'API Imara backend. DuckDuckGo est peu fiable, rate beaucoup de requetes, et necessite des imports dynamiques ESM-only fragiles.

## 2. Solution

### 2.1 Supprimer DuckDuckGo

- Retirer le package `duckduckgo-search` des dependances
- Supprimer tout le code DuckDuckGo de `web-search.tool.ts`
- Supprimer le fichier de types `src/types/duckduckgo-search.d.ts`

### 2.2 API Imara comme source unique

- Utiliser l'API Imara backend (`POST /v1/agent/search`) comme source principale et unique
- Reutiliser la connexion existante (ImaraClient) via l'API key de l'utilisateur

### 2.3 Extraction de contenu de sites web

- Ajouter la capacite d'extraire le contenu textuel d'une URL donnee
- Utiliser `fetch()` directement depuis Node.js (fetch natif > Node 18)
- Extraire le texte du HTML (stripper les balises, garder les paragraphes, titres, liens)
- Limiter a 8000 caracteres pour eviter les payloads trop gros
- Ajouter un parametre optionnel `url` a l'outil `web_search`

## 3. Critères d'Acceptation

- [x] La recherche web utilise exclusivement l'API Imara backend
- [x] L'outil `web_search` avec le parametre `url` extrait le contenu textuel de la page
- [x] Pas de dependance vers `duckduckgo-search`
- [x] Compilation TypeScript OK
- [x] Les tests passent
