import { ToolDefinition } from '../agent.types';

export class WebSearchTool {
  static definition: ToolDefinition = {
    name: 'web_search',
    description: 'Recherche des informations sur le web.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'La requête de recherche' }
      },
      required: ['query']
    }
  };

  static async run(args: { query: string }) {
    // This would typically call a backend endpoint that has search capabilities
    return `Recherche web pour: "${args.query}". (Note: La recherche web est actuellement simulée via le client API)`;
  }
}
