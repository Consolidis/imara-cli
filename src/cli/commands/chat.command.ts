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

interface ChatOptions {
  model?: string;
  yes?: boolean;
  resume?: string;
  execute?: boolean;
}

export async function chatCommand(options: ChatOptions, initialPrompt?: string) {
  if (ConfigManager.isFirstLaunch()) {
    const { runSetupWizard } = await import('../../cli/wizard');
    const { showTutorial } = await import('../../ui/tutorial');
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

  // Trigger Garbage Collector in background asynchronously (purge >30 days old sessions)
  setTimeout(() => {
    try {
      const deletedCount = store.deleteOldSessions(30);
      if (deletedCount > 0 && ConfigManager.get().verbose) {
        console.log(chalk.dim(`\n[GC] ${deletedCount} sessions inactives obsolètes (>30 jours) purgées.`));
      }
    } catch {
      // Silent GC
    }
  }, 1000);

  // Resume session if requested
  if (options.resume) {
    try {
      const session = store.findSessionByName(options.resume) || store.getSession(options.resume);
      if (session) {
        if (session.projectPath !== process.cwd()) {
          console.log(chalk.hex(theme.warning)(`\n  ⚠ Impossible de charger cette session : elle appartient au projet situé dans "${session.projectPath}" et non au projet courant.\n`));
        } else {
          const messages = store.loadMessages(session.id);
          if (messages.length > 0) {
            agent.setMessages(messages);
            currentSessionId = session.id;
            store.activateSession(session.id);
            console.log(chalk.dim(`\n(Session "${session.name}" reprise avec ${messages.length} messages)\n`));
          }
        }
      } else {
        console.log(chalk.hex(theme.warning)(`\nSession "${options.resume}" introuvable.\n`));
      }
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      console.error(chalk.red(`\nErreur reprise session: ${errMsg}`));
    }
  } else {
    // Auto-resume derniere session active si elle existe (avec confirmation interactive et confinement de projet)
    try {
      const sessions = store.listSessions(process.cwd());
      const activeSession = sessions.find(s => s.isActive);
      if (activeSession && activeSession.projectPath === process.cwd()) {
        const messages = store.loadMessages(activeSession.id);
        if (messages.length > 0) {
          if (process.env.NODE_ENV === 'test') {
            agent.setMessages(messages);
            currentSessionId = activeSession.id;
          } else {
            rl.pause();
            const resumeConfirm = await new Promise<boolean>(resolve => {
              const tempRl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
              });
              tempRl.question(
                chalk.hex(theme.primary)(`  Souhaitez-vous reprendre votre dernière session active "${activeSession.name}" ? (y/N) : `),
                (ans) => {
                  tempRl.close();
                  resolve(ans.trim().toLowerCase() === 'y');
                }
              );
            });
            rl.resume();
            
            if (resumeConfirm) {
              agent.setMessages(messages);
              currentSessionId = activeSession.id;
              console.log(chalk.hex(theme.accent)(`\n  ✓ Session "${activeSession.name}" reprise avec succès (${messages.length} messages).\n`));
            } else {
              // Désactiver l'ancienne session pour ne pas reprompter à chaque fois
              store.deactivateSession(activeSession.id);
              console.log(chalk.dim('\n  (Démarrage d\'une nouvelle session vierge)\n'));
            }
          }
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
      if (session) {
        store.saveMessages(session.id, agent.getMessages());
        currentSessionId = session.id;
        console.log(chalk.hex(theme.accent)(`\n  Session sauvegardée : ${chalk.bold(name)} (${session.id})\n`));
      } else {
        console.log(chalk.hex(theme.warning)('\n  Impossible de sauvegarder la session.\n'));
      }
      rl.prompt();
      return;
    }

    if (input === '/sessions') {
      const sessions = store.listSessions(process.cwd());
      console.log(chalk.hex(theme.primary).bold('\n  🤖 SESSIONS HISTORIQUES (Dossier courant) :'));
      if (sessions.length === 0) {
        console.log(chalk.hex(theme.muted)('    Aucune session enregistrée pour ce projet.'));
      } else {
        console.log(chalk.hex(theme.muted)(
          '  ┌' + '─'.repeat(38) + '┬' + '─'.repeat(34) + '┬' + '─'.repeat(14) + '┬' + '─'.repeat(19) + '┐'
        ));
        console.log(chalk.hex(theme.muted)(
          '  │ ' + chalk.bold('ID Session'.padEnd(36)) + ' │ ' + chalk.bold('Titre / Nom'.padEnd(32)) + ' │ ' + chalk.bold('Modèle'.padEnd(12)) + ' │ ' + chalk.bold('Date'.padEnd(17)) + ' │'
        ));
        console.log(chalk.hex(theme.muted)(
          '  ├' + '─'.repeat(38) + '┼' + '─'.repeat(34) + '┼' + '─'.repeat(14) + '┼' + '─'.repeat(19) + '┤'
        ));
        sessions.slice(0, 10).forEach(s => {
          const idStr = s.id.substring(0, 36).padEnd(36);
          const nameStr = s.name.substring(0, 32).padEnd(32);
          const modelStr = resolvedModel.substring(0, 12).padEnd(12);
          const dateStr = new Date(s.updatedAt).toLocaleDateString('fr-FR', {
            day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
          }).padEnd(17);
          const isActiveColor = s.isActive ? chalk.hex(theme.accent) : chalk.hex(theme.text);
          console.log(chalk.hex(theme.muted)(
            `  │ ` + isActiveColor(idStr) + ` │ ` + chalk.hex(theme.text)(nameStr) + ` │ ` + chalk.hex(theme.accent)(modelStr) + ` │ ` + chalk.hex(theme.muted)(dateStr) + ` │`
          ));
        });
        console.log(chalk.hex(theme.muted)(
          '  └' + '─'.repeat(38) + '┴' + '─'.repeat(34) + '┴' + '─'.repeat(14) + '┴' + '─'.repeat(19) + '┘'
        ));
      }
      console.log(chalk.hex(theme.primary)(`\n  👉 Tapez ${chalk.bold('/load <id|nom>')} pour reprendre une session.\n`));
      rl.prompt();
      return;
    }

    if (input.startsWith('/load ')) {
      const nameOrId = input.replace('/load ', '').trim();
      if (!nameOrId) {
        console.log(chalk.hex(theme.warning)('\n  Veuillez spécifier l\'ID ou le nom de la session (ex: /load session_123).\n'));
        rl.prompt();
        return;
      }
      const session = store.findSessionByName(nameOrId) || store.getSession(nameOrId);
      if (!session) {
        console.log(chalk.hex(theme.warning)(`\n  Session "${nameOrId}" introuvable.\n`));
        rl.prompt();
        return;
      }
      if (session.projectPath !== process.cwd()) {
        console.log(chalk.hex(theme.warning)(`\n  ⚠ Impossible de charger cette session : elle appartient au projet situé dans "${session.projectPath}" et non au projet courant.\n`));
        rl.prompt();
        return;
      }
      
      // Désactiver toutes les autres sessions actives dans ce projet
      store.listSessions(process.cwd()).forEach(s => {
        if (s.id !== session.id && s.isActive) {
          store.deactivateSession(s.id);
        }
      });

      const messages = store.loadMessages(session.id);
      agent.setMessages(messages);
      currentSessionId = session.id;
      store.activateSession(session.id);
      console.log(chalk.hex(theme.accent)(`\n  ✓ Session "${session.name}" rechargée avec succès (${messages.length} messages).\n`));
      rl.prompt();
      return;
    }

    if (input === '/clear-history') {
      rl.pause();
      console.log(chalk.hex(theme.warning)('\n  ⚠️  ATTENTION : Cette action supprimera DÉFINITIVEMENT toutes les sessions et historiques stockés pour ce projet.'));
      
      const confirm = await new Promise<boolean>(resolve => {
        const tempRl = readline.createInterface({
          input: process.stdin,
          output: process.stdout
        });
        tempRl.question(chalk.bold('  Voulez-vous continuer ? (y/N) : '), (ans) => {
          tempRl.close();
          resolve(ans.trim().toLowerCase() === 'y');
        });
      });
      rl.resume();

      if (confirm) {
        const sessions = store.listSessions(process.cwd());
        sessions.forEach(s => {
          store.deleteSession(s.id);
        });
        agent.clearHistory();
        currentSessionId = null;
        console.log(chalk.hex(theme.accent)('\n  ✓ Base de données nettoyée pour ce projet.\n'));
      } else {
        console.log(chalk.dim('\n  Action annulée.\n'));
      }
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

      // Auto-save history after each successful interaction
      if (!currentSessionId) {
        const defaultName = `session_${new Date().toLocaleDateString('fr-FR').replace(/\//g, '-')}_${Date.now().toString().slice(-4)}`;
        const session = store.createSession(defaultName, process.cwd());
        if (session) {
          currentSessionId = session.id;
          store.activateSession(session.id);
        }
      }
      if (currentSessionId) {
        store.saveMessages(currentSessionId, agent.getMessages());
      }
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

      // Auto-save initial prompt interaction
      if (!currentSessionId) {
        const defaultName = `session_${new Date().toLocaleDateString('fr-FR').replace(/\//g, '-')}_${Date.now().toString().slice(-4)}`;
        const session = store.createSession(defaultName, process.cwd());
        if (session) {
          currentSessionId = session.id;
          store.activateSession(session.id);
        }
      }
      if (currentSessionId) {
        store.saveMessages(currentSessionId, agent.getMessages());
      }
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
