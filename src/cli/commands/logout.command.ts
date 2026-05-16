import chalk from 'chalk';
import { Keychain } from '../../auth/keychain';

export async function logoutCommand() {
  try {
    await Keychain.delete();
    console.log(chalk.green('Déconnexion réussie. Votre clé API a été supprimée de votre trousseau de clés local.'));
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(chalk.red(`Erreur lors de la déconnexion: ${errMsg}`));
    process.exit(1);
  }
}
