import { exec } from 'child_process';
import * as path from 'path';
import { ToolDefinition } from '../agent.types';

// --- Transpileur de commandes multiplateforme ---

interface TranspileEntry {
  pattern: RegExp;
  replacement: string;
}

/** Table de conversion Unix -> Windows */
const UNIX_TO_WIN: TranspileEntry[] = [
  { pattern: /\bls\s+(-la?)\s+(.+)/, replacement: 'dir $2' },
  { pattern: /\bls\s+(-l)\s+(.+)/, replacement: 'dir $2' },
  { pattern: /\bls\s+(-a)\s+(.+)/, replacement: 'dir $2' },
  { pattern: /\bls\s+(.+)/, replacement: 'dir $2' },
  { pattern: /\bls\b/, replacement: 'dir' },
  { pattern: /\bpwd\b/, replacement: 'cd' },
  { pattern: /\bcat\s+(.+)/, replacement: 'type $1' },
  { pattern: /\brm\s+-rf\s+(.+)/, replacement: 'rmdir /s /q $1' },
  { pattern: /\brm\s+-r\s+(.+)/, replacement: 'rmdir /s /q $1' },
  { pattern: /\brm\s+(.+)/, replacement: 'del $1' },
  { pattern: /\bmv\s+(.+)\s+(.+)/, replacement: 'move $1 $2' },
  { pattern: /\bcp\s+-r\s+(.+)\s+(.+)/, replacement: 'xcopy $1 $2 /E /I /Y' },
  { pattern: /\bcp\s+(.+)\s+(.+)/, replacement: 'copy $1 $2' },
  { pattern: /\bmkdir\s+-p\s+(.+)/, replacement: 'mkdir $1' },
  { pattern: /\btouch\s+(.+)/, replacement: 'type nul > $1' },
  { pattern: /\bgrep\s+-i\s+"(.+)"\s+(.+)/, replacement: 'findstr /I "$1" $2' },
  { pattern: /\bgrep\s+"(.+)"\s+(.+)/, replacement: 'findstr "$1" $2' },
  { pattern: /\bgrep\s+-i\s+'(.+)'\s+(.+)/, replacement: 'findstr /I "$1" $2' },
  { pattern: /\bgrep\s+'(.+)'\s+(.+)/, replacement: 'findstr "$1" $2' },
  { pattern: /\bwhich\s+(.+)/, replacement: 'where $1' },
  { pattern: /\bhead\s+-n\s+(\d+)\s+(.+)/, replacement: 'powershell -c "Get-Content $2 -TotalCount $1"' },
  { pattern: /\btail\s+-n\s+(\d+)\s+(.+)/, replacement: 'powershell -c "Get-Content $2 -Tail $1"' },
  { pattern: /\bwc\s+-l\s+(.+)/, replacement: 'find /c /v "" < $1' },
  { pattern: /\buname\s+-a\b/, replacement: 'ver' },
  { pattern: /\buname\s+-r\b/, replacement: 'ver' },
  { pattern: /\buname\b/, replacement: 'ver' },
];

/** Table de conversion Windows -> Unix */
const WIN_TO_UNIX: TranspileEntry[] = [
  { pattern: /\bdir\s+(.+)/, replacement: 'ls $1' },
  { pattern: /\bdir\b/, replacement: 'ls' },
  { pattern: /\btype\s+(.+)/, replacement: 'cat $1' },
  { pattern: /\bdel\s+(.+)/, replacement: 'rm $1' },
  { pattern: /\bmove\s+(.+)\s+(.+)/, replacement: 'mv $1 $2' },
  { pattern: /\bcopy\s+(.+)\s+(.+)/, replacement: 'cp $1 $2' },
  { pattern: /\bxcopy\s+(.+)\s+(.+)\s+\/E\s+\/I\s+\/Y/, replacement: 'cp -r $1 $2' },
  { pattern: /\bmkdir\s+(.+)/, replacement: 'mkdir -p $1' },
  { pattern: /\bfindstr\s+\/I\s+"(.+)"\s+(.+)/, replacement: 'grep -i "$1" $2' },
  { pattern: /\bfindstr\s+"(.+)"\s+(.+)/, replacement: 'grep "$1" $2' },
  { pattern: /\bwhere\s+(.+)/, replacement: 'which $1' },
  { pattern: /\bver\b/, replacement: 'uname -a' },
];

function matchAndReplace(cmd: string, table: TranspileEntry[]): { command: string; transpiled: boolean } {
  for (const entry of table) {
    if (entry.pattern.test(cmd)) {
      return { command: cmd.replace(entry.pattern, entry.replacement), transpiled: true };
    }
  }
  return { command: cmd, transpiled: false };
}

