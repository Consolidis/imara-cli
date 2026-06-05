import { Command } from 'commander';
import { runCommand } from './commands/run.command';
import { chatCommand } from './commands/chat.command';
import { loginCommand } from './commands/login.command';
import { logoutCommand } from './commands/logout.command';
import { whoamiCommand } from './commands/whoami.command';
import { configCommand } from './commands/config.command';
import { trackCommand } from './commands/track.command';
import { initConductorCommand } from './commands/init-conductor.command';
import { securityAuditCommand } from './commands/security.command';
import { getVersion } from '../utils/version';
import { ConfigManager } from '../config/config-manager';

const program = new Command();

program
  .name('imara')
  .description('Agent de codage IA pour le terminal — propulsé par Imara AI')
  .version(getVersion());

// Global Options
program
  .option('-f, --file <path>', 'Ajouter un fichier au contexte')
  .option('-m, --model <name>', 'Specifier le modele (flash, standard, zuri)')
  .option('-y, --yes', 'Confirmer automatiquement les actions dangereuses', false)
  .option('--no-execute', 'Ne pas executer les commandes proposees', false)
  .option('--max-tokens <number>', 'Limite de tokens par requete', '8192')
  .option('--context-depth <number>', 'Profondeur de l\'analyse de projet', '2')
  .option('--setup', 'Lancer la configuration interactif initiale', false);

// Default action: one-shot prompt
program
  .argument('[prompt]', 'Le prompt a envoyer a l\'IA')
  .action(async (prompt, options) => {
    if (options.setup) {
      const { runSetupWizard } = await import('./wizard');
      const { showTutorial } = await import('../ui/tutorial');
      await runSetupWizard();
      await showTutorial();
      return;
    }
    if (prompt) {
      const config = ConfigManager.get();
      const globalOpts = program.opts();
      const mergedOptions = {
        ...globalOpts,
        model: options.model || globalOpts.model || config.defaultModel || 'zuri',
        ...options
      };
      await runCommand(prompt, mergedOptions);
    } else {
      program.help();
    }
  });

// Subcommands
program
  .command('chat')
  .description('Demarrer une session de chat interactive')
  .option('--resume <session-id>', 'Reprendre une session existante')
  .action(async (options) => {
    const globalOpts = program.opts();
    const config = ConfigManager.get();
    const mergedOptions = {
      ...globalOpts,
      model: options.model || globalOpts.model || config.defaultModel || 'zuri',
      ...options
    };
    await chatCommand(mergedOptions);
  });

program
  .command('login')
  .description('Se connecter a Imara AI')
  .option('--key <api-key>', 'Cle API Imara')
  .action(async (options) => await loginCommand(options));

program
  .command('logout')
  .description('Se deconnecter et supprimer la cle API')
  .action(async () => await logoutCommand());

program
  .command('whoami')
  .description('Afficher les informations de l\'utilisateur connecte')
  .action(async () => await whoamiCommand());

program
  .command('config')
  .description('Gerer la configuration locale')
  .argument('<action>', 'Action (set, get, list, reset)')
  .argument('[key]', 'Cle de configuration')
  .argument('[value]', 'Valeur de configuration')
  .action(async (action, key, value) => await configCommand(action, key, value));

program
  .command('track')
  .description('Gerer le suivi de projet (Conductor integre)')
  .argument('<action>', 'Action (init, new, state, status, list, done)')
  .argument('[arg]', 'Titre du track (pour new) ou ID partiel (pour done)')
  .action(async (action, arg) => await trackCommand(action, arg));

program
  .command('init-conductor')
  .description('Initialiser la methodologie Conductor dans le projet')
  .action(async () => await initConductorCommand());

program
  .command('security')
  .description('Analyser la securite du code')
  .argument('<action>', 'Action (audit)')
  .option('--quick', 'Analyse rapide (fichiers modifies recemment)')
  .action(async (action, options) => {
    if (action === 'audit') {
      await securityAuditCommand({ quick: options.quick });
    } else {
      console.log('Action inconnue. Utilisez : imara security audit');
    }
  });

export { program };
