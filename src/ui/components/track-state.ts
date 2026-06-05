// src/ui/components/track-state.ts
// CLI Track State - Interface Interactive d'Exploration des Tracks (Conductor)
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { theme } from '../theme';
import { TrackManager, TrackMeta } from '../../context/conductor/track-manager';

// ── State ─────────────────────────────────────────────────────────────────
let selectedTrackId: string | null = null;

// ── Helpers ──────────────────────────────────────────────────────────────
function progressBar(percent: number, width: number = 20): string {
  const filled = Math.round((percent / 100) * width);
  const empty = width - filled;
  const bar = chalk.hex(theme.accent)('█'.repeat(filled)) + chalk.hex(theme.muted)('░'.repeat(empty));
  return `${bar} ${chalk.hex(theme.text)(String(percent).padStart(3))}%`;
}

function statusIcon(status: string): string {
  switch (status) {
    case 'active':       return chalk.hex(theme.accent)('●');
    case 'in_progress':  return chalk.hex(theme.warning)('◐');
    case 'done':         return chalk.hex(theme.muted)('✓');
    case 'archived':     return chalk.hex(theme.muted)('○');
    default:             return chalk.hex(theme.muted)('·');
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case 'active':       return chalk.hex(theme.accent)('ACTIF');
    case 'in_progress':  return chalk.hex(theme.warning)('EN COURS');
    case 'done':         return chalk.hex(theme.muted)('TERMINE');
    case 'archived':     return chalk.hex(theme.muted)('ARCHIVE');
    default:             return chalk.hex(theme.muted)(status.toUpperCase());
  }
}

function printSeparator(title?: string): void {
  const width = process.stdout.columns || 80;
  if (title) {
    const lineLen = Math.max(2, width - title.length - 4);
    const half = Math.floor(lineLen / 2);
    console.log(chalk.hex(theme.muted)(` ${'─'.repeat(half)} ${title} ${'─'.repeat(half)}`));
  } else {
    console.log(chalk.hex(theme.muted)('─'.repeat(width)));
  }
}

function printHeader(text: string): void {
  console.log(chalk.hex(theme.primary).bold(`  ${text}`));
}

function printMuted(text: string): void {
  console.log(chalk.hex(theme.muted)(`  ${text}`));
}

function printLine(label: string, value: string): void {
  console.log(`  ${chalk.hex(theme.secondary)(label)}: ${chalk.hex(theme.text)(value)}`);
}

function getTrackTitle(trackId: string): string {
  const meta = TrackManager.getTrackMeta(trackId);
  return meta ? meta.title : trackId;
}

function printTrackHeader(trackId: string): void {
  const title = getTrackTitle(trackId);
  console.log(chalk.hex(theme.muted)(`  Track: ${chalk.hex(theme.accent)(trackId)}  —  ${chalk.hex(theme.text)(title)}`));
  printSeparator();
}

// ── Views ────────────────────────────────────────────────────────────────

function renderOverview(): void {
  const tracks = TrackManager.getAllTracks();
  const active = TrackManager.getActive();
  if (tracks.length === 0) {
    printMuted('Aucun track trouve dans ce projet.');
    return;
  }
  printHeader('VUE D\'ENSEMBLE DES TRACKS');
  printMuted(`Total: ${tracks.length} track(s)  ·  Actif: ${active ? active.id : 'aucun'}`);
  console.log('');
  // Column headers
  console.log(chalk.hex(theme.muted)(
    `  ${'ID'.padEnd(42)} ${'STATUT'.padEnd(14)} ${'PROGRESSION'.padEnd(30)} ${'VALIDATION'}`
  ));
  printSeparator();
  tracks.forEach(t => {
    const prog = TrackManager.computeProgress(t.id);
    const idStr = (t.id.length > 40 ? t.id.slice(0, 37) + '...' : t.id).padEnd(42);
    const icon = statusIcon(t.status);
    const statStr = `${icon} ${statusLabel(t.status).padEnd(12)}`.padEnd(14);
    const progStr = prog.total > 0
      ? `${String(prog.done).padStart(2)}/${String(prog.total).padStart(2)} ${progressBar(prog.percent, 10)}`
      : chalk.hex(theme.muted)('aucune tache');
    const valStr = t.validated ? chalk.hex(theme.accent)('✓') : chalk.hex(theme.muted)('·');
    const marker = active && active.id === t.id ? chalk.hex(theme.accent)('▶ ') : '  ';
    console.log(`  ${marker}${chalk.hex(theme.text)(idStr)} ${statStr} ${progStr.padEnd(30)} ${valStr}`);
  });
}