// --- Blacklist étendue par patterns avec sévérité ---

interface BlacklistEntry {
  pattern: RegExp;
  severity: 'block' | 'warn';
  label: string;
}

const BLACKLIST: BlacklistEntry[] = [
  // FORMATAGE / DESTRUCTION DISQUE
  { pattern: /\bformat\s+[a-z]:/i, severity: 'block', label: 'Formatage de disque' },
  { pattern: /\bmkfs\b/i, severity: 'block', label: 'Création système de fichiers' },
  { pattern: /\bdd\s+if=/, severity: 'block', label: 'Écriture bas niveau disque' },
  { pattern: /\bparted\b/i, severity: 'block', label: 'Partitionnement' },
  { pattern: /\bfdisk\b/i, severity: 'block', label: 'Partitionnement' },
  { pattern: /\bdiskpart\b/i, severity: 'block', label: 'Partitionnement Windows' },

  // SUPPRESSION RÉCURSIVE SYSTÈME
  { pattern: /\brm\s+-rf\s+\/\s*$/, severity: 'block', label: 'Suppression racine' },
  { pattern: /\brm\s+-rf\s+~\s*$/, severity: 'block', label: 'Suppression home' },
  { pattern: /\brm\s+-rf\s+\$HOME/, severity: 'block', label: 'Suppression $HOME' },
  { pattern: /\brm\s+-rf\s+\/\*/, severity: 'block', label: 'Suppression récursive /*' },

  // NETTOYAGE FORCÉ WINDOWS
  { pattern: /\brd\s+\/s\s+\/q\s+c:/i, severity: 'block', label: 'Suppression récursive C:' },
  { pattern: /\brmdir\s+\/s\s+\/q\s+c:/i, severity: 'block', label: 'Suppression récursive C:' },
  { pattern: /\bdel\s+\/s\s+\/q\s+c:/i, severity: 'block', label: 'Suppression fichiers C:' },
  { pattern: /Remove-Item\s+-Recurse\s+-Force\s+C:/i, severity: 'block', label: 'PowerShell suppression C:' },

  // SHUTDOWN / REBOOT
  { pattern: /\bshutdown\b/i, severity: 'block', label: 'Extinction système' },
  { pattern: /\breboot\b/i, severity: 'block', label: 'Redémarrage système' },
  { pattern: /\bpoweroff\b/i, severity: 'block', label: 'Extinction système' },
  { pattern: /\bhalt\b/i, severity: 'block', label: 'Arrêt système' },
  { pattern: /\binit\s+0\b/, severity: 'block', label: 'Arrêt système (init)' },
  { pattern: /\binit\s+6\b/, severity: 'block', label: 'Redémarrage système (init)' },

  // TÉLÉCHARGEMENT + EXÉCUTION
  { pattern: /curl\s+.*\|\s*(bash|sh)\b/i, severity: 'block', label: 'Téléchargement + exécution bash' },
  { pattern: /wget\s+.*\|\s*(bash|sh)\b/i, severity: 'block', label: 'Téléchargement + exécution bash' },
  { pattern: /Invoke-WebRequest.*-Command/i, severity: 'block', label: 'PowerShell téléchargement + exécution' },
  { pattern: /Invoke-Expression.*(http|wget|curl)/i, severity: 'block', label: 'PowerShell exécution distante' },

  // MODIFICATION PERMISSIONS SYSTÈME
  { pattern: /\bchmod\s+777\s+\//, severity: 'block', label: 'Permissions 777 sur root' },
  { pattern: /\bchown\s+-R\s+.+\s+\//, severity: 'block', label: 'Chown récursif sur root' },

  // RÉSEAU / FIREWALL
  { pattern: /\biptables\s+-F\b/, severity: 'block', label: 'Vider règles iptables' },
  { pattern: /\bufw\s+(disable|reset)\b/i, severity: 'block', label: 'Désactiver firewall' },
  { pattern: /\bnetsh\s+firewall\s+set\s+opmode\s+disable/i, severity: 'block', label: 'Désactiver firewall Windows' },

  // SUPPRESSION GIT
  { pattern: /\brm\s+-rf\s+\.git\b/, severity: 'warn', label: 'Suppression dépôt Git' },
  { pattern: /\brmdir\s+\/s\s+\.git\b/i, severity: 'warn', label: 'Suppression dépôt Git' },

  // AUTRES DANGEREUX
  { pattern: /\bmkswap\b/, severity: 'block', label: 'Création swap' },
  { pattern: /\bswapon\b/, severity: 'block', label: 'Activation swap' },
  { pattern: /\bcryptsetup\b/, severity: 'block', label: 'Chiffrement disque' },
  { pattern: /\bchattr\s+[+]\s*i\b/, severity: 'block', label: 'Verrouillage fichier (immutable)' },
  { pattern: />\s*\/dev\/sda/, severity: 'block', label: 'Écriture directe sur disque' },
  { pattern: />\s*\/dev\/null\s*$/, severity: 'warn', label: 'Suppression définitive de données' },
];

function checkBlacklist(cmd: string): { blocked: boolean; label?: string; severity?: 'block' | 'warn' } {
  for (const entry of BLACKLIST) {
    if (entry.pattern.test(cmd)) {
      return { blocked: true, label: entry.label, severity: entry.severity };
    }
  }
  return { blocked: false };
}

function detectPlatform(): { name: string; isWindows: boolean } {
  const isWin = process.platform === 'win32';
  return {
    name: isWin ? 'Windows' : (process.platform === 'darwin' ? 'macOS' : 'Linux'),
    isWindows: isWin
  };
}

function transpileCommand(cmd: string, isWindows: boolean): { command: string; transpiled: boolean } {
  // Appliquer la table appropriée selon la plateforme
  if (isWindows) {
    const result = matchAndReplace(cmd, UNIX_TO_WIN);
    return result;
  } else {
    const result = matchAndReplace(cmd, WIN_TO_UNIX);
    return result;
  }
}

export class RunCommandTool {
  static definition: ToolDefinition = {
    name: 'run_command',
    description: 'Exécute une commande shell. Vous pouvez spécifier le répertoire de travail (cwd) pour cibler un sous-répertoire ou un sous-dépôt Git spécifique.',
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'La commande à exécuter' },
        cwd: { type: 'string', description: 'Le répertoire de travail dans lequel exécuter la commande (optionnel, doit être confiné dans le workspace du projet)' }
      },
      required: ['command']
    }
  };

  static async run(args: { command: string; cwd?: string }): Promise<string> {
    const platform = detectPlatform();

    // 1. Transpilation multiplateforme
    const { command: transpiledCmd, transpiled } = transpileCommand(args.command, platform.isWindows);
    const cmdToRun = transpiledCmd;

    // 2. Blacklist
    const check = checkBlacklist(cmdToRun);
    if (check.blocked) {
      if (check.severity === 'block') {
        throw new Error(`Sécurité: Commande interdite (${check.label}).`);
      }
      // warn = on passe mais on signale (l'utilisateur confirme dans le guard conductor)
    }

    const root = process.cwd();
    let targetCwd = root;

    if (args.cwd) {
      const resolvedCwd = path.resolve(root, args.cwd);
      if (!resolvedCwd.startsWith(root)) {
        throw new Error('Sécurité: Le répertoire cible doit être confiné dans le workspace du projet.');
      }
      targetCwd = resolvedCwd;
    }

    return new Promise((resolve, reject) => {
      const child = exec(
        cmdToRun,
        {
          cwd: targetCwd,
          timeout: 60000,
          maxBuffer: 10 * 1024 * 1024,
          stdio: ['pipe', 'pipe', 'pipe']
        } as any,
        (error: any, stdout: any, stderr: any) => {
          const result = stdout + stderr;
          if (error && !result) {
            reject(new Error(error.message));
          } else {
            let output = result || 'Commande exécutée (pas de sortie).';
            if (transpiled) {
              const prefix = `[Transpilé pour ${platform.name}] Commande d'origine: ${args.command}\n`;
              output = prefix + output;
            }
            resolve(output);
          }
        }
      );

      if (child.stdin) {
        child.stdin.on('error', () => {});
      }

      const checkPrompts = (data: string) => {
        if (!child.stdin || !child.stdin.writable) return;
        const yNPatterns = [
          /\[y\/n\]/i, /\(y\/n\)/i, /y\/n\s*\?/i,
          /continue\?/i, /confirm\?/i, /voulez-vous continuer/i
        ];
        const enterPatterns = [
          /press enter/i, /appuyez sur entrée/i,
          /presser entrée/i, /touche entrée/i
        ];
        if (yNPatterns.some(p => p.test(data))) {
          try { child.stdin.write('y\n'); } catch {}
        } else if (enterPatterns.some(p => p.test(data))) {
          try { child.stdin.write('\n'); } catch {}
        }
      };

      if (child.stdout) {
        child.stdout.on('data', (chunk) => { checkPrompts(chunk.toString()); });
      }
      if (child.stderr) {
        child.stderr.on('data', (chunk) => { checkPrompts(chunk.toString()); });
      }
    });
  }
}
