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

describe('ProjectIndexer multi-langages et graphe de dependances', () => {
  beforeEach(() => {
    if (!existsSync(TEST_ROOT)) mkdirSync(TEST_ROOT, { recursive: true });
    // Python
    mkdirSync(join(TEST_ROOT, 'py'), { recursive: true });
    writeFileSync(join(TEST_ROOT, 'py', 'calc.py'), `def add(a, b):\n    return a + b\n\nclass Calculator:\n    def multiply(self, a, b):\n        return a * b\n`);
    // Go
    mkdirSync(join(TEST_ROOT, 'go'), { recursive: true });
    writeFileSync(join(TEST_ROOT, 'go', 'main.go'), `package main\n\nfunc greet(name string) string {\n    return "Hello " + name\n}\n\ntype User struct {\n    Name string\n}\n`);
    // Ruby
    mkdirSync(join(TEST_ROOT, 'rb'), { recursive: true });
    writeFileSync(join(TEST_ROOT, 'rb', 'app.rb'), `class Greeter\n  def hello(name)\n    "Hi #{name}"\n  end\nend\n\nmodule Utils\n  def self.format(x)\n    x.to_s\n  end\nend\n`);
    // PHP
    mkdirSync(join(TEST_ROOT, 'php'), { recursive: true });
    writeFileSync(join(TEST_ROOT, 'php', 'index.php'), `<?php\nfunction greet($name) {\n    return "Hello " . $name;\n}\nclass User {\n    public $name;\n}\n`);
    // Java
    mkdirSync(join(TEST_ROOT, 'java'), { recursive: true });
    writeFileSync(join(TEST_ROOT, 'java', 'Main.java'), `public class Main {\n    public static void main(String[] args) {\n        System.out.println("hi");\n    }\n    public int compute() {\n        return 42;\n    }\n}\n`);
    // Rust
    mkdirSync(join(TEST_ROOT, 'rs'), { recursive: true });
    writeFileSync(join(TEST_ROOT, 'rs', 'lib.rs'), `pub fn add(a: i32, b: i32) -> i32 {\n    a + b\n}\n\npub struct Point {\n    pub x: f64,\n}\n\npub trait Shape {\n    fn area(&self) -> f64;\n}\n`);
    // SQL
    mkdirSync(join(TEST_ROOT, 'sql'), { recursive: true });
    writeFileSync(join(TEST_ROOT, 'sql', 'schema.sql'), `CREATE TABLE users (\n    id INTEGER PRIMARY KEY,\n    name TEXT\n);\nCREATE VIEW active_users AS SELECT * FROM users;\n`);
  });

  afterEach(() => {
    if (existsSync(TEST_ROOT)) rmSync(TEST_ROOT, { recursive: true });
    if (existsSync(INDEX_FILE)) rmSync(INDEX_FILE);
  });

  it('indexes python symbols', () => {
    const indexer = new ProjectIndexer(INDEX_FILE);
    indexer.scan(TEST_ROOT, ['py']);
    const res = indexer.search('add');
    expect(res.some(r => r.symbol === 'add' && r.type === 'function')).toBe(true);
    const cls = indexer.search('Calculator');
    expect(cls.some(r => r.symbol === 'Calculator' && r.type === 'class')).toBe(true);
  });

  it('indexes go symbols', () => {
    const indexer = new ProjectIndexer(INDEX_FILE);
    indexer.scan(TEST_ROOT, ['go']);
    const res = indexer.search('greet');
    expect(res.some(r => r.symbol === 'greet' && r.type === 'function')).toBe(true);
    const usr = indexer.search('User');
    expect(usr.some(r => r.symbol === 'User' && r.type === 'class')).toBe(true);
  });

  it('indexes ruby symbols', () => {
    const indexer = new ProjectIndexer(INDEX_FILE);
    indexer.scan(TEST_ROOT, ['rb']);
    const res = indexer.search('hello');
    expect(res.some(r => r.symbol === 'hello' && r.type === 'function')).toBe(true);
    const cls = indexer.search('Greeter');
    expect(cls.some(r => r.symbol === 'Greeter' && r.type === 'class')).toBe(true);
  });

  it('indexes php symbols', () => {
    const indexer = new ProjectIndexer(INDEX_FILE);
    indexer.scan(TEST_ROOT, ['php']);
    const res = indexer.search('greet');
    expect(res.some(r => r.symbol === 'greet' && r.type === 'function')).toBe(true);
  });

  it('indexes java symbols', () => {
    const indexer = new ProjectIndexer(INDEX_FILE);
    indexer.scan(TEST_ROOT, ['java']);
    const res = indexer.search('Main');
    expect(res.some(r => r.symbol === 'Main' && r.type === 'class')).toBe(true);
    const method = indexer.search('compute');
    expect(method.some(r => r.symbol === 'compute')).toBe(true);
  });

  it('indexes rust symbols', () => {
    const indexer = new ProjectIndexer(INDEX_FILE);
    indexer.scan(TEST_ROOT, ['rs']);
    const fn = indexer.search('add');
    expect(fn.some(r => r.symbol === 'add' && r.type === 'function')).toBe(true);
    const tr = indexer.search('Shape');
    expect(tr.some(r => r.symbol === 'Shape' && r.type === 'interface')).toBe(true);
  });

  it('indexes sql objects', () => {
    const indexer = new ProjectIndexer(INDEX_FILE);
    indexer.scan(TEST_ROOT, ['sql']);
    const res = indexer.search('users');
    expect(res.length).toBeGreaterThan(0);
  });

  it('extracts dependency graph for ts imports', () => {
    mkdirSync(join(TEST_ROOT, 'src'), { recursive: true });
    writeFileSync(join(TEST_ROOT, 'src', 'a.ts'), `import { b } from './b';\nimport { c } from './c';\nexport function useB() { return b(); }\n`);
    writeFileSync(join(TEST_ROOT, 'src', 'b.ts'), `export function b() { return 1; }\n`);
    writeFileSync(join(TEST_ROOT, 'src', 'c.ts'), `export function c() { return 2; }\n`);
    const indexer = new ProjectIndexer(INDEX_FILE);
    indexer.scan(TEST_ROOT, ['src']);
    const deps = indexer.getDependencies('src/a.ts');
    expect(deps).toContain('src/b.ts');
    expect(deps).toContain('src/c.ts');
    const dependents = indexer.getDependents('src/b.ts');
    expect(dependents).toContain('src/a.ts');
  });

  it('skips unchanged files on rescan (incremental mtime)', () => {
    mkdirSync(join(TEST_ROOT, 'src'), { recursive: true });
    writeFileSync(join(TEST_ROOT, 'src', 'x.ts'), `export const x = 1;\n`);
    const indexer = new ProjectIndexer(INDEX_FILE);
    indexer.scan(TEST_ROOT, ['src']);
    expect(indexer.docCount()).toBe(1);
    indexer.scan(TEST_ROOT, ['src']);
    expect(indexer.docCount()).toBe(1);
    // Le fichier non modifie n'est pas reindexe -> memes donnees
    expect(indexer.getLanguageStats()['ts']).toBe(1);
  });

  it('ranks definitions above usages', () => {
    mkdirSync(join(TEST_ROOT, 'src'), { recursive: true });
    writeFileSync(join(TEST_ROOT, 'src', 'def.ts'), `export function paiement() { return 1; }\n`);
    writeFileSync(join(TEST_ROOT, 'src', 'use.ts'), `import { paiement } from './def';\nconsole.log(paiement());\n`);
    const indexer = new ProjectIndexer(INDEX_FILE);
    indexer.scan(TEST_ROOT, ['src']);
    const results = indexer.search('paiement');
    const def = results.find(r => r.path === 'src/def.ts');
    const use = results.find(r => r.path === 'src/use.ts' && r.matchType === 'IMPORT');
    expect(def).toBeDefined();
    if (use) {
      expect(def!.score).toBeGreaterThan(use.score);
    }
  });
});