function renderTrackDetail(trackId: string): void {
  const meta = TrackManager.getTrackMeta(trackId);
  const prog = TrackManager.computeProgress(trackId);
  const active = TrackManager.getActive();
  printHeader('DETAIL DU TRACK');
  printTrackHeader(trackId);
  printLine('ID', trackId);
  if (meta) printLine('Titre', meta.title);
  if (meta) printLine('Auteur', meta.author || 'inconnu');
  if (meta) {
    printLine('Cree le', meta.createdAt ? new Date(meta.createdAt).toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
    }) : 'N/A');
    printLine('Mis a jour', meta.updatedAt ? new Date(meta.updatedAt).toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
    }) : 'N/A');
  }
  const isActive = active && active.id === trackId;
  printLine('Statut', isActive
    ? chalk.hex(theme.accent)('ACTIF')
    : meta ? statusLabel(meta.status) : chalk.hex(theme.muted)('INCONNU'));
  printLine('Validation', meta?.validated ? chalk.hex(theme.accent)('Valide') : chalk.hex(theme.warning)('En attente'));
  if (prog.total > 0) {
    printLine('Progression', `${prog.done}/${prog.total} taches - ${prog.percent}%`);
    console.log(`  ${progressBar(prog.percent)}`);
  } else {
    printMuted('Aucune tache definie dans le plan.');
  }
}

function renderPlan(trackId?: string): void {
  const id = trackId || selectedTrackId;
  if (!id) { printMuted('Aucun track selectionne.'); return; }
  const prog = TrackManager.computeProgress(id);
  printHeader('PLAN D\'EXECUTION');
  printTrackHeader(id);
  printLine('Progression', `${prog.done} / ${prog.total} taches`);
  if (prog.total > 0) {
    console.log(`  ${progressBar(prog.percent)}`);
    console.log('');
    printSeparator('TACHES');
    prog.tasks.forEach(t => {
      const done = t.includes('[x]');
      const inprog = t.includes('[~]');
      const icon = done
        ? chalk.hex(theme.accent)('✓')
        : inprog
          ? chalk.hex(theme.warning)('~')
          : chalk.hex(theme.muted)('○');
      const text = t.replace(/^\s*- \[[ x~]\]\s*/, '');
      const colored = done ? chalk.hex(theme.muted)(text) : chalk.hex(theme.text)(text);
      console.log(`  ${icon} ${colored}`);
    });
  }
  // Afficher les phases et sections du plan meme sans taches formatees
  const tracksDir = TrackManager.getTracksDir();
  const planPath = path.join(tracksDir, id, 'plan.md');
  if (fs.existsSync(planPath)) {
    const content = fs.readFileSync(planPath, 'utf-8');
    const lines = content.split('\n');
    const nonTaskLines = lines.filter(l => !l.match(/^\s*- \[[ x~]\]/) && l.trim());
    if (nonTaskLines.length > 0) {
      console.log('');
      printSeparator('CONTENU COMPLET');
      nonTaskLines.slice(0, 40).forEach(line => {
        if (line.startsWith('### ')) {
          console.log(chalk.hex(theme.secondary).bold(`  ${line}`));
        } else if (line.startsWith('## ')) {
          console.log(chalk.hex(theme.primary).bold(`  ${line}`));
        } else if (line.startsWith('- ')) {
          console.log(`  ${chalk.hex(theme.muted)('·')} ${chalk.hex(theme.text)(line.replace(/^- /, ''))}`);
        } else if (line.trim()) {
          console.log(`  ${chalk.hex(theme.text)(line)}`);
        }
      });
      if (lines.length > 40) printMuted(`... (${lines.length - 40} lignes masquees)`);
    }
  }
}

