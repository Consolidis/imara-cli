import { ToolDefinition, Message, AgentProxy } from '../agent.types';

export class ClearContextTool {
  static definition: ToolDefinition = {
    name: 'clear_context',
    description: 'Réduit l\'historique en cas de changement de sujet majeur. Garde le prompt système et TOUTES les demandes utilisateur. À éviter pendant une tâche en cours — ne pas utiliser pour économiser des tokens.',
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'La raison pour laquelle vous videz le contexte' }
      }
    }
  };

  static async run(args: { reason?: string }, agent?: AgentProxy): Promise<string> {
    if (!agent) { throw new Error('Erreur interne: L\'instance agent est manquante.'); }

    const messages = agent.getMessages();
    const systemPrompt = messages.find((m: Message) => m.role === 'system');
    const userMessages = messages.filter((m: Message) => m.role === 'user');

    const newHistory: Message[] = [];
    if (systemPrompt) newHistory.push(systemPrompt);
    newHistory.push(...userMessages);

    agent.setMessages(newHistory);
    return `Historique allégé (${userMessages.length} demande(s) utilisateur conservée(s)). Raison: ${args.reason || 'Changement de contexte'}.`;
  }
}
