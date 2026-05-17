export interface IndexedDocument {
  path: string;
  content: string;
  lastModified: number;
  symbols: SymbolEntry[];
}

export interface SymbolEntry {
  name: string;
  type: 'function' | 'class' | 'interface' | 'variable' | 'import' | 'other';
  line: number;
  column: number;
}

export interface SearchResult {
  path: string;
  line: number;
  symbol?: string;
  type?: string;
  score: number;
}

export interface InvertedIndex {
  [term: string]: Array<{ path: string; line: number; symbol?: string }>;
}
