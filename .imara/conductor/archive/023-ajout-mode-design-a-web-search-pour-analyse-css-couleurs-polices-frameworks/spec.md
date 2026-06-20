# Spécifications — Ajout mode design a web_search pour analyse CSS, couleurs, polices, frameworks

## 1. Problème

L'outil `web_search` permet de chercher des informations sur le web et d'extraire le texte d'une page. Mais l'agent ne peut pas analyser le design visuel (couleurs, polices, mise en page, frameworks CSS).

## 2. Solution

Ajouter un second mode "design" a l'outil `web_search`, activable via un parametre `mode: "design"`.

### 2.1 Modes disponibles

- **mode: "search"** (defaut) : comportement actuel — recherche via API Imara OU extraction texte d'une URL
- **mode: "design"** : analyse le design d'une page web en extrayant depuis son HTML/CSS :
  - Frameworks CSS detectes (Bootstrap, Tailwind, Bulma, Foundation, Materialize, etc.)
  - Couleurs declarees (CSS et inline : backgrounds, textes, bordures)
  - Polices et Google Fonts chargees
  - Structure du DOM (header, nav, main, sections, footer)
  - Breakpoints et media queries
  - Meta viewport et favicon
  - Icones (Font Awesome, Material Icons, etc.)

### 2.2 Architecture

- Garder le paramètre `url` obligatoire en mode design
- L'agent peut choisir automatiquement le mode :
  - Si `url` est fourni + `mode` explicite → mode design
  - Si `query` est fourni + pas de `mode` → mode search
- Le fetch de la page reste en Node.js natif (pas de navigateur headless)
- L'analyse CSS se fait en parsant le contenu des balises `<style>`, `<link rel="stylesheet">` et les styles inline

## 3. Critères d'Acceptation

- [x] L'outil `web_search` accepte un parametre `mode: "search" | "design"`
- [x] En mode design, extraction du framework CSS, couleurs, polices, structure, breakpoints
- [x] Detection automatique de Tailwind, Bootstrap, Bulma, Foundation, Materialize, PureCSS
- [x] Couleurs extraites classees par role (texte, fond, bordure, accent)
- [x] Polices identifiees avec Google Fonts URL
- [x] Structure DOM resume en 10-15 lignes max
- [x] Compilation TypeScript OK
- [x] Compatible avec les tests existants
