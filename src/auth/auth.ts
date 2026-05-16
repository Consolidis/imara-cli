import chalk from 'chalk';
import { Keychain } from './keychain';
import { getApiKey } from '../utils/env';

export async function requireAuth(): Promise<string> {
  const apiKey = (await Keychain.get()) || getApiKey();
  
  if (!apiKey) {
    console.error(chalk.red('\nErreur: Vous n\'êtes pas connecté.'));
    console.log(`Utilisez ${chalk.cyan('imara login --key <api-key>')} pour commencer.`);
    process.exit(1);
  }

  return apiKey;
}
