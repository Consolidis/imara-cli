import * as readline from 'readline';
import chalk from 'chalk';
import { Agent } from '../../agent/agent';
import { requireAuth } from '../../auth/auth';
import { ProjectAnalyzer } from '../../context/project-analyzer';
import { SessionManager } from '../../context/session-manager';
import { SessionStore } from '../../context/session-store';
import { theme } from '../../ui/theme';
import { renderStatusBar, clearStatusBar } from '../../ui/components/status-bar';
import { showErrorPanel } from '../../ui/components/error-panel';
import { TrackManager } from '../../context/conductor/track-manager';
import { renderWelcome } from '../../ui/screens/welcome';
import { ConfigManager } from '../../config/config-manager';
import { runSetupWizard } from '../wizard';
import { showTutorial } from '../../ui/tutorial';

interface ChatOptions {
  model?: string;
  yes?: boolean;
  resume?: string;
  execute?: boolean;
}

export async function chatCommand(options: ChatOptions, initialPrompt?: string) {
  if (ConfigManager.isFirstLaunch()) {
    await runSetupWizard();
    await showTutorial();
  }

  const user = await requireAuth();
  const projectInfo = await ProjectAnalyzer.analyze();
  
  const resolvedModel = options.model || ConfigManager.get().defaultModel || 'zuri';

  renderWelcome({
    model: resolvedModel,
    projectName: projectInfo.name,
    projectType: projectInfo.type,
    mode: 'Senior Engineer (MIT)'
  });

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.hex(theme.primary)('› ')
  });

  const agent = new Agent({
    ...options,
    model: resolvedModel
  });

  // ESCAPE Keypress listener to cancel agent processing
  const keypressHandler = (str: string, key: any) => {
    if (isProcessing && key) {
      if (key.name === 'escape' || key.name === 'esc') {
        console.log(chalk.hex(theme.warning)('\n\n  [Interruption demandée via ÉCHAP...]'));
        agent.cancel();
      }
    }
  };

  process.stdin.on('keypress', keypressHandler);

  // SIGINT (Ctrl+C) listener to cancel agent processing instead of crashing the CLI
  rl.on('SIGINT', () => {
    if (isProcessing) {
      console.log(chalk.hex(theme.warning)('\n\n  [Interruption demandée via Ctrl+C...]'));
      agent.cancel();
    } else {
      rl.close();
    }
  });

  const store = new SessionStore();
  let currentSessionId: string | null = null;

  function autoSaveSession() {
    if (currentSessionId) {
      store.saveMessages(currentSessionId, agent.getMessages());
    }
  }

  // Resume session if requested
  if (options.resume) {
    try {
      const session = store.findSessionByName(options.resume) || store.getSession(options.resume);
      if (session) {
        const messages = store.loadMessages(session.id);
        if (messages.length > 0) {
          agent.setMessages(messages);
          currentSessionId = session.id;
          store.activateSession(session.id);
          console.log(chalk.dim(`\n(Session "${session.name}" reprise avec ${messages.length} messages)\n`));
        }
      } else {
        console.log(chalk.hex(theme.warning)(`\nSession "${options.resume}" introuvable.\n`));
      }
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      console.error(chalk.red(`\nErreur reprise session: ${errMsg}`));
    }
  } else {
    // Auto-resume derniere session active si elle existe
    try {
      const sessions = store.listSessions();
      const active = sessions.find(s => s.isActive);
      if (active && active.projectPath === process.cwd()) {
        const messages = store.loadMessages(active.id);
        if (messages.length > 0) {
          agent.setMessages(messages);
          currentSessionId = active.id;
          console.log(chalk.dim(`\n(Session "${active.name}" reprise automatiquement : ${messages.length} messages)\n`));
        }
      }
    } catch {
      // Ignorer silencieusement
    }
  }

  console.log(chalk.dim('Tapez /exit pour quitter, /help pour les commandes spéciales.'));

  // Show active track if any
  const active = TrackManager.getActive();
  if (active) {
    console.log(`\n  ${chalk.hex(theme.primary).bold('📍 TRACK ACTIF')} : ${chalk.hex(theme.accent)(active.id)}`);
    console.log(`  ${chalk.hex(theme.muted)(active.title)}`);
    if (!active.validated) {
      console.log(chalk.hex(theme.warning)('  ⚠ Le plan n\'est pas encore validé. Utilisez /approve pour débloquer le codage.\n'));
    } else {
      console.log(chalk.hex(theme.accent)('  ✓ Plan validé. Prêt à coder.\n'));
    }
  } else {
    console.log('');
  }

  let isProcessing = false;

  function printStatus() {
    const stats = agent.getSessionStats();
    const track = TrackManager.getActive();
    const ctx = agent.getContextStats();
    renderStatusBar({
      model: agent.getModel(),
      tokens: stats.tokens,
      costFcfa: stats.cost,
      trackId: track?.id,
      phase: isProcessing ? 'tool' : 'idle',
      contextPercent: ctx.percent,
      contextState: ctx.state,
    });
  }

  // Override rl.prompt to always render status bar dynamically under the prompt
  const originalPrompt = rl.prompt.bind(rl);
  rl.prompt = (preserveCursor?: boolean) => {
    printStatus();
    originalPrompt(preserveCursor);
  };

  rl.prompt();

  rl.on('line', async (line) => {
    clearStatusBar();

    if (isProcessing) {
      console.log(chalk.hex(theme.warning)('  Veuillez patienter, l\'IA réfléchit...'));
      rl.prompt();
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
      console.log(`    ${chalk.hex(theme.secondary)('/welcome')}    : Rejouer le tutoriel interactif`);
      console.log(`    ${chalk.hex(theme.secondary)('/setup')}      : Relancer la configuration initiale`);
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
      const status = TrackManager.status();

      if (!status.track) {
        console.log(chalk.hex(theme.muted)('\n  Aucun track actif dans ce projet.\n'));
      } else {
        console.log(`\n  ${chalk.hex(theme.primary).bold('TRACK ACTIF')} : ${chalk.hex(theme.accent)(status.track.id)}`);
        console.log(`  ${chalk.hex(theme.muted)(status.track.title)}\n`);

        const tasks = status.plan.split('\n').filter((l: string) => l.match(/^\s*- \[[ x~]\]/));
        if (tasks.length > 0) {
          tasks.slice(0, 10).forEach((t: string) => {
            const done = t.includes('[x]');
            const inprog = t.includes('[~]');
            const icon = done ? chalk.hex(theme.accent)('✓') : inprog ? chalk.hex(theme.warning)('~') : chalk.hex(theme.muted)('○');
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
      const active = TrackManager.getActive();
      if (!active) {
        console.log(chalk.hex(theme.muted)('\n  Aucun track actif.\n'));
      } else {
        console.log(chalk.hex(theme.warning)('\n  Archivage du track en cours...'));
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

    if (input === '/welcome') {
      rl.pause();
      const { showTutorial } = await import('../../ui/tutorial');
      await showTutorial();
      rl.resume();
      rl.prompt();
      return;
    }

    if (input === '/setup') {
      rl.pause();
      const { runSetupWizard } = await import('../../cli/wizard');
      const { showTutorial } = await import('../../ui/tutorial');
      await runSetupWizard();
      await showTutorial();
      rl.resume();
      rl.prompt();
      return;
    }

    if (input === '/clear') {
      agent.clearHistory();
      console.log(chalk.hex(theme.warning)('\n  Historique effacé.\n'));
      rl.prompt();
      return;
    }

    if (input === '/model' || input.startsWith('/model ')) {
      const parts = input.split(' ');
      const model = parts[1]?.trim();
      
      if (!model) {
        console.log(chalk.hex(theme.primary).bold('\n  🤖 MODÈLES DISPONIBLES :'));
        console.log(`    • ${chalk.hex(theme.accent).bold('zuri')}     : Modèle d'ingénierie senior - Très précis, idéal pour le code.`);
        console.log(`    • ${chalk.hex(theme.accent).bold('standard')} : Modèle standard équilibré - Rapide et intelligent.`);
        console.log(`    • ${chalk.hex(theme.accent).bold('flash')}    : Modèle ultra-rapide - Économique et instantané.`);
        console.log(`    • ${chalk.hex(theme.muted)('Autre')}    : N'importe quel modèle personnalisé (ex: gpt-4o, claude-3.5-sonnet).`);
        console.log(chalk.hex(theme.muted)('              (Tarif forfaitaire fixe de 5.00 FCFA par requête)'));
        console.log(chalk.hex(theme.primary)(`\n  👉 Tapez ${chalk.bold('/model <nom>')} pour activer un modèle (ex: ${chalk.bold('/model flash')})\n`));
        rl.prompt();
        return;
      }

      agent.setModel(model);
      
      renderWelcome({
        model: model,
        projectName: projectInfo.name,
        projectType: projectInfo.type,
        mode: 'Senior Engineer (MIT)'
      });

      console.log(chalk.hex(theme.primary)(`\n  Modèle changé pour : ${chalk.bold(model)}\n`));
      rl.prompt();
      return;
    }

    if (input.startsWith('/save')) {
      const name = input.split(' ')[1] || `session_${Date.now()}`;
      let session = store.findSessionByName(name);
      if (!session) {
        session = store.createSession(name, process.cwd());
      }
      store.saveMessages(session.id, agent.getMessages());
      currentSessionId = session.id;
      console.log(chalk.hex(theme.accent)(`\n  Session sauvegardée : ${chalk.bold(name)} (${session.id})\n`));
      rl.prompt();
      return;
    }

    if (input === '/sessions') {
      const sessions = store.listSessions();
      console.log(chalk.hex(theme.primary).bold('\n  SESSIONS DISPONIBLES :'));
      if (sessions.length === 0) {
        console.log(chalk.hex(theme.muted)('    Aucune session enregistrée.'));
      } else {
        sessions.slice(0, 20).forEach(s => {
          const active = s.isActive ? chalk.hex(theme.accent)('●') : chalk.hex(theme.muted)('○');
          const date = new Date(s.updatedAt).toLocaleDateString('fr-FR');
          console.log(`    ${active} ${chalk.hex(theme.text)(s.name)} ${chalk.hex(theme.muted)(date + ' · ' + s.projectPath)}`);
        });
      }
      console.log('');
      rl.prompt();
      return;
    }

    if (input.startsWith('/load ')) {
      const nameOrId = input.split(' ')[1];
      const session = store.findSessionByName(nameOrId) || store.getSession(nameOrId);
      if (!session) {
        console.log(chalk.hex(theme.warning)(`\n  Session "${nameOrId}" introuvable.\n`));
        rl.prompt();
        return;
      }
      const messages = store.loadMessages(session.id);
      agent.setMessages(messages);
      currentSessionId = session.id;
      store.activateSession(session.id);
      console.log(chalk.hex(theme.accent)(`\n  Session "${session.name}" chargée (${messages.length} messages).\n`));
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

    // Guardrail: Intercept all unknown slash commands to avoid sending them to the agent
    if (input.startsWith('/')) {
      console.log(chalk.hex(theme.warning)(`\n  Commande inconnue : "${input}". Saisissez /help pour voir les commandes disponibles.\n`));
      rl.prompt();
      return;
    }

    isProcessing = true;
    try {
      await agent.run(input);
    } catch (error) {
      if (error instanceof Error) {
        showErrorPanel(error);
      } else {
        console.error(chalk.red(`\nErreur: ${error}`));
      }
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
    process.stdin.removeListener('keypress', keypressHandler);
    clearStatusBar();
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
