import { ToolDefinition } from '../agent.types';

export class ClearContextTool {
  static definition: ToolDefinition = {
    name: 'clear_context',
    description: 'Permet à l\'agent de vider son historique de messages pour économiser des tokens. Garde uniquement le prompt système et la demande initiale.',
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'La raison pour laquelle vous videz le contexte' }
      }
    }
  };

  static async run(args: { reason?: string }, agent?: any) {
    if (!agent) {
      throw new Error('Erreur interne: L\'instance de l\'agent est manquante.');
    }

    // Capture the first user message (the main task) before clearing
    const messages = agent.getMessages();
    const systemPrompt = messages.find((m: any) => m.role === 'system');
    const firstUserMsg = messages.find((m: any) => m.role === 'user');

    const newHistory = [];
    if (systemPrompt) newHistory.push(systemPrompt);
    if (firstUserMsg) newHistory.push(firstUserMsg);

    agent.setMessages(newHistory);

    return `Historique vidé avec succès. Raison: ${args.reason || 'Optimisation des tokens'}. L'agent a maintenant un contexte frais tout en gardant sa mission principale.`;
  }
}
