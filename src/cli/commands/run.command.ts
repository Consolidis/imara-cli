import { Agent } from '../../agent/agent';
import { requireAuth } from '../../auth/auth';
import { showSpinner, stopSpinner } from '../../ui/spinner';

export async function runCommand(prompt: string, options: any) {
  try {
    await requireAuth();
    
    showSpinner('Imara réfléchit...');
    const agent = new Agent(options);
    await agent.run(prompt);
    stopSpinner();
  } catch (error: any) {
    stopSpinner();
    console.error(`Erreur: ${error.message}`);
    process.exit(1);
  }
}
