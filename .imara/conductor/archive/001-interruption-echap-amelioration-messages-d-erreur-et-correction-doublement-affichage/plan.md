# Plan

## Taches

- [x] 1. Correction du doublement d'affichage des erreurs
  - Supprimer `process.stdout.write(chalk.hex(theme.error)(\`\n  ✗ ${userMessage}\n\`));` dans agent.ts run()
  - L'affichage n'est fait que par le caller (chat.command.ts via showErrorPanel)

- [x] 2. Amelioration du format d'erreur dans error-panel.ts
  - Ajouter icones et couleurs par categorie d'erreur
  - Ajouter cadre visuel de delimitation
  - Messages d'action plus precis

- [ ] 3. Interruption Echap renforcee
  - Rendre l'ecoute Echap permanente (pas conditionnee a isProcessing)
  - Ajouter un flag d'interruption atomique verifie dans la runLoop de l'agent
  - Interruption possible pendant toutes les phases (thinking, tool calls, etc.)
