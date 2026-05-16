import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import chalk from 'chalk';

const CONFIG_PATH = path.join(os.homedir(), '.imara', 'config.json');

const DEFAULT_CONFIG = {
  defaultModel: 'zuri',
  language: 'fr',
  autoConfirm: false,
  contextDepth: 2,
  maxTokensPerRequest: 8192,
  apiBaseUrl: 'https://api.imara.ai'
};

export async function configCommand(action: string, key?: string, value?: string) {
  let config = loadConfig();

  switch (action) {
    case 'list':
      console.log(chalk.cyan('\nConfiguration actuelle :'));
      Object.entries(config).forEach(([k, v]) => {
        console.log(`  ${k}: ${v}`);
      });
      break;

    case 'get':
      if (!key) {
        console.error(chalk.red('Erreur: Vous devez spécifier une clé.'));
        break;
      }
      console.log(`${key}: ${(config as any)[key]}`);
      break;

    case 'set':
      if (!key || value === undefined) {
        console.error(chalk.red('Erreur: Vous devez spécifier une clé et une valeur.'));
        break;
      }
      
      // Type casting
      let parsedValue: any = value;
      if (value === 'true') parsedValue = true;
      if (value === 'false') parsedValue = false;
      if (!isNaN(Number(value))) parsedValue = Number(value);

      (config as any)[key] = parsedValue;
      saveConfig(config);
      console.log(chalk.green(`Config mise à jour : ${key} = ${parsedValue}`));
      break;

    case 'reset':
      saveConfig(DEFAULT_CONFIG);
      console.log(chalk.green('Configuration réinitialisée aux valeurs par défaut.'));
      break;

    default:
      console.error(chalk.red(`Action inconnue: ${action}. Utilisez list, get, set ou reset.`));
  }
}

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    return DEFAULT_CONFIG;
  }
  try {
    const data = fs.readFileSync(CONFIG_PATH, 'utf-8');
    return { ...DEFAULT_CONFIG, ...JSON.parse(data) };
  } catch {
    return DEFAULT_CONFIG;
  }
}

function saveConfig(config: any) {
  const dir = path.dirname(CONFIG_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}
