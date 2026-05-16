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
}
