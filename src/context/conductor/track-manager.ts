// src/context/conductor/track-manager.ts
// Manages .imara/conductor/ tracks in the current project directory.
import * as fs from 'fs';
import * as path from 'path';

export interface TrackMeta {
  id: string;
  title: string;
  status: 'active' | 'done' | 'archived';
  createdAt: string;
  updatedAt: string;
  validated: boolean;
}

export interface ActiveTrack {
  id: string;
  title: string;
  dir: string;
  validated: boolean;
}

export class TrackManager {
  private static cachedConductorDir: string | null = null;

  static resetCache(): void {
    this.cachedConductorDir = null;
  }

  static getConductorDir(): string {
    if (this.cachedConductorDir) return this.cachedConductorDir;

    const root = process.cwd();
    const defaultDir = path.join(root, '.imara', 'conductor');
    
    const candidates = [
      path.join(root, 'conductor'),
      path.join(root, 'backend', 'conductor'),
      defaultDir,
    ];

    for (const cand of candidates) {
      if (fs.existsSync(cand) && fs.statSync(cand).isDirectory()) {
        this.cachedConductorDir = cand;
        return cand;
      }
    }

    return defaultDir;
  }

  static getTracksDir(): string {
    return path.join(this.getConductorDir(), 'tracks');
  }

  static getActiveFile(): string {
    return path.join(this.getConductorDir(), 'active-track.json');
  }

  // ── Bootstrap ──────────────────────────────────────────────────────────

  static init(data?: { name?: string; description?: string; vision?: string; audience?: string; techStack?: string }): void {
    const conductorDir = this.getConductorDir();
    const tracksDir = this.getTracksDir();
    fs.mkdirSync(tracksDir, { recursive: true });

    // 1. Project Map (index.md)
    const indexMd = path.join(conductorDir, 'index.md');
    if (!fs.existsSync(indexMd)) {
      const name = data?.name || path.basename(process.cwd());
      const desc = data?.description || '(Describe the project goals and architecture here)';
      fs.writeFileSync(indexMd, `# 🗺 Project Map : ${name}\n\n## 🚀 Overview\n${desc}\n\n## 🛤 Active Tracks\n(No active tracks yet)\n\n## 📂 Structure\n- \`src/\`: Source code\n`, 'utf-8');
    }

    // 2. Tracks Registry (tracks.md)
    const tracksMd = path.join(conductorDir, 'tracks.md');
    if (!fs.existsSync(tracksMd)) {
      fs.writeFileSync(tracksMd, `# 🛤 Tracks Registry\n\n## 🟢 In Progress\n(None)\n\n## 🟡 Backlog\n(None)\n\n## 🔴 Archived\n(None)\n`, 'utf-8');
    }

    // 3. Workflow (workflow.md)
    const workflowMd = path.join(conductorDir, 'workflow.md');
    if (!fs.existsSync(workflowMd)) {
      fs.writeFileSync(workflowMd, `# 🔄 Conductor Workflow\n\n## 1. Inquiry\n- Ask clarifying questions.\n- Understand scope and constraints.\n\n## 2. Planning\n- Create \`spec.md\` (Technical Specification).\n- Create \`plan.md\` (Step-by-step tasks).\n- Get approval.\n\n## 3. Execution (TDD)\n- Write tests.\n- Implement code.\n- Refactor.\n\n## 4. Completion\n- Final verification.\n- Archive or clean up track.\n`, 'utf-8');
    }

    // 4. Product Vision (product.md)
    const productMd = path.join(conductorDir, 'product.md');
    if (!fs.existsSync(productMd)) {
      const vision = data?.vision || '(What problem does this project solve?)';
      const audience = data?.audience || '(Who is this for?)';
      const techStack = data?.techStack || '(List the technologies used)';
      
      fs.writeFileSync(productMd, 
`# 🎯 Product Vision

## Core Value Proposition
${vision}

## Target Audience
${audience}

## Tech Stack
${techStack}

## Key Features
- Feature 1
`, 'utf-8');
    }

    console.log(`\n✓ Conductor initialisé dans ${path.relative(process.cwd(), conductorDir)}`);
  }

  // ── Create ─────────────────────────────────────────────────────────────

