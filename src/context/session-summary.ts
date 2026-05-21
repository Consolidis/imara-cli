import { Message } from '../agent/agent.types';

export type Intention =
  | 'creation'
  | 'correction'
  | 'optimisation'
  | 'question'
  | 'suppression'
  | 'refactor'
  | 'test'
  | 'autre';

export type Status = 'reussi' | 'bloque' | 'en_cours';

interface ExchangeGroup {
  intention: Intention;
  topic: string;
  status: Status;
}

const INTENTION_KEYWORDS: Record<Intention, RegExp[]> = {
  creation: [/\b(cre|cré|ajoute?|ajout|impl[eé]mente|g[eé]n[eèè]re|crée|créer|nouveau?|build)\b/i],
  correction: [/\b(corrige?|fixe?|r[eé]pare|r[eé]solu|bug|erreur|probl[eèè]me|patch|restaure)\b/i],
  optimisation: [/\b(optimise?|am[eé]liore?|perf|acc[eé]l[eèè]re|r[eé]duit|compression|cache|memoize)\b/i],
  question: [/\b(comment|pourquoi|quand|ou|o[uù]|quel|quelle|explique|aide)\b/i],
  suppression: [/\b(supprime?|retire|enl[eèè]ve|d[eé]truit|delete|remove|drop)\b/i],
  refactor: [/\b(refactor|extrait|s[eé]pare|d[eé]place|renomme|restructure|modularise)\b/i],
  test: [/\b(test|verifie|v[eé]rifie|valide|spec|mock|assert|coverage)\b/i],
  autre: [/\b(voici|montre|liste|affiche|donne)\b/i],
};

const STATUS_KEYWORDS: Record<Status, RegExp[]> = {
  reussi: [/\b(fait|termin[eé]|r[eé]ussi|cr[eé][eé]|ajout[eé]|corrig[eé]|supprim[eé]|optimis[eé]|ok|parfait|enregistr[eé])\b/i],
  bloque: [/\b(erreur|bloqu[eé]|impossible|[eé]chou[eé]|fail|abort|refus[eé]|401|403|404|500|refuse|annul[eé])\b/i],
  en_cours: [],
};

