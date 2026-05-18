import { Message, AgentOptions, ParsedToolCall, ToolResult, ToolArguments } from './agent.types';
import { ImaraClient } from '../api/imara-client';
import { Keychain } from '../auth/keychain';
import { ToolExecutor } from './tools';
import { ContextBuilder } from '../context/context-builder';
import { showResponse, showToolCall, showToolResult, showIntention, startToolCallSpinner, stopToolCallSpinner } from '../ui/renderer';
import { confirmAction } from '../ui/confirm';
import { TrackLogger } from '../context/conductor/track-logger';
import { ContextWindow } from '../context/context-window';
import { ConfigManager } from '../config';
import ora from 'ora';
import { getAutoConfirm } from '../utils/env';
import chalk from 'chalk';
import { theme } from '../ui/theme';
import { fromUnknown, ImaraError } from '../types/errors';
import { Result } from '../types/result';

function sanitizeErrorMessage(msg: string): string {
  const technicalPatterns = [
    /cloudflare/i, /AiError/i, /Capacity temporarily exceeded/i,
    /\{"errors":/, /\{"success":/, /Error:\s+Error:/,
    /ee[0-9a-f]{6,}/i, /at\s+\w+\s+\(.*:\d+:\d+\)/,
  ];
  if (technicalPatterns.some(p => p.test(msg))) {
    if (/429|Capacity|satur[eé]|quota/i.test(msg)) {
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
  private options: Required<AgentOptions>;
  private client: ImaraClient | null = null;
  private maxIterations = 20;
  private totalTokensUsed = 0;
  private totalCostFcfa = 0;
  private contextWindow: ContextWindow;
  private cancelled = false;

  constructor(options: AgentOptions = {}) {
    this.options = {
      model: options.model ?? 'zuri',
      yes: options.yes ?? false,
      execute: options.execute ?? true,
      maxTokens: options.maxTokens ?? 8192,
      contextDepth: options.contextDepth ?? 2,
    };
    if (getAutoConfirm()) this.options.yes = true;

    const cfg = ConfigManager.get();
    this.contextWindow = new ContextWindow({
      maxTokens: this.options.maxTokens,
      warningThreshold: cfg.tokenWarningThreshold,
      compactThreshold: cfg.tokenCompactThreshold,
    });
  }

  cancel(): void {
    this.cancelled = true;
  }

  resetCancellation(): void {
    this.cancelled = false;
  }

  async run(prompt: string): Promise<void> {
    if (!this.client) {
      const apiKey = await Keychain.get();
      if (!apiKey && !process.env.IMARA_API_KEY) {
        throw new Error('Non authentifié. Lancez `imara login`.');
      }
      this.client = new ImaraClient(apiKey || '');
    }

    if (this.messages.length === 0) {
      const systemPrompt = await ContextBuilder.buildSystemPrompt(this.options);
      this.messages.push({ role: 'system', content: systemPrompt });
    }

    this.messages.push({ role: 'user', content: prompt });
    this.resetCancellation();
    await this.runLoop();
  }

  private async runLoop(): Promise<void> {
    const silentTools = new Set(['list_directory']);
    let iterations = 0;

    while (iterations < this.maxIterations) {
      if (this.cancelled) {
        throw new Error('Interruption : exécution annulée par l\'utilisateur.');
      }
      iterations++;

      // CHECK FENETRE DE CONTEXTE
      const check = this.contextWindow.check(this.messages);
      if (check.action === 'warn') {
        process.stdout.write(chalk.hex(theme.warning)('\n⚠ Attention : le contexte approche de la limite (' + this.contextWindow.getStats(this.messages).totalTokens + ' tokens).\n'));
      }
      if (check.action === 'compact') {
        const beforeCount = this.messages.length;
        this.messages = this.contextWindow.compact(this.messages);
        const afterCount = this.messages.length;
        if (afterCount < beforeCount) {
          process.stdout.write(chalk.hex(theme.warning)(`\n⚠ Contexte compresse : ${beforeCount - afterCount} messages resumes pour economiser des tokens.\n`));
        }
      }

      const spinnerText = iterations === 1
        ? chalk.hex(theme.muted)('Analyse de la demande...')
        : chalk.hex(theme.muted)('Synthèse des résultats...');
      const spinner = ora({
        text: spinnerText,
        spinner: { frames: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'], interval: 80 }
      }).start();

      try {
        const response = await this.client!.chat(this.messages, this.options);
        spinner.stop();

        this.totalTokensUsed += response.usage.totalTokens;
        this.totalCostFcfa += response.usage.costFcfa;

        if (response.content) {
          this.messages.push({ role: 'assistant', content: response.content });
          if (!this.isAck(response.content) || response.finishReason !== 'tool_calls') {
            showResponse(response.content);
          }
        }

        if (response.finishReason === 'tool_calls' && response.toolCalls.length > 0) {
          this.pushAssistantToolCalls(response);
          for (const toolCall of response.toolCalls) {
            if (this.cancelled) {
              throw new Error('Interruption : exécution annulée par l\'utilisateur.');
            }
            const isSilent = silentTools.has(toolCall.name);
            if (!isSilent) showIntention(toolCall.name, toolCall.arguments);
            await this.handleToolCall(toolCall, isSilent);
          }
          // MAJ STATUS BAR APRES TOOLS
          continue;
        }

        // MAJ STATUS BAR A LA FIN
        break;
      } catch (error) {
        const imaraErr = fromUnknown(error);
        const userMessage = sanitizeErrorMessage(imaraErr.message);
        spinner.fail(chalk.hex(theme.error)(userMessage));
        throw new Error(userMessage);
      }
    }

    if (iterations >= this.maxIterations) {
      console.warn('\nAttention: Nombre maximum d\'iterations atteint.');
    }
  }

  getContextStats() {
    const stats = this.contextWindow.getStats(this.messages);
    const percent = Math.round((stats.totalTokens / stats.maxTokens) * 100);
    return { percent, state: stats.state };
  }

  private isAck(text: string): boolean {
    const ackPhrases = ['merci', 'bien sûr', 'voici', 'je vais', 'je viens de', 'parfait', 'd\'accord', 'entendu', 'compris'];
    const isShort = text.trim().split(/\s+/).length < 20;
    return isShort && ackPhrases.some(p => text.trim().toLowerCase().startsWith(p));
  }

  private pushAssistantToolCalls(response: { content: string; toolCalls: ParsedToolCall[] }): void {
    const assistantMsg: Message = {
      role: 'assistant',
      content: response.content || '',
      tool_calls: response.toolCalls.map(tc => ({
        id: tc.id,
        type: 'function',
        function: { name: tc.name, arguments: JSON.stringify(tc.arguments) }
      }))
    };
    this.messages.push(assistantMsg);
  }

  private async handleToolCall(toolCall: ParsedToolCall, isSilent: boolean): Promise<void> {
    if (this.cancelled) {
      throw new Error('Interruption : exécution annulée par l\'utilisateur.');
    }
    const { id, name, arguments: args } = toolCall;

    if (!isSilent) startToolCallSpinner(name, args);

    if (this.isDangerousTool(name) && !this.options.yes) {
      stopToolCallSpinner();
      const choice = await confirmAction(`Voulez-vous exécuter le tool "${name}" ?`);
      if (choice === 'no') {
        this.pushToolResult(id, name, 'Exécution annulée par l\'utilisateur.');
        showToolResult(name, 'Annulé');
        return;
      }
      if (choice === 'always') {
        this.options.yes = true;
      }
      startToolCallSpinner(name, args);
    }

    const start = Date.now();
    const result = await ToolExecutor.execute(name, args, this);
    const duration = Date.now() - start;

    stopToolCallSpinner();

    if (result.ok) {
      this.pushToolResult(id, name, result.value);
      TrackLogger.log(name, args, result.value, duration);
      if (!isSilent) showToolCall(name, args, duration);
    } else {
      const errMsg = result.error.message;
      this.pushToolResult(id, name, `Erreur: ${errMsg}`);
      TrackLogger.log(name, args, null, duration, errMsg);
      showToolCall(name, { error: errMsg }, duration);
    }
  }

  private pushToolResult(id: string, name: string, content: string): void {
    this.messages.push({
      role: 'tool',
      tool_call_id: id,
      name,
      content
    });
  }

  private isDangerousTool(name: string): boolean {
    return name === 'run_command' || name === 'write_file' || name === 'delete_file';
  }

  getSessionStats(): { tokens: number; cost: number; messages: number } {
    return { tokens: this.totalTokensUsed, cost: this.totalCostFcfa, messages: this.messages.length };
  }

  clearHistory(): void {
    const systemPrompt = this.messages.find(m => m.role === 'system');
    this.messages = systemPrompt ? [systemPrompt] : [];
  }

  setModel(model: string): void { this.options.model = model; }
  getModel(): string { return this.options.model; }
  getMessages(): Message[] { return [...this.messages]; }
  setMessages(messages: Message[]): void { this.messages = [...messages]; }
}
