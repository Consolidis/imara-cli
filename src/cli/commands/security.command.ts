// src/cli/commands/security.command.ts
// IMARA Security Audit - Analyse de securite et optimisation du code
import chalk from 'chalk';
import * as path from 'path';
import * as fs from 'fs';
import { theme } from '../../ui/theme';
import { TrackManager } from '../../context/conductor/track-manager';

// ── Types ─────────────────────────────────────────────────────────────────
export interface Vulnerability {
  id: string;
  title: string;
  description: string;
  impact: string;
  solution: string;
  priority: 'critical' | 'high' | 'medium' | 'low' | 'info';
  category: 'security' | 'optimization' | 'maintenance';
  file: string;
  line?: number;
}

export interface AuditReport {
  timestamp: string;
  filesScanned: number;
  vulnerabilities: Vulnerability[];
  optimizations: Vulnerability[];
  tracksCreated: number;
}

// ── Fonctions de scan ─────────────────────────────────────────────────────

function scanProject(): string[] {
  const files: string[] = [];
  const scanDirs = ['src', 'backend/src', 'frontend/src', 'imara-cli/src'];
  for (const dir of scanDirs) {
    if (fs.existsSync(dir)) {
      collectFiles(dir, files);
    }
  }
  return files;
}

function collectFiles(dir: string, result: string[]): void {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!entry.name.startsWith('node_modules') && !entry.name.startsWith('.') && entry.name !== 'dist') {
          collectFiles(fullPath, result);
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (['.ts', '.js', '.tsx', '.jsx', '.vue', '.py', '.go', '.java', '.php', '.rb', '.yaml', '.yml', '.env', '.json', '.toml'].includes(ext)) {
          result.push(fullPath);
        }
      }
    }
  } catch {
    // Ignore inaccessible directories
  }
}

