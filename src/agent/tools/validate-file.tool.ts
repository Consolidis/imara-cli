import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { isInsideCwd, isProtectedFile } from '../../utils/file-utils';
import { ToolDefinition } from '../agent.types';

interface ValidatorDefinition {
  extension: string;
  label: string;
  command: string;
  languages: string[];
}

const VALIDATORS: ValidatorDefinition[] = [
  {
    extension: '.ts',
    label: 'TypeScript',
    command: 'npx tsc --noEmit --pretty',
    languages: ['typescript', 'ts']
  },
  {
    extension: '.tsx',
    label: 'TypeScript React',
    command: 'npx tsc --noEmit --pretty',
    languages: ['typescript', 'tsx', 'react']
  },
  {
    extension: '.mts',
    label: 'TypeScript ESM',
    command: 'npx tsc --noEmit --pretty',
    languages: ['typescript', 'mts']
  },
  {
    extension: '.cts',
    label: 'TypeScript CJS',
    command: 'npx tsc --noEmit --pretty',
    languages: ['typescript', 'cts']
  },
  {
    extension: '.js',
    label: 'JavaScript',
    command: 'node --check',
    languages: ['javascript', 'js']
  },
  {
    extension: '.jsx',
    label: 'JavaScript React',
    command: 'node --check',
    languages: ['javascript', 'jsx', 'react']
  },
  {
    extension: '.mjs',
    label: 'JavaScript ESM',
    command: 'node --check',
    languages: ['javascript', 'mjs']
  },
  {
    extension: '.cjs',
    label: 'JavaScript CJS',
    command: 'node --check',
    languages: ['javascript', 'cjs']
  },
  {
    extension: '.py',
    label: 'Python',
    command: 'python -m py_compile',
    languages: ['python', 'py']
  },
  {
    extension: '.rs',
    label: 'Rust',
    command: 'rustc --edition 2021 --crate-type lib --out-dir /tmp/rust_check',
    languages: ['rust', 'rs']
  },
  {
    extension: '.go',
    label: 'Go',
    command: 'go vet',
    languages: ['go', 'golang']
  },
  {
    extension: '.rb',
    label: 'Ruby',
    command: 'ruby -c',
    languages: ['ruby', 'rb']
  },
  {
    extension: '.php',
    label: 'PHP',
    command: 'php -l',
    languages: ['php']
  },
  {
    extension: '.java',
    label: 'Java',
    command: 'javac -Xlint:all -proc:none -d /tmp/java_check',
    languages: ['java']
  },
  {
    extension: '.swift',
    label: 'Swift',
    command: 'swiftc -typecheck',
    languages: ['swift']
  },
  {
    extension: '.kt',
    label: 'Kotlin',
    command: 'kotlinc -nowarn',
    languages: ['kotlin', 'kt']
  },
  {
    extension: '.cs',
    label: 'C#',
    command: 'dotnet build --no-restore --no-dependencies 2>&1',
    languages: ['csharp', 'c#', 'cs']
  }
];

export class ValidateFileTool {
  static definition: ToolDefinition = {
    name: 'validate_file',
    description: 'Valide la syntaxe et le typage d\'un fichier en detectant automatiquement son langage via l\'extension. Supporte TypeScript, JavaScript, Python, Rust, Go, Ruby, PHP, Java, Swift, Kotlin, C#.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Le chemin du fichier a valider' }
      },
      required: ['path']
    }
  };

  static async run(args: { path: string }): Promise<string> {
    const fullPath = path.resolve(process.cwd(), args.path);

    if (!isInsideCwd(fullPath)) {
      throw new Error('Securite: Acces refuse en dehors du projet.');
    }
    if (isProtectedFile(fullPath)) {
      throw new Error('Securite: Fichier protege.');
    }
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Fichier non trouve: ${args.path}`);
    }

    const ext = path.extname(fullPath).toLowerCase();
    const validator = VALIDATORS.find(v => v.extension === ext);

    if (!validator) {
      const supported = VALIDATORS.map(v => v.extension).join(', ');
      return `Aucun validateur disponible pour l'extension "${ext}". Extensions supportees: ${supported}`;
    }

    const fileDir = path.dirname(fullPath);

    try {
      const output = execSync(validator.command, {
        cwd: fileDir,
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 30000,
        encoding: 'utf-8',
        shell: process.platform === 'win32' ? 'cmd.exe' : '/bin/bash'
      } as any);

      return `[${validator.label}] ${args.path}: OK (aucune erreur)`;
    } catch (e: any) {
      const stderr = e.stderr || '';
      const stdout = e.stdout || '';
      const combined = (stderr + stdout).trim();

      // Si l'outil n'est pas installe, on le detecte
      if (this.isToolMissing(combined, validator.label)) {
        return `[${validator.label}] ${validator.label} n'est pas installe ou pas dans le PATH. Impossible de valider ${args.path}.`;
      }

      // Limiter la sortie pour eviter la pollution du contexte
      const maxLines = 30;
      const lines = combined.split('\n');
      let errorOutput: string;
      if (lines.length > maxLines) {
        errorOutput = lines.slice(0, maxLines).join('\n') + `\n... (${lines.length - maxLines} lignes supplementaires masquees)`;
      } else {
        errorOutput = combined;
      }

      return `[${validator.label}] ${args.path}: ERREURS\n${errorOutput}`;
    }
  }

  private static isToolMissing(output: string, label: string): boolean {
    const patterns = [
      /not recognized/i, /not found/i, /command not found/i,
      /n'est pas reconnu/i, /n'est pas une commande/i,
      /no such file/i, /cannot find/i,
      /is not installed/i, /not installed/i,
      /could not be found/i
    ];
    return patterns.some(p => p.test(output));
  }

  /** Valide un fichier et retourne true si pas d'erreur, false si erreur */
  static async validateFile(path: string): Promise<{ valid: boolean; message: string }> {
    try {
      const result = await ValidateFileTool.run({ path });
      if (result.includes('ERREURS') || result.includes("n'est pas installe")) {
        return { valid: false, message: result };
      }
      return { valid: true, message: result };
    } catch (e) {
      return { valid: false, message: e instanceof Error ? e.message : String(e) };
    }
  }
}
