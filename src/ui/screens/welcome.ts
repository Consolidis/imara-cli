import chalk from 'chalk';
import { theme } from '../theme';
import { getVersion } from '../../utils/version';
import { TrackManager } from '../../context/conductor/track-manager';

export function isNativeModel(modelName: string): boolean {
  const nativeList = ['zuri', 'imara-zuri', 'standard', 'imara', 'flash', 'imara-flash'];
  return nativeList.includes(modelName.toLowerCase());
}

/** Minimal welcome — Claude Code–inspired, low noise. */
export function renderWelcome(config: {
  model: string;
  projectName: string;
  projectType: string;
  mode: string;
}): void {
  console.clear();

  const activeTrack = TrackManager.getActive();
  const trackText = activeTrack
    ? `${activeTrack.id}`.slice(0, 26)
    : 'aucun';
  const trackStatus = activeTrack
    ? (activeTrack.validated ? 'validé' : 'en attente')
    : '';

  const versionText = `v${getVersion()}`;
  const projInfo = `${config.projectName} (${config.projectType})`.slice(0, 30);

  const leftW = 45;
  const rightW = 30;

  const topBorder = chalk.hex(theme.muted)('┌' + '─'.repeat(leftW) + '┬' + '─'.repeat(rightW) + '┐');
  const bottomBorder = chalk.hex(theme.muted)('└' + '─'.repeat(leftW) + '┴' + '─'.repeat(rightW) + '┘');

  const printRow = (plainL: string, colorL: string, plainR: string, colorR: string) => {
    const padL = ' '.repeat(Math.max(0, leftW - plainL.length));
    const padR = ' '.repeat(Math.max(0, rightW - plainR.length));
    console.log(
      chalk.hex(theme.muted)('│') +
      colorL + padL +
      chalk.hex(theme.muted)('│') +
      colorR + padR +
      chalk.hex(theme.muted)('│')
    );
  };

  // ASCII Art
  const ascii1 = '  ___ __  __   _    ____    _   ';
  const ascii2 = ' |_ _|  \\/  | / \\  |  _ \\  / \\  ';
  const ascii3 = '  | || |\\/| |/ _ \\ | |_) |/ _ \\ ';
  const ascii4 = '  | || |  | / ___ \\|  _ < / ___ \\';
  const ascii5 = ' |___|_|  |_/_/   \\_\\_| \\_/_/   \\_\\';

  console.log('');
  console.log(topBorder);

  // Line 1
  const l1LPlain = `  ${versionText} · ${projInfo}`;
  const l1LColor = chalk.hex(theme.muted)(`  ${versionText} · `) + chalk.hex(theme.text).bold(projInfo);
  const l1RPlain = `  TRACK ACTIF:`;
  const l1RColor = chalk.hex(theme.primary).bold(l1RPlain);
  printRow(l1LPlain, l1LColor, l1RPlain, l1RColor);

  // Line 2
  printRow(
    ascii1, chalk.hex(theme.primary).bold(ascii1),
    `  ${trackText}`, chalk.hex(theme.accent)(`  ${trackText}`)
  );

  // Line 3
  const statusStr = trackStatus ? `  (${trackStatus})` : '  (aucun)';
  printRow(
    ascii2, chalk.hex(theme.primary).bold(ascii2),
    statusStr, chalk.hex(theme.muted)(statusStr)
  );

  // Line 4 (Right-side divider line)
  console.log(
    chalk.hex(theme.muted)('│') +
    chalk.hex(theme.primary).bold(ascii3.padEnd(leftW)) +
    chalk.hex(theme.muted)('├' + '─'.repeat(rightW) + '┤')
  );

  // Line 5
  const l5RPlain = '  STATS SESSION:';
  printRow(
    ascii4, chalk.hex(theme.primary).bold(ascii4),
    l5RPlain, chalk.hex(theme.primary).bold(l5RPlain)
  );

  // Line 6
  const l6RPlain = '  0 tokens';
  printRow(
    ascii5, chalk.hex(theme.primary).bold(ascii5),
    l6RPlain, chalk.hex(theme.text)(l6RPlain)
  );

  // Line 7
  const modelText = `  Modèle: ${config.model.toUpperCase()}`;
  const l7RPlain = '  0.00 FCFA';
  printRow(
    modelText, chalk.hex(theme.secondary).bold(modelText),
    l7RPlain, chalk.hex(theme.text)(l7RPlain)
  );

  console.log(bottomBorder);

  if (!isNativeModel(config.model)) {
    console.log(
      chalk.hex(theme.warning)(
        '  ⚠ Modèle non-natif : 5.00 FCFA / requête — vérifiez votre solde wallet.'
      )
    );
  }

  console.log('');
}

