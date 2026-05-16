import chalk from 'chalk';
import { Keychain } from '../../auth/keychain';
import { ImaraClient } from '../../api/imara-client';
import { showSpinner, stopSpinner } from '../../ui/spinner';

export async function loginCommand(options: any) {
  let apiKey = options.key;

  if (!apiKey) {
    console.error(chalk.red('Erreur: Vous devez spécifier une clé API avec --key <api-key>'));
    process.exit(1);
  }

  showSpinner('Validation de la clé API...');
  try {
    const client = new ImaraClient(apiKey);
    const userInfo = await client.validateApiKey();
    
    await Keychain.save(apiKey);
    
    stopSpinner();
    console.log(chalk.green(`\nConnexion réussie !`));
    console.log(`Utilisateur: ${userInfo.name} (${userInfo.email})`);
    console.log(`Solde wallet: ${userInfo.walletBalance} FCFA`);
  } catch (error: any) {
    stopSpinner();
    console.error(chalk.red(`\nErreur de connexion: ${error.message}`));
    process.exit(1);
  }
}