function renderSpec(trackId?: string): void {
  const id = trackId || selectedTrackId;
  if (!id) { printMuted('Aucun track selectionne.'); return; }
  const spec = TrackManager.readSpec(id);
  if (!spec) {
    printMuted('Aucun fichier spec.md pour ce track.');
    return;
  }
  printHeader('SPECIFICATIONS');
  printTrackHeader(id);
  const lines = spec.split('\n').slice(0, 40);
  lines.forEach(line => {
    if (line.startsWith('# ')) {
      console.log(chalk.hex(theme.primary).bold(`  ${line}`));
    } else if (line.startsWith('## ')) {
      console.log(chalk.hex(theme.secondary)(`  ${line}`));
    } else if (line.startsWith('- [ ]')) {
      const text = line.replace(/^- \[ \]\s*/, '');
      console.log(`  ${chalk.hex(theme.muted)('○')} ${chalk.hex(theme.text)(text)}`);
    } else if (line.trim()) {
      console.log(`  ${chalk.hex(theme.text)(line)}`);
    } else {
      console.log('');
    }
  });
  if (lines.length < spec.split('\n').length) {
    printMuted(`... (${spec.split('\n').length - 40} lignes masquees)`);
  }
}

function renderWorkflow(): void {
  const wf = TrackManager.readWorkflow();
  if (!wf) {
    printMuted('Aucun fichier workflow.md trouve.');
    return;
  }
  printHeader('WORKFLOW CONDUCTOR');
  printSeparator();
  const lines = wf.split('\n');
  lines.forEach(line => {
    if (line.startsWith('# ')) {
      console.log(chalk.hex(theme.primary).bold(`  ${line}`));
    } else if (line.startsWith('## ')) {
      console.log(chalk.hex(theme.secondary)(`  ${line}`));
    } else if (line.startsWith('- ')) {
      console.log(`  ${chalk.hex(theme.text)(line)}`);
    } else if (line.trim()) {
      console.log(`  ${chalk.hex(theme.text)(line)}`);
    }
  });
}

function renderLogs(trackId?: string): void {
  const id = trackId || selectedTrackId;
  if (!id) { printMuted('Aucun track selectionne.'); return; }
  const logs = TrackManager.readLogs(id, 40);
  if (!logs) {
    printMuted('Aucune entree de journal.');
    return;
  }
  printHeader('JOURNAL DES ACTIONS');
  printTrackHeader(id);
  const lines = logs.split('\n').filter(l => l.trim());
  if (lines.length === 0) {
    printMuted('Aucune entree.');
  } else {
    lines.forEach(line => {
      if (line.startsWith('- [')) {
        const match = line.match(/^- \[([^\]]+)\]\s*(.*)/);
        if (match) {
          const ts = match[1];
          const rest = match[2];
          console.log(`  ${chalk.hex(theme.muted)(ts)} ${chalk.hex(theme.text)(rest)}`);
        } else {
          console.log(`  ${chalk.hex(theme.muted)(line)}`);
        }
      } else if (line.startsWith('### ')) {
        const note = line.replace(/^###\s*/, '');
        console.log(chalk.hex(theme.secondary)(`  ${note}`));
      } else if (line.trim()) {
        console.log(`  ${chalk.hex(theme.text)(line)}`);
      }
    });
  }
}

