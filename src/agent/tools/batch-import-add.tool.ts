import * as fs from 'fs';
import * as path from 'path';
import { isInsideCwd, isProtectedFile } from '../../utils/file-utils';
import { ToolDefinition } from '../agent.types';

interface FileResult {
  file: string;
  status: 'import_added' | 'already_imported' | 'symbol_not_found' | 'error';
  message: string;
}

export class BatchImportAddTool {
  static definition: ToolDefinition = {
    name: 'batch_import_add',
    description: 'Ajoute un import manquant dans tous les fichiers correspondant a un glob pattern qui utilisent un symbole (fonction, hook, composant) sans l\'avoir importe.',
    parameters: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Le nom du symbole a rechercher et importer (ex: "useCurrencyFormat", "Button")'
        },
        import_path: {
          type: 'string',
          description: 'Le chemin du module depuis lequel importer (ex: "@/hooks/useCurrencyFormat", "react")'
        },
        file_pattern: {
          type: 'string',
          description: 'Glob pattern pour cibler les fichiers (ex: "src/**/*.tsx", "*.ts")'
        },
        import_type: {
          type: 'string',
          enum: ['named', 'default', 'namespace', 'require'],
          description: 'Type d\'import : named (import { X }), default (import X), namespace (import * as X), require (const X = require)',
          default: 'named'
        },
        alias: {
          type: 'string',
          description: 'Alias optionnel pour l\'import (ex: "useCurrencyFormat as useFormat")'
        }
      },
      required: ['symbol', 'import_path', 'file_pattern']
    }
  };

  static async run(args: {
    symbol: string;
    import_path: string;
    file_pattern: string;
    import_type?: 'named' | 'default' | 'namespace' | 'require';
    alias?: string;
  }): Promise<string> {
    const { symbol, import_path, file_pattern, alias } = args;
    const importType = args.import_type || 'named';
    const root = process.cwd();

    // Utiliser fast-glob pour trouver les fichiers correspondant au pattern
    let files: string[];
    try {
      const fg = require('fast-glob');
      files = await fg(file_pattern, {
        cwd: root,
        absolute: true,
        ignore: ['node_modules/**', 'dist/**', '.git/**']
      });
    } catch (e) {
      throw new Error(`Erreur lors de la recherche des fichiers: ${e instanceof Error ? e.message : String(e)}`);
    }

    if (files.length === 0) {
      return `Aucun fichier trouve pour le pattern "${file_pattern}".`;
    }

    const results: FileResult[] = [];

    for (const fullPath of files) {
      try {
        if (!isInsideCwd(fullPath)) {
          results.push({ file: fullPath, status: 'error', message: 'En dehors du workspace' });
          continue;
        }
        if (isProtectedFile(fullPath)) {
          results.push({ file: fullPath, status: 'error', message: 'Fichier protege' });
          continue;
        }

        const relativePath = path.relative(root, fullPath);
        const content = fs.readFileSync(fullPath, 'utf8');
        const normalizedContent = content.replace(/\r\n/g, '\n');

        // Verifier si le symbole est utilise dans le fichier
        const symbolRegex = new RegExp(`\\b${escapeRegex(symbol)}\\b`);
        if (!symbolRegex.test(normalizedContent)) {
          results.push({ file: relativePath, status: 'symbol_not_found', message: `Le symbole "${symbol}" n'est pas utilise dans ce fichier` });
          continue;
        }

        // Verifier si l'import existe deja
        const importExists = this.checkImportExists(normalizedContent, symbol, import_path, importType, alias);
        if (importExists) {
          results.push({ file: relativePath, status: 'already_imported', message: `"${symbol}" deja importe depuis "${import_path}"` });
          continue;
        }

        // Ajouter l'import
        const newContent = this.addImport(normalizedContent, symbol, import_path, importType, alias);
        fs.writeFileSync(fullPath, newContent, 'utf8');
        results.push({ file: relativePath, status: 'import_added', message: `Import ajoute: ${this.formatImport(symbol, import_path, importType, alias)}` });
      } catch (e) {
        const relativePath = path.relative(root, fullPath);
        results.push({ file: relativePath, status: 'error', message: e instanceof Error ? e.message : String(e) });
      }
    }

    // Compiler les resultats
    const added = results.filter(r => r.status === 'import_added').length;
    const already = results.filter(r => r.status === 'already_imported').length;
    const notFound = results.filter(r => r.status === 'symbol_not_found').length;
    const errors = results.filter(r => r.status === 'error').length;

    let output = `Resultats pour l'import de "${symbol}" depuis "${import_path}" dans ${files.length} fichiers:\n`;
    output += `  - Import ajoute: ${added}\n`;
    output += `  - Deja importe: ${already}\n`;
    output += `  - Symbole non utilise: ${notFound}\n`;
    if (errors > 0) output += `  - Erreurs: ${errors}\n`;

    // Detail des fichiers modifies
    const modified = results.filter(r => r.status === 'import_added');
    if (modified.length > 0) {
      output += `\nFichiers modifies:\n`;
      for (const r of modified) {
        output += `  ${r.file}: ${r.message}\n`;
      }
    }

    const failed = results.filter(r => r.status === 'error');
    if (failed.length > 0) {
      output += `\nErreurs:\n`;
      for (const r of failed) {
        output += `  ${r.file}: ${r.message}\n`;
      }
    }

    return output.trim();
  }

  private static checkImportExists(
    content: string,
    symbol: string,
    importPath: string,
    importType: string,
    alias?: string
  ): boolean {
    const escapedPath = importPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const escapedSymbol = escapeRegex(symbol);
    const escapedAlias = alias ? escapeRegex(alias) : null;

    switch (importType) {
      case 'named': {
        // import { ... symbol ... } from '...path...'
        // import { ... symbol as alias ... } from '...path...'
        const pattern = alias
          ? new RegExp(`import\\s*\\{[^}]*\\b${escapedSymbol}\\s+as\\s+${escapedAlias}\\b[^}]*\\}\\s+from\\s+['"]${escapedPath}['"]`)
          : new RegExp(`import\\s*\\{[^}]*\\b${escapedSymbol}\\b[^}]*\\}\\s+from\\s+['"]${escapedPath}['"]`);
        return pattern.test(content);
      }
      case 'default': {
        // import symbol from '...path...'
        const pattern = alias
          ? new RegExp(`import\\s+${escapedAlias}\\s+from\\s+['"]${escapedPath}['"]`)
          : new RegExp(`import\\s+${escapedSymbol}\\s+from\\s+['"]${escapedPath}['"]`);
        return pattern.test(content);
      }
      case 'namespace': {
        // import * as symbol from '...path...'
        const names = alias || symbol;
        const pattern = new RegExp(`import\\s+\\*\\s+as\\s+${escapeRegex(names)}\\s+from\\s+['"]${escapedPath}['"]`);
        return pattern.test(content);
      }
      case 'require': {
        // const symbol = require('...path...')
        const names = alias || symbol;
        const pattern = new RegExp(`(?:const|let|var)\\s+${escapeRegex(names)}\\s*=\\s*require\\s*\\(\\s*['"]${escapedPath}['"]\\s*\\)`);
        return pattern.test(content);
      }
      default:
        return false;
    }
  }

  private static addImport(
    content: string,
    symbol: string,
    importPath: string,
    importType: string,
    alias?: string
  ): string {
    const importStatement = this.formatImport(symbol, importPath, importType, alias);

    // Trouver le meilleur endroit pour inserer l'import
    const lines = content.split('\n');

    // Chercher la derniere ligne d'import
    let lastImportLine = -1;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('import ') || line.includes('require(') || line.startsWith('/// <reference')) {
        lastImportLine = i;
      } else if (line.startsWith('export ') || line.startsWith('// ') || line === '' || line.startsWith('/*')) {
        // Continuer a travers les commentaires et lignes vides apres les imports
        if (lastImportLine >= 0) continue;
      } else if (lastImportLine >= 0) {
        break;
      }
    }

    if (lastImportLine >= 0 && lastImportLine < lines.length - 1) {
      // Inserer apres la derniere ligne d'import
      lines.splice(lastImportLine + 1, 0, importStatement);
    } else {
      // Aucun import existant, inserer en haut du fichier
      lines.unshift(importStatement);
    }

    return lines.join('\n');
  }

  private static formatImport(
    symbol: string,
    importPath: string,
    importType: string,
    alias?: string
  ): string {
    const names = alias || symbol;
    switch (importType) {
      case 'named':
        return `import { ${names} } from '${importPath}';`;
      case 'default':
        return `import ${names} from '${importPath}';`;
      case 'namespace':
        return `import * as ${names} from '${importPath}';`;
      case 'require':
        return `const ${names} = require('${importPath}');`;
      default:
        return `import { ${names} } from '${importPath}';`;
    }
  }
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
