import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import fg from 'fast-glob';

export class ProjectAnalyzer {
  static async analyze() {
    const packageDetails = this.getPackageDetails();
    // Project name: pkg.name > directory name
    const projectName = packageDetails?.name || path.basename(process.cwd());
    const projectInfo = {
      name: projectName,
      type: this.detectProjectType(packageDetails),
      structure: await this.getProjectStructure(),
      recentCommits: this.getRecentCommits(),
      gitStatus: this.getGitStatus(),
      scripts: packageDetails?.scripts || {},
      dependencies: packageDetails?.dependencies || {},
      conductor: {
        active: fs.existsSync(require('./conductor/track-manager').TrackManager.getConductorDir())
      }
    };

    return projectInfo;
  }

  private static detectProjectType(pkg: any): string {
    if (pkg) {
      if (pkg.dependencies?.next) return `Next.js (${pkg.dependencies.next})`;
      if (pkg.dependencies?.['@nestjs/core']) return `NestJS (${pkg.dependencies['@nestjs/core']})`;
      if (pkg.devDependencies?.vite) return 'Vite';
      if (pkg.dependencies?.react) return 'React';
      return 'Node.js';
    }
    if (fs.existsSync(path.join(process.cwd(), 'requirements.txt'))) return 'Python';
    if (fs.existsSync(path.join(process.cwd(), 'go.mod'))) return 'Go';
    if (fs.existsSync(path.join(process.cwd(), 'pom.xml'))) return 'Java (Maven)';
    return 'Inconnu';
  }

  private static getPackageDetails(): any {
    const pkgPath = path.join(process.cwd(), 'package.json');
    if (!fs.existsSync(pkgPath)) return null;
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      return {
        name: pkg.name || null,
        description: pkg.description || null,
        scripts: pkg.scripts ? Object.keys(pkg.scripts).slice(0, 10).reduce((acc: any, k) => { acc[k] = pkg.scripts[k]; return acc; }, {}) : {},
        dependencies: {
          ...Object.keys(pkg.dependencies || {}).slice(0, 10).reduce((acc: any, k) => { acc[k] = pkg.dependencies[k]; return acc; }, {}),
          ...Object.keys(pkg.devDependencies || {}).slice(0, 5).reduce((acc: any, k) => { acc[k] = pkg.devDependencies[k]; return acc; }, {})
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

      // Simple tree builder
      const tree: any = {};
      entries.sort().forEach(entry => {
        const parts = entry.split('/');
        let current = tree;
        parts.forEach((part, index) => {
          if (!part) return;
          if (!current[part]) current[part] = index === parts.length - 1 && !entry.endsWith('/') ? null : {};
          current = current[part];
        });
      });

      const renderTree = (node: any, prefix = ''): string => {
        const keys = Object.keys(node);
        return keys.map((key, index) => {
          const isLast = index === keys.length - 1;
          const connector = isLast ? '└── ' : '├── ';
          const childPrefix = isLast ? '    ' : '│   ';
          const line = `${prefix}${connector}${key}`;
          const children = node[key] ? renderTree(node[key], `${prefix}${childPrefix}`) : '';
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
