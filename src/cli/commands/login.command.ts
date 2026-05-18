import chalk from 'chalk';
import { Keychain } from '../../auth/keychain';
import { ImaraClient } from '../../api/imara-client';
import { showSpinner, stopSpinner } from '../../ui/spinner';

export async function loginCommand(options: Record<string, unknown>) {
  let apiKey = options.key as string | undefined;

  if (!apiKey) {
    console.error(chalk.red('Erreur: Vous devez spécifier une clé API avec --key <api-key>'));
    process.exit(1);
  }

  showSpinner('Validation de la clé API...');
  try {
    const client = new ImaraClient(apiKey);
    const userInfo = await client.validateApiKey();
    
    await Keychain.save(apiKey);
    
    // Save user info to local config
    const { ConfigManager } = require('../../config/config-manager');
    ConfigManager.set({
      userName: userInfo.name,
      userEmail: userInfo.email
    });
    
    stopSpinner();
    console.log(chalk.green(`\nConnexion réussie !`));
    console.log(`Utilisateur: ${userInfo.name} (${userInfo.email})`);
    console.log(`Solde wallet: ${userInfo.walletBalance} FCFA`);
  } catch (error) {
    stopSpinner();
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(chalk.red(`\nErreur de connexion: ${errMsg}`));
    process.exit(1);
  }
}