  static newTrack(title: string): ActiveTrack {
    const tracksDir = this.getTracksDir();
    if (!fs.existsSync(tracksDir)) {
      throw new Error('Conductor non initialisé. Lancez `imara init-conductor` d\'abord.');
    }

    const existing = fs.readdirSync(tracksDir).filter(d => fs.statSync(path.join(tracksDir, d)).isDirectory());
    const nextNum  = String(existing.length + 1).padStart(3, '0');
    const slug     = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const id       = `${nextNum}-${slug}`;
    const dir      = path.join(tracksDir, id);

    fs.mkdirSync(dir, { recursive: true });

    const now = new Date().toISOString();

    // index.md
    fs.writeFileSync(path.join(dir, 'index.md'),
      `# Track ${nextNum} — ${title}\n\n**Statut :** 🟡 En cours\n**Créé :** ${now.slice(0, 10)}\n\n## Objectif\n(À compléter)\n`, 'utf-8');

    // spec.md
    fs.writeFileSync(path.join(dir, 'spec.md'),
      `# Spécifications — ${title}\n\n## 1. Contexte & Enjeux\n(L'IA va définir le contexte ici)\n\n## 2. Architecture & Choix Techniques\n(L'IA va proposer l'architecture ici)\n\n## 3. Critères d'Acceptation\n- [ ] (À définir par l'IA)\n`, 'utf-8');

    // plan.md
    fs.writeFileSync(path.join(dir, 'plan.md'),
      `# Plan — ${title}\n\n(L'IA va générer le plan étape par étape ici)\n`, 'utf-8');

    // Activate
    const track = { id, title, dir, validated: false };
    this.setActive(track);

    console.log(`✓ Track créé : ${id}`);
    console.log(`  ${path.relative(process.cwd(), dir)}/`);
    return track;
  }

  static validateTrack(): void {
    const track = this.getActive();
    if (track) {
      track.validated = true;
      this.setActive(track);
    }
  }

  // ── Active track ────────────────────────────────────────────────────────

  static getActive(): ActiveTrack | null {
    const activeFile = this.getActiveFile();
    if (!fs.existsSync(activeFile)) return null;
    try {
      const raw = JSON.parse(fs.readFileSync(activeFile, 'utf-8')) as unknown;
      if (!raw || typeof raw !== 'object') {
        this.clearActive();
        return null;
      }
      const track = raw as { [K in keyof ActiveTrack]?: unknown };
      if (
        typeof track.id !== 'string' ||
        typeof track.title !== 'string' ||
        typeof track.dir !== 'string' ||
        typeof track.validated !== 'boolean'
      ) {
        this.clearActive();
        return null;
      }
      if (!fs.existsSync(track.dir)) {
        this.clearActive();
        return null;
      }
      return { id: track.id, title: track.title, dir: track.dir, validated: track.validated };
    } catch {
      return null;
    }
  }

  static setActive(track: ActiveTrack): void {
    const activeFile = this.getActiveFile();
    fs.mkdirSync(path.dirname(activeFile), { recursive: true });
    fs.writeFileSync(activeFile, JSON.stringify(track, null, 2), 'utf-8');
  }

  static clearActive(): void {
    const activeFile = this.getActiveFile();
    if (fs.existsSync(activeFile)) fs.unlinkSync(activeFile);
  }

  // ── Status ─────────────────────────────────────────────────────────────

  static status(): { track: ActiveTrack | null; plan: string; recentLog: string } {
    const track = this.getActive();
    if (!track) return { track: null, plan: '', recentLog: '' };

    const planPath = path.join(track.dir, 'plan.md');
    const logPath  = path.join(track.dir, 'log.md');

    const plan      = fs.existsSync(planPath) ? fs.readFileSync(planPath, 'utf-8') : '';
    const logFull   = fs.existsSync(logPath)  ? fs.readFileSync(logPath, 'utf-8')  : '';
    // Return last 20 lines of log
    const recentLog = logFull.split('\n').slice(-20).join('\n');

    return { track, plan, recentLog };
  }

  // ── List ────────────────────────────────────────────────────────────────

  static list(): string[] {
    const tracksDir = this.getTracksDir();
    if (!fs.existsSync(tracksDir)) return [];
    return fs.readdirSync(tracksDir)
      .filter(d => fs.statSync(path.join(tracksDir, d)).isDirectory())
      .sort();
  }

  // ── Context for LLM ─────────────────────────────────────────────────────

  /**
   * Returns a compact text block to inject into the system prompt.
   * Includes active track info, current plan tasks, and recent log entries.
   */
  static buildContextBlock(): string {
    const { track, plan, recentLog } = this.status();
    if (!track) return '';

    // Extract only task lines from plan
    const tasks = plan.split('\n')
      .filter(l => l.match(/^\s*- \[[ x~]\]/))
      .slice(0, 15)
      .join('\n');

    return `
TRACK ACTIF : ${track.id}
Titre : ${track.title}

TÂCHES (plan.md) :
${tasks || '(aucune tâche définie)'}

JOURNAL RÉCENT (log.md) :
${recentLog || '(aucune entrée)'}
`.trim();
  }
}
