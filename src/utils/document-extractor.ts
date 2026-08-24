import * as fs from 'fs';
import * as path from 'path';

export type DocumentKind = 'pdf' | 'docx' | 'doc' | 'zip' | 'binary' | 'text';

export interface ExtractedDocument {
  kind: 'pdf' | 'docx';
  text: string;
  pages?: number;
  truncated: boolean;
  maxChars: number;
  sizeBytes: number;
  relPath: string;
}

export const MAX_DOCUMENT_SIZE = 25 * 1024 * 1024; // 25 Mo
export const DEFAULT_MAX_DOC_CHARS = 150_000; // ~37 500 tokens cl100k

export const DOCUMENT_ERRORS = {
  OLE:
    "Fichier .doc (format Word ancien, binaire OLE2) non lisible en l'etat. " +
    "Convertissez le document en .docx ou .pdf (Word : Enregistrer sous -> .docx, ou Exporter en PDF), puis relisez-le.",
  BINARY:
    'Fichier binaire non reconnu (ni PDF, ni DOCX, ni texte). Extraction de texte impossible.',
  PASSWORD:
    'PDF protege par mot de passe. Deverrouillez le document puis relisez-le.',
  SCANNED:
    'PDF sans couche texte (document scanne ou image). Aucun texte extractible. ' +
    'L\'OCR n\'est pas inclus dans cette version.',
} as const;

