import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import fg from 'fast-glob';

export class ProjectAnalyzer {
  static async analyze(): Promise<{ name: string; type: string; structure: string; recentCommits: string; gitStatus: string; multiGitStatus?: string; scripts: Record<string, unknown>; dependencies: Record<string, unknown>; conductor: { active: boolean } }> {
    const packageDetails = this.getPackageDetails();
    const projectName = String(packageDetails?.name || path.basename(process.cwd()));
    const projectInfo = {
      name: projectName,
      type: this.detectProjectType(packageDetails),
      structure: await this.getProjectStructure(),
      recentCommits: this.getRecentCommits(),
      gitStatus: this.getGitStatus(),
      multiGitStatus: this.getMultiGitStatus(),
      scripts: (packageDetails?.scripts as Record<string, unknown> | undefined) || {},
      dependencies: (packageDetails?.dependencies as Record<string, unknown> | undefined) || {},
      conductor: {
        active: fs.existsSync(path.join(process.cwd(), '.imara', 'conductor'))
      }
    };

    return projectInfo;
  }

  private static detectProjectType(pkg: Record<string, unknown> | null): string {
    if (pkg) {
      const deps = pkg.dependencies as Record<string, string> | undefined;
      const devDeps = pkg.devDependencies as Record<string, string> | undefined;
      if (deps?.next) return `Next.js (${deps.next})`;
      if (deps?.['@nestjs/core']) return `NestJS (${deps['@nestjs/core']})`;
      if (devDeps?.vite) return 'Vite';
      if (deps?.react) return 'React';
      return 'Node.js';
    }
    if (fs.existsSync(path.join(process.cwd(), 'requirements.txt'))) return 'Python';
    if (fs.existsSync(path.join(process.cwd(), 'go.mod'))) return 'Go';
    if (fs.existsSync(path.join(process.cwd(), 'pom.xml'))) return 'Java (Maven)';
    return 'Inconnu';
  }

  private static getPackageDetails(): Record<string, unknown> | null {
    const pkgPath = path.join(process.cwd(), 'package.json');
    if (!fs.existsSync(pkgPath)) return null;
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as Record<string, unknown>;
      const deps = (pkg.dependencies as Record<string, string> | undefined) || {};
      const devDeps = (pkg.devDependencies as Record<string, string> | undefined) || {};
      const scripts = (pkg.scripts as Record<string, string> | undefined) || {};
      return {
        name: pkg.name || null,
        description: pkg.description || null,
        scripts: Object.fromEntries(Object.entries(scripts).slice(0, 10)),
        dependencies: {
          ...Object.fromEntries(Object.entries(deps).slice(0, 10)),
          ...Object.fromEntries(Object.entries(devDeps).slice(0, 5)),
        }
      };
    } catch {
      return null;
    }
  }

  private static async getProjectStructure(depth = 2): Promise<string> {
    try {
      const entries = await fg('**', {
        cwd: process.cwd(),
        onlyFiles: false,
        markDirectories: true,
        deep: depth,
        ignore: ['node_modules/**', '.git/**', 'dist/**', '.next/**', 'vendor/**', '.cache/**', 'target/**', '__pycache__/**']
      });

      if (entries.length === 0) return 'Répertoire vide';

      interface TreeNode { [key: string]: TreeNode | null; }
      const tree: TreeNode = {};
      entries.sort().forEach(entry => {
        const parts = entry.split('/');
        let current: TreeNode = tree;
        parts.forEach((part, index) => {
          if (!part) return;
          if (!current[part]) current[part] = index === parts.length - 1 && !entry.endsWith('/') ? null : {};
          current = current[part] as TreeNode;
        });
      });

      const renderTree = (node: TreeNode | null, prefix = ''): string => {
        if (!node) return '';
        const keys = Object.keys(node);
        return keys.map((key, index) => {
          const isLast = index === keys.length - 1;
          const connector = isLast ? '└── ' : '├── ';
          const childPrefix = isLast ? '    ' : '│   ';
          const line = `${prefix}${connector}${key}`;
          const childNode = node[key];
          const children = childNode ? renderTree(childNode, `${prefix}${childPrefix}`) : '';
          return line + (children ? '\n' + children : '');
        }).join('\n');
      };

      return renderTree(tree);
    } catch (e) {
      return 'Erreur lors de la lecture de la structure.';
    }
  }

  private static getRecentCommits(): string {
    try {
      return execSync('git log --oneline -n 5', { stdio: ['ignore', 'pipe', 'ignore'] }).toString();
    } catch {
      return 'Aucun historique git trouvé.';
    }
  }

  private static getGitStatus(): string {
    try {
      return execSync('git status --short', { stdio: ['ignore', 'pipe', 'ignore'] }).toString();
    } catch {
      return 'Pas un dépôt git.';
    }
  }

  private static getMultiGitStatus(): string {
    const repos = this.discoverGitRepos();
    if (repos.length <= 1) {
      return ''; // No multi-repo setup or only one repo discovered
    }
    return repos.map(r => `  - Repository [${r.name}] (path: ${r.path})\n    Branch: ${r.branch}\n    Status:\n${r.status ? r.status.split('\n').map(l => `      ${l}`).join('\n') : '      Clean'}`).join('\n\n');
  }

  private static discoverGitRepos(): { path: string; name: string; branch: string; status: string }[] {
    const repos: { path: string; name: string; branch: string; status: string }[] = [];
    const root = process.cwd();

    // 1. Check parent directory up to 3 levels (monorepo support)
    let currentDir = root;
    for (let i = 0; i < 3; i++) {
      const gitDir = path.join(currentDir, '.git');
      if (fs.existsSync(gitDir) && fs.statSync(gitDir).isDirectory()) {
        const name = path.basename(currentDir);
        const { branch, status } = this.getGitInfoForPath(currentDir);
        repos.push({ path: currentDir, name: `${name} (Parent)`, branch, status });
        break; 
      }
      const parent = path.dirname(currentDir);
      if (parent === currentDir) break;
      currentDir = parent;
    }

    // 2. Discover children Git repos under the parent/current workspace up to depth 2
    try {
      const items = fs.readdirSync(root);
      for (const item of items) {
        if (item === 'node_modules' || item === '.git') continue;
        const fullPath = path.join(root, item);
        if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
          const subGit = path.join(fullPath, '.git');
          if (fs.existsSync(subGit) && fs.statSync(subGit).isDirectory()) {
            const { branch, status } = this.getGitInfoForPath(fullPath);
            if (!repos.some(r => r.path === fullPath)) {
              repos.push({ path: fullPath, name: item, branch, status });
            }
          }
        }
      }
    } catch { /* ignore list failures */ }

    return repos;
  }

  private static getGitInfoForPath(dirPath: string): { branch: string; status: string } {
    try {
      const branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: dirPath, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
      const status = execSync('git status --short', { cwd: dirPath, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
      return { branch, status };
    } catch {
      return { branch: 'unknown', status: '' };
    }
  }
}
