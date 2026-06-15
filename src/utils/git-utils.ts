import { execSync } from 'child_process';

export class GitUtils {
  static getRecentCommits(n: number = 5): string {
    try {
      return execSync(`git log --oneline -n ${n}`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString();
    } catch {
      return 'Aucun historique git trouvé.';
    }
  }

  static getGitStatus(): string {
    try {
      return execSync('git status --short', { stdio: ['ignore', 'pipe', 'ignore'] }).toString();
    } catch {
      return 'Pas un dépôt git.';
    }
  }

  static getDiff(): string {
    try {
      return execSync('git diff', { stdio: ['ignore', 'pipe', 'ignore'] }).toString();
    } catch {
      return '';
    }
  }

  static getFileDiff(filePath: string): string {
    try {
      return execSync(`git diff -- "${filePath}"`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString();
    } catch {
      return '';
    }
  }

  static push(): { success: boolean; message: string } {
    try {
      const out = execSync('git push', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
      return { success: true, message: out || 'Push effectue avec succes.' };
    } catch (err: any) {
      const msg = err?.stderr?.toString().trim() || err?.message || 'Erreur inconnue lors du push.';
      return { success: false, message: msg };
    }
  }
}
