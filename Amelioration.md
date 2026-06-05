AMELIORATIONS D'OUTILS DONT J'AURAIS BESOIN

  Un outil de "safe string replacement" qui gererait automatiquement les
  differences de line endings (LF vs CRLF) en normalisant le fichier avant
  chaque remplacement. Les corruptions d'aujourd'hui venaient toutes de la -
  les scripts PowerShell ne detectaient pas les blocs a cause de problemes `\n`
  vs `\r\n`.

  Un outil de "commit atomique multi-depots" (`git_commit --all`) qui detecte
  automatiquement si chaque depot a des modifications avant de committer, et
  saute silencieusement les depots propres au lieu d'ecrire "backend: arbre
  propre, aucun commit necessaire".

  Un outil `validate_file(path)` qui lance `--target=check` (type checking) sur
  un seul fichier et retourne immediatement les erreurs. Cela permettrait de
  verifier chaque fichier apres modification sans attendre un build complet.

 1. OUTIL : `safe_replace`
  Un remplacement intelligent qui normalise automatiquement les line endings
  avant de chercher le motif. Ca empecherait les echecs silencieux quand un
  fichier a des CRLF et que mon motif utilise LF.
  - Signature : `safe_replace(path, old_text, new_text)`
  - En interne : normalise old_text et le contenu du fichier vers le meme line
  ending avant la comparaison

  2. OUTIL : `validate_after_edit`
  Apres chaque `write_file` ou `replace_in_file`, lance automatiquement `tsc
  --noEmit` (ou equivalent selon le langage) et retourne les erreurs. Pas
  besoin d'attendre la fin de la session pour decouvrir 5 corruptions.

  3. OUTIL : `atomic_section_replace`
  Pour les gros fichiers (le `page.tsx` de 200KB est le coupable ideal), un
  outil qui prend un bloc delimite par deux marqueurs (ex: `{activeSection ===
  "currency" && (` comme debut et `{activeSection === "general" && (` comme
  fin) et remplace TOUT entre les deux, sans avoir a matcher le contenu exact.
  Le matching exact a ete la source de 90% des problemes aujourd'hui.

  4. AMELIORATION : `diff_preview` systematique
  Le diff_preview existe deja mais je ne l'ai pas utilise systematiquement. Un
  flag `--preview` obligatoire avant tout `replace_in_file` dans les gros
  fichiers (> 500 lignes) permettrait de voir ce qui va changer avant de
  l'appliquer.

  5. OUTIL : `batch_import_add`
  Un outil specifique pour ajouter un import manquant dans tous les fichiers
  qui utilisent un hook/fonction. Aujourd'hui j'ai du ajouter `import {
  useCurrencyFormat }` dans 5 fichiers un par un.
  `batch_import_add("useCurrencyFormat", "@/hooks/useCurrencyFormat",
  ["*.tsx"])` ferait ca en une operation.

  6. AMELIORATION : `read_file_range` avec line endings visibles
  Quand je lis un fichier, voir le type de line ending (LF, CRLF, mixte) dans
  les metadonnees. Ca m'aurait evite de tatonner pendant 20 minutes sur le
  premier `replace_in_file` qui echouait.

  7. OUTIL : `smart_read` plus pousse
  Le `smart_read` actuel fait un summary mais perd le contexte de binding JSX.
  Un mode `smart_read --jsx` qui preserve les paires `{...}` et signale les
  balises non fermees serait utile pour deboguer rapidement les corruptions de
  structure.

8. eviter d'executer bettement cette commande taskkill /f /im node.exe 2>&1 || echo "No node … car cela tue aussi la cli qui travail vu que c'est sur node. 