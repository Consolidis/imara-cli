# Spec: Amelioration des outils CLI suite au fichier Amelioration.md

## Contexte

Le fichier `Amelioration.md` liste 8 points d'amelioration pour les outils de l'agent IA. Apres analyse du code existant, certains sont deja implementes partiellement ou totalement.

## Analyse des 8 points

### Point 1 - safe_replace (DEJA FAIT)
Le `replace_in_file` et `batch_replace` normalisent deja les CRLF/LF dans leur implementation. L'outil `batch_replace` est meme plus robuste avec rollback atomique. Aucune action necessaire.

### Point 2 - validate_after_edit (NOUVEAU)

Deux composants :

**2a. Outil `validate_file(path)`** : Outil manuel qui detecte automatiquement le langage via l'extension du fichier et lance le validateur approprie :
- `.ts`, `.tsx`, `.mts`, `.cts` -> `npx tsc --noEmit --pretty` (check type-level)
- `.js`, `.jsx`, `.mjs`, `.cjs` -> `node --check` (syntax check rapide)
- `.py` -> `python -m py_compile` (compile check)
- `.rs` -> `rustc --edition 2021 --crate-type lib` (type check)
- `.go` -> `go vet` (vet analysis)
- `.rb` -> `ruby -c` (syntax check)
- `.php` -> `php -l` (lint syntax)
- `.cs` -> `dotnet build --no-restore --no-dependencies 2>&1 | head -50` (build check, silencieux si pas de dotnet)
- `.java` -> `javac -Xlint:all -proc:none` (compile check)
- `.swift` -> `swiftc -typecheck` (type check)
- `.kt` -> `kotlinc` (compile check)
- Autres extensions : retourne "Aucun validateur disponible pour ce type de fichier"

Le validateur doit etre resilient : si l'outil n'est pas installe, retourner un message clair ("Python n'est pas installe ou pas dans le PATH").

**2b. Hook automatique post-ecriture** : Apres chaque write_file/replace_in_file/batch_replace/append_file, le ToolExecutor peut appeler `validate_file` automatiquement si le fichier est d'un type supporte. Ce hook doit etre :
- Optionnel (activable via un flag `auto_validate: true` dans les outils d'ecriture ou config global)
- Limite aux fichiers TS/TSX/JS/JSX par defaut (les plus courants dans ce projet)
- Non-bloquant : les erreurs de validation sont retournees comme avertissement, pas comme echec de l'ecriture

### Point 3 - atomic_section_replace (NOUVEAU)
Nouvel outil `atomic_section_replace` qui prend deux marqueurs (start_marker, end_marker) et un nouveau contenu, et remplace tout ce qui se trouve entre ces deux marqueurs dans le fichier. Pas de matching exact du contenu intermediaire.

### Point 4 - diff_preview systematique (DEJA FAIT)
L'outil `diff_preview` existe deja. Le `replace_in_file` et `write_file` affichent deja un diff terminal via `showDiff`. Aucune action necessaire.

### Point 5 - batch_import_add (NOUVEAU)
Nouvel outil `batch_import_add` qui cherche tous les fichiers correspondant a un glob pattern, detecte ceux qui utilisent un symbole (fonction/hook), et ajoute l'import manquant en haut du fichier si absent.

### Point 6 - read_file_range avec line endings (AMELIORATION)
Ajouter les metadonnees de type de line ending (LF, CRLF, mixte) dans la sortie de `read_file_range` et `inspect_file`.

### Point 7 - smart_read mode JSX (AMELIORATION)
Ajouter un mode `jsx` a smart_read qui preserve les paires `{...}` et signale les balises non fermees.

### Point 8 - git_commit all silencieux (AMELIORATION)
Modifier `git_commit` avec `all=true` pour ne PAS ecrire les messages "arbre propre, aucun commit necessaire" pour les depots sans modifications. Passer silencieusement.

## Priorites retenues pour implementation

P0 : Points 8, 3
P1 : Points 6, 5
P2 : Points 2, 7
P3 : Points 1, 4 (deja fonctionnels)
