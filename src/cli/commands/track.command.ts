// src/cli/commands/track.command.ts
import chalk from 'chalk';
import * as path from 'path';
import * as fs from 'fs';
import { TrackManager } from '../../context/conductor/track-manager';
import { theme } from '../../ui/theme';
import { showTrackStateMenu } from '../../ui/components/track-state';

export async function trackCommand(action: string, arg?: string) {
  switch (action) {
    // ── imara track new <titre> ──────────────────────────────────────────
    case 'new': {
      let title = arg;
      if (!title) {
        const { Input } = require('enquirer');
        const prompt = new Input({
          message: 'Titre du nouveau track',
          initial: 'Nouvelle fonctionnalité'
        });
        title = await prompt.run();
      }
      const { Input: InputLong } = require('enquirer');
      const goalPrompt = new InputLong({
        message: 'Objectif principal de ce track'
      });
      const goal = await goalPrompt.run();
      const track = TrackManager.newTrack(title!);
      
      // Update index.md with the goal
      const indexPath = path.join(track.dir, 'index.md');
      if (fs.existsSync(indexPath)) {
        const content = fs.readFileSync(indexPath, 'utf-8');
        fs.writeFileSync(indexPath, content.replace('(À compléter)', goal || 'Objectif non défini'), 'utf-8');
      }
      console.log(chalk.hex(theme.accent)(`\n  Track actif : ${track.id}`));
      console.log(chalk.hex(theme.muted)(`  Fichiers créés et pré-remplis dans ${path.relative(process.cwd(), track.dir)}/\n`));
      break;
    }
    // ── imara track status ───────────────────────────────────────────────
    case 'status': {
      const { track, plan, recentLog } = TrackManager.status();
      if (!track) {
        console.log(chalk.hex(theme.muted)('\n  Aucun track actif. Lancez `imara track new "<titre>`.\n'));
        break;
      }
      console.log(`\n  ${chalk.hex(theme.primary).bold('TRACK ACTIF')} : ${chalk.hex(theme.accent)(track.id)}`);
      console.log(`  ${chalk.hex(theme.muted)(track.title)}\n`);
      // Show tasks from plan.md
      const tasks = plan.split('\n').filter(l => l.match(/^\s*- \[[ x~]\]/));
      if (tasks.length > 0) {
        console.log(chalk.hex(theme.secondary)('  PLAN :'));
        tasks.slice(0, 15).forEach(t => {
          const done    = t.includes('[x]');
          const inprog  = t.includes('[~]');
          const icon    = done ? chalk.hex(theme.accent)('✓') : inprog ? chalk.hex(theme.warning ?? '#ffaa00')('~') : chalk.hex(theme.muted)('○');
          const text    = t.replace(/^\s*- \[[ x~]\]\s*/, '');
          const colored = done ? chalk.hex(theme.muted)(text) : chalk.hex(theme.text)(text);
          console.log(`    ${icon} ${colored}`);
        });
        console.log('');
      }
      // Show last 5 log entries
      const lastLines = recentLog.split('\n').filter(l => l.startsWith('- [')).slice(-5);
      if (lastLines.length > 0) {
        console.log(chalk.hex(theme.secondary)('  JOURNAL RÉCENT :'));
        lastLines.forEach(l => console.log(`    ${chalk.hex(theme.muted)(l)}`));
        console.log('');
      }
      break;
    }
    // ── imara track state ────────────────────────────────────────────────
    case 'state': {
      await showTrackStateMenu();
      break;
    }
    // ── imara track list ─────────────────────────────────────────────────
    case 'list': {
      const tracks = TrackManager.list();
      const active = TrackManager.getActive();
      if (tracks.length === 0) {
        console.log(chalk.hex(theme.muted)('\n  Aucun track trouvé. Lancez `imara track init` puis `imara track new`.\n'));
        break;
      }
      console.log(`\n  ${chalk.hex(theme.primary).bold('TRACKS DU PROJET :')}\n`);
      tracks.forEach(t => {
        const isActive = active?.id === t;
        const marker   = isActive ? chalk.hex(theme.accent)('▶ ') : '  ';
        console.log(`  ${marker}${chalk.hex(isActive ? theme.accent : theme.text)(t)}`);
      });
      console.log('');
      break;
    }
    // ── imara track done <id_partiel> ────────────────────────────────────
    case 'done': {
      const active = TrackManager.getActive();
      if (!active) {
        console.error(chalk.red('  Aucun track actif.'));
        break;
      }
      const planPath = path.join(active.dir, 'plan.md');
      if (!fs.existsSync(planPath)) {
        console.error(chalk.red(`  plan.md introuvable dans ${active.dir}`));
        break;
      }
      let plan = fs.readFileSync(planPath, 'utf-8');
      // Mark first pending task [ ] as done [x]
      const updated = plan.replace(/^(\s*- )\[ \]/, '$1[x]');
      if (updated === plan) {
        console.log(chalk.hex(theme.muted)('  Aucune tâche [ ] trouvée à marquer.'));
      } else {
        fs.writeFileSync(planPath, updated, 'utf-8');
        console.log(chalk.hex(theme.accent)('  ✓ Première tâche en attente marquée comme terminée.'));
      }
      break;
    }
    // ── imara track implement <id> ───────────────────────────────────────
    case 'implement': {
      if (!arg) {
        console.error(chalk.red('Usage: imara track implement <id_du_track>'));
        process.exit(1);
      }
      const tracks = TrackManager.list();
      // Prioritize exact match, then prefix match, then fuzzy include
      let target = tracks.find(t => t === arg);
      if (!target) target = tracks.find(t => t.startsWith(arg));
      if (!target) target = tracks.find(t => t.includes(arg));
      
      if (!target) {
        console.error(chalk.red(`Track "${arg}" introuvable.`));
        console.log(chalk.dim('Utilisez `imara track list` pour voir les IDs disponibles.'));
        break;
      }
      const tracksDir = TrackManager.getTracksDir();
      const trackDir = path.join(tracksDir, target);
      
      // We need to get the title from index.md
      const indexMd = path.join(trackDir, 'index.md');
      let title = target;
      if (fs.existsSync(indexMd)) {
        const content = fs.readFileSync(indexMd, 'utf-8');
        const match = content.match(/^# Track \d+ — (.*)$/m);
        if (match) title = match[1];
      }
      TrackManager.setActive({ id: target, title, dir: trackDir, validated: false });
      
      console.log(chalk.hex(theme.accent)(`\n  Track "${target}" activé pour implémentation.`));
      console.log(chalk.hex(theme.muted)('  Lancement de l\'analyse automatique...\n'));
      // Forward to chat command with initial prompt
      const { chatCommand } = require('./chat.command');
      const relDir = path.relative(process.cwd(), trackDir).replace(/\\/g, '/');
      await chatCommand({}, `Je souhaite implémenter le track "${target}". Analyse le projet (regarde dans ./${relDir} pour le plan et les specs, et dans le reste du projet pour le code) et propose un plan détaillé.`);
      break;
    }
    case 'help':
    default: {
      console.log(`\n  ${chalk.hex(theme.primary).bold('SYSTÈME DE TRACKS (Conductor)')}`);
      console.log(chalk.hex(theme.muted)('  Le système de tracks permet de structurer votre travail par objectifs.\n'));
      
      console.log(chalk.hex(theme.secondary).bold('  CONCEPT :'));
      console.log('    1. Un track représente une fonctionnalité ou un bug spécifique.');
      console.log('    2. L\'IA accède aux fichiers du track (.imara/conductor/) pour garder le contexte.');
      console.log('    3. Toutes les actions (tool calls) sont logguées automatiquement.\n');
      console.log(chalk.hex(theme.secondary).bold('  COMMANDES :'));
      console.log(`    ${chalk.hex(theme.accent)('imara init-conductor')}      Installer le framework dans le projet`);
      console.log(`    ${chalk.hex(theme.accent)('imara track new <titre>')}   Créer un nouvel objectif de travail`);
      console.log(`    ${chalk.hex(theme.accent)('imara track implement <id>')} Lancer le chat sur un track spécifique`);
      console.log(`    ${chalk.hex(theme.accent)('imara track state')}         Interface interactive d\'exploration des tracks`);
      console.log(`    ${chalk.hex(theme.accent)('imara track status')}        Voir l\'avancement et les tâches du plan`);
      console.log(`    ${chalk.hex(theme.accent)('imara track list')}          Lister tous les tracks du projet`);
      console.log(`    ${chalk.hex(theme.accent)('imara track done')}          Marquer la tâche courante comme finie\n`);
      console.log(chalk.hex(theme.secondary).bold('  FLUX DE TRAVAIL :'));
      console.log('    $ imara init-conductor');
      console.log('    $ imara track new "Ajouter authentification"');
      console.log('    $ imara track state');
      console.log('    › Parcourir les tracks, le plan, la spec...\n');
      break;
    }
  }
}