/** Lit uniquement l'en-tete du fichier (par defaut 512 octets) sans charger tout le fichier. */
export function readFileHeader(filePath: string, bytes = 512): Buffer {
  const fd = fs.openSync(filePath, 'r');
  try {
    const buf = Buffer.alloc(bytes);
    const read = fs.readSync(fd, buf, 0, bytes, 0);
    return buf.subarray(0, read);
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * Detection du type par magic bytes (plus robuste que l'extension seule).
 * - PDF : %PDF-
 * - DOC OLE2/CFB : D0 CF 11 E0 A1 B1 1A E1
 * - DOCX : archive ZIP (PK) + entree word/document.xml (ou extension .docx)
 * - binaire : octets NUL dans les 4 premiers Ko
 * - sinon : texte
 */
export function detectDocumentKind(buffer: Buffer, extension?: string): DocumentKind {
  const len = buffer.length;
  // %PDF-
  if (
    len >= 5 &&
    buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 &&
    buffer[3] === 0x46 && buffer[4] === 0x2d
  ) {
    return 'pdf';
  }
  // D0 CF 11 E0 A1 B1 1A E1 (OLE2/CFB, .doc ancien)
  if (
    len >= 8 &&
    buffer[0] === 0xd0 && buffer[1] === 0xcf && buffer[2] === 0x11 && buffer[3] === 0xe0 &&
    buffer[4] === 0xa1 && buffer[5] === 0xb1 && buffer[6] === 0x1a && buffer[7] === 0xe1
  ) {
    return 'doc';
  }
  // PK (ZIP : DOCX, XLSX, PPTX, JAR, archives...)
  if (len >= 2 && buffer[0] === 0x50 && buffer[1] === 0x4b) {
    const ext = (extension || '').toLowerCase();
    const isDocxExt = ext === '.docx';
    const hasDocXml = buffer.includes(Buffer.from('word/document.xml'));
    return isDocxExt || hasDocXml ? 'docx' : 'zip';
  }
  // Heuristique binaire : octet NUL dans les 4 premiers Ko
  const scan = buffer.subarray(0, Math.min(len, 4096));
  if (scan.includes(0)) return 'binary';
  return 'text';
}

export function getMaxDocChars(): number {
  const raw = process.env.IMARA_MAX_DOC_CHARS;
  if (raw) {
    const n = parseInt(raw, 10);
    if (Number.isFinite(n) && n > 0) return Math.min(n, 2_000_000);
  }
  return DEFAULT_MAX_DOC_CHARS;
}

export function truncateText(text: string, maxChars: number): { text: string; truncated: boolean } {
  if (text.length <= maxChars) return { text, truncated: false };
  const head = text.slice(0, maxChars);
  const tail = `\n... [TRONQUE : texte complet de ${text.length} caracteres, limite ${maxChars}]`;
  return { text: head + tail, truncated: true };
}

/** pdf-parse 2.x : classe PDFParse (import dynamique CJS/ESM compatible). */
async function loadPdfParse(): Promise<{ PDFParse: new (opts: { data: Buffer }) => any }> {
  const mod: any = await import('pdf-parse');
  const PDFParse = mod.PDFParse ?? mod.default?.PDFParse;
  if (typeof PDFParse !== 'function') {
    throw new Error('Extraction PDF indisponible : module pdf-parse introuvable ou invalide (npm install pdf-parse).');
  }
  return { PDFParse };
}

const PAGE_SEPARATOR_RE = /^--\s*\d+\s+of\s+\d+\s*--$/;

function isPdfTextEmpty(text: string): boolean {
  const meaningful = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !PAGE_SEPARATOR_RE.test(l))
    .join('');
  return meaningful.length === 0;
}

async function extractPdf(buffer: Buffer): Promise<{ text: string; pages?: number }> {
  const { PDFParse } = await loadPdfParse();
  const parser = new PDFParse({ data: buffer });
  try {
    let text = '';
    try {
      const res = await parser.getText();
      text = typeof res?.text === 'string' ? res.text : '';
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/password/i.test(msg)) throw new Error(DOCUMENT_ERRORS.PASSWORD);
      throw err;
    }
    let pages: number | undefined;
    try {
      const info = await parser.getInfo({ parsePageInfo: true });
      if (info && typeof info.total === 'number') pages = info.total;
    } catch {
      // Metadonnees optionnelles : ne pas bloquer l'extraction
    }
    return { text, pages };
  } finally {
    try {
      await parser.destroy();
    } catch {
      // Liberation memoire best-effort
    }
  }
}

/** mammoth : extractRawText ({ buffer }) — import dynamique CJS/ESM compatible. */
async function extractDocx(buffer: Buffer): Promise<{ text: string }> {
  const mod: any = await import('mammoth');
  const mammoth = mod.mammoth ?? mod.default ?? mod;
  const extractRawText =
    typeof mammoth.extractRawText === 'function'
      ? mammoth.extractRawText
      : mammoth.default?.extractRawText;
  if (typeof extractRawText !== 'function') {
    throw new Error('Extraction DOCX indisponible : module mammoth introuvable ou invalide (npm install mammoth).');
  }
  const res = await extractRawText({ buffer });
  return { text: typeof res?.value === 'string' ? res.value : '' };
}

/**
 * Point d'entree principal : extrait le texte d'un PDF ou DOCX.
 * Le buffer peut etre fourni pour eviter une double lecture disque.
 */
export async function extractDocumentText(
  fullPath: string,
  buffer?: Buffer,
  opts?: { maxChars?: number }
): Promise<ExtractedDocument> {
  const buf = buffer ?? fs.readFileSync(fullPath);
  const kind = detectDocumentKind(buf, path.extname(fullPath));
  const maxChars = opts?.maxChars ?? getMaxDocChars();
  const sizeBytes = buf.length;
  const relPath = path.relative(process.cwd(), fullPath) || fullPath;

  if (kind === 'pdf') {
    const { text, pages } = await extractPdf(buf);
    const t = truncateText(text, maxChars);
    return { kind: 'pdf', text: t.text, pages, truncated: t.truncated, maxChars, sizeBytes, relPath };
  }
  if (kind === 'docx') {
    const { text } = await extractDocx(buf);
    const t = truncateText(text, maxChars);
    return { kind: 'docx', text: t.text, truncated: t.truncated, maxChars, sizeBytes, relPath };
  }
  throw new Error(`Type de document non supporte : ${kind}`);
}

/** Formate le resultat d'extraction pour read_file / read_multiple_files. */
export function formatDocumentOutput(doc: ExtractedDocument): string {
  const kindLabel = doc.kind === 'pdf' ? 'PDF' : 'Word (.docx)';
  const pages = doc.kind === 'pdf' && doc.pages !== undefined ? `\nPages : ${doc.pages}` : '';
  const trunc = doc.truncated ? ` (tronque a ${doc.maxChars} caracteres)` : '';
  const sizeKB = (doc.sizeBytes / 1024).toFixed(1);
  const noTextLayer =
    doc.kind === 'pdf' ? isPdfTextEmpty(doc.text) : doc.text.trim().length === 0;
  const empty = noTextLayer
    ? `\n\n${doc.kind === 'pdf' ? DOCUMENT_ERRORS.SCANNED : "Aucun texte extrait du document (document vide ou illisible)."}`
    : '';
  return [
    `=== Document extrait : ${doc.relPath} ===`,
    `Type : ${kindLabel}`,
    `Taille : ${sizeKB} Ko${pages}${trunc}`,
    `--- CONTENU ---`,
    doc.text,
    empty,
    `=== Fin du document ===`,
  ].join('\n');
}

/** Formate un refus propre pour les documents non extractibles (.doc OLE, ZIP inconnu, binaire). */
export function formatBinaryRefusal(kind: DocumentKind, fullPath: string, sizeBytes: number): string {
  const relPath = path.relative(process.cwd(), fullPath) || fullPath;
  const label =
    kind === 'pdf' ? 'PDF'
    : kind === 'docx' ? 'Word (.docx)'
    : kind === 'doc' ? 'Word (.doc, OLE2 binaire)'
    : kind === 'zip' ? 'Archive ZIP'
    : 'binaire';
  const msg =
    kind === 'doc' ? DOCUMENT_ERRORS.OLE
    : kind === 'pdf' ? DOCUMENT_ERRORS.SCANNED
    : DOCUMENT_ERRORS.BINARY;
  return [
    `=== Document non lisible : ${relPath} ===`,
    `Type : ${label}`,
    `Taille : ${(sizeBytes / 1024).toFixed(1)} Ko`,
    '',
    msg,
    '',
  ].join('\n');
}

/** Verifie si un PDF n'a pas de couche texte exploitable (seuls les separateurs de page). */
export function isPdfWithoutTextLayer(text: string): boolean {
  return isPdfTextEmpty(text);
}
