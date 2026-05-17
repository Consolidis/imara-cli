import chalk from 'chalk';
import { askQuestion } from '../utils/prompt';
import { ConfigManager } from '../config/config-manager';

/**
 * Renders the multi-step interactive onboarding tutorial slides.
 */
export async function showTutorial(): Promise<void> {
  // Slide 1
  console.clear();
  console.log(chalk.cyan(`
╔══════════════════════════════════════════════════════════════════════════╗
║  ● IMARA AI — BIENVENUE ! (Diapo 1/3)                                    ║
╠══════════════════════════════════════════════════════════════════════════╣
║                                                                          ║
║  L'assistant autonome d'ingénierie taillé pour vos projets de code.      ║
║                                                                          ║
║  • Autonomie Complète :                                                  ║
║    Analyse l'architecture, crée, lit et modifie vos fichiers locaux.     ║
║                                                                          ║
║  • Sécurité Absolue :                                                    ║
║    L'agent est strictement confiné à votre workspace courant.            ║
║    Aucun fichier système ou sensible externe ne peut être lu.            ║
║                                                                          ║
║  👉 Astuce : Vos modifications de code nécessitent un Track actif !      ║
║                                                                          ║
╚══════════════════════════════════════════════════════════════════════════╝
  `));
  await askQuestion(chalk.cyan('   [Appuyez sur ENTRÉE pour voir les commandes...] '));

  // Slide 2
  console.clear();
  console.log(chalk.cyan(`
╔══════════════════════════════════════════════════════════════════════════╗
║  ● COMMANDES DE BASE (Diapo 2/3)                                         ║
╠══════════════════════════════════════════════════════════════════════════╣
║                                                                          ║
║  Interagissez avec l'agent et contrôlez la session de chat.              ║
║                                                                          ║
║  • /help    - Affiche la liste des commandes et des outils.              ║
║  • /clear   - Vide l'écran et réinitialise la mémoire à court terme.     ║
║  • /files   - Liste les fichiers attachés au contexte courant.           ║
║  • /welcome - Rejoue ce tutoriel interactif à tout moment.               ║
║  • /setup   - Relance le Wizard de configuration initiale.               ║
║                                                                          ║
║  👉 Astuce : Saisissez simplement vos requêtes en langage naturel !      ║
║                                                                          ║
╚══════════════════════════════════════════════════════════════════════════╝
  `));
  await askQuestion(chalk.cyan('   [Appuyez sur ENTRÉE pour découvrir le Conductor...] '));

  // Slide 3
  console.clear();
  console.log(chalk.cyan(`
╔══════════════════════════════════════════════════════════════════════════╗
║  ● LE WORKFLOW CONDUCTOR (Diapo 3/3)                                     ║
╠══════════════════════════════════════════════════════════════════════════╣
║                                                                          ║
║  IMARA applique le workflow rigoureux "Measure twice, code once".         ║
║                                                                          ║
║  1. Inquiry  : L'agent pose des questions de cadrage.                    ║
║  2. Planning : L'agent rédige un plan de route précis (plan.md).         ║
║  3. Approval : L'utilisateur valide le plan pour donner le feu vert.     ║
║  4. Coding   : L'agent exécute les modifications en sécurité.            ║
║                                                                          ║
║  👉 Astuce : Utilisez la commande 'track' pour démarrer un projet.       ║
║                                                                          ║
╚══════════════════════════════════════════════════════════════════════════╝
  `));
  await askQuestion(chalk.cyan('   [Appuyez sur ENTRÉE pour commencer l\'aventure !...] '));

  // Mark onboarding done
  ConfigManager.set({ onboardingDone: true });
  console.clear();
  console.log(chalk.green.bold('\n✨ Onboarding terminé avec succès ! Bienvenue à bord. ✨\n'));
}
