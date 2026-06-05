declare module 'duckduckgo-search' {
  export interface SearchResult {
    title: string;
    description: string;
    url: string;
  }

  export function search(query: string): AsyncGenerator<SearchResult, void, undefined>;
  export function text(query: string): Promise<SearchResult[]>;
}
