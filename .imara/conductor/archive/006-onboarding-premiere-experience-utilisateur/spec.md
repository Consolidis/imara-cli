# SPECIFICATIONS TECHNIQUES — TRACK 006 (ONBOARDING)

Ce document définit l'architecture technique, les structures de données, et les comportements visuels attendus pour le parcours d'onboarding utilisateur d'IMARA CLI.

## 🛠️ MODULES TOUCHÉS & NOUVEAUX COMPOSANTS

1. **`src/config/config-manager.ts`** (et `config.ts`)
   * Ajout d'une propriété optionnelle au schéma de configuration globale : `onboardingDone?: boolean`.
   * Implémentation d'un helper `isFirstLaunch()` : retourne `true` si le fichier `~/.imara/config.json` n'existe pas, est corrompu ou si `onboardingDone` vaut `false`.

2. **`src/cli/wizard.ts`** (Nouveau module)
   * Logique du wizard interactif reposant exclusivement sur le module natif Node.js `readline`.
   * Masquage visuel lors de la saisie de l'API Key (interception bas niveau du flux de sortie pour remplacer les caractères saisis par du vide ou des astérisques).
   * Intégration d'une étape de **validation temps réel** : instancie temporairement un `ImaraClient` pour appeler `/v1/agent/profile`. En cas d'échec (401 ou erreur réseau), affiche un message d'erreur rouge clair et invite à ressaisir.
   * Sélection verrouillée du Workspace : forcé à `process.cwd()` par défaut, avec impossibilité d'en sortir (contrôles stricts pour que le dossier reste encapsulé dans le répertoire courant).

3. **`src/ui/tutorial.ts`** (Nouveau module)
   * Gestion du diaporama interactif de 3 étapes.
   * Rendu visuel haut de gamme : cadres ASCII double-ligne, pastilles réseau de couleur, titres stylisés en dégradés, et instructions claires.
   * Intercepte l'appui de la touche `Entrée` pour la transition des diapositives.

4. **`src/cli/commands/chat.command.ts`** (ou `repl.ts` / commands registry)
   * Détection automatique lors de l'appel à `imara chat` : si `isFirstLaunch()` est vrai, le flux est suspendu pour exécuter `runSetupWizard()` puis le tutoriel de bienvenue avant de lancer le prompt interactif standard.
   * Enregistrement des commandes spéciales `/welcome`, `/setup` et de l'option globale CLI `--setup` pour relancer les assistants à tout moment.

---

## 📋 INTERFACES & CONTRATS

```typescript
export interface WizardConfig {
  apiKey: string;
  defaultModel: 'flash' | 'standard' | 'zuri';
  workspacePath: string;
}

export interface TutorialSlide {
  title: string;
  subtitle: string;
  bulletPoints: string[];
  tips: string;
}
```

---

## 🎨 DESIGN VISUEL DES PANNEAUX DE DIAPORAMA (ASCII PREMIUM)

Chaque diapositive est encadrée par une bordure double-ligne (`╔════╗`) avec des indications de pagination dynamiques et des espacements calibrés pour un rendu premium à l'écran.

### Exemple structurel :
```text
╔══════════════════════════════════════════════════════════════════════════╗
║  ● IMARA AI — BIENVENUE ! (Diapo 1/3)                                    ║
╠══════════════════════════════════════════════════════════════════════════╣
║                                                                          ║
║  L'assistant de programmation autonome taillé pour vos projets.           ║
║                                                                          ║
║  • Autonomie totale : Analyse, création et modification de fichiers.    ║
║  • Conductor : Enforce des workflows robustes de Lead Engineer.          ║
║                                                                          ║
║  👉 Astuce : Vos modifications nécessitent un Track actif !             ║
║                                                                          ║
║  [Appuyez sur ENTRÉE pour continuer...]                                  ║
╚══════════════════════════════════════════════════════════════════════════╝
```

---

## 🛡️ RÈGLES DE VALIDATION ET SÉCURITÉ

* **Masquage de la clé API** : Lors de la saisie de l'API Key, les entrées clavier ne sont pas écrites sur `stdout` (écouteur personnalisé sur le flux d'entrée).
* **Isolation du Workspace** : Le workspace configuré est strictement résolu via `resolve(process.cwd())`. Aucune saisie ne doit permettre de définir un chemin sortant de cette racine pour les actions d'écriture/lecture de l'agent.
* **Non-intrusif** : Si l'onboarding a déjà été complété avec succès (`onboardingDone: true`), aucun assistant automatique ne s'affiche, préservant la fluidité immédiate pour les utilisateurs expérimentés.
