/**
 * StreamHandler gère le parsing des événements SSE (Server-Sent Events)
 * pour le streaming des réponses de l'IA.
 * (Actuellement en attente d'implémentation complète)
 */
export class StreamHandler {
  static async handle(response: Response, onChunk: (chunk: string) => void) {
    const reader = response.body?.getReader();
    if (!reader) return;

    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value);
      onChunk(chunk);
    }
  }
}
