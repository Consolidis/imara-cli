# Spec: Interruption Echap, amelioration messages d'erreur, correction doublement

## Contexte

Analyse du code existant revele 3 problemes :
1. L'interruption Echap ne marche que pendant l'appel API (fetch) et pas pendant le spinner "thinking" ou les tool calls
2. Les messages d'erreur sont affiches deux fois : une fois dans `agent.ts` (avec `✗`), une fois dans `chat.command.ts` (via `showErrorPanel`)
3. Le format des erreurs est basique et manque de personnalisation par type d'erreur

## Analyse detaillee

### Probleme 1 - Interruption Echap partielle

Dans `chat.command.ts`, le handler Echap verifie `isProcessing` :
```typescript
if (isProcessing) {
  if (key && (key.name === 'escape' || key.name === 'esc')) {
    console.log(...);
    agent.cancel();
  }
}
```
Probleme : `isProcessing` passe a `true` trop tard (apres le debounce du multiline), et `agent.cancel()` ne fait qu'annuler le fetch en cours. Le spinner "thinking" et les appels synchrones ne sont pas interrompus.

Solution : Rendre l'ecoute Echap permanente (pas conditionnee a isProcessing), et propager un flag d'interruption partage qui est verifie dans la boucle d'iteration de l'agent (runLoop).

### Probleme 2 - Doublement des messages d'erreur

Dans `agent.ts`, methode `run()` :
```typescript
// LIGNE 252-256
const userMessage = sanitizeErrorMessage(imaraErr.message);
process.stdout.write(chalk.hex(theme.error)(`\n  ✗ ${userMessage}\n`));
throw new Error(userMessage);
```

Dans `chat.command.ts` :
```typescript
// LIGNE 685-689
if (error instanceof Error) {
  showErrorPanel(error);
}
```

L'erreur est affichee une fois dans agent.run() via `✗ message` puis remontee, puis affichee a nouveau via `showErrorPanel` dans le caller.

Solution : Supprimer l'affichage dans agent.ts, ne garder que le throw. L'affichage appartient a la couche UI (chat.command.ts).

### Probleme 3 - Format des erreurs basique

Actuellement `showErrorPanel` affiche :
```
  UNKNOWN [UNKNOWN]
  fail
  → Contactez le support si le problème persiste.
```

Amelioration :
- Utiliser des icones et couleurs par categorie d'erreur
- Afficher le message d'erreur de maniere plus lisible
- Proposer des actions concretes plutot que des messages generiques
- Ajouter un cadre visuel pour delimiter l'erreur
