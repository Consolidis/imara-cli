# Plan: Amelioration des outils CLI

## Tâches

- [x] 1. Git commit all silencieux (Point 8)
  - Modifier git-commit.tool.ts : en mode all=true, ne pas ecrire de message pour les repos sans modifications
- [x] 2. Atomic section replace (Point 3)
  - Creer atomic-section-replace.tool.ts : outil prenant start_marker, end_marker, new_content
  - Enregistrer l'outil dans l'index des outils et ToolExecutor
- [x] 3. Line endings dans read_file_range et inspect_file (Point 6)
  - Ajouter le type de line ending (LF/CRLF/mixte) dans les metadonnees de read_file_range
  - Ajouter le type de line ending dans inspect_file
- [x] 4. Batch import add (Point 5)
  - Creer batch-import-add.tool.ts : outil prenant symbol, import_path, file_pattern
  - Supporte les imports ES6 (import { X } from 'Y') et CommonJS (const X = require('Y'))
- [x] 5. Validate after edit (Point 2)
  - Creer validate-file.tool.ts : detection du langage par extension + commande de validation appropriee
  - Hook optionnel dans ToolExecutor post-ecriture
- [x] 6. Smart read mode JSX (Point 7)
  - Ajouter mode 'jsx' a smart_read : preservation des paires {...}, detection des balises non fermees
