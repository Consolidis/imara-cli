import { Agent } from '../../agent/agent';
import { AgentOptions } from '../../agent/agent.types';
import { requireAuth } from '../../auth/auth';
import { showSpinner, stopSpinner } from '../../ui/spinner';

export async function runCommand(prompt: string, options: Record<string, unknown>) {
  try {
    await requireAuth();
    showSpinner('Imara réfléchit...');
    const agent = new Agent(options as AgentOptions);
    await agent.run(prompt);
    stopSpinner();
  } catch (error) {
    stopSpinner();
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(`Erreur: ${errMsg}`);
    process.exit(1);
  }
}
