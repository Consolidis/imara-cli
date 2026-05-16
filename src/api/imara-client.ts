import { Message, AgentOptions, UserInfo, AgentResponse } from '../agent/agent.types';
import { TOOLS_DEFINITIONS } from '../agent/tools';
import { getApiUrl, getApiKey, getDebugMode } from '../utils/env';

export class ImaraClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl: string = getApiUrl()) {
    this.apiKey = getApiKey() || apiKey;
    this.baseUrl = baseUrl;
  }

  async validateApiKey(): Promise<UserInfo> {
    const response = await fetch(`${this.baseUrl}/v1/agent/profile`, {
      headers: { 'Authorization': `Bearer ${this.apiKey}` }
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Clé API invalide ou expirée. Relancez `imara login`.');
      }
      throw new Error(`Erreur validation API (${response.status})`);
    }

    return await response.json() as UserInfo;
  }

  async chat(messages: Message[], options: AgentOptions): Promise<AgentResponse> {
    const modelId = this.mapModel(options.model);
    const payload = {
      messages,
      model: modelId,
      tools: TOOLS_DEFINITIONS,
      maxTokens: options.maxTokens,
      system: options.model === 'zuri' ? 'Tu es Imara Zuri, un expert en code.' : undefined,
    };

    if (getDebugMode()) {
      console.error(`\x1b[36m[IMARA_DEBUG] POST /v1/agent/chat\x1b[0m`);
      console.error(`\x1b[36m[IMARA_DEBUG] Payload: ${JSON.stringify(payload, null, 2)}\x1b[0m`);
    }

    const response = await fetch(`${this.baseUrl}/v1/agent/chat`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'X-Model': modelId,
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      if (response.status === 400) {
        let errorMsg = 'Erreur 400 (Bad Request).';
        try {
          const errBody = await response.json() as Record<string, unknown>;
          const raw = String(errBody?.message || errBody?.error || '');
          if (raw.toLowerCase().includes('context') || raw.toLowerCase().includes('token') || raw.toLowerCase().includes('length')) {
            errorMsg = 'Le contexte de la conversation est trop lourd pour le modèle. Tapez /clear pour vider la mémoire.';
          } else if (!isTechnicalError(raw)) {
            errorMsg = raw;
          }
        } catch (_e) { /* ignore */ }
        throw new Error(errorMsg);
      }
      if (response.status === 401) {
        throw new Error('Clé API invalide ou expirée. Relancez `imara login`.');
      }
      if (response.status === 402) {
        throw new Error('Crédits insuffisants. Rechargez votre wallet sur app.imara.ai.');
      }
      if (response.status === 429) {
        throw new Error('Le service est temporairement saturé. Réessayez dans quelques secondes.');
      }
      if (response.status >= 500) {
        throw new Error('Le service Imara est temporairement indisponible. Réessayez dans un instant.');
      }

      let errorMsg = `Erreur inattendue (code ${response.status}). Réessayez ou contactez le support.`;
      try {
        const errBody = await response.json() as Record<string, unknown>;
        const raw = String(errBody?.message || errBody?.error || '');
        if (!isTechnicalError(raw)) {
          errorMsg = raw || errorMsg;
        }
      } catch (_e) { /* ignore parse errors */ }

      throw new Error(errorMsg);
    }

    const data = await response.json() as AgentResponse;

    if (getDebugMode()) {
      console.error(`\x1b[36m[IMARA_DEBUG] Response: ${JSON.stringify(data, null, 2)}\x1b[0m`);
    }

    return data;
  }

  private mapModel(modelName?: string): string {
    const map: Record<string, string> = {
      'flash': 'imara-flash',
      'standard': 'imara',
      'zuri': 'imara-zuri'
    };
    return map[modelName || 'zuri'] || 'imara-zuri';
  }
}

/**
 * Returns true if the error message contains technical/internal details
 * that should never be exposed to the end user (Cloudflare internals, stack traces, etc.)
 */
function isTechnicalError(msg: string): boolean {
  if (!msg) return false;
  const technicalPatterns = [
    /cloudflare/i,
    /AiError/i,
    /Capacity temporarily exceeded/i,
    /\{"errors":/,
    /\{"success":/,
    /code":\s*\d{4}/,
    /ee[0-9a-f]{6,}/i,   // UUIDs from Cloudflare error codes
    /at\s+\w+\s+\(.*:\d+:\d+\)/,  // Stack trace lines
    /Error:\s+Error:/,   // Double-Error prefix
  ];
  return technicalPatterns.some(p => p.test(msg));
}
