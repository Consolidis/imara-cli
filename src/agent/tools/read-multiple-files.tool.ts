import { ReadFileTool } from './read-file.tool';
import { ToolDefinition } from '../agent.types';

export class ReadMultipleFilesTool {
  static definition: ToolDefinition = {
    name: 'read_multiple_files',
    description: 'Lit plusieurs fichiers en une seule fois.',
    parameters: {
      type: 'object',
      properties: {
        paths: {
          type: 'array',
          items: { type: 'string' },
          description: 'Liste des chemins de fichiers'
        }
      },
      required: ['paths']
    }
  };

  static async run(args: { paths: string[] }): Promise<string> {
    const results = await Promise.all(
      args.paths.map(async (p) => {
        try {
          const content = await ReadFileTool.run({ path: p });
          return `--- FILE: ${p} ---\n${content}\n`;
        } catch (error) {
          const err = error instanceof Error ? error.message : String(error);
          return `--- FILE: ${p} (ERROR) ---\n${err}\n`;
        }
      })
    );
    return results.join('\n');
  }
}
