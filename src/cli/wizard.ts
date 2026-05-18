import * as readline from 'readline';
import chalk from 'chalk';
import { ConfigManager } from '../config/config-manager';
import { ImaraClient } from '../api/imara-client';
import { Keychain } from '../auth/keychain';
import { askQuestion, askQuestionMasked } from '../utils/prompt';

/**
 * Runs the interactive onboarding Setup Wizard.
 */
export async function runSetupWizard(): Promise<void> {
  console.clear();
  console.log(chalk.cyan.bold('\n┌────────────────────────────────────────────────────────┐'));
  console.log(chalk.cyan.bold('│                                                        │'));
  console.log(chalk.cyan.bold('│            ⚡ CONFIGURATION INITIALE D' + "'" + 'IMARA ⚡           │'));
  console.log(chalk.cyan.bold('│                                                        │'));
  console.log(chalk.cyan.bold('└────────────────────────────────────────────────────────┘\n'));
  console.log(chalk.gray('Bienvenue ! Configurons IMARA CLI en quelques instants.\n'));

  // 1. API KEY ENTRY & LIVE VALIDATION
  let apiKey = '';
  let validated = false;
  let userName = '';
  let userEmail = '';
  
  // Try to load key from existing keychain if any
  const existingKey = await Keychain.get();

  while (!validated) {
    if (existingKey && !apiKey) {
      console.log(chalk.yellow(`🔑 Clé API sécurisée existante détectée.`));
      const useExisting = await askQuestion(chalk.cyan('› Utiliser cette clé existante ? (O/n) : '));
      if (useExisting.toLowerCase() !== 'n') {
        apiKey = existingKey;
      }
    }

    if (!apiKey) {
      console.log(chalk.gray('\nRécupérez votre clé API sur https://imara.consolidis.com'));
      apiKey = await askQuestionMasked(chalk.cyan('› Collez votre Clé API d\'IMARA (saisie invisible) : '));
      if (!apiKey) {
        console.log(chalk.red('⚠ La clé API ne peut pas être vide.'));
        continue;
      }
    }

    // Live validation
    process.stdout.write(chalk.yellow('⠋ Validation de la clé API avec le serveur...'));
    try {
      const client = new ImaraClient(apiKey);
      const userInfo = await client.validateApiKey();
      
      // Clear the loading line
      readline.clearLine(process.stdout, 0);
      readline.cursorTo(process.stdout, 0);
      
      console.log(chalk.green(`🟢 Clé API validée avec succès !`));
      console.log(chalk.gray(`   Utilisateur : ${userInfo.name} (${userInfo.email})`));
      console.log(chalk.gray(`   Solde       : ${userInfo.walletBalance} FCFA`));
      
      // Save valid key to system keychain
      await Keychain.save(apiKey);
      userName = userInfo.name;
      userEmail = userInfo.email;
      validated = true;
    } catch (error) {
      // Clear the loading line
      readline.clearLine(process.stdout, 0);
      readline.cursorTo(process.stdout, 0);

      const msg = error instanceof Error ? error.message : String(error);
      console.log(chalk.red(`🔴 Validation échouée : Clé API incorrecte ou expirée.\n   (${msg})`));
      apiKey = ''; // Reset for retry
    }
  }

  // 2. MODEL SELECTION
  console.log(chalk.cyan.bold('\n--- Choix du Modèle par Défaut ---'));
  console.log(chalk.gray('1. imara-zuri  - Expert en code et refactoring (Recommandé)'));
  console.log(chalk.gray('2. imara       - Modèle standard pour tâches générales'));
  console.log(chalk.gray('3. imara-flash - Modèle rapide et ultra-économique'));
  
  let modelChoice = '';
  let defaultModel = 'zuri';
  while (!modelChoice) {
    const ans = await askQuestion(chalk.cyan('\n› Sélectionnez le modèle (1-3, défaut: 1) : '));
    if (!ans || ans === '1') {
      defaultModel = 'zuri';
      modelChoice = 'zuri';
    } else if (ans === '2') {
      defaultModel = 'standard';
      modelChoice = 'standard';
    } else if (ans === '3') {
      defaultModel = 'flash';
      modelChoice = 'flash';
    } else {
      console.log(chalk.red('⚠ Choix invalide. Veuillez entrer 1, 2 ou 3.'));
    }
  }
  console.log(chalk.green(`🟢 Modèle configuré : imara-${defaultModel}`));

  // 3. WORKSPACE ROOT ISOLATION
  const cwd = process.cwd();
  console.log(chalk.cyan.bold('\n--- Workspace de Travail Sécurisé ---'));
  console.log(chalk.gray(`Le workspace par défaut est configuré à la racine du dossier courant.`));
  console.log(chalk.yellow(`📂 Racine : ${cwd}`));
  console.log(chalk.gray('Pour votre sécurité, l\'agent sera strictement confiné dans ce répertoire.'));
  await askQuestion(chalk.cyan('\n[Appuyez sur ENTRÉE pour confirmer et terminer la configuration...] '));

  // Save config
  ConfigManager.set({
    defaultModel,
    userName,
    userEmail,
    onboardingDone: false, // will be marked true after tutorial is displayed
  });

  console.log(chalk.green.bold('\n⚡ Configuration initiale sauvegardée avec succès !\n'));
}
