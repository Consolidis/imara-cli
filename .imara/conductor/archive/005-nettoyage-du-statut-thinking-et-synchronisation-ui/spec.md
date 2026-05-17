# SPEC: Nettoyage du statut thinking et synchronisation UI

## Probleme
Le type `phase` dans `StatusState` contient la valeur `'thinking'` qui est utilisee dans :
- `src/ui/components/status-bar.ts` — pour afficher l'icone de reflexion
- `src/cli/commands/chat.command.ts` — pour indiquer l'etat de l'agent

## Problematique architecture
Le status `'thinking'` represente un etat actif de traitement. Cependant, dans un modele offline-first, l'agent ne "reflechit" pas au sens d'un appel API en cours. Il y a une ambiguite entre :
- Le traitement synchrone (calcul local, execution d'outil)
- Le traitement asynchrone (attente de reponse reseau)

## Decision fonctionnelle
Maintenir `'thinking'` comme etat legitime representant tout traitement en cours, qu'il soit reseau ou local. Le statut `'tool'` represente specifiquement l'execution d'un outil.

## Modifications prevues
1. Retablir la coherence du type `StatusState.phase` si altere
2. Remplacer `'thinking'` par `'tool'` dans `chat.command.ts` car le traitement y est associe a l'execution d'outils, non a la reflexion pure
3. Simplifier l'affichage de la barre de statut

## Fichiers impactes
- src/ui/components/status-bar.ts
- src/cli/commands/chat.command.ts
