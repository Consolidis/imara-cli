import { Message, AgentOptions, ToolCall, AgentResponse } from './agent.types';
import { ImaraClient } from '../api/imara-client';
import { Keychain } from '../auth/keychain';
import { ToolExecutor } from './tools';
import { ContextBuilder } from '../context/context-builder';
import { showResponse, showToolCall, showToolResult, showTokenUsage, showIntention } from '../ui/renderer';
import { confirmAction } from '../ui/confirm';
import { TrackLogger } from '../context/conductor/track-logger';
import ora from 'ora';
import { getAutoConfirm } from '../utils/env';
import chalk from 'chalk';
import { theme } from '../ui/theme';

/**
 * Sanitizes error messages to hide technical/internal details from the user.
 * This is the last-resort fallback — the API client already handles most cases.
 */
function sanitizeErrorMessage(msg: string): string {
  const technicalPatterns = [
    /cloudflare/i,
    /AiError/i,
    /Capacity temporarily exceeded/i,
    /\{"errors":/,
    /\{"success":/,
    /Error:\s+Error:/,
    /ee[0-9a-f]{6,}/i,
    /at\s+\w+\s+\(.*:\d+:\d+\)/,
  ];
  if (technicalPatterns.some(p => p.test(msg))) {
    if (/429|Capacity|saturé|quota/i.test(msg)) {
      return 'Le service est temporairement saturé. Réessayez dans quelques secondes.';
    }
    if (/401|unauthorized|authentifi/i.test(msg)) {
      return 'Clé API invalide. Relancez `imara login`.';
    }
    return 'Le service est temporairement indisponible. Réessayez dans un instant.';
  }
  return msg;
}

export class Agent {
  private messages: Message[] = [];
  private options: AgentOptions;
  private client: ImaraClient | null = null;
  private maxIterations = 20;
  private totalTokensUsed = 0;
  private totalCostFcfa = 0;

  constructor(options: AgentOptions = {}) {
    this.options = {
      model: 'zuri',
      yes: false,
      execute: true,
      maxTokens: 8192,
      contextDepth: 2,
      ...options
    };
    
    if (getAutoConfirm()) {
      this.options.yes = true;
    }
  }

  async run(prompt: string) {
    if (!this.client) {
      const apiKey = await Keychain.get();
      if (!apiKey && !process.env.IMARA_API_KEY) throw new Error('Non authentifié. Lancez `imara login`.');
      this.client = new ImaraClient(apiKey || '');
    }

    // Initialize context if first message
    if (this.messages.length === 0) {
      const systemPrompt = await ContextBuilder.buildSystemPrompt(this.options);
      this.messages.push({ role: 'system', content: systemPrompt });
    }

    const silentTools = ['list_directory'];

    this.messages.push({ role: 'user', content: prompt });

    let iterations = 0;
    while (iterations < this.maxIterations) {
      iterations++;

      // Dynamic spinner phase: first call = Analyse, subsequent = Synthèse
      const spinnerText = iterations === 1
        ? chalk.hex(theme.muted)('Analyse de la demande...')
        : chalk.hex(theme.muted)('Synthèse des résultats...');

      const spinner = ora({
        text: spinnerText,
        spinner: {
          frames: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
          interval: 80
        }
      }).start();
      
      try {
        const response = await this.client.chat(this.messages, this.options);
        spinner.stop();

        this.totalTokensUsed += response.usage.totalTokens;
        this.totalCostFcfa += response.usage.costFcfa;

        const isAck = (text: string): boolean => {
          const ackPhrases = ['merci', 'bien sûr', 'voici', 'je vais', 'je viens de', 'parfait', 'd\'accord', 'entendu', 'compris'];
          const isShort = text.trim().split(' ').length < 20;
          return isShort && ackPhrases.some(p => text.trim().toLowerCase().startsWith(p));
        };

        if (response.content) {
          this.messages.push({ role: 'assistant', content: response.content });
          
          // Don't show if it's just an acknowledgment before tool calls
          if (!(response.finishReason === 'tool_calls' && isAck(response.content))) {
             showResponse(response.content);
          }
        }

        if (response.finishReason === 'tool_calls' && response.toolCalls) {
          const assistantMsg: any = {
            role: 'assistant',
            tool_calls: response.toolCalls.map((tc: any) => ({
              id: tc.id,
              type: 'function',
              function: { name: tc.name, arguments: JSON.stringify(tc.arguments) }
            }))
          };
          if (response.content) {
            assistantMsg.content = response.content;
          }
          this.messages.push(assistantMsg);

          for (const toolCall of response.toolCalls) {
            const isSilent = silentTools.includes(toolCall.name);
            // Show intention BEFORE execution for transparency
            if (!isSilent) {
              showIntention(toolCall.name, toolCall.arguments);
            }
            await this.handleToolCall(toolCall, isSilent);
          }
          continue;
        }

        // If it was just an acknowledgment at the end, don't show it (or loop again if needed)
        // But usually 'stop' means we are done.

        break;
      } catch (error: any) {
        const userMessage = sanitizeErrorMessage(error.message || String(error));
        spinner.fail(chalk.hex(theme.error)(userMessage));
        // Re-throw with sanitized message so chat.command.ts also shows clean output
        throw new Error(userMessage);
      }
    }

    if (iterations >= this.maxIterations) {
      console.warn('\nAttention: Nombre maximum d\'itérations atteint.');
    }
  }

  private async handleToolCall(toolCall: any, isSilent: boolean = false) {
    const { id, name, arguments: args } = toolCall;

    if (!isSilent) {
      showToolCall(name, args);
    }

    // Security check for dangerous tools
    if (this.isDangerousTool(name, args) && !this.options.yes) {
      const confirmed = await confirmAction(`Voulez-vous exécuter le tool "${name}" ?`);
      if (!confirmed) {
        this.messages.push({
          role: 'tool',
          tool_call_id: id,
          name: name,
          content: 'Exécution annulée par l\'utilisateur.'
        });
        showToolResult(name, 'Annulé');
        return;
      }
    }

    const start = Date.now();
    try {
      const result = await ToolExecutor.execute(name, args, this);
      const duration = Date.now() - start;
      
      let toolContent = typeof result === 'string' ? result : JSON.stringify(result);
      if (!toolContent || toolContent.trim() === '') {
        toolContent = 'Action effectuée avec succès.';
      }
      
      this.messages.push({
        role: 'tool',
        tool_call_id: id,
        name: name,
        content: toolContent
      });

      // Auto-log to active track
      TrackLogger.log(name, args, typeof result === 'string' ? result : JSON.stringify(result), duration);

      if (!isSilent) {
        showToolResult(name, result, duration);
      }
    } catch (error: any) {
      const duration = Date.now() - start;
      this.messages.push({
        role: 'tool',
        tool_call_id: id,
        name: name,
        content: `Erreur: ${error.message}`
      });

      // Log the error too
      TrackLogger.log(name, args, null, duration, error.message);

      showToolResult(name, `Erreur: ${error.message}`);
    }
  }

  private isDangerousTool(name: string, args: any): boolean {
    if (name === 'run_command') return true;
    if (name === 'write_file') return true;
    if (name === 'delete_file') return true;
    return false;
  }

  public getSessionStats() {
    return {
      tokens: this.totalTokensUsed,
      cost: this.totalCostFcfa,
      messages: this.messages.length
    };
  }

  public clearHistory() {
    const systemPrompt = this.messages.find(m => m.role === 'system');
    this.messages = systemPrompt ? [systemPrompt] : [];
  }

  public setModel(model: string) {
    this.options.model = model;
  }

  public getMessages() {
    return this.messages;
  }

  public setMessages(messages: Message[]) {
    this.messages = messages;
  }
}
