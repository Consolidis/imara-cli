import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('readline', () => ({
  createInterface: vi.fn().mockReturnValue({
    on: vi.fn(),
    prompt: vi.fn(),
    close: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    write: vi.fn(),
    question: vi.fn(),
  }),
  clearLine: vi.fn(),
  cursorTo: vi.fn(),
}));

import * as wizardModule from '../cli/wizard';
import * as promptModule from '../utils/prompt';
import { ConfigManager } from '../config/config-manager';
import { Keychain } from '../auth/keychain';
import { ImaraClient } from '../api/imara-client';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const TEST_CONFIG = path.join(os.homedir(), '.imara', 'config.json');

describe('Onboarding Wizard & Integration', () => {
  beforeEach(() => {
    if (fs.existsSync(TEST_CONFIG)) fs.unlinkSync(TEST_CONFIG);
    (ConfigManager as any)._cache = null;
    vi.restoreAllMocks();
  });

  afterEach(() => {
    if (fs.existsSync(TEST_CONFIG)) fs.unlinkSync(TEST_CONFIG);
    (ConfigManager as any)._cache = null;
    vi.restoreAllMocks();
  });

  it('should run setup wizard successfully and store config', async () => {
    // 1. Mock interactive ask prompts to simulate user choices
    const askMock = vi.spyOn(promptModule, 'askQuestion');
    const askMaskedMock = vi.spyOn(promptModule, 'askQuestionMasked');

    // Simulate Keychain is empty
    vi.spyOn(Keychain, 'get').mockResolvedValue(null);
    const saveSpy = vi.spyOn(Keychain, 'save').mockResolvedValue(undefined as any);

    // Mock API Client validation
    const validateMock = vi.spyOn(ImaraClient.prototype, 'validateApiKey').mockResolvedValue({
      name: 'Test User',
      email: 'test@imara.ai',
      walletBalance: 5000,
    });

    // Mock prompt flow:
    // First prompt is API key -> masked
    askMaskedMock.mockResolvedValueOnce('super-valid-api-key');
    // Second prompt is model selection -> "1" (zuri)
    askMock.mockResolvedValueOnce('1');
    // Third prompt is workspace confirmation -> Enter
    askMock.mockResolvedValueOnce('');

    // Execute Wizard
    await wizardModule.runSetupWizard();

    // Verify key was validated and saved
    expect(validateMock).toHaveBeenCalled();
    expect(saveSpy).toHaveBeenCalledWith('super-valid-api-key');

    // Verify config was persisted
    const cfg = ConfigManager.get();
    expect(cfg.defaultModel).toBe('zuri');
    expect(cfg.onboardingDone).toBe(false);
  });

  it('should run showTutorial and mark onboardingDone true', async () => {
    const { showTutorial } = await import('../ui/tutorial');
    const askMock = vi.spyOn(promptModule, 'askQuestion').mockResolvedValue('');

    // Execute Tutorial
    await showTutorial();

    // Verify 3 slide transitions were prompted
    expect(askMock).toHaveBeenCalledTimes(3);

    // Verify onboardingDone was saved
    expect(ConfigManager.get().onboardingDone).toBe(true);
  });

  it('should intercept chatCommand on first launch, run wizard and tutorial', async () => {
    // 1. Force isFirstLaunch to true by ensuring config file is deleted
    expect(ConfigManager.isFirstLaunch()).toBe(true);

    // Mock wizard and tutorial
    const { runSetupWizard } = await import('../cli/wizard');
    const { showTutorial } = await import('../ui/tutorial');
    const wizardSpy = vi.spyOn(await import('../cli/wizard'), 'runSetupWizard').mockResolvedValue();
    const tutorialSpy = vi.spyOn(await import('../ui/tutorial'), 'showTutorial').mockResolvedValue();

    // Mock requireAuth to reject with an error so that chatCommand exits early instead of blocking in REPL
    const authModule = await import('../auth/auth');
    vi.spyOn(authModule, 'requireAuth').mockRejectedValue(new Error('exit-early'));

    // Mock ProjectAnalyzer
    const analyzerModule = await import('../context/project-analyzer');
    vi.spyOn(analyzerModule.ProjectAnalyzer, 'analyze').mockResolvedValue({
      name: 'test-project',
      type: 'typescript',
      filesCount: 10,
    });

    // We use the globally mocked readline which exits immediately
    const { chatCommand } = await import('../cli/commands/chat.command');
    
    try {
      await chatCommand({});
    } catch (e: any) {
      expect(e.message).toBe('exit-early');
    }

    // Verify setup and tutorial were triggered before anything else
    expect(wizardSpy).toHaveBeenCalled();
    expect(tutorialSpy).toHaveBeenCalled();
  });

  it('should intercept unrecognized slash commands and not call the agent', async () => {
    // 1. Bypass onboarding wizard for this command filtering test
    ConfigManager.set({ onboardingDone: true });

    // Mock requireAuth to not fail
    const authModule = await import('../auth/auth');
    vi.spyOn(authModule, 'requireAuth').mockResolvedValue({ id: '1', name: 'User', email: 'test@imara.ai' });

    // Mock ProjectAnalyzer
    const analyzerModule = await import('../context/project-analyzer');
    vi.spyOn(analyzerModule.ProjectAnalyzer, 'analyze').mockResolvedValue({
      name: 'test-project',
      type: 'typescript',
      filesCount: 10,
    });

    const agentModule = await import('../agent/agent');
    const runSpy = vi.spyOn(agentModule.Agent.prototype, 'run').mockResolvedValue();

    // Catch readline interface
    const readline = await import('readline');
    let lineCallback: any = null;
    const rlInstance = {
      on: vi.fn().mockImplementation((event, cb) => {
        if (event === 'line') lineCallback = cb;
      }),
      prompt: vi.fn(),
      close: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      write: vi.fn(),
      question: vi.fn(),
    } as any;
    vi.spyOn(readline, 'createInterface').mockReturnValue(rlInstance);

    const { chatCommand } = await import('../cli/commands/chat.command');
    await chatCommand({});

    // Feed unrecognized command
    await lineCallback('/unknown-command');

    // Feed recognized command /clear (should not call agent)
    await lineCallback('/clear');

    // Feed regular message (should call agent)
    await lineCallback('hello there');

    // Agent.run should only be called once (for "hello there"), and not for slash commands!
    expect(runSpy).toHaveBeenCalledTimes(1);
    expect(runSpy).toHaveBeenCalledWith('hello there');
  });
});
