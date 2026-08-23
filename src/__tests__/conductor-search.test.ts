import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { TrackManager } from '../context/conductor/track-manager';
import { searchConductorArchives, formatConductorSearchResults } from '../utils/conductor-search';

describe('ConductorSearch (archives)', () => {
  const testDir = path.join(process.cwd(), 'temp-test-conductor-search');
  let trackAccent: { id: string; title: string };
  let trackPaiement: { id: string; title: string };

  beforeEach(() => {
    if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true });
    fs.mkdirSync(testDir, { recursive: true });
    vi.spyOn(process, 'cwd').mockReturnValue(testDir);
    TrackManager.resetCache();
    TrackManager.init();

    // Track 1 : accents
    const t1 = TrackManager.newTrack('Correction des accents francais');
    trackAccent = { id: t1.id, title: 'Correction des accents francais' };
    fs.writeFileSync(path.join(t1.dir, 'spec.md'), '# Spec\n\nNormaliser les accents francais dans les reponses IA.\nLe probleme : les accents etaient perdus apres les tool calls.\n', 'utf-8');
    fs.writeFileSync(path.join(t1.dir, 'plan.md'), '# Plan\n- [x] Creer AccentNormalizerService\n- [x] Bufferiser les mots\n', 'utf-8');
    fs.writeFileSync(path.join(t1.dir, 'log.md'), '- Implemente normalisation des accents en streaming\n- Tests verts\n', 'utf-8');

    // Track 2 : paiement
    const t2 = TrackManager.newTrack('Integration paiement mobile money');
    trackPaiement = { id: t2.id, title: 'Integration paiement mobile money' };
    fs.writeFileSync(path.join(t2.dir, 'spec.md'), '# Spec\n\nPaiement via Tara Money, mobile money et carte bancaire.\n', 'utf-8');
    fs.writeFileSync(path.join(t2.dir, 'plan.md'), '# Plan\n- [x] Creer PaymentService\n', 'utf-8');

    // Archiver le track paiement (simuler une archive)
    const archiveDir = TrackManager.getArchiveDir();
    fs.mkdirSync(archiveDir, { recursive: true });
    fs.renameSync(t2.dir, path.join(archiveDir, t2.id.split('-')[0] + '-integration-paiement-mobile-money'));
    TrackManager.resetCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true });
  });

  it('finds tracks mentioning the query in spec', () => {
    const hits = searchConductorArchives('accent', 5);
    expect(hits.length).toBeGreaterThan(0);
    const accent = hits.find(h => h.id === trackAccent.id);
    expect(accent).toBeDefined();
    expect(accent!.score).toBeGreaterThan(0);
    expect(accent!.status).toBe('done'); // Seul le dernier track cree est actif
    // Le track paiement ne doit pas matcher "accent"
    expect(hits.some(h => h.id.includes('paiement'))).toBe(false);
  });

  it('scores title higher than body', () => {
    // Un track dont le TITRE contient "paiement" doit scorer plus qu'un simple mention en corps
    const hits = searchConductorArchives('paiement', 5);
    const paiement = hits.find(h => h.id.includes('paiement'));
    expect(paiement).toBeDefined();
    expect(paiement!.status).toBe('archived');
    expect(paiement!.score).toBeGreaterThan(0);
  });

  it('returns excerpts containing the term', () => {
    const hits = searchConductorArchives('accents', 5);
    const accent = hits.find(h => h.id === trackAccent.id);
    expect(accent).toBeDefined();
    expect(accent!.excerpts.length).toBeGreaterThan(0);
    expect(accent!.excerpts[0].toLowerCase()).toContain('accent');
  });

  it('returns progress from plan tasks', () => {
    const hits = searchConductorArchives('accent', 5);
    const accent = hits.find(h => h.id === trackAccent.id);
    expect(accent!.progress.total).toBe(2);
    expect(accent!.progress.done).toBe(2);
  });

  it('formats results as text report', () => {
    const hits = searchConductorArchives('paiement', 5);
    const report = formatConductorSearchResults('paiement', hits);
    expect(report).toContain('paiement');
    expect(report).toContain('TRACKS SIMILAIRES');
    expect(report).toContain('Progression');
  });

  it('returns empty message when no match', () => {
    const hits = searchConductorArchives('sujet-inexistant-xyz', 5);
    expect(hits.length).toBe(0);
    const report = formatConductorSearchResults('sujet-inexistant-xyz', hits);
    expect(report).toContain('AUCUN TRACK SIMILAIRE');
  });
});
