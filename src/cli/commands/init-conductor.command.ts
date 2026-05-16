import chalk from 'chalk';
import { theme } from '../../ui/theme';
import { TrackManager } from '../../context/conductor/track-manager';
import { ProjectAnalyzer } from '../../context/project-analyzer';
const { Input } = require('enquirer');

export async function initConductorCommand() {
  console.log(chalk.hex(theme.primary).bold('\n  🚀 INITIALISATION DU FRAMEWORK CONDUCTOR'));
  console.log(chalk.dim('  Analyse du projet en cours...\n'));
  
  try {
    const projectInfo = await ProjectAnalyzer.analyze();
    
    console.log(`  Projet détecté : ${chalk.hex(theme.accent)(projectInfo.name)}`);
    console.log(`  Type : ${chalk.hex(theme.secondary)(projectInfo.type)}\n`);

    const namePrompt = new Input({
      message: 'Confirmer le nom du projet',
      initial: projectInfo.name
    });
    const projectName = await namePrompt.run();

    const descPrompt = new Input({
      message: 'Brève description du projet',
      initial: projectInfo.type !== 'Inconnu' ? `Application ${projectInfo.type}` : ''
    });
    const description = await descPrompt.run();

    const visionPrompt = new Input({
      message: 'Vision du produit (Valeur ajoutée)',
      initial: 'Simplifier le développement grâce à l\'IA'
    });
    const vision = await visionPrompt.run();

    const audiencePrompt = new Input({
      message: 'Public cible',
      initial: 'Développeurs'
    });
    const audience = await audiencePrompt.run();

    // Generate tech stack summary from projectInfo
    const techStack = Object.keys(projectInfo.dependencies || {})
      .slice(0, 10)
      .join(', ') || projectInfo.type;

    TrackManager.init({
      name: projectName,
      description,
      vision,
      audience,
      techStack
    });
    
    console.log(chalk.hex(theme.accent)('  ✓ Structure de base créée.'));
    console.log(chalk.hex(theme.accent)('  ✓ Templates Markdown générés.'));
    console.log(chalk.hex(theme.accent)('  ✓ Dossier tracks/ prêt.\n'));
    
    console.log(chalk.hex(theme.muted)('  Conseil : Commencez par créer un track pour votre prochaine tâche :'));
    console.log(chalk.hex(theme.secondary)(`  $ imara track new "Initialiser les fonctionnalités de base"\n`));
    
  } catch (error: any) {
    console.error(chalk.red(`  Erreur lors de l'initialisation : ${error.message}`));
  }
}
