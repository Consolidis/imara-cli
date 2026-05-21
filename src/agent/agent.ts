import { Message, AgentOptions, ParsedToolCall, ToolResult, ToolArguments } from './agent.types';
import { ImaraClient } from '../api/imara-client';
import { Keychain } from '../auth/keychain';
import { ToolExecutor } from './tools';
import { ContextBuilder } from '../context/context-builder';
import { showResponse, showToolCall, showToolResult, startToolCallSpinner, stopToolCallSpinner } from '../ui/renderer';
import { uiEvents } from '../ui/ui-events';
import { confirmDangerousTool } from '../ui/confirm';
import * as path from 'path';
import { TrackLogger } from '../context/conductor/track-logger';
import { ContextWindow } from '../context/context-window';
import { ConfigManager } from '../config';
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
  private totalTokensUsed = 0;
  private totalCostFcfa = 0;
  private contextWindow: ContextWindow;
  private cancelled = false;
  private paused = false;
  private toolCallHistory: { name: string; args: string }[] = [];
  private richToolCallHistory: {
    name: string;
    args: ToolArguments;
    argsStr: string;
    targetFile?: string;
    timestamp: number;
  }[] = [];

  constructor(options: AgentOptions = {}) {
    const cfg = ConfigManager.get();
    this.options = {
      model: options.model ?? cfg.defaultModel ?? 'zuri',
      yes: options.yes ?? false,
      execute: options.execute ?? true,
      maxTokens: options.maxTokens ?? cfg.maxTokens,
      contextDepth: options.contextDepth ?? cfg.contextDepth,
    };
    if (getAutoConfirm()) this.options.yes = true;

    this.contextWindow = new ContextWindow({
      maxTokens: cfg.contextWindow,
      warningThreshold: cfg.tokenWarningThreshold,
      compactThreshold: cfg.tokenCompactThreshold,
      preserveTailMessages: cfg.contextPreserveMessages,
    });
  }

  cancel(): void {
    this.cancelled = true;
  }

  resetCancellation(): void {
    this.cancelled = false;
    this.paused = false;
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
    try {
      await this.runLoop();
    } finally {
      uiEvents.setPhase('idle');
    }
  }

  private async runLoop(): Promise<void> {
    const silentTools = new Set(['list_directory']);
    let iterations = 0;

    while (true) {
      if (this.cancelled) {
        throw new Error('Interruption : exécution annulée par l\'utilisateur.');
      }
      if (this.paused) {
        return;
      }
      iterations++;

      if (iterations > 120) {
        throw new Error("Nombre maximum d'itérations (120) dépassé. Arrêt de sécurité.");
      }

      // CHECK FENETRE DE CONTEXTE
      const check = this.contextWindow.check(this.messages);
      if (check.action === 'warn') {
        const pct = Math.round(
          (this.contextWindow.getStats(this.messages).totalTokens /
            this.contextWindow.getStats(this.messages).maxTokens) *
            100
        );
        process.stdout.write(
          chalk.hex(theme.muted)(`\n  · contexte à ${pct}% — compaction prochaine si nécessaire\n`)
        );
      }
      if (check.action === 'compact') {
        const beforeStats = this.contextWindow.getStats(this.messages);
        this.messages = this.contextWindow.compact(this.messages);
        const afterStats = this.contextWindow.getStats(this.messages);
        if (afterStats.totalTokens < beforeStats.totalTokens) {
          const savedTokens = beforeStats.totalTokens - afterStats.totalTokens;
          process.stdout.write(
            chalk.hex(theme.muted)(
              `\n  · contexte compressé${savedTokens > 0 ? ` (−${savedTokens.toLocaleString()} tk)` : ''}\n`
            )
          );
        }
      }

      uiEvents.setPhase('thinking');

      try {
        // Dynamic Context Refresh: Keep system prompt (git status, active track, project map) 100% fresh in every turn
        if (this.messages.length > 0 && this.messages[0].role === 'system') {
          try {
            const freshSystemPrompt = await ContextBuilder.buildSystemPrompt(this.options);
            this.messages[0].content = freshSystemPrompt;
          } catch (_err) {
            // Fallback silently if system prompt build fails
          }
        }

        const response = await this.client!.chat(this.messages, this.options);

        this.totalTokensUsed += response.usage.totalTokens;
        this.totalCostFcfa += response.usage.costFcfa;

        if (response.finishReason === 'tool_calls' && response.toolCalls.length > 0) {
          this.pushAssistantToolCalls(response);
          // Pas de monologue avant les outils — évite la duplication avec les lignes ✓ Read(...)
          for (const toolCall of response.toolCalls) {
            if (this.cancelled || this.paused) {
              break;
            }
            const isSilent = silentTools.has(toolCall.name);
            await this.handleToolCall(toolCall, isSilent);
          }
          if (this.paused) {
            break;
          }
          // MAJ STATUS BAR APRES TOOLS
          continue;
        }

        if (response.content) {
          this.messages.push({ role: 'assistant', content: response.content });
          showResponse(response.content);
        }

        // MAJ STATUS BAR A LA FIN
        break;
      } catch (error) {
        uiEvents.setPhase('idle');
        const imaraErr = fromUnknown(error);
        const userMessage = sanitizeErrorMessage(imaraErr.message);
        process.stdout.write(chalk.hex(theme.error)(`\n  ✗ ${userMessage}\n`));
        throw new Error(userMessage);
      }
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

  private getTargetFilePath(name: string, args: ToolArguments): string | undefined {
    if (args && typeof args.path === 'string') {
      try {
        return path.resolve(process.cwd(), args.path);
      } catch {
        return undefined;
      }
    }
    if (name === 'read_multiple_files' && args && Array.isArray(args.paths)) {
      try {
        return args.paths.length > 0 && typeof args.paths[0] === 'string'
          ? path.resolve(process.cwd(), args.paths[0])
          : undefined;
      } catch {
        return undefined;
      }
    }
    return undefined;
  }

  private detectCallCycle(signatures: string[]): boolean {
    const n = signatures.length;
    for (let k = 1; k <= 4; k++) {
      if (n < 3 * k) continue;
      let isCycle = true;
      const seq1 = signatures.slice(n - k);
      for (let rep = 1; rep < 3; rep++) {
        const seqStart = n - (rep + 1) * k;
        const seqCurrent = signatures.slice(seqStart, seqStart + k);
        for (let i = 0; i < k; i++) {
          if (seq1[i] !== seqCurrent[i]) {
            isCycle = false;
            break;
          }
        }
        if (!isCycle) break;
      }
      if (isCycle) return true;
    }
    return false;
  }

  private detectRepeatingFileModifications(history: any[]): boolean {
    const modifyingTools = new Set(['write_file', 'append_file', 'replace_in_file']);
    const modCounts: Record<string, number> = {};
    for (const record of history) {
      if (modifyingTools.has(record.name) && record.targetFile) {
        modCounts[record.targetFile] = (modCounts[record.targetFile] || 0) + 1;
        if (modCounts[record.targetFile] >= 4) {
          return true;
        }
      }
    }
    return false;
  }

  private detectLoop(name: string, args: ToolArguments): { isLoop: boolean; reason: string } {
    const newRecord = {
      name,
      args,
      argsStr: JSON.stringify(args),
      targetFile: this.getTargetFilePath(name, args),
      timestamp: Date.now()
    };
    
    const tempHistory = [...this.richToolCallHistory, newRecord];
    if (tempHistory.length > 10) tempHistory.shift();

    // 1. Check for repeating call cycles
    const signatures = tempHistory.map(tc => `${tc.name}:${tc.argsStr}`);
    if (this.detectCallCycle(signatures)) {
      return { isLoop: true, reason: `Répétition cyclique de l'action "${name}"` };
    }

    // 2. Check for repeating file modifications
    if (this.detectRepeatingFileModifications(tempHistory)) {
      const filename = newRecord.targetFile ? path.basename(newRecord.targetFile) : 'inconnu';
      return { isLoop: true, reason: `Modifications répétées du fichier "${filename}"` };
    }

    return { isLoop: false, reason: '' };
  }

  private async handleToolCall(toolCall: ParsedToolCall, isSilent: boolean): Promise<void> {
    if (this.cancelled || this.paused) {
      throw new Error('Interruption : exécution annulée par l\'utilisateur.');
    }
    const { id, name, arguments: args } = toolCall;
    const argsStr = JSON.stringify(args);

    // Record the current tool call in rich history silently
    this.richToolCallHistory.push({
      name,
      args,
      argsStr,
      targetFile: this.getTargetFilePath(name, args),
      timestamp: Date.now()
    });
    if (this.richToolCallHistory.length > 10) this.richToolCallHistory.shift();

    if (!isSilent) startToolCallSpinner(name, args);

    if (this.isDangerousTool(name) && !this.options.yes) {
      stopToolCallSpinner();
      const choice = await confirmDangerousTool(name, args);
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