function renderStats(): void {
  const tracks = TrackManager.getAllTracks();
  const active = TrackManager.getActive();
  const registre = TrackManager.getRegistre();
  let totalTasks = 0;
  let doneTasks = 0;
  let activeCount = 0;
  let archivedCount = 0;
  tracks.forEach(t => {
    const prog = TrackManager.computeProgress(t.id);
    totalTasks += prog.total;
    doneTasks += prog.done;
    if (t.status === 'active') activeCount++;
  });
  if (registre) {
    const inProgressMatch = registre.match(/## 🟢 In Progress\n([^#]+)/);
    if (inProgressMatch) {
      activeCount = inProgressMatch[1].split('\n').filter(l => l.trim().startsWith('-')).length;
    }
    const archivedMatch = registre.match(/## 🔴 Archived\n([^#]+)/);
    if (archivedMatch) {
      archivedCount = archivedMatch[1].split('\n').filter(l => l.trim().startsWith('-')).length;
    }
  }
  printHeader('STATISTIQUES DU PROJET');
  printSeparator();
  printLine('Nombre total de tracks', String(tracks.length));
  printLine('Tracks en cours', String(activeCount));
  printLine('Tracks termines', String(archivedCount));
  printLine('Tracks actif', active ? active.id : 'aucun');
  printLine('Taches totales', String(totalTasks));
  printLine('Taches accomplies', String(doneTasks));
  if (totalTasks > 0) {
    const globalPercent = Math.round((doneTasks / totalTasks) * 100);
    printLine('Progression globale', `${globalPercent}%`);
    console.log(`  ${progressBar(globalPercent)}`);
  }
  printLine('Validation active', active?.validated ? chalk.hex(theme.accent)('Valide') : chalk.hex(theme.warning)('Non valide'));
  printLine('Dossier Conductor', TrackManager.getConductorDir());
}

// ── Selection de track ─────────────────────────────────────────────────────
async function selectTrack(): Promise<string | null> {
  const { Select } = require('enquirer');
  const tracks = TrackManager.getAllTracks();
  if (tracks.length === 0) {
    printMuted('Aucun track disponible.');
    return null;
  }
  const active = TrackManager.getActive();
  const choices = tracks.map(t => {
    const icon = statusIcon(t.status);
    const prog = TrackManager.computeProgress(t.id);
    const marker = active && active.id === t.id ? chalk.hex(theme.accent)(' ▶') : '';
    const progStr = prog.total > 0 ? ` ${prog.done}/${prog.total} (${prog.percent}%)` : '';
    const label = `${icon} ${chalk.hex(theme.text)(t.id.padEnd(42))} ${statusLabel(t.status).padEnd(12)}${progStr}${marker}`;
    return { name: t.id, message: label };
  });
  choices.push({ name: '__back__', message: chalk.hex(theme.muted)('← Retour au menu principal') });
  const prompt = new Select({
    name: 'trackChoice',
    message: chalk.hex(theme.primary).bold('SELECTIONNER UN TRACK'),
    prefix: '',
    pointer(choice: any, index: number) {
      return this.index === index ? chalk.hex(theme.accent)('▶') : ' ';
    },
    choices,
  });
  try {
    const choice = await prompt.run();
    if (choice === '__back__') return null;
    return choice;
  } catch {
    return null;
  }
}

// ── Sous-menu detail d'un track ───────────────────────────────────────────
async function showTrackDetailMenu(trackId: string): Promise<void> {
  const { Select } = require('enquirer');
  const meta = TrackManager.getTrackMeta(trackId);
  const title = meta ? meta.title : trackId;
  let running = true;
  while (running) {
    const prompt = new Select({
      name: 'detailView',
      message: chalk.hex(theme.primary).bold(`TRACK: ${trackId}  —  ${title}`),
      prefix: '',
      pointer(choice: any, index: number) {
        return this.index === index ? chalk.hex(theme.accent)('▶') : ' ';
      },
      choices: [
        { name: 'detail',  message: '1. DETAILS       — Metadonnees et progression du track' },
        { name: 'plan',     message: '2. PLAN          — Taches avec barre de progression' },
        { name: 'spec',     message: '3. SPECIFICATION  — Contenu du spec.md' },
        { name: 'logs',     message: '4. JOURNAL       — Dernieres entrees du log.md' },
        { name: 'back',     message: '5. RETOUR        — Revenir a la selection' },
      ],
    });
    let choice: string;
    try {
      choice = await prompt.run();
    } catch {
      running = false;
      break;
    }
    if (choice === 'back') {
      running = false;
      break;
    }
    console.clear();
    switch (choice) {
      case 'detail': renderTrackDetail(trackId); break;
      case 'plan':   renderPlan(trackId); break;
      case 'spec':   renderSpec(trackId); break;
      case 'logs':   renderLogs(trackId); break;
    }
    console.log('');
    printSeparator();
    printMuted('Appuyez sur ENTER pour revenir au menu du track...');
    await new Promise<void>(resolve => {
      const readline = require('readline');
      const tempRl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      tempRl.question('', () => {
        tempRl.close();
        resolve();
      });
    });
  }
}

// ── Menu principal ─────────────────────────────────────────────────────────
export async function showTrackStateMenu(): Promise<void> {
  const { Select } = require('enquirer');
  const views: { name: string; message: string; render: () => void }[] = [
    { name: 'overview',       message: '1. VUE D\'ENSEMBLE     — Tous les tracks et leur progression', render: renderOverview },
    { name: 'select',         message: '2. SELECTIONNER TRACK  — Explorer un track specifique', render: () => {} },
    { name: 'active',         message: '3. TRACK ACTIF         — Detail du track courant', render: () => renderTrackDetail(TrackManager.getActive()?.id || '') },
    { name: 'plan',           message: '4. PLAN                — Taches du track selectionne', render: () => renderPlan() },
    { name: 'spec',           message: '5. SPECIFICATION       — Contenu du spec.md du track selectionne', render: () => renderSpec() },
    { name: 'workflow',       message: '6. WORKFLOW            — Workflow Conductor du projet', render: renderWorkflow },
    { name: 'logs',           message: '7. JOURNAL             — Dernieres entrees du track selectionne', render: () => renderLogs() },
    { name: 'stats',          message: '8. STATISTIQUES        — Stats globales du projet', render: renderStats },
    { name: 'back',           message: '9. QUITTER             — Retour au terminal', render: () => {} },
  ];

  // Initialiser selectedTrackId avec le track actif
  const active = TrackManager.getActive();
  if (active) {
    selectedTrackId = active.id;
  } else {
    // Fallback: prendre le premier track disponible
    const all = TrackManager.getAllTracks();
    if (all.length > 0) selectedTrackId = all[0].id;
  }

  let running = true;
  while (running) {
    // Afficher l'en-tete avec le track selectionne
    if (selectedTrackId) {
      const meta = TrackManager.getTrackMeta(selectedTrackId);
      const title = meta ? meta.title : selectedTrackId;
      console.log(chalk.hex(theme.muted)(`  Track selectionne: ${chalk.hex(theme.accent)(selectedTrackId)}  —  ${chalk.hex(theme.text)(title)}`));
    } else {
      console.log(chalk.hex(theme.muted)(`  Track selectionne: ${chalk.hex(theme.warning)('aucun')}`));
    }
    printSeparator();

    const prompt = new Select({
      name: 'view',
      message: chalk.hex(theme.primary).bold('NAVIGATION TRACK STATE'),
      prefix: '',
      pointer(choice: any, index: number) {
        return this.index === index ? chalk.hex(theme.accent)('▶') : ' ';
      },
      choices: views.map(v => ({
        name: v.name,
        message: v.message,
      })),
    });

    let choice: string;
    try {
      choice = await prompt.run();
    } catch {
      running = false;
      break;
    }

    if (choice === 'back') {
      running = false;
      break;
    }

    if (choice === 'select') {
      const trackId = await selectTrack();
      if (trackId) {
        selectedTrackId = trackId;
        await showTrackDetailMenu(trackId);
      }
      continue;
    }

    const view = views.find(v => v.name === choice);
    if (view) {
      console.clear();
      view.render();
      console.log('');
      printSeparator();
      printMuted('Appuyez sur ENTER pour revenir au menu principal...');
      await new Promise<void>(resolve => {
        const readline = require('readline');
        const tempRl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        });
        tempRl.question('', () => {
          tempRl.close();
          resolve();
        });
      });
    }
  }
}
