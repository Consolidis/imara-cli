import { ToolDefinition } from '../agent.types';
import { getApiUrl, getApiKey } from '../../utils/env';

interface SearchResult {
  title: string;
  description: string;
  url: string;
}

export class WebSearchTool {
  static definition: ToolDefinition = {
    name: 'web_search',
    description: 'Recherche des informations sur le web (mode search) ou analyse le design visuel d\'un site (mode design). Utilise l\'API Imara pour la recherche et le fetch direct pour l\'extraction.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'La requete de recherche (obligatoire en mode search, ignoré en mode design)'
        },
        url: {
          type: 'string',
          description: 'URL d\'un site web. En mode search : extrait le contenu textuel. En mode design : analyse le CSS, couleurs, polices, frameworks.'
        },
        mode: {
          type: 'string',
          enum: ['search', 'design'],
          description: "Mode d'analyse : 'search' (defaut) pour rechercher ou extraire du texte, 'design' pour analyser l'apparence (couleurs, polices, framework CSS)",
          default: 'search'
        },
        max_results: {
          type: 'number',
          description: 'Nombre maximum de resultats a retourner (defaut: 5, max: 10)',
          default: 5
        }
      },
      required: []
    }
  };

  static async run(args: { query?: string; url?: string; mode?: string; max_results?: number }): Promise<string> {
    const mode = args.mode || 'search';

    // Mode design : analyse visuelle d'une URL
    if (mode === 'design') {
      if (!args.url) {
        throw new Error('Le mode design necessite une URL. Fournissez le parametre "url".');
      }
      return await this.analyzeDesign(args.url);
    }

    // Mode search avec URL : extraction de contenu textuel
    if (args.url && !args.query) {
      return await this.extractPage(args.url);
    }

    // Mode search standard : recherche via API Imara
    const query = (args.query || '').trim();
    if (!query) {
      throw new Error('La requete de recherche est vide. Fournissez une query ou une url.');
    }
    const maxResults = Math.min(args.max_results || 5, 10);
    const results = await this.searchImara(query, maxResults);
    return this.formatResults(results, query);
  }

  // ── MODE SEARCH ─────────────────────────────────────────────────────────

  private static async searchImara(query: string, maxResults: number): Promise<SearchResult[]> {
    const baseUrl = getApiUrl();
    const apiKey = getApiKey();
    if (!apiKey) {
      throw new Error('Aucune cle API Imara trouvee. Lancez `imara login`.');
    }
    const response = await fetch(`${baseUrl}/v1/agent/search`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query, max_results: maxResults })
    });
    if (!response.ok) {
      if (response.status === 401) throw new Error('Cle API Imara invalide ou expiree. Relancez `imara login`.');
      if (response.status === 402) throw new Error('Credits insuffisants pour la recherche web. Rechargez sur imara.consolidis.com.');
      throw new Error(`API Imara a retourne une erreur (code ${response.status})`);
    }
    const data = await response.json() as { results?: SearchResult[] };
    if (!data || !Array.isArray(data.results) || data.results.length === 0) {
      throw new Error(`Aucun resultat trouve pour "${query}" sur l'API Imara.`);
    }
    return data.results;
  }
  // ── MODE SEARCH : Extraction de page ────────────────────────────────────

  private static async extractPage(url: string): Promise<string> {
    const parsedUrl = this.parseUrl(url);
    const response = await this.fetchPage(parsedUrl.toString());
    const html = await response.text();
    const text = this.htmlToText(html);
    const MAX_CHARS = 8000;
    const truncated = text.length > MAX_CHARS
      ? text.substring(0, MAX_CHARS) + '\n\n[... Contenu tronque a 8000 caracteres. Lisez la page originale pour la suite.]'
      : text;
    return `Contenu extrait de : ${url}\n\n${truncated}`;
  }

  private static htmlToText(html: string): string {
    let text = html;
    text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    text = text.replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '');
    text = text.replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '');
    text = text.replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '');
    text = text.replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '');
    text = text.replace(/<br\s*\/?>/gi, '\n');
    text = text.replace(/<\/(p|div|li|h[1-6]|tr|blockquote|pre|section|article)>/gi, '\n');
    text = text.replace(/<li[^>]*>/gi, '  - ');
    text = text.replace(/<a[^>]*href=["'](https?:\/\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, '$2 ($1)');
    text = text.replace(/<[^>]+>/g, '');
    text = text.replace(/&nbsp;/g, ' ');
    text = text.replace(/&amp;/g, '&');
    text = text.replace(/&lt;/g, '<');
    text = text.replace(/&gt;/g, '>');
    text = text.replace(/&quot;/g, '"');
    text = text.replace(/&#39;/g, "'");
    text = text.replace(/&#x27;/g, "'");
    text = text.replace(/&#x2F;/g, '/');
    text = text.replace(/\t/g, ' ');
    text = text.replace(/[ \t]+/g, ' ');
    text = text.replace(/\n{3,}/g, '\n\n');
    return text.trim();
  }

  private static formatResults(results: SearchResult[], query: string): string {
    let output = `Recherche web (Imara) pour: "${query}"\n`;
    output += `\n${results.length} resultat(s) trouve(s):\n\n`;
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      output += `${i + 1}. ${r.title}\n`;
      if (r.description) {
        output += `   ${r.description.substring(0, 250)}${r.description.length > 250 ? '...' : ''}\n`;
      }
      output += `   URL: ${r.url}\n`;
      if (i < results.length - 1) output += '\n';
    }
    return output;
  }

  // ── Utilitaires de fetch ────────────────────────────────────────────────

  private static parseUrl(url: string): URL {
    let parsedUrl: URL;
    try { parsedUrl = new URL(url); } catch {
      throw new Error(`URL invalide : "${url}". Format attendu : https://exemple.com/page`);
    }
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error(`Protocole non supporte : "${parsedUrl.protocol}". Seuls HTTP et HTTPS sont acceptes.`);
    }
    return parsedUrl;
  }

  private static async fetchPage(url: string): Promise<Response> {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Imara-CLI/2.0; +https://imara.consolidis.com)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8'
      },
      signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) {
      throw new Error(`Impossible de charger la page (HTTP ${response.status})`);
    }
    return response;
  }
  // ═══════════════════════════════════════════════════════════════════════
  // MODE DESIGN
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Analyse le design d'une page web a partir de son HTML/CSS.
   * Extrait : frameworks, couleurs, polices, structure du DOM, breakpoints, meta.
   */
  private static async analyzeDesign(url: string): Promise<string> {
    const parsedUrl = this.parseUrl(url);
    const response = await this.fetchPage(parsedUrl.toString());
    const html = await response.text();

    const framework = this.detectFramework(html);
    const colors = this.extractColors(html);
    const fonts = this.extractFonts(html);
    const structure = this.extractStructure(html);
    const breakpoints = this.extractBreakpoints(html);
    const meta = this.extractMeta(html);
    const icons = this.extractIcons(html);

    let output = `Analyse design de : ${url}\n`;
    output += `─${'─'.repeat(50)}\n\n`;

    // Framework
    output += `FRAMEWORKS CSS\n`;
    if (framework.length > 0) {
      framework.forEach(f => output += `  - ${f}\n`);
    } else {
      output += `  (aucun framework majeur detecte)\n`;
    }

    // Couleurs
    output += `\nCOULEURS\n`;
    if (colors.length > 0) {
      // Grouper et dedupliquer (max 15 couleurs)
      const unique = [...new Set(colors)].slice(0, 15);
      unique.forEach(c => output += `  ${c}\n`);
    } else {
      output += `  (aucune couleur explicite detectee)\n`;
    }

    // Polices
    output += `\nPOLICES\n`;
    if (fonts.length > 0) {
      fonts.slice(0, 8).forEach(f => output += `  ${f}\n`);
    } else {
      output += `  (polices systeme par defaut)\n`;
    }

    // Structure
    output += `\nSTRUCTURE DU DOM\n`;
    output += structure;

    // Icons
    if (icons.length > 0) {
      output += `\nICONES\n`;
      icons.slice(0, 5).forEach(i => output += `  ${i}\n`);
    }

    // Breakpoints
    if (breakpoints.length > 0) {
      output += `\nBREAKPOINTS / MEDIA QUERIES\n`;
      breakpoints.slice(0, 8).forEach(b => output += `  ${b}\n`);
    }

    // Meta
    output += `\nMETA\n`;
    output += meta;

    return output;
  }

  // ── Detection Framework ─────────────────────────────────────────────────

  private static detectFramework(html: string): string[] {
    const frameworks: Array<{ name: string; patterns: RegExp[] }> = [
      { name: 'Tailwind CSS', patterns: [/tailwind/i, /cdn\.tailwindcss/i, /@tailwindcss/i] },
      { name: 'Bootstrap', patterns: [/bootstrap/i, /bootstrap\.(min\.)?css/, /bootstrap-native/i] },
      { name: 'Foundation', patterns: [/foundationcss/i, /foundation\.(min\.)?css/, /foundation-sites/i] },
      { name: 'Bulma', patterns: [/bulma/i, /cdn\.jsdelivr\.net\/npm\/bulma/i] },
      { name: 'Materialize CSS', patterns: [/materializecss/i, /materialize\.(min\.)?css/i] },
      { name: 'PureCSS', patterns: [/purecss/i, /yui\/pure/i] },
      { name: 'Uikit', patterns: [/uikit/i, /uikit\.(min\.)?css/i] },
      { name: 'Primer CSS (GitHub)', patterns: [/primercss/i, /@primer\/css/i] },
      { name: 'Chakra UI', patterns: [/@chakra-ui/i, /chakra-ui/i] },
      { name: 'MUI / Material UI', patterns: [/@mui/i, /material-ui/i] },
      { name: 'Ant Design', patterns: [/antd/i, /ant-design/i] },
      { name: 'Shadcn/ui', patterns: [/shadcn/i, /shadcn\/ui/i] },
      { name: 'Font Awesome', patterns: [/font-awesome/i, /fontawesome/i, /fa\.css/] },
    ];

    const detected: string[] = [];
    for (const fw of frameworks) {
      if (fw.patterns.some(p => p.test(html))) {
        if (!detected.includes(fw.name)) detected.push(fw.name);
      }
    }
    return detected;
  }
  // ── Extraction Couleurs ─────────────────────────────────────────────────

  private static extractColors(html: string): string[] {
    const colors: string[] = [];

    // Couleurs dans les balises <style> et <link rel="stylesheet">
    const styleBlocks = html.match(/<style[^>]*>[\s\S]*?<\/style>/gi) || [];
    const cssBlocks = html.match(/<link[^>]*rel=["']stylesheet["'][^>]*>/gi) || [];

    const allCSS = [
      ...styleBlocks.map(b => b.replace(/<\/?style[^>]*>/gi, '')),
    ].join('\n');

    // Regex pour les couleurs CSS
    const colorPatterns = [
      /(?:color|background[^-]|background-color|border-color|outline-color)\.*?\s*:\s*(#[0-9a-fA-F]{3,8}|rgba?\s*\([^)]+\)|hsla?\s*\([^)]+\))/g,
      /(?:background|background-image)\s*:\s*(?:linear-gradient|radial-gradient|conic-gradient)\([^)]*?(#[0-9a-fA-F]{3,8}|rgba?\s*\([^)]+\))/g,
    ];

    for (const pattern of colorPatterns) {
      const matches = allCSS.matchAll(pattern);
      for (const m of matches) {
        const color = m[1] || m[0];
        colors.push(color.trim());
      }
    }

    // Couleurs inline dans les attributs style
    const inlineStyles = html.match(/style=["'][^"']*["']/gi) || [];
    for (const style of inlineStyles) {
      const inlineColors = style.match(/(#[0-9a-fA-F]{3,8}|rgba?\s*\([^)]+\))/g);
      if (inlineColors) colors.push(...inlineColors);
    }

    // Classes utilitaires Tailwind (bg-*, text-*, border-*)
    const twColors = html.match(/(?:bg|text|border|from|via|to|ring|outline)-(?:red|blue|green|yellow|purple|pink|indigo|teal|orange|amber|lime|emerald|cyan|sky|violet|fuchsia|rose|stone|neutral|zinc|gray|slate)-\d{2,3}/gi);
    if (twColors) colors.push(...[...new Set(twColors)].slice(0, 20));

    return colors;
  }

  // ── Extraction Polices ──────────────────────────────────────────────────

  private static extractFonts(html: string): string[] {
    const fonts: string[] = [];

    // Google Fonts
    const gfLinks = html.match(/fonts\.googleapis\.com\/css2?\?[^"'&\s]+/gi) || [];
    for (const link of gfLinks) {
      const families = link.match(/family=([^&]+)/gi) || [];
      for (const f of families) {
        const names = decodeURIComponent(f.replace(/family=/i, ''))
          .split('|')
          .map(n => n.split(':')[0].replace(/\+/g, ' ').trim())
          .filter(n => n);
        fonts.push(...names);
      }
    }

    // Google Fonts via @import dans le CSS
    const gfImports = html.match(/@import\s+url\([^)]*fonts\.googleapis[^)]*\)/gi) || [];
    for (const imp of gfImports) {
      const families = imp.match(/family=([^&)]+)/gi) || [];
      for (const f of families) {
        const names = decodeURIComponent(f.replace(/family=/i, ''))
          .split('|')
          .map(n => n.split(':')[0].replace(/\+/g, ' ').trim())
          .filter(n => n);
        fonts.push(...names);
      }
    }

    // Polices declarees dans les styles (font-family)
    const fontDecls = html.match(/font-family\s*:\s*['"]?([^;"'}]+)['"]?/gi) || [];
    for (const decl of fontDecls) {
      const names = decl.replace(/font-family\s*:\s*/i, '')
        .split(',')
        .map(n => n.replace(/['"]/g, '').trim())
        .filter(n => n && !n.toLowerCase().includes('sans-serif') && !n.toLowerCase().includes('serif') && !n.toLowerCase().includes('monospace'));
      fonts.push(...names);
    }

    return [...new Set(fonts)];
  }
  // ── Extraction Structure ────────────────────────────────────────────────

  private static extractStructure(html: string): string {
    const tags: string[] = [];

    // Balises semantiques avec leur classe/id si presente
    const semanticPatterns = [
      /<header[^>]*>/gi, /<nav[^>]*>/gi, /<main[^>]*>/gi, /<footer[^>]*>/gi,
      /<aside[^>]*>/gi, /<section[^>]*>/gi, /<article[^>]*>/gi, /<figure[^>]*>/gi,
      /<form[^>]*>/gi, /<dialog[^>]*>/gi, /<details[^>]*>/gi,
      /<div[^>]*class=["'][^"']*container[^"']*["'][^>]*>/gi,
      /<div[^>]*class=["'][^"']*wrapper[^"']*["'][^>]*>/gi,
      /<div[^>]*class=["'][^"']*grid[^"']*["'][^>]*>/gi,
      /<div[^>]*class=["'][^"']*sidebar[^"']*["'][^>]*>/gi,
      /<div[^>]*class=["'][^"']*content[^"']*["'][^>]*>/gi,
      /<div[^>]*class=["'][^"']*hero[^"']*["'][^>]*>/gi,
      /<div[^>]*class=["'][^"']*banner[^"']*["'][^>]*>/gi,
      /<div[^>]*class=["'][^"']*card[^"']*["'][^>]*>/gi,
    ];

    for (const pattern of semanticPatterns) {
      const matches = html.match(pattern);
      if (matches) {
        for (const m of matches) {
          const tagName = m.match(/<\s*(\w+)/)?.[1] || '';
          const cls = m.match(/class=["']([^"']*)["']/)?.[1] || '';
          const id = m.match(/id=["']([^"']*)["']/)?.[1] || '';
          let label = `<${tagName}>`;
          if (id) label += ` #${id}`;
          if (cls) label += ` .${cls.split(/\s+/).filter(c => c).join('.')}`;
          if (!tags.includes(label)) tags.push(label);
        }
      }
    }

    // Niveaux de titres
    for (let i = 1; i <= 6; i++) {
      const hasH = new RegExp(`<h${i}[^>]*>`, 'gi').test(html);
      if (hasH) tags.push(`<h${i}> present`);
    }

    // Navigation bars
    if (/<ul[^>]*class=["'][^"']*nav[^"']*["']/gi.test(html)) tags.push('<ul.nav>');
    if (/navbar/i.test(html)) tags.push('navbar detectee');
    if (/menu/i.test(html)) tags.push('menu detecte');

    // Grid et layout
    if (/grid|flex/i.test(html)) {
      if (html.match(/grid-cols-\d+|grid-template-columns/i)) tags.push('CSS Grid (explicite)');
      if (html.match(/flex-(?:wrap|row|col)/i)) tags.push('Flexbox');
    }

    // Carousel / Slider
    if (/carousel|slider|swiper|slick/i.test(html)) tags.push('carousel/slider detecte');

    return tags.slice(0, 18).map(t => `  ${t}`).join('\n') || '  (structure basique)';
  }

  // ── Extraction Breakpoints ──────────────────────────────────────────────

  private static extractBreakpoints(html: string): string[] {
    const bps: string[] = [];

    // Media queries dans le HTML (style blocks et link)
    const styleBlocks = html.match(/<style[^>]*>[\s\S]*?<\/style>/gi) || [];
    for (const block of styleBlocks) {
      const mqs = block.match(/@media\s*\([^)]+\)\s*\{/gi);
      if (mqs) bps.push(...mqs);
    }

    // Breakpoints Tailwind dans les classes
    const twBps = html.match(/(?:sm|md|lg|xl|2xl):[a-zA-Z]+/g);
    if (twBps) bps.push(...[...new Set(twBps)].slice(0, 10));

    return [...new Set(bps)].slice(0, 8);
  }

  // ── Extraction Meta ─────────────────────────────────────────────────────

  private static extractMeta(html: string): string {
    const lines: string[] = [];

    // Viewport
    const vp = html.match(/<meta[^>]*name=["']viewport["'][^>]*>/i);
    if (vp) lines.push(`  Viewport: present`);

    // Description
    const desc = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i);
    if (desc) lines.push(`  Description: ${desc[1].substring(0, 80)}`);

    // Favicon
    const favicon = html.match(/<link[^>]*rel=["'](?:shortcut )?icon["'][^>]*href=["']([^"']*)["']/i);
    if (favicon) lines.push(`  Favicon: ${favicon[1]}`);

    // Title
    const title = html.match(/<title>([\s\S]*?)<\/title>/i);
    if (title) lines.push(`  Titre: ${title[1].trim().substring(0, 80)}`);

    // Langue
    const lang = html.match(/<html[^>]*lang=["']([^"']*)["']/i);
    if (lang) lines.push(`  Langue: ${lang[1]}`);

    // Theme-color
    const theme = html.match(/<meta[^>]*name=["']theme-color["'][^>]*content=["']([^"']*)["']/i);
    if (theme) lines.push(`  Theme-color: ${theme[1]}`);

    // Open Graph
    const ogTitle = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']*)["']/i);
    if (ogTitle) lines.push(`  OG: ${ogTitle[1].substring(0, 60)}`);

    return lines.join('\n') || '  (meta de base uniquement)';
  }

  // ── Extraction Icones ──────────────────────────────────────────────────

  private static extractIcons(html: string): string[] {
    const icons: string[] = [];

    // Font Awesome
    if (/font-awesome|fontawesome/i.test(html)) icons.push('Font Awesome');
    if (/fa-[a-z][a-z-]*/gi.test(html)) icons.push('Font Awesome (classes fa-*)');

    // Material Icons
    if (/material-icons/i.test(html)) icons.push('Material Icons');

    // Heroicons
    if (/heroicon/i.test(html)) icons.push('Heroicons');

    // Ionicons
    if (/ionicon/i.test(html)) icons.push('Ionicons');

    // Feather Icons
    if (/feather/i.test(html)) icons.push('Feather Icons');

    // Lucide
    if (/lucide/i.test(html)) icons.push('Lucide');

    // SVG inline
    if (/<svg[^>]*>[\s\S]*?<\/svg>/gi.test(html)) icons.push('SVG inline present');

    return [...new Set(icons)];
  }
}