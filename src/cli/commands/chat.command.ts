import * as readline from 'readline';
import chalk from 'chalk';
import { Agent } from '../../agent/agent';
import { requireAuth } from '../../auth/auth';
import { ProjectAnalyzer } from '../../context/project-analyzer';
import { SessionManager } from '../../context/session-manager';
import { theme } from '../../ui/theme';
import { renderWelcome } from '../../ui/screens/welcome';

interface ChatOptions {
  model?: string;
  yes?: boolean;
  resume?: string;
  execute?: boolean;
}

export async function chatCommand(options: ChatOptions, initialPrompt?: string) {
  const user = await requireAuth();
  const projectInfo = await ProjectAnalyzer.analyze();
  
  renderWelcome({
    model: options.model || 'zuri',
    projectName: projectInfo.name,
    projectType: projectInfo.type,
    mode: 'Senior Engineer (MIT)'
  });

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.hex(theme.primary)('› ')
  });

  const agent = new Agent(options);

  // Resume session if requested
  if (options.resume) {
    try {
      const sm = new SessionManager(options.resume);
      const messages = sm.getMessages();
      if (messages.length > 0) {
        agent.setMessages(messages);
        console.log(chalk.dim(`\n(Session "${options.resume}" reprise avec ${messages.length} messages)\n`));
      }
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      console.error(chalk.red(`\nErreur reprise session: ${errMsg}`));
    }
  }

  console.log(chalk.dim('Tapez /exit pour quitter, /help pour les commandes spéciales.'));

  // Show active track if any
  const { TrackManager } = require('../../context/conductor/track-manager');
  const active = TrackManager.getActive();
  if (active) {
    console.log(`\n  ${chalk.hex(theme.primary).bold('📍 TRACK ACTIF')} : ${chalk.hex(theme.accent)(active.id)}`);
    console.log(`  ${chalk.hex(theme.muted)(active.title)}`);
    if (!active.validated) {
      console.log(chalk.hex(theme.warning ?? '#ffaa00')('  ⚠ Le plan n\'est pas encore validé. Utilisez /approve pour débloquer le codage.\n'));
    } else {
      console.log(chalk.hex(theme.accent)('  ✓ Plan validé. Prêt à coder.\n'));
    }
  } else {
    console.log('');
  }

  let isProcessing = false;

  rl.prompt();

  rl.on('line', async (line) => {
    if (isProcessing) {
      console.log(chalk.hex(theme.warning ?? '#ffaa00')('  Veuillez patienter, l\'IA réfléchit...'));
      // Ne pas relancer rl.prompt() ici pour ne pas casser l'affichage du spinner
      return;
    }

    const input = line.trim();
    if (!input) {
      rl.prompt();
      return;
    }

    if (input === '/exit' || input === '/quit') {
      rl.close();
      return;
    }

    if (input === '/help') {
      console.log(chalk.hex(theme.primary).bold('\n  COMMANDES DU CHAT :'));
      console.log(`    ${chalk.hex(theme.secondary)('/track')}      : Voir l'état du track Conductor actif`);
      console.log(`    ${chalk.hex(theme.secondary)('/approve')}    : Valider le plan (débloquer le codage)`);
      console.log(`    ${chalk.hex(theme.secondary)('/archive')}    : Terminer et archiver le track`);
      console.log(`    ${chalk.hex(theme.secondary)('/files')}      : Lister les fichiers consultés`);
      console.log(`    ${chalk.hex(theme.secondary)('/tokens')}     : Afficher l'utilisation et le coût`);
      console.log(`    ${chalk.hex(theme.secondary)('/model <id>')} : Changer de modèle (flash, standard, zuri)`);
      console.log(`    ${chalk.hex(theme.secondary)('/save [name]')} : Sauvegarder la session`);
      console.log(`    ${chalk.hex(theme.secondary)('/clear')}      : Effacer l'historique`);
      console.log(`    ${chalk.hex(theme.secondary)('/exit')}       : Quitter le chat\n`);
      
      console.log(chalk.hex(theme.primary).bold('  MÉTHODOLOGIE CONDUCTOR :'));
      console.log('    Imara suit une approche structurée pour les tâches complexes :');
      console.log(`    1. ${chalk.bold('Inquiry')}   : Analyse et questions de clarification.`);
      console.log(`    2. ${chalk.bold('Planning')}  : Création automatique d'un track et d'un plan.`);
      console.log(`    3. ${chalk.bold('Approval')}  : L'IA attend votre validation avant de coder.`);
      console.log(`    4. ${chalk.bold('Execution')} : Codage par itérations sécurisées (max 50 lignes).\n`);

      console.log(chalk.hex(theme.primary).bold('  ASTUCE :'));
      console.log('    Si l\'IA est bloquée par un guardrail, validez simplement le plan en disant :');
      console.log(`    ${chalk.hex(theme.accent)('"Le plan est validé, tu peux commencer à coder."')}\n`);
      
      rl.prompt();
      return;
    }

    if (input === '/track') {
      const { TrackManager } = require('../../context/conductor/track-manager');
      const { track, plan } = TrackManager.status();
      
      if (!track) {
        console.log(chalk.hex(theme.muted)('\n  Aucun track actif dans ce projet.\n'));
      } else {
        console.log(`\n  ${chalk.hex(theme.primary).bold('TRACK ACTIF')} : ${chalk.hex(theme.accent)(track.id)}`);
        console.log(`  ${chalk.hex(theme.muted)(track.title)}\n`);
        
        const tasks = plan.split('\n').filter((l: string) => l.match(/^\s*- \[[ x~]\]/));
        if (tasks.length > 0) {
          tasks.slice(0, 10).forEach((t: string) => {
            const done = t.includes('[x]');
            const inprog = t.includes('[~]');
            const icon = done ? chalk.hex(theme.accent)('✓') : inprog ? chalk.hex(theme.warning ?? '#ffaa00')('~') : chalk.hex(theme.muted)('○');
            const text = t.replace(/^\s*- \[[ x~]\]\s*/, '');
            console.log(`    ${icon} ${done ? chalk.hex(theme.muted)(text) : chalk.hex(theme.text)(text)}`);
          });
          console.log('');
        }
      }
      rl.prompt();
      return;
    }

    if (input === '/approve') {
      const { TrackManager } = require('../../context/conductor/track-manager');
      const active = TrackManager.getActive();
      if (!active) {
        console.log(chalk.hex(theme.muted)('\n  Aucun track actif.\n'));
      } else {
        TrackManager.validateTrack();
        console.log(chalk.hex(theme.accent)('\n  ✓ Plan validé avec succès. Les outils de modification sont débloqués.\n'));
      }
      rl.prompt();
      return;
    }

    if (input === '/archive') {
      const { TrackManager } = require('../../context/conductor/track-manager');
      const active = TrackManager.getActive();
      if (!active) {
        console.log(chalk.hex(theme.muted)('\n  Aucun track actif.\n'));
      } else {
        console.log(chalk.hex(theme.warning ?? '#ffaa00')('\n  Archivage du track en cours...'));
        TrackManager.clearActive();
        console.log(chalk.hex(theme.accent)('  ✓ Track terminé et retiré de la session.\n'));
      }
      rl.prompt();
      return;
    }

    if (input === '/tokens') {
      const stats = agent.getSessionStats();
      console.log(`\n  ${chalk.hex(theme.primary).bold('USAGE SESSION :')}`);
      console.log(`    Tokens   : ${chalk.hex(theme.accent)(stats.tokens.toLocaleString())}`);
      console.log(`    Messages : ${chalk.hex(theme.accent)(stats.messages)}`);
      console.log(`    Coût     : ${chalk.hex(theme.accent)(stats.cost.toFixed(2))} FCFA\n`);
      rl.prompt();
      return;
    }

    if (input === '/clear') {
      agent.clearHistory();
      console.log(chalk.hex(theme.warning ?? '#ffaa00')('\n  Historique effacé.\n'));
      rl.prompt();
      return;
    }

    if (input.startsWith('/model ')) {
      const model = input.split(' ')[1];
      agent.setModel(model);
      console.log(chalk.hex(theme.primary)(`\n  Modèle changé pour : ${chalk.bold(model)}\n`));
      rl.prompt();
      return;
    }

    if (input.startsWith('/save')) {
      const name = input.split(' ')[1];
      const sm = new SessionManager(name);
      sm.setMessages(agent.getMessages());
      sm.save();
      console.log(chalk.hex(theme.accent)(`\n  Session sauvegardée : ${chalk.bold(sm.getSessionId())}\n`));
      rl.prompt();
      return;
    }

    if (input === '/files') {
      const messages = agent.getMessages();
      const files = new Set<string>();
      messages.forEach(m => {
        if (m.role === 'tool' && m.name === 'read_file' && m.content) {
          files.add('Fichier lu');
        }
      });
      console.log(chalk.hex(theme.primary).bold('\n  FICHIERS EN CONTEXTE :'));
      if (files.size === 0) {
        console.log(chalk.hex(theme.muted)('    Aucun fichier lu pour l\'instant.'));
      } else {
        files.forEach(f => console.log(`    ${chalk.hex(theme.text)(f)}`));
      }
      console.log('');
      rl.prompt();
      return;
    }

    isProcessing = true;
    try {
      await agent.run(input);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error(chalk.red(`\nErreur: ${errMsg}`));
    } finally {
      isProcessing = false;
    }
    rl.prompt();
  });

  // Run initial prompt if provided
  if (initialPrompt) {
    isProcessing = true;
    try {
      // Small delay to let the UI settle
      await new Promise(resolve => setTimeout(resolve, 500));
      console.log(chalk.hex(theme.primary)(`› ${initialPrompt}`));
      await agent.run(initialPrompt);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error(chalk.red(`\nErreur initialisation: ${errMsg}`));
    } finally {
      isProcessing = false;
      rl.prompt();
    }
  }

  rl.on('close', () => {
    const stats = agent.getSessionStats();
    console.log(
      chalk.hex(theme.muted)(
        `\n  Session terminée · ${stats.messages} échanges · ` +
        `${stats.tokens.toLocaleString()} tokens · ${stats.cost.toFixed(2)} FCFA\n`
      )
    );
    process.exit(0);
  });
}
