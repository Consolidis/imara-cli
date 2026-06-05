import { execSync } from 'child_process';
import { existsSync, readdirSync, statSync } from 'fs';
import { join, resolve, basename } from 'path';
import { ToolDefinition, ToolArguments } from '../agent.types';

interface GitRepo {
  path: string;
  name: string;
  branch: string;
  status: string;
  hasChanges: boolean;
}

/**
 * Decouvre tous les depots Git accessibles depuis le repertoire courant :
 * - Remonte jusqu'a 3 niveaux de parents pour trouver un .git racine
 * - Scanne les sous-dossiers immediats (depth 1) pour trouver des sous-repos
 */
function discoverGitRepos(): GitRepo[] {
  const repos: GitRepo[] = [];
  const root = process.cwd();

  // 1. Verifier les dossiers parents (monorepo : CLI lancee depuis un sous-dossier)
  let currentDir = root;
  for (let i = 0; i < 3; i++) {
    const gitDir = join(currentDir, '.git');
    if (existsSync(gitDir) && statSync(gitDir).isDirectory()) {
      const info = getGitInfoForPath(currentDir);
      repos.push({
        path: currentDir,
        name: basename(currentDir) + (currentDir !== root ? ' (Parent)' : ''),
        ...info,
        hasChanges: info.status.trim().length > 0
      });
      break;
    }
    const parent = resolve(currentDir, '..');
    if (parent === currentDir) break;
    currentDir = parent;
  }

  // 2. Scanner les sous-dossiers immediats pour des sous-repos
  try {
    const items = readdirSync(root);
    for (const item of items) {
      if (item === 'node_modules' || item === '.git') continue;
      const fullPath = join(root, item);
      if (existsSync(fullPath) && statSync(fullPath).isDirectory()) {
        const subGit = join(fullPath, '.git');
        if (existsSync(subGit) && statSync(subGit).isDirectory()) {
          // Eviter les doublons
          if (repos.some(r => r.path === fullPath)) continue;
          const info = getGitInfoForPath(fullPath);
          repos.push({
            path: fullPath,
            name: item,
            ...info,
            hasChanges: info.status.trim().length > 0
          });
        }
      }
    }
  } catch { /* ignore */ }

  return repos;
}

function getGitInfoForPath(dirPath: string): { branch: string; status: string } {
  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', {
      cwd: dirPath, stdio: ['ignore', 'pipe', 'ignore']
    }).toString().trim();
    const status = execSync('git status --short', {
      cwd: dirPath, stdio: ['ignore', 'pipe', 'ignore']
    }).toString().trim();
    return { branch, status };
  } catch {
    return { branch: 'inconnu', status: '' };
  }
}

/**
 * Execute un git commit dans le repertoire donne.
 * Ajoute les fichiers specifies ou tout le dossier si aucun fichier donne.
 */
function commitInRepo(repoPath: string, message: string, files?: string[]): string {
  const addCmd = files && files.length > 0
    ? `git add ${files.map(f => `"${f}"`).join(' ')}`
    : 'git add -A';

  // Executer git add
  try {
    execSync(addCmd, { cwd: repoPath, stdio: ['ignore', 'pipe', 'ignore'] });
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    throw new Error(`Echec git add dans ${repoPath}: ${errMsg}`);
  }

  // Verifier qu'il y a quelque chose a commiter
  const status = execSync('git status --short', {
    cwd: repoPath, stdio: ['ignore', 'pipe', 'ignore']
  }).toString().trim();
  if (!status) {
    return `Rien a commiter dans ${repoPath} (arbre propre).`;
  }

  // Executer git commit
  try {
    execSync(`git commit -F -`, {
      cwd: repoPath,
      input: message,
      stdio: ['pipe', 'pipe', 'pipe'],
      encoding: 'utf-8'
    });
    const result = execSync('git log --oneline -n 1', {
      cwd: repoPath, stdio: ['ignore', 'pipe', 'ignore']
    }).toString().trim();
    return `Commit reussi dans ${repoPath}: ${result}`;
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    // Cas particulier : rien a commit malgre le add (fichiers ignores, etc.)
    if (errMsg.includes('nothing to commit') || errMsg.includes('nothing added')) {
      return `Rien a commiter dans ${repoPath} apres add.`;
    }
    throw new Error(`Echec git commit dans ${repoPath}: ${errMsg}`);
  }
}

// --- Definition de l'outil ---
export const GitCommitTool: {
  definition: ToolDefinition;
  run(args: { message: string; files?: string[]; all?: boolean }): Promise<string>;
} = {
  definition: {
    name: 'git_commit',
    description: 'Cree un commit Git. Detecte automatiquement le depot courant (dossier parent ou sous-dossier). Si all=true, commit dans TOUS les depots modifies decouverts.',
    parameters: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'Message de commit obligatoire'
        },
        files: {
          type: 'array',
          items: { type: 'string' },
          description: 'Fichiers specifiques a ajouter (optionnel). Si absent, tous les fichiers modifies sont ajoutes (git add -A)'
        },
        all: {
          type: 'boolean',
          description: 'Si true, commit dans tous les depots modifies decouverts automatiquement. Si false (defaut), commit uniquement dans le depot courant.',
          default: false
        }
      },
      required: ['message']
    }
  },
  async run(args: { message: string; files?: string[]; all?: boolean }): Promise<string> {
    const { message, files, all } = args;
    if (!message || !message.trim()) {
      throw new Error('Le message de commit est obligatoire.');
    }

    const repos = discoverGitRepos();
    const cleanMessage = message.trim();

    if (repos.length === 0) {
      throw new Error('Aucun depot Git trouve. Verifiez que vous etes dans un projet Git (ou un sous-dossier avec un parent .git).');
    }

    if (all) {
      // Commit dans tous les repos modifies -- silencieux pour les repos propres
      const results: string[] = [];
      let anyCommited = false;
      for (const repo of repos) {
        if (!repo.hasChanges) continue; // Ignorer silencieusement les repos propres
        const result = commitInRepo(repo.path, cleanMessage, files);
        results.push(`${repo.name}: ${result}`);
        anyCommited = true;
      }
      if (!anyCommited) {
        return ''; // Rien a commiter -- pas de message
      }
      return results.join('\n');
    } else {
      // Commit dans le depot courant uniquement
      // 1. Si le cwd est directement un repo, on l'utilise
      let targetRepo = repos.find(r => r.path === process.cwd());
      // 2. Sinon, prendre le premier repo parent trouve
      if (!targetRepo) {
        targetRepo = repos.find(r => r.name.includes('(Parent)'));
      }
      // 3. Sinon, prendre le premier repo avec des changements
      if (!targetRepo) {
        targetRepo = repos.find(r => r.hasChanges);
      }
      // 4. Dernier recours : premier repo de la liste
      if (!targetRepo) {
        targetRepo = repos[0];
      }
      if (!targetRepo.hasChanges) {
        return '';
      }
      return commitInRepo(targetRepo.path, cleanMessage, files);
    }
  }
};
