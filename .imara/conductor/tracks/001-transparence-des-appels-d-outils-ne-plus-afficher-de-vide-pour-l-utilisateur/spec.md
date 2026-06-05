# Specifications - Transparence des appels d'outils

## 1. Contexte & Enjeux

L'IA utilise des outils (web_search, read_file, read_file_range, code_map, etc.)
mais l'utilisateur voit parfois du vide :
- `web_search("")` affiche `Web("")` sans indiquer que la requete est vide
- `read_file("")` ou `read_file()` affiche `Read` sans chemin
- `showToolResult()` ignore le contenu du resultat et affiche juste le nom
- Le fallback Imara pour web_search retourne un message creux sans resultats utiles

Enjeu : L'utilisateur doit voir ce que l'IA fait en temps reel, meme quand les
arguments sont incomplets ou que les resultats sont vides.

## 2. Architecture & Choix Techniques

Cibles a modifier :

| Fichier | Role | Probleme |
|---------|------|----------|
| src/ui/tool-labels.ts | Formater le label outil | Vide si args vides |
| src/ui/renderer.ts | showToolResult() | Jette le contenu |
| src/ui/components/tool-call.ts | showToolCall() | N'affiche pas le resultat |
| src/agent/tools/web-search.tool.ts | Fallback Imara | Message creux |
| src/agent/agent.ts | executeReadOnlyBatch | Affiche resultats sans contenu |

Principes :
- Si args est vide ou que les champs cles sont absents, afficher "(vide)" ou
  "(requete manquante)" en rouge/jaune au lieu de chaine vide.
- showToolResult doit afficher un extrait du contenu (premiere ligne ou N
  premiers caracteres) pour que l'utilisateur sache ce qui a ete retourne.
- web_search en fallback doit faire un vrai appel API ou echouer proprement
  avec un message clair.

## 3. Criteres d'Acceptation

- [ ] `web_search("")` affiche `Web("(requete vide)")` au lieu de `Web("")`
- [ ] `read_file("")` affiche `Read("(aucun chemin)")` au lieu de `Read()`
- [ ] `showToolResult()` affiche un extrait du resultat (premiere ligne)
- [ ] Les outils read-only en batch affichent leur resultat
- [ ] web_search en fallback ne retourne plus un message creux mais un vrai
      resultat ou une erreur explicite
- [ ] Tests passes apres chaque modification
