import chalk from 'chalk';
import { ConfigManager, ConfigSchema } from '../../config';

export async function configCommand(action: string, key?: string, value?: string) {
  switch (action) {
    case 'list':
      console.log(chalk.cyan('\nConfiguration actuelle :'));
      Object.entries(ConfigManager.get()).forEach(([k, v]) => {
        console.log(`  ${k}: ${v}`);
      });
      break;

    case 'get':
      if (!key) {
        console.error(chalk.red('Erreur: Vous devez spécifier une clé.'));
        break;
      }
      if (!ConfigManager.validateKey(key)) {
        console.error(chalk.red(`Clé de configuration invalide: ${key}. Clés autorisées: ${Object.keys(ConfigManager.get()).join(', ')}`));
        break;
      }
      console.log(`${key}: ${ConfigManager.get()[key as keyof ConfigSchema]}`);
      break;

    case 'set':
      if (!key || value === undefined) {
        console.error(chalk.red('Erreur: Vous devez spécifier une clé et une valeur.'));
        break;
      }
      if (!ConfigManager.validateKey(key)) {
        console.error(chalk.red(`Clé de configuration invalide: ${key}.`));
        break;
      }
      try {
        const parsed = ConfigManager.parseValue(key as keyof ConfigSchema, value);
        ConfigManager.set({ [key]: parsed } as Partial<ConfigSchema>);
        console.log(chalk.green(`Config mise à jour : ${key} = ${parsed}`));
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        console.error(chalk.red(`Erreur: ${errMsg}`));
      }
      break;

    case 'reset':
      ConfigManager.reset();
      console.log(chalk.green('Configuration réinitialisée aux valeurs par défaut.'));
      break;

    default:
      console.error(chalk.red(`Action inconnue: ${action}. Utilisez list, get, set ou reset.`));
  }
}