const CONSTRAINT_PATTERNS = [
  /\b(ne\s+pas|n'?apas|jamais|toujours|obligatoire|imp[eé]ratif|strictement|uniquement|exclusivement)\b[^.!?]{0,80}/gi,
  /\b(il\s+faut|tu\s+dois|vous\s+devez|garder|conserver|pr[eé]server)\b[^.!?]{0,80}/gi,
];

const FILE_PATH_PATTERN = /(?:^|\s)([\w./\\-]+\.(?:ts|tsx|js|jsx|json|md|css|html|py|go|rs|vue|yml|yaml))\b/gi;
const FILE_TOOLS = new Set([
  'read_file', 'read_file_range', 'write_file', 'append_file', 'replace_in_file',
  'inspect_file', 'code_map', 'smart_read', 'read_multiple_files',
]);

const TOOL_RESULT_TOKEN_THRESHOLD = 8000;
const MAX_TOPIC_LEN = 120;
const MAX_THEMES = 8;
const MAX_FILES = 12;
const MAX_CONSTRAINTS = 6;

function quickTokenEstimate(text: string): number {
  return Math.ceil(text.length / 4);
}

export class SessionSummary {
  static summarize(messages: Message[]): string {
    if (!messages || messages.length === 0) {
      return 'Aucun echange precedent.';
    }

    const groups = this.groupByIntention(messages);
    const files = this.extractTouchedFiles(messages);
    const constraints = this.extractUserConstraints(messages);

    const parts: string[] = [];

    if (groups.length > 0) {
      parts.push(this.buildParagraph(groups));
    } else {
      parts.push('Echanges techniques precedents.');
    }

    if (constraints.length > 0) {
      parts.push(`Consignes utilisateur a respecter : ${constraints.join(' | ')}`);
    }

    if (files.length > 0) {
      parts.push(`Fichiers deja consultes ou modifies : ${files.join(', ')}`);
    }

    return parts.join('. ') + '.';
  }

  private static groupByIntention(messages: Message[]): ExchangeGroup[] {
    const groups: ExchangeGroup[] = [];
    let currentIntention: Intention = 'autre';
    let currentTopic = '';
    let latestStatus: Status = 'en_cours';

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      if (msg.role === 'system') continue;
      if (msg.role === 'tool' && quickTokenEstimate(msg.content) > TOOL_RESULT_TOKEN_THRESHOLD) continue;

      if (msg.role === 'user') {
        currentIntention = this.detectIntention(msg.content);
        currentTopic = this.extractTopic(msg.content);
        latestStatus = 'en_cours';
      } else if (msg.role === 'assistant') {
        const detected = this.detectStatus(msg.content);
        if (detected !== 'en_cours') latestStatus = detected;
      } else if (msg.role === 'tool') {
        const detected = this.detectStatus(msg.content);
        if (detected !== 'en_cours') latestStatus = detected;
      }

      const nextIsNewExchange = i + 1 < messages.length && messages[i + 1].role === 'user';
      const isLast = i === messages.length - 1;
      if ((nextIsNewExchange || isLast) && currentTopic) {
        groups.push({
          intention: currentIntention,
          topic: currentTopic,
          status: latestStatus,
        });
      }
    }

    return this.dedupeGroups(groups);
  }

  private static extractTouchedFiles(messages: Message[]): string[] {
    const seen = new Set<string>();

    for (const msg of messages) {
      if (msg.role === 'tool' && msg.name && FILE_TOOLS.has(msg.name)) {
        const fromContent = this.extractPathsFromText(msg.content);
        for (const p of fromContent) seen.add(p);
      }
      if (msg.role === 'assistant' && msg.tool_calls) {
        for (const tc of msg.tool_calls) {
          try {
            const args = JSON.parse(tc.function.arguments) as Record<string, unknown>;
            if (typeof args.path === 'string') seen.add(args.path.replace(/\\/g, '/'));
            if (Array.isArray(args.paths)) {
              for (const p of args.paths) {
                if (typeof p === 'string') seen.add(p.replace(/\\/g, '/'));
              }
            }
          } catch {
            // ignore malformed tool args
          }
        }
      }
      if (msg.role === 'user' || msg.role === 'assistant') {
        for (const p of this.extractPathsFromText(msg.content)) seen.add(p);
      }
    }

    return [...seen].slice(0, MAX_FILES);
  }

  private static extractPathsFromText(text: string): string[] {
    const paths: string[] = [];
    let match: RegExpExecArray | null;
    const re = new RegExp(FILE_PATH_PATTERN.source, FILE_PATH_PATTERN.flags);
    while ((match = re.exec(text)) !== null) {
      const p = match[1].replace(/\\/g, '/');
      if (p.length > 3 && !p.startsWith('http')) paths.push(p);
    }
    return paths;
  }

  private static extractUserConstraints(messages: Message[]): string[] {
    const constraints: string[] = [];
    const seen = new Set<string>();

    for (const msg of messages) {
      if (msg.role !== 'user') continue;
      for (const pattern of CONSTRAINT_PATTERNS) {
        const re = new RegExp(pattern.source, pattern.flags);
        let match: RegExpExecArray | null;
        while ((match = re.exec(msg.content)) !== null) {
          const snippet = match[0].replace(/\s+/g, ' ').trim().substring(0, 100);
          if (snippet.length > 12 && !seen.has(snippet)) {
            seen.add(snippet);
            constraints.push(snippet);
          }
        }
      }
    }

    return constraints.slice(0, MAX_CONSTRAINTS);
  }

  private static detectIntention(content: string): Intention {
    for (const [intent, patterns] of Object.entries(INTENTION_KEYWORDS) as [Intention, RegExp[]][]) {
      if (patterns.some(p => p.test(content))) return intent;
    }
    return 'autre';
  }

  private static detectStatus(content: string): Status {
    if (STATUS_KEYWORDS.bloque.some(p => p.test(content))) return 'bloque';
    if (STATUS_KEYWORDS.reussi.some(p => p.test(content))) return 'reussi';
    return 'en_cours';
  }

  private static extractTopic(content: string): string {
    const cleaned = content
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`[^`]+`/g, '')
      .trim();
    const sentences = cleaned.split(/[.!?]/).map(s => s.trim()).filter(s => s.length > 5);
    const first = sentences[0] || cleaned;
    const topic = first.substring(0, MAX_TOPIC_LEN).trim();
    return topic.endsWith('...') ? topic : topic + (first.length > MAX_TOPIC_LEN ? '...' : '');
  }

  private static dedupeGroups(groups: ExchangeGroup[]): ExchangeGroup[] {
    const deduped: ExchangeGroup[] = [];
    for (const g of groups) {
      const last = deduped[deduped.length - 1];
      if (last && last.intention === g.intention && last.topic === g.topic) {
        last.status = g.status === 'bloque' ? 'bloque' : g.status;
      } else {
        deduped.push({ ...g });
      }
    }
    return deduped;
  }

  private static buildParagraph(groups: ExchangeGroup[]): string {
    if (groups.length === 1) {
      const g = groups[0];
      return `${g.intention}: ${g.topic} (${g.status})`;
    }

    const parts: string[] = [];
    parts.push(`${groups.length} echanges precedents`);
    const themes = groups.slice(0, MAX_THEMES).map(g => `${g.intention}:${g.topic}`).join(' | ');
    if (themes) parts.push(`Themes : ${themes}`);

    const intentionCounts: Partial<Record<Intention, number>> = {};
    for (const g of groups) {
      intentionCounts[g.intention] = (intentionCounts[g.intention] || 0) + 1;
    }
    const stats = Object.entries(intentionCounts)
      .map(([k, v]) => `${k}(${v})`)
      .join(' ; ');
    if (stats) parts.push(`Repartition : ${stats}`);

    return parts.join('. ');
  }
}
