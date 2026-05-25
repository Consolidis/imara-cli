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
 * Découvre tous les dépôts Git accessibles depuis le répertoire courant :
 * - Remonte jusqu'à 3 niveaux de parents pour trouver un .git racine
 * - Scanne les sous-dossiers immédiats (depth 1) pour trouver des sous-repos
 */
function discoverGitRepos(): GitRepo[] {
  const repos: GitRepo[] = [];
  const root = process.cwd();

  // 1. Vérifier les dossiers parents (monorepo : CLI lancée depuis un sous-dossier)
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

  // 2. Scanner les sous-dossiers immédiats pour des sous-repos
  try {
    const items = readdirSync(root);
    for (const item of items) {
      if (item === 'node_modules' || item === '.git') continue;
      const fullPath = join(root, item);
      if (existsSync(fullPath) && statSync(fullPath).isDirectory()) {
        const subGit = join(fullPath, '.git');
        if (existsSync(subGit) && statSync(subGit).isDirectory()) {
          // Éviter les doublons
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
 * Exécute un git commit dans le répertoire donné.
 * Ajoute les fichiers spécifiés ou tout le dossier si aucun fichier donné.
 */
function commitInRepo(repoPath: string, message: string, files?: string[]): string {
  const addCmd = files && files.length > 0
    ? `git add ${files.map(f => `"${f}"`).join(' ')}`
    : 'git add -A';

  // Exécuter git add
  try {
    execSync(addCmd, { cwd: repoPath, stdio: ['ignore', 'pipe', 'ignore'] });
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    throw new Error(`Échec git add dans ${repoPath}: ${errMsg}`);
  }

  // Vérifier qu'il y a quelque chose à commiter
  const status = execSync('git status --short', {
    cwd: repoPath, stdio: ['ignore', 'pipe', 'ignore']
  }).toString().trim();

  if (!status) {
    return `Rien à commiter dans ${repoPath} (arbre propre).`;
  }

  // Exécuter git commit
  try {
    // Utiliser l'entrée standard pour passer le message (évite les problèmes de guillemets)
    execSync(`git commit -F -`, {
      cwd: repoPath,
      input: message,
      stdio: ['pipe', 'pipe', 'pipe'],
      encoding: 'utf-8'
    });
    const result = execSync('git log --oneline -n 1', {
      cwd: repoPath, stdio: ['ignore', 'pipe', 'ignore']
    }).toString().trim();
    return `Commit réussi dans ${repoPath}: ${result}`;
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    // Cas particulier : rien à commit malgré le add (fichiers ignorés, etc.)
    if (errMsg.includes('nothing to commit') || errMsg.includes('nothing added')) {
      return `Rien à commiter dans ${repoPath} après add.`;
    }
    throw new Error(`Échec git commit dans ${repoPath}: ${errMsg}`);
  }
}

// --- Définition de l'outil ---

export const GitCommitTool: {
  definition: ToolDefinition;
  run(args: { message: string; files?: string[]; all?: boolean }): Promise<string>;
} = {
  definition: {
    name: 'git_commit',
    description: 'Crée un commit Git. Détecte automatiquement le dépôt courant (dossier parent ou sous-dossier). Si all=true, commit dans TOUS les dépôts modifiés découverts.',
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
          description: 'Fichiers spécifiques à ajouter (optionnel). Si absent, tous les fichiers modifiés sont ajoutés (git add -A)'
        },
        all: {
          type: 'boolean',
          description: 'Si true, commit dans tous les dépôts modifiés découverts automatiquement. Si false (defaut), commit uniquement dans le dépôt courant.',
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
      throw new Error('Aucun dépôt Git trouvé. Vérifiez que vous êtes dans un projet Git (ou un sous-dossier avec un parent .git).');
    }

    if (all) {
      // Commit dans tous les repos modifiés
      const results: string[] = [];
      let anyCommited = false;

      for (const repo of repos) {
        if (!repo.hasChanges) {
          results.push(`${repo.name}: arbre propre, aucun commit nécessaire.`);
          continue;
        }
        const result = commitInRepo(repo.path, cleanMessage, files);
        results.push(`${repo.name}: ${result}`);
        anyCommited = true;
      }

      if (!anyCommited) {
        return 'Aucun dépôt avec des modifications à commiter.';
      }

      return results.join('\n');
    } else {
      // Commit dans le dépôt courant uniquement
      // 1. Si le cwd est directement un repo, on l'utilise
      let targetRepo = repos.find(r => r.path === process.cwd());

      // 2. Sinon, prendre le premier repo parent trouvé
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
        return `Aucune modification à commiter dans ${targetRepo.name}. Utilisez all=true pour commiter tous les dépôts.`;
      }

      return commitInRepo(targetRepo.path, cleanMessage, files);
    }
  }
};
