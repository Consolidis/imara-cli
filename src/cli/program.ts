import { Command } from 'commander';
import { runCommand } from './commands/run.command';
import { chatCommand } from './commands/chat.command';
import { loginCommand } from './commands/login.command';
import { logoutCommand } from './commands/logout.command';
import { whoamiCommand } from './commands/whoami.command';
import { configCommand } from './commands/config.command';
import { trackCommand } from './commands/track.command';
import { initConductorCommand } from './commands/init-conductor.command';
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
  .option('-m, --model <name>', 'Spécifier le modèle (flash, standard, zuri)')
  .option('-y, --yes', 'Confirmer automatiquement les actions dangereuses', false)
  .option('--no-execute', 'Ne pas exécuter les commandes proposées', false)
  .option('--max-tokens <number>', 'Limite de tokens par requête', '8192')
  .option('--context-depth <number>', 'Profondeur de l\'analyse de projet', '2')
  .option('--setup', 'Lancer la configuration interactif initiale', false);

// Default action: one-shot prompt
program
  .argument('[prompt]', 'Le prompt à envoyer à l\'IA')
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
      runCommand(prompt, mergedOptions);
    } else {
      program.help();
    }
  });

// Subcommands
program
  .command('chat')
  .description('Démarrer une session de chat interactive')
  .option('--resume <session-id>', 'Reprendre une session existante')
  .action((options) => {
    const globalOpts = program.opts();
    const config = ConfigManager.get();
    const mergedOptions = {
      ...globalOpts,
      model: options.model || globalOpts.model || config.defaultModel || 'zuri',
      ...options
    };
    chatCommand(mergedOptions);
  });

program
  .command('login')
  .description('Se connecter à Imara AI')
  .option('--key <api-key>', 'Clé API Imara')
  .action((options) => loginCommand(options));

program
  .command('logout')
  .description('Se déconnecter et supprimer la clé API')
  .action(() => logoutCommand());

program
  .command('whoami')
  .description('Afficher les informations de l\'utilisateur connecté')
  .action(() => whoamiCommand());

program
  .command('config')
  .description('Gérer la configuration locale')
  .argument('<action>', 'Action (set, get, list, reset)')
  .argument('[key]', 'Clé de configuration')
  .argument('[value]', 'Valeur de configuration')
  .action((action, key, value) => configCommand(action, key, value));

program
  .command('track')
  .description('Gérer le suivi de projet (Conductor intégré)')
  .argument('<action>', 'Action (init, new, status, list, done)')
  .argument('[arg]', 'Titre du track (pour `new`) ou ID partiel (pour `done`)')
  .action((action, arg) => trackCommand(action, arg));

program
  .command('init-conductor')
  .description('Initialiser la méthodologie Conductor dans le projet')
  .action(() => initConductorCommand());

export { program };

