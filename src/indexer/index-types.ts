export interface IndexedDocument {
  path: string;
  content: string;
  lastModified: number;
  symbols: SymbolEntry[];
  dependencies: string[];
}

export interface SymbolEntry {
  name: string;
  type: 'function' | 'class' | 'interface' | 'variable' | 'import' | 'other';
  line: number;
  column: number;
}

export type MatchType = 'DEFINITION' | 'USAGE' | 'IMPORT' | 'TEXTE';

export interface SearchResult {
  path: string;
  line: number;
  symbol?: string;
  type?: string;
  score: number;
  matchType?: MatchType;
}

export interface InvertedIndex {
  [term: string]: Array<{ path: string; line: number; symbol?: string }>;
}
