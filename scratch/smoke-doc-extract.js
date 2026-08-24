// Smoke test temporaire : pdf-parse 2.x + mammoth depuis imara-cli
const fs = require('fs');
const path = require('path');

function buildMinimalPdf(text) {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    null, // stream rempli apres
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  const stream = `BT /F1 24 Tf 72 720 Td (${text}) Tj ET`;
  objects[3] = `<< /Length ${Buffer.byteLength(stream, 'ascii')} >>\nstream\n${stream}\nendstream`;
  let pdf = '%PDF-1.4\n';
  const offsets = [];
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

(async () => {
  // 1. PDF
  const pdfBuf = buildMinimalPdf('Hello Imara from minimal PDF');
  fs.writeFileSync(path.join(__dirname, 'smoke-test.pdf'), pdfBuf);
  const { PDFParse } = require('pdf-parse');
  const parser = new PDFParse({ data: pdfBuf });
  const result = await parser.getText();
  console.log('PDF text:', JSON.stringify(result.text.trim()));
  const info = await parser.getInfo({ parsePageInfo: true });
  console.log('PDF pages:', info.total);
  await parser.destroy();
  console.log('pdf-parse OK');

  // 2. DOCX via mammoth (mini zip store)
  const { extractRawText } = require('mammoth');
  const crcTable = (() => {
    const t = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c;
    }
    return t;
  })();
  function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }
  const docXml = Buffer.from('<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Hello Imara from DOCX</w:t></w:r></w:p></w:body></w:document>', 'utf8');
  const name = Buffer.from('word/document.xml', 'utf8');
  const crc = crc32(docXml);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4); // version
  local.writeUInt16LE(0, 6); // flags
  local.writeUInt16LE(0, 8); // method store
  local.writeUInt16LE(0, 10); // time
  local.writeUInt16LE(0x21, 12); // date 1980-01-01
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
  const offset = 30 + name.length + docXml.length;
  central.writeUInt32LE(0, 42); // local header offset = 0 (debut du zip)
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(46 + name.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  const docxBuf = Buffer.concat([local, name, docXml, central, name, end]);
  fs.writeFileSync(path.join(__dirname, 'smoke-test.docx'), docxBuf);
  const r = await extractRawText({ buffer: docxBuf });
  console.log('DOCX text:', JSON.stringify(r.value.trim()));
  console.log('mammoth OK');
})().catch((e) => { console.error('SMOKE FAIL:', e); process.exit(1); });
