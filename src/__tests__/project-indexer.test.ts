import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import { ProjectIndexer } from '../indexer/project-indexer';

const TEST_ROOT = join(process.cwd(), '.test-project');
const INDEX_FILE = join(process.cwd(), '.test-index.json');

describe('ProjectIndexer', () => {
  beforeEach(() => {
    if (!existsSync(TEST_ROOT)) mkdirSync(TEST_ROOT, { recursive: true });
    mkdirSync(join(TEST_ROOT, 'src'), { recursive: true });
    writeFileSync(join(TEST_ROOT, 'src', 'math.ts'), `export function add(a: number, b: number): number {\n  return a + b;\n}\nexport const PI = 3.14;\n`);
    writeFileSync(join(TEST_ROOT, 'src', 'utils.ts'), `export interface Logger {\n  log(msg: string): void;\n}\nexport class ConsoleLogger implements Logger {\n  log(msg: string) { console.log(msg); }\n}\n`);
  });

  afterEach(() => {
    if (existsSync(TEST_ROOT)) rmSync(TEST_ROOT, { recursive: true });
    if (existsSync(INDEX_FILE)) rmSync(INDEX_FILE);
  });

  it('indexes ts files', () => {
    const indexer = new ProjectIndexer(INDEX_FILE);
    indexer.scan(TEST_ROOT, ['src']);
    expect(indexer.docCount()).toBeGreaterThan(0);
    expect(indexer.termCount()).toBeGreaterThan(0);
  });

  it('finds exported function by name', () => {
    const indexer = new ProjectIndexer(INDEX_FILE);
    indexer.scan(TEST_ROOT, ['src']);
    const results = indexer.search('add');
    expect(results.length).toBeGreaterThan(0);
    expect(results.some(r => r.symbol === 'add')).toBe(true);
  });

  it('finds class by name', () => {
    const indexer = new ProjectIndexer(INDEX_FILE);
    indexer.scan(TEST_ROOT, ['src']);
    const results = indexer.search('ConsoleLogger');
    expect(results.some(r => r.symbol === 'ConsoleLogger')).toBe(true);
  });

  it('finds interface by name', () => {
    const indexer = new ProjectIndexer(INDEX_FILE);
    indexer.scan(TEST_ROOT, ['src']);
    const results = indexer.search('Logger');
    expect(results.some(r => r.symbol === 'Logger')).toBe(true);
  });

  it('persists and reloads index', () => {
    const indexer1 = new ProjectIndexer(INDEX_FILE);
    indexer1.scan(TEST_ROOT, ['src']);
    const indexer2 = new ProjectIndexer(INDEX_FILE);
    expect(indexer2.docCount()).toBeGreaterThan(0);
    expect(indexer2.search('add').length).toBeGreaterThan(0);
  });

  it('re-indexes only modified files', () => {
    const indexer = new ProjectIndexer(INDEX_FILE);
    indexer.scan(TEST_ROOT, ['src']);
    const before = indexer.docCount();
    indexer.scan(TEST_ROOT, ['src']);
    expect(indexer.docCount()).toBe(before);
  });

  it('search performance under 100ms for 1000 terms', () => {
    const indexer = new ProjectIndexer(INDEX_FILE);
    indexer.scan(TEST_ROOT, ['src']);
    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      indexer.search('add');
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(100);
  });
});
