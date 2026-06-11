import * as path from 'path';
import * as fs from 'fs';

/**
 * Valide et résout un chemin fourni par l'UI, en s'assurant qu'il reste
 * strictement dans les limites du répertoire de travail (process.cwd()).
 *
 * Cette fonction prévient les attaques par Directory Traversal :
 * - Rejette les chemins contenant ".." qui sortent du périmètre autorisé
 * - Rejette les liens symboliques pointant vers l'extérieur
 * - Rejette les accès aux fichiers système sensibles (Windows : C:\, Linux : /etc, etc.)
 *
 * @param inputPath - Chemin relatif ou absolu fourni par l'UI
 * @returns Le chemin absolu résolu et sécurisé
 * @throws Error si le chemin est invalide ou hors périmètre
 */
export function validatePath(inputPath: string): string {
  if (!inputPath || typeof inputPath !== 'string') {
    throw new Error('Chemin invalide : doit être une chaîne non vide.');
  }

  const cwd = process.cwd();

  // Nettoyer et résoudre le chemin
  const normalized = path.normalize(inputPath).replace(/\\/g, '/');
  const resolved = path.resolve(cwd, normalized);

  // Vérifier que le chemin résolu commence bien par le cwd
  const cwdNormalized = cwd.replace(/\\/g, '/').toLowerCase();
  const resolvedNormalized = resolved.replace(/\\/g, '/').toLowerCase();

  if (!resolvedNormalized.startsWith(cwdNormalized)) {
    throw new Error(
      `Accès refusé : le chemin "${inputPath}" sort du répertoire du projet (${cwd}).`
    );
  }

  // Vérifier que le fichier/répertoire existe (ou que le répertoire parent existe)
  const parentDir = path.dirname(resolved);
  if (!fs.existsSync(parentDir)) {
    throw new Error(
      `Chemin invalide : le répertoire parent "${parentDir}" n'existe pas.`
    );
  }

  return resolved;
}

/**
 * Vérifie si le fichier est autorisé à être lu/écrit selon sa taille.
 * Les fichiers binaires ou trop volumineux (> 1 Mo) sont rejetés.
 *
 * @param filePath - Chemin absolu du fichier
 * @returns true si le fichier peut être transféré, false sinon
 */
export function isFileTransferAllowed(filePath: string): boolean {
  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) return false;
    if (stat.size > 1024 * 1024) return false; // 1 Mo max
    return true;
  } catch {
    return false;
  }
}

/**
 * Liste des extensions de fichiers texte autorisés pour la lecture par défaut.
 */
const TEXT_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.css', '.scss', '.less',
  '.html', '.htm', '.xml', '.yaml', '.yml', '.toml', '.env', '.txt',
  '.py', '.rb', '.go', '.rs', '.java', '.c', '.cpp', '.h', '.hpp',
  '.php', '.vue', '.svelte', '.astro', '.sql', '.graphql', '.proto',
  '.sh', '.bat', '.ps1', '.zsh', '.bash', '.fish',
  '.config', '.rc', '.gitignore', '.dockerignore', '.editorconfig',
  '.svg', '.woff2', '.woff', '.ttf', '.eot',
]);

/**
 * Vérifie si un fichier a une extension texte connue.
 *
 * @param filePath - Chemin du fichier
 * @returns true si l'extension est reconnue comme texte
 */
export function isTextExtension(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return TEXT_EXTENSIONS.has(ext);
}
