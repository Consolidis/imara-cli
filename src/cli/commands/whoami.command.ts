import chalk from 'chalk';
import { Keychain } from '../../auth/keychain';
import { ImaraClient } from '../../api/imara-client';
import { showSpinner, stopSpinner } from '../../ui/spinner';

export async function whoamiCommand() {
  const apiKey = await Keychain.get();

  if (!apiKey) {
    console.log(chalk.yellow('Vous n\'êtes pas connecté. Utilisez "imara login --key <api-key>" pour vous connecter.'));
    return;
  }

  showSpinner('Récupération de vos informations...');
  try {
    const client = new ImaraClient(apiKey);
    const userInfo = await client.validateApiKey();
    
    stopSpinner();
    console.log(chalk.cyan(`\nUtilisateur connecté :`));
    console.log(`  Nom:     ${userInfo.name}`);
    console.log(`  Email:   ${userInfo.email}`);
    console.log(`  Rôle:    ${userInfo.role}`);
    console.log(`  Solde:   ${userInfo.walletBalance} FCFA`);
  } catch (error) {
    stopSpinner();
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(chalk.red(`\nErreur lors de la récupération des informations: ${errMsg}`));
  }
}
