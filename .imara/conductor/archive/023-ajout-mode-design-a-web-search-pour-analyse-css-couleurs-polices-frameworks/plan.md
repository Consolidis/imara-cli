# Plan — Ajout mode design a web_search pour analyse CSS, couleurs, polices, frameworks

## Tâches

- [x] Étape 1 : Ajouter le paramètre `mode: "search" | "design"` a la definition de l'outil
- [x] Étape 2 : Implementer `analyzeDesign(url)` : fetch HTML + extraction framework, couleurs, polices, structure
- [x] Étape 3 : Implementer `detectFramework(html)` : detection Tailwind, Bootstrap, Bulma, Foundation, etc.
- [x] Étape 4 : Implementer `extractColors(html)` : extraction des couleurs CSS et inline classees
- [x] Étape 5 : Implementer `extractFonts(html)` : Google Fonts, polices declarees
- [x] Étape 6 : Implementer `extractStructure(html)` : DOM squelettique (header, nav, sections...)
- [x] Étape 7 : Mettre a jour `run()` pour router selon le mode et ajouter la detection automatique
- [x] Étape 8 : Verifier compilation TypeScript + tests
