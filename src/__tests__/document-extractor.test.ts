import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  detectDocumentKind,
  extractDocumentText,
  formatBinaryRefusal,
  formatDocumentOutput,
  getMaxDocChars,
  isPdfWithoutTextLayer,
  readFileHeader,
  truncateText,
  DOCUMENT_ERRORS,
  DEFAULT_MAX_DOC_CHARS,
} from '../utils/document-extractor';

// ── Builders de fixtures (PDF minimal + DOCX minimal) ──────────────────
function buildMinimalPdf(text: string, emptyPage = false): Buffer {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    null,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  const stream = emptyPage ? '' : `BT /F1 24 Tf 72 720 Td (${text}) Tj ET`;
  objects[3] = `<< /Length ${Buffer.byteLength(stream, 'ascii')} >>\nstream\n${stream}\nendstream`;
  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  for (let i = 0; i < objects.length; i++) {
    offsets.push(Buffer.byteLength(pdf, 'ascii'));
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(pdf, 'ascii');
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (const off of offsets) {
    pdf += `${String(off).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, 'ascii');
}

const crcTable = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function buildMinimalDocx(text: string): Buffer {
  const docXml = Buffer.from(
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    '<w:body><w:p><w:r><w:t>' + text + '</w:t></w:r></w:p></w:body></w:document>',
    'utf8'
  );
  const name = Buffer.from('word/document.xml', 'utf8');
  const crc = crc32(docXml);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0, 6);
  local.writeUInt16LE(0, 8);
  local.writeUInt16LE(0, 10);
  local.writeUInt16LE(0x21, 12);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(docXml.length, 18);
  local.writeUInt32LE(docXml.length, 22);
  local.writeUInt16LE(name.length, 26);
  local.writeUInt16LE(0, 28);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(0, 8);
  central.writeUInt16LE(0, 10);
  central.writeUInt16LE(0x21, 12);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(docXml.length, 20);
  central.writeUInt32LE(docXml.length, 24);
  central.writeUInt16LE(name.length, 28);
  central.writeUInt32LE(0, 42);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(46 + name.length, 12);
  end.writeUInt32LE(30 + name.length + docXml.length, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([local, name, docXml, central, name, end]);
}

// ── Fixtures persistees sur disque ─────────────────────────────────────
let tmpDir: string;
let pdfPath: string;
let pdfEmptyPath: string;
let docxPath: string;

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'imara-doc-'));
  pdfPath = path.join(tmpDir, 'sample.pdf');
  pdfEmptyPath = path.join(tmpDir, 'empty.pdf');
  docxPath = path.join(tmpDir, 'sample.docx');
  fs.writeFileSync(pdfPath, buildMinimalPdf('Hello Imara from PDF'));
  fs.writeFileSync(pdfEmptyPath, buildMinimalPdf('', true));
  fs.writeFileSync(docxPath, buildMinimalDocx('Hello Imara from DOCX'));
});

afterAll(() => {
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    // nettoyage best-effort
  }
});

describe('detectDocumentKind (magic bytes)', () => {
  it('detecte un PDF par la signature %PDF-', () => {
    expect(detectDocumentKind(Buffer.from('%PDF-1.7\n...'), '.pdf')).toBe('pdf');
  });
  it('detecte un DOCX par signature ZIP + entree word/document.xml', () => {
    const buf = buildMinimalDocx('test');
    expect(detectDocumentKind(buf, '.docx')).toBe('docx');
    expect(detectDocumentKind(buf, '.docx').startsWith('doc')).toBe(true);
  });
  it('detecte une archive ZIP non docx', () => {
    const zip = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0]);
    expect(detectDocumentKind(zip, '.zip')).toBe('zip');
  });
  it('detecte un DOC OLE2 ancien', () => {
    const ole = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0]);
    expect(detectDocumentKind(ole, '.doc')).toBe('doc');
  });
  it('classe un fichier texte comme text', () => {
    expect(detectDocumentKind(Buffer.from('const x = 1;\n// commentaire'), '.ts')).toBe('text');
  });
  it('classe un binaire avec octets NUL comme binary', () => {
    expect(detectDocumentKind(Buffer.from([0xff, 0x00, 0x01, 0x02]), '.bin')).toBe('binary');
  });
});

describe('truncateText et limites', () => {
  it('ne tronque pas sous la limite', () => {
    const r = truncateText('abc', 10);
    expect(r.text).toBe('abc');
    expect(r.truncated).toBe(false);
  });
  it('tronque au-dessus de la limite avec marqueur', () => {
    const r = truncateText('x'.repeat(100), 10);
    expect(r.text.length).toBeLessThan(100);
    expect(r.text).toContain('TRONQUE');
    expect(r.truncated).toBe(true);
  });
  it('limite par defaut a 150000 caracteres', () => {
    expect(getMaxDocChars()).toBe(DEFAULT_MAX_DOC_CHARS);
  });
});

describe('extraction PDF (pdf-parse v2)', () => {
  it('extrait le texte d un PDF minimal', async () => {
    const doc = await extractDocumentText(pdfPath);
    expect(doc.kind).toBe('pdf');
    expect(doc.text).toContain('Hello Imara from PDF');
    expect(doc.pages).toBe(1);
    expect(doc.sizeBytes).toBeGreaterThan(0);
  }, 20000);
  it('detecte un PDF sans couche texte (scanne)', async () => {
    const doc = await extractDocumentText(pdfEmptyPath);
    expect(isPdfWithoutTextLayer(doc.text)).toBe(true);
    const out = formatDocumentOutput(doc);
    expect(out).toContain('scanne');
  }, 20000);
  it('rejette un PDF corrompu avec une erreur (pas de crash)', async () => {
    const bad = path.join(tmpDir, 'bad.pdf');
    fs.writeFileSync(bad, Buffer.from('%PDF-1.4\nceci nest pas un pdf valide'));
    await expect(extractDocumentText(bad)).rejects.toThrow();
  }, 20000);
});

describe('extraction DOCX (mammoth)', () => {
  it('extrait le texte d un DOCX minimal', async () => {
    const doc = await extractDocumentText(docxPath);
    expect(doc.kind).toBe('docx');
    expect(doc.text).toContain('Hello Imara from DOCX');
  }, 20000);
});

describe('formatDocumentOutput', () => {
  it('produit un rapport avec type, taille et contenu', async () => {
    const doc = await extractDocumentText(pdfPath);
    const out = formatDocumentOutput(doc);
    expect(out).toContain('=== Document extrait :');
    expect(out).toContain('Type : PDF');
    expect(out).toContain('Pages : 1');
    expect(out).toContain('Hello Imara from PDF');
  }, 20000);
});

describe('formatBinaryRefusal', () => {
  it('oriente vers la conversion pour les .doc OLE', () => {
    const out = formatBinaryRefusal('doc', '/tmp/ancien.doc', 1024);
    expect(out).toContain('non lisible');
    expect(out).toContain('docx');
  });
  it('explique le binaire inconnu', () => {
    const out = formatBinaryRefusal('binary', '/tmp/autre.bin', 512);
    expect(out).toContain(DOCUMENT_ERRORS.BINARY);
  });
});

describe('readFileHeader', () => {
  it('ne lit que les premiers octets', () => {
    const p = path.join(tmpDir, 'header.txt');
    fs.writeFileSync(p, 'A'.repeat(5000));
    const header = readFileHeader(p, 512);
    expect(header.length).toBe(512);
    expect(header.toString()).toBe('A'.repeat(512));
  });
});
