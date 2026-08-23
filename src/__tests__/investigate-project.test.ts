import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { InvestigateProjectTool } from '../agent/tools/investigate-project.tool';

describe('InvestigateProjectTool', () => {
  const testDir = path.join(process.cwd(), 'temp-test-investigate-project');

  beforeEach(() => {
    if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true });
    fs.mkdirSync(testDir, { recursive: true });
    vi.spyOn(process, 'cwd').mockReturnValue(testDir);
    // Projet factice multi-langages autour du concept "wallet"
    fs.mkdirSync(path.join(testDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(testDir, 'src', 'wallet.service.ts'), `export class WalletService {\n  credit(amount: number): void {\n    // credite le wallet\n  }\n  debit(amount: number): void {\n    // debite le wallet\n  }\n}\n`, 'utf-8');
    fs.writeFileSync(path.join(testDir, 'src', 'wallet.controller.ts'), `import { WalletService } from './wallet.service';\nexport class WalletController {\n  constructor(private wallet: WalletService) {}\n}\n`, 'utf-8');
    fs.mkdirSync(path.join(testDir, 'py'), { recursive: true });
    fs.writeFileSync(path.join(testDir, 'py', 'billing.py'), `def compute_balance(wallet_id):\n    return 100\n`, 'utf-8');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true });
  });

  it('builds a localization map for a concept', async () => {
    const raw = await InvestigateProjectTool.run({ concept: 'wallet', depth: 'rapide' });
    const report = raw.split('\\').join('/');
    expect(report).toContain("VUE D'ENSEMBLE");
    expect(report).toContain('CARTE DE LOCALISATION');
    expect(report).toContain('src/wallet.service.ts');
    expect(report).toContain('src/wallet.controller.ts');
    expect(report).toContain('DEFINITION');
  });

  it('returns empty message when concept not found', async () => {
    const report = await InvestigateProjectTool.run({ concept: 'zyxwv-introuvable', depth: 'rapide' });
    expect(report).toContain('Aucun resultat');
  });

  it('includes dependency relations at standard depth', async () => {
    const raw = await InvestigateProjectTool.run({ concept: 'wallet', depth: 'standard' });
    const report = raw.split('\\').join('/');
    expect(report).toContain('RELATIONS');
    expect(report).toContain('Importe par');
  });

  it('includes excerpts of context lines', async () => {
    const raw = await InvestigateProjectTool.run({ concept: 'wallet', depth: 'standard' });
    const report = raw.split('\\').join('/');
    expect(report).toContain('EXTRAITS');
    expect(report).toContain('L1');
  });

  it('rejects missing concept parameter', async () => {
    await expect(InvestigateProjectTool.run({ concept: '' })).rejects.toThrow('concept est requis');
  });
});
