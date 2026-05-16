import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import fg from 'fast-glob';

export class ProjectAnalyzer {
  static async analyze(): Promise<{ name: string; type: string; structure: string; recentCommits: string; gitStatus: string; scripts: Record<string, unknown>; dependencies: Record<string, unknown>; conductor: { active: boolean } }> {
    const packageDetails = this.getPackageDetails();
    const projectName = String(packageDetails?.name || path.basename(process.cwd()));
    const projectInfo = {
      name: projectName,
      type: this.detectProjectType(packageDetails),
      structure: await this.getProjectStructure(),
      recentCommits: this.getRecentCommits(),
      gitStatus: this.getGitStatus(),
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
}