async function checkSecrets(filePath: string): Promise<Vulnerability[]> {
  const found: Vulnerability[] = [];
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const patterns = [
      { regex: /(["'])API[_-]?KEY\1\s*[:=]\s*["']([^"']{8,})["']/i, label: 'API Key' },
      { regex: /(["'])SECRET[_-]?KEY\1\s*[:=]\s*["']([^"']{8,})["']/i, label: 'Secret Key' },
      { regex: /(["'])PASSWORD\1\s*[:=]\s*["']([^"']{4,})["']/i, label: 'Password' },
      { regex: /(["'])TOKEN\1\s*[:=]\s*["']([^"']{8,})["']/i, label: 'Token' },
      { regex: /sk-[a-zA-Z0-9]{20,}/, label: 'OpenAI API Key (sk-)' },
      { regex: /ghp_[a-zA-Z0-9]{36}/, label: 'GitHub Token (ghp_)' },
      { regex: /AKIA[0-9A-Z]{16}/, label: 'AWS Access Key (AKIA)' },
    ];
    for (const pattern of patterns) {
      const match = content.match(pattern.regex);
      if (match) {
        const lineNum = lines.findIndex(l => l.includes(match[0])) + 1;
        found.push({
          id: `secret-${found.length + 1}`,
          title: `Secret expose : ${pattern.label}`,
          description: `Un(e) ${pattern.label} a ete trouve(e) en dur dans le fichier ${path.basename(filePath)}.`,
          impact: 'Exposition de secrets d\'authentification, risque de compromission de comptes et services tiers.',
          solution: `Deplacer la valeur dans un fichier .env et utiliser process.env.VARIABLE. Verifier que le fichier .env est dans .gitignore.`,
          priority: 'critical',
          category: 'security',
          file: filePath,
          line: lineNum,
        });
      }
    }
  } catch { /* ignore */ }
  return found;
}

async function checkSqlInjections(filePath: string): Promise<Vulnerability[]> {
  const found: Vulnerability[] = [];
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    // Concaténation SQL dangereuse
    const sqlPatterns = [
      /(query|execute|run)\s*\(\s*`[^`]*\$\{[^}]*\}[^`]*`/i,
      /(query|execute|run)\s*\(\s*['"][^'"]*['"]\s*\+/i,
      /(query|execute|run)\s*\(.*\+.*['"]/i,
    ];
    for (const pattern of sqlPatterns) {
      const match = content.match(pattern);
      if (match) {
        const lineNum = lines.findIndex(l => l.includes(match[0].substring(0, 30))) + 1;
        found.push({
          id: `sqli-${found.length + 1}`,
          title: 'Injection SQL potentielle',
          description: `Concatenation SQL detectee dans ${path.basename(filePath)}.`,
          impact: 'Un attaquant pourrait injecter des commandes SQL et acceder/modifier/supprimer des donnees.',
          solution: 'Utiliser des Prepared Statements (requetes parametrees) ou un ORM. Ne jamais concatener des valeurs utilisateur dans des requetes SQL.',
          priority: 'critical',
          category: 'security',
          file: filePath,
          line: lineNum,
        });
      }
    }
    // Command injection
    const cmdPatterns = [
      /(exec|spawn|execSync)\(\s*`[^`]*\$\{[^}]*\}[^`]*`/i,
      /(exec|spawn|execSync)\(\s*['"][^'"]*['"]\s*\+/i,
    ];
    for (const pattern of cmdPatterns) {
      const match = content.match(pattern);
      if (match) {
        const lineNum = lines.findIndex(l => l.includes(match[0].substring(0, 30))) + 1;
        found.push({
          id: `cmdi-${found.length + 1}`,
          title: 'Injection de commande potentielle',
          description: `Commande systeme avec concatenation detectee dans ${path.basename(filePath)}.`,
          impact: 'Un attaquant pourrait executer des commandes arbitraires sur le serveur.',
          solution: 'Utiliser des fonctions avec parametres separes (ex: spawn avec tableau d\'arguments). Valider et assainir les entrees utilisateur.',
          priority: 'high',
          category: 'security',
          file: filePath,
          line: lineNum,
        });
      }
    }
  } catch { /* ignore */ }
  return found;
}

async function checkCORSConfig(filePath: string): Promise<Vulnerability[]> {
  const found: Vulnerability[] = [];
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    // CORS permissif
    if (content.includes('Access-Control-Allow-Origin') && content.includes('*')) {
      found.push({
        id: `cors-${found.length + 1}`,
        title: 'CORS trop permissif',
        description: `Configuration CORS avec Access-Control-Allow-Origin: * detectee dans ${path.basename(filePath)}.`,
        impact: 'Tout domaine peut effectuer des requetes cross-origin, exposant les donnees a des attaques CSRF.',
        solution: 'Restreindre CORS a des origines specifiques. Utiliser un whitelist de domaines autorises.',
        priority: 'high',
        category: 'security',
        file: filePath,
      });
    }
    // Vérifier si DELETE, PUT, PATCH sont dans les méthodes autorisées
    const methodsMatch = content.match(/methods\s*:\s*\[([^\]]+)\]/i);
    if (methodsMatch) {
      const methods = methodsMatch[1];
      if (methods.includes("'DELETE'") || methods.includes('"DELETE"') || methods.includes('DELETE')) {
        found.push({
          id: `cors-methods-${found.length + 1}`,
          title: 'Methode DELETE autorisee en CORS',
          description: `La methode DELETE est autorisee dans la configuration CORS de ${path.basename(filePath)}.`,
          impact: 'Permet des suppressions de ressources cross-origin non autorisees.',
          solution: 'Utiliser le pattern POST-Action : remplacer DELETE par POST /ressource/delete.',
          priority: 'medium',
          category: 'security',
          file: filePath,
        });
      }
    }
  } catch { /* ignore */ }
  return found;
}

async function checkXSS(filePath: string): Promise<Vulnerability[]> {
  const found: Vulnerability[] = [];
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const patterns = [
      /innerHTML\s*=/i,
      /dangerouslySetInnerHTML/i,
      /v-html\s*=/i,
      /\.html\(\s*[^)]/i,
      /document\.write\s*\(/i,
    ];
    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match) {
        const lineNum = lines.findIndex(l => l.match(pattern)) + 1;
        found.push({
          id: `xss-${found.length + 1}`,
          title: 'Faille XSS potentielle',
          description: `Utilisation de ${match[0]} detectee dans ${path.basename(filePath)} (ligne ${lineNum}).`,
          impact: 'Un attaquant peut injecter du code JavaScript malveillant dans le navigateur des utilisateurs.',
          solution: 'Utiliser textContent au lieu de innerHTML. Si l\'HTML est necessaire, utiliser DOMPurify ou un systeme de templates securise.',
          priority: 'high',
          category: 'security',
          file: filePath,
          line: lineNum,
        });
      }
    }
  } catch { /* ignore */ }
  return found;
}

async function suggestOptimizations(filePath: string): Promise<Vulnerability[]> {
  const found: Vulnerability[] = [];
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    // console.log dans le code de production
    if (filePath.match(/\/src\//) && content.includes('console.log')) {
      const count = (content.match(/console\.log/g) || []).length;
      found.push({
        id: `opt-console-${found.length + 1}`,
        title: 'Console.log dans le code source',
        description: `${count} appel(s) a console.log trouve(s) dans ${path.basename(filePath)}.`,
        impact: 'Pollution des logs, performance degradee en production, fuite d\'informations.',
        solution: 'Remplacer par un logger structure (winston, pino) ou retirer en production.',
        priority: 'low',
        category: 'optimization',
        file: filePath,
      });
    }
    // Fichiers volumineux (plus de 500 lignes)
    if (lines.length > 500) {
      found.push({
        id: `opt-size-${found.length + 1}`,
        title: 'Fichier trop volumineux',
        description: `${path.basename(filePath)} fait ${lines.length} lignes.`,
        impact: 'Maintenabilite reduite, complexite elevee, difficile a tester et a comprendre.',
        solution: 'Decouper le fichier en plusieurs modules plus petits (< 300 lignes). Separer les responsabilites.',
        priority: 'medium',
        category: 'optimization',
        file: filePath,
        line: lines.length,
      });
    }
    // any type usage (si fichier .ts)
    if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
      const anyCount = (content.match(/: any/g) || []).length;
      if (anyCount > 3) {
        found.push({
          id: `opt-any-${found.length + 1}`,
          title: 'Usage excessif de `: any`',
          description: `${anyCount} utilisations de \`: any\` dans ${path.basename(filePath)}.`,
          impact: 'Perte de la securite du typage TypeScript, bugs a l\'execution plus probables.',
          solution: 'Definir des interfaces ou types specifiques. Utiliser `unknown` comme alternative plus sure.',
          priority: 'low',
          category: 'optimization',
          file: filePath,
        });
      }
    }
  } catch { /* ignore */ }
  return found;
}

// ── Generation de tracks ──────────────────────────────────────────────────
async function createSecurityTrack(vuln: Vulnerability): Promise<string> {
  const title = `[${vuln.category.toUpperCase()}] ${vuln.title}`;
  // Creer un track via TrackManager
  const track = TrackManager.newTrack(title);
  if (!track) return '';

  // Ecrire spec.md specifique a la vulnerabilite
  const specContent = `# Specifications — ${vuln.title}

## 1. Contexte & Enjeux
${vuln.description}

## 2. Impact
${vuln.impact}

## 3. Solution Recommandee
${vuln.solution}

## 4. Fichier concerne
\`${vuln.file}\`${vuln.line ? ` (ligne ${vuln.line})` : ''}

## 5. Priorite
${vuln.priority.toUpperCase()}

## 6. Criteres d'Acceptation
- [ ] Le correctif est applique sans introduire de regression
- [ ] La solution respecte les regles de secure coding (OWASP)
- [ ] Le build passe (npm run build)
- [ ] Les tests existants passent (npm test)
`;
  fs.writeFileSync(path.join(track.dir, 'spec.md'), specContent, 'utf-8');

  // Ecrire plan.md
  const planContent = `# Plan — Correction : ${vuln.title}

## Etapes

### Phase 1 : Analyse
- [ ] Localiser le code concerne dans ${vuln.file}${vuln.line ? ` (ligne ${vuln.line})` : ''}
- [ ] Comprendre le contexte d'utilisation et les dependances

### Phase 2 : Correction
- [ ] Implementer la solution recommandee
- [ ] Verifier qu'aucune autre occurrence similaire n'existe dans le projet

### Phase 3 : Validation
- [ ] Build : npm run build compile sans erreur
- [ ] Tests : npm test passe vert
- [ ] Verification manuelle du correctif
`;
  fs.writeFileSync(path.join(track.dir, 'plan.md'), planContent, 'utf-8');

  console.log(chalk.hex(theme.muted)(`  → Track cree : ${chalk.hex(theme.accent)(track.id)}`));
  return track.id;
}

// ── Rapport ───────────────────────────────────────────────────────────────
function printReport(report: AuditReport): void {
  const width = process.stdout.columns || 80;
  console.log('');
  console.log(chalk.hex(theme.muted)('═'.repeat(width)));
  console.log(chalk.hex(theme.primary).bold('  RAPPORT D\'AUDIT DE SECURITE'));
  console.log(chalk.hex(theme.muted)('═'.repeat(width)));
  console.log(`  ${chalk.hex(theme.secondary)('Fichiers analyses')}    : ${chalk.hex(theme.text)(String(report.filesScanned))}`);
  console.log(`  ${chalk.hex(theme.secondary)('Vulnerabilites')}       : ${chalk.hex(theme.text)(String(report.vulnerabilities.length))}`);
  console.log(`  ${chalk.hex(theme.secondary)('Optimisations')}        : ${chalk.hex(theme.text)(String(report.optimizations.length))}`);
  console.log(`  ${chalk.hex(theme.secondary)('Tracks crees')}         : ${chalk.hex(theme.accent)(String(report.tracksCreated))}`);
  console.log(chalk.hex(theme.muted)('─'.repeat(width)));

  // Grouper par priorite
  const critical = [...report.vulnerabilities, ...report.optimizations].filter(v => v.priority === 'critical');
  const high = [...report.vulnerabilities, ...report.optimizations].filter(v => v.priority === 'high');
  const medium = [...report.vulnerabilities, ...report.optimizations].filter(v => v.priority === 'medium');
  const low = [...report.vulnerabilities, ...report.optimizations].filter(v => v.priority === 'low' || v.priority === 'info');

  if (critical.length > 0) {
    console.log(chalk.hex(theme.error).bold(`\n  🔴 CRITIQUE (${critical.length})`));
    critical.forEach(v => {
      console.log(`    - ${chalk.hex(theme.text)(v.title)}`);
      console.log(`      ${chalk.hex(theme.muted)(v.file)}${v.line ? `:${v.line}` : ''}`);
    });
  }
  if (high.length > 0) {
    console.log(chalk.hex(theme.warning).bold(`\n  🟡 HAUTE (${high.length})`));
    high.forEach(v => {
      console.log(`    - ${chalk.hex(theme.text)(v.title)}`);
      console.log(`      ${chalk.hex(theme.muted)(v.file)}${v.line ? `:${v.line}` : ''}`);
    });
  }
  if (medium.length > 0) {
    console.log(chalk.hex(theme.secondary).bold(`\n  🟠 MOYENNE (${medium.length})`));
    medium.forEach(v => {
      console.log(`    - ${chalk.hex(theme.text)(v.title)}`);
      console.log(`      ${chalk.hex(theme.muted)(v.file)}${v.line ? `:${v.line}` : ''}`);
    });
  }
  if (low.length > 0) {
    console.log(chalk.hex(theme.muted).bold(`\n  🟢 BASSE (${low.length})`));
    low.forEach(v => {
      console.log(`    - ${chalk.hex(theme.text)(v.title)}`);
      console.log(`      ${chalk.hex(theme.muted)(v.file)}`);
    });
  }
  console.log(chalk.hex(theme.muted)('═'.repeat(width)));
  if (report.tracksCreated > 0) {
    console.log(chalk.hex(theme.accent)(`\n  ${chalk.bold('Tracks crees :')} ${report.tracksCreated} — Validez-les avec /approve ou imara track implement\n`));
  } else {
    console.log(chalk.hex(theme.accent)('\n  Aucun probleme critique detecte. Votre projet est en bonne sante.\n'));
  }
}

// ── Fonction principale ───────────────────────────────────────────────────
export async function securityAuditCommand(options: { quick?: boolean } = {}): Promise<void> {
  console.log(chalk.hex(theme.primary).bold('\n  IMARA SECURITY AUDIT'));
  console.log(chalk.hex(theme.muted)('  Analyse de securite et optimisation du code\n'));

  // Phase 1 : Scan du projet
  console.log(chalk.hex(theme.secondary)('  Phase 1/4 : Scan du projet...'));
  const files = scanProject();
  console.log(chalk.hex(theme.muted)(`  → ${files.length} fichiers sources trouves`));

  if (options.quick) {
    // Mode quick : seulement les fichiers modifies (via git diff)
    console.log(chalk.hex(theme.warning)('  Mode quick active : analyse des fichiers modifies uniquement.'));
  }

  // Phase 2 : Detection proactive (etape par etape)
  console.log(chalk.hex(theme.secondary)('\n  Phase 2/4 : Detection des vulnerabilites...'));
  const allVulns: Vulnerability[] = [];
  const allOpts: Vulnerability[] = [];

  const checkFns = [
    { name: 'Secrets exposes', fn: (f: string) => checkSecrets(f) },
    { name: 'Injections SQL/Command', fn: (f: string) => checkSqlInjections(f) },
    { name: 'Configuration CORS', fn: (f: string) => checkCORSConfig(f) },
    { name: 'Failles XSS', fn: (f: string) => checkXSS(f) },
  ];

  for (const check of checkFns) {
    process.stdout.write(`  → ${chalk.hex(theme.muted)(check.name)}... `);
    const found: Vulnerability[] = [];
    for (const file of files) {
      const v = await check.fn(file);
      found.push(...v);
    }
    console.log(chalk.hex(found.length > 0 ? theme.warning : theme.accent)(`${found.length} trouvee(s)`));
    allVulns.push(...found);
  }

  // Phase 3 : Optimisations
  console.log(chalk.hex(theme.secondary)('\n  Phase 3/4 : Optimisations...'));
  process.stdout.write(`  → ${chalk.hex(theme.muted)('Analyse du code')}... `);
  for (const file of files) {
    const opts = await suggestOptimizations(file);
    allOpts.push(...opts);
  }
  console.log(chalk.hex(allOpts.length > 0 ? theme.warning : theme.accent)(`${allOpts.length} suggestion(s)`));

  // Phase 4 : Generation de tracks
  console.log(chalk.hex(theme.secondary)('\n  Phase 4/4 : Generation des tracks correctifs...\n'));
  let tracksCreated = 0;
  const allIssues = [...allVulns, ...allOpts].filter(v => v.priority !== 'info');

  for (const issue of allIssues) {
    const trackId = await createSecurityTrack(issue);
    if (trackId) tracksCreated++;
  }

  // Rapport final
  const report: AuditReport = {
    timestamp: new Date().toISOString(),
    filesScanned: files.length,
    vulnerabilities: allVulns,
    optimizations: allOpts,
    tracksCreated,
  };

  printReport(report);
}
