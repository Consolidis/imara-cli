import { Message, AgentOptions, UserInfo, AgentResponse } from '../agent/agent.types';
import { TOOLS_DEFINITIONS } from '../agent/tools';
import { getApiUrl, getApiKey, getDebugMode } from '../utils/env';
import { fetchWithTimeout } from '../utils/fetch-with-timeout';
import { executeWithRetry } from '../utils/retry';
import { CircuitBreaker } from '../utils/circuit-breaker';
import { CacheManager } from '../cache/cache-manager';
import { computeContextHash } from '../utils/cache';
import { join } from 'path';
import { homedir } from 'os';
import chalk from 'chalk';

function sanitizeForJson(value: string): string {
  return value.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
}

function sanitizeMessages(messages: Message[]): Message[] {
  return messages.map(m => ({
    ...m,
    content: sanitizeForJson(m.content),
  }));
}

export class ImaraClient {
  private apiKey: string;
  private baseUrl: string;
  private circuitBreaker: CircuitBreaker;
  private cache: CacheManager<AgentResponse>;

  constructor(apiKey: string, baseUrl: string = getApiUrl()) {
    this.apiKey = getApiKey() || apiKey;
    this.baseUrl = baseUrl;
    this.circuitBreaker = new CircuitBreaker('imara-api');
    this.cache = new CacheManager<AgentResponse>(
      join(homedir(), '.imara', 'cache'),
      { ttlMs: 24 * 60 * 60 * 1000, maxSize: 100 }
    );
  }

  async validateApiKey(): Promise<UserInfo> {
    return this.circuitBreaker.execute(async () => {
      return executeWithRetry(async () => {
        const response = await fetchWithTimeout(`${this.baseUrl}/v1/agent/profile`, {
          headers: { 'Authorization': `Bearer ${this.apiKey}` },
          timeoutMs: 5000,
          retries: 0
        });

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error('Clé API invalide ou expirée (code 401). Relancez `imara login`.');
          }
          throw new Error(`Erreur validation API (code ${response.status})`);
        }

        return await response.json() as UserInfo;
      });
    });
  }

  async chat(messages: Message[], options: AgentOptions): Promise<AgentResponse> {
    const cacheKey = computeContextHash(messages);

    try {
      const data = await this.circuitBreaker.execute(async () => {
        return executeWithRetry(async () => {
          const modelId = this.mapModel(options.model);
          const sanitizedMessages = sanitizeMessages(messages);
          const payload = {
            messages: sanitizedMessages,
            model: modelId,
            tools: TOOLS_DEFINITIONS,
            maxTokens: options.maxTokens,
            system: options.model === 'zuri' ? 'Tu es Imara Zuri, un expert en code.' : undefined,
          };

          if (getDebugMode()) {
            console.error(`\x1b[36m[IMARA_DEBUG] POST /v1/agent/chat\x1b[0m`);
            console.error(`\x1b[36m[IMARA_DEBUG] Payload: ${JSON.stringify(payload, null, 2)}\x1b[0m`);
          }

          const response = await fetchWithTimeout(`${this.baseUrl}/v1/agent/chat`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json',
              'X-Model': modelId,
            },
            body: JSON.stringify(payload),
            timeoutMs: 30000,
            retries: 0
          });

          if (!response.ok) {
            if (response.status === 400) {
              let errorMsg = 'Erreur 400 (Bad Request).';
              try {
                const errBody = await response.json() as Record<string, unknown>;
                const raw = String(errBody?.message || errBody?.error || '');
                if (raw.toLowerCase().includes('context') || raw.toLowerCase().includes('token') || raw.toLowerCase().includes('length')) {
                  errorMsg = 'Le contexte de la conversation est trop lourd pour le modèle. Tapez /clear pour vider la mémoire.';
                } else if (raw.toLowerCase().includes('wallet') || raw.toLowerCase().includes('balance') || raw.toLowerCase().includes('insufficient')) {
                  errorMsg = 'Solde insuffisant dans votre wallet. Veuillez recharger vos crédits sur https://imara.consolidis.com pour utiliser ce modèle.';
                } else if (!isTechnicalError(raw)) {
                  errorMsg = raw;
                }
              } catch (_e) { /* ignore */ }
              throw new Error(errorMsg);
            }
            if (response.status === 401) {
              throw new Error('Clé API invalide ou expirée (code 401). Relancez `imara login`.');
            }
            if (response.status === 402) {
              throw new Error('Crédits insuffisants (code 402). Rechargez votre wallet sur imara.consolidis.com.');
            }
            if (response.status === 429) {
              throw new Error('Le service est temporairement saturé (code 429). Réessayez dans quelques secondes.');
            }
            if (response.status >= 500) {
              throw new Error(`Le service Imara est temporairement indisponible (code ${response.status}). Réessayez dans un instant.`);
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

          // Robust Fallback: Parse raw embedded tool call tokens in response content (génération brute)
          if (data.content && (!data.toolCalls || data.toolCalls.length === 0)) {
            const regex = /([a-zA-Z0-9_-]+):(\d+)<\|tool_call_argument_begin\|>([\s\S]*?)<\|tool_call_end\|>(?:<\|tool_calls_section_end\|>)?/g;
            const matches = [...data.content.matchAll(regex)];
            if (matches.length > 0) {
              data.toolCalls = data.toolCalls || [];
              for (const match of matches) {
                const name = match[1];
                const id = match[2];
                const argsText = match[3].trim();
                let args = {};
                try {
                  args = JSON.parse(argsText);
                } catch {
                  try {
                    const cleaned = argsText.replace(/'/g, '"');
                    args = JSON.parse(cleaned);
                  } catch {
                    args = { raw: argsText };
                  }
                }
                data.toolCalls.push({
                  id: `embedded_${name}_${id}`,
                  name,
                  arguments: args
                });
              }
              data.finishReason = 'tool_calls';
              data.content = data.content.replace(regex, '').trim();
            }
          }

          if (getDebugMode()) {
            console.error(`\x1b[36m[IMARA_DEBUG] Response: ${JSON.stringify(data, null, 2)}\x1b[0m`);
          }

          return data;
        }, {
          maxRetries: process.env.NODE_ENV === 'test' ? 0 : 5,
          baseDelayMs: process.env.NODE_ENV === 'test' ? 0 : 2000,
          maxDelayMs: process.env.NODE_ENV === 'test' ? 0 : 15000,
          onRetry: (error, attempt, delayMs) => {
            if (process.env.NODE_ENV === 'test') return;
            const sec = Math.ceil(delayMs / 1000);
            process.stdout.write(
              chalk.hex('#ffcc00')(`\n  ⚠ [IMARA / API Pause] Connexion temporairement saturée. Pause de ${sec}s avant tentative ${attempt + 1}/5...\n`)
            );
          }
        });
      });

      // Save successful response to cache
      this.cache.set(cacheKey, data);
      return data;
    } catch (error) {
      // Fallback to cache offline
      const cachedResponse = this.cache.get(cacheKey);
      if (cachedResponse) {
        return {
          ...cachedResponse,
          content: `[● HORS-LIGNE - RÉPONSE EN CACHE]\n\n${cachedResponse.content}`,
        };
      }
      throw error;
    }
  }

  private mapModel(modelName?: string): string {
    if (!modelName) return 'imara-zuri';
    const map: Record<string, string> = {
      'flash': 'imara-flash',
      'standard': 'imara',
      'zuri': 'imara-zuri'
    };
    return map[modelName] || modelName;
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
