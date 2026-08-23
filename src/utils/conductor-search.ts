import * as fs from 'fs';
import * as path from 'path';
import { TrackManager } from '../context/conductor/track-manager';

export interface TrackSearchHit {
  id: string;
  title: string;
  status: 'active' | 'done' | 'archived';
  date: string;
  score: number;
  excerpts: string[];
  progress: { done: number; total: number; percent: number };
}

const SOURCE_WEIGHTS: Record<string, number> = {
  title: 5,
  spec: 3,
  plan: 2,
  index: 1,
  log: 1,
};

// Cache en memoire par session (recree si le registre change)
let cache: { signature: string; docs: Map<string, TrackDoc> } | null = null;

interface TrackDoc {
  id: string;
  title: string;
  status: 'active' | 'done' | 'archived';
  date: string;
  spec: string;
  plan: string;
  index: string;
  log: string;
}

function computeSignature(): string {
  const tracks = TrackManager.list();
  let sig = `${tracks.length};`;
  for (const t of tracks.slice(0, 100)) {
    const meta = TrackManager.getTrackMeta(t);
    sig += `${t}:${meta?.updatedAt || ''};`;
  }
  return sig;
}

function loadAll(): Map<string, TrackDoc> {
  const signature = computeSignature();
  if (cache && cache.signature === signature) return cache.docs;
  const docs = new Map<string, TrackDoc>();
  const active = TrackManager.getActive();
  for (const id of TrackManager.list()) {
    const dir = TrackManager.resolveTrackDir(id);
    if (!dir) continue;
    const meta = TrackManager.getTrackMeta(id);
    const inArchive = fs.existsSync(path.join(TrackManager.getArchiveDir(), id));
    let status: TrackDoc['status'] = active?.id === id ? 'active' : (inArchive ? 'archived' : 'done');
    const read = (name: string): string => {
      const p = path.join(dir, name);
      if (!fs.existsSync(p)) return '';
      try { return fs.readFileSync(p, 'utf-8'); } catch { return ''; }
    };
    const logFull = read('log.md');
    const logTail = logFull.split('\n').slice(-30).join('\n');
    docs.set(id, {
      id,
      title: meta?.title || id,
      status,
      date: meta?.createdAt?.slice(0, 10) || '',
      spec: read('spec.md'),
      plan: read('plan.md'),
      index: read('index.md'),
      log: logTail,
    });
  }
  cache = { signature, docs };
  return docs;
}

function occurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  const lower = haystack.toLowerCase();
  let count = 0;
  let idx = 0;
  while ((idx = lower.indexOf(needle, idx)) !== -1) {
    count++;
    idx += needle.length;
  }
  return count;
}

function extractExcerpts(source: string, needle: string, max: number): string[] {
  const lower = source.toLowerCase();
  const excerpts: string[] = [];
  let idx = 0;
  while (excerpts.length < max) {
    idx = lower.indexOf(needle, idx);
    if (idx === -1) break;
    const start = Math.max(0, idx - 40);
    const end = Math.min(source.length, idx + needle.length + 60);
    let excerpt = source.slice(start, end).replace(/\s+/g, ' ').trim();
    if (start > 0) excerpt = '...' + excerpt;
    if (end < source.length) excerpt = excerpt + '...';
    excerpts.push(excerpt);
    idx += needle.length;
  }
  return excerpts;
}

export function searchConductorArchives(query: string, maxResults = 5): TrackSearchHit[] {
  const needle = query.toLowerCase().trim();
  if (!needle) return [];
  const docs = loadAll();
  const hits: TrackSearchHit[] = [];
  for (const doc of docs.values()) {
    const score =
      occurrences(doc.title, needle) * SOURCE_WEIGHTS.title +
      occurrences(doc.spec, needle) * SOURCE_WEIGHTS.spec +
      occurrences(doc.plan, needle) * SOURCE_WEIGHTS.plan +
      occurrences(doc.index, needle) * SOURCE_WEIGHTS.index +
      occurrences(doc.log, needle) * SOURCE_WEIGHTS.log;
    if (score <= 0) continue;
    // Normalisation par longueur du corpus (eviter que les gros tracks dominent)
    const corpusLength = doc.spec.length + doc.plan.length + doc.index.length + doc.log.length;
    const normalized = corpusLength > 0 ? score / Math.sqrt(corpusLength) : score;
    const excerpts: string[] = [];
    if (doc.title.toLowerCase().includes(needle)) {
      excerpts.push(...extractExcerpts(doc.title, needle, 1));
    }
    excerpts.push(...extractExcerpts(doc.spec, needle, 2));
    excerpts.push(...extractExcerpts(doc.plan, needle, 1));
    excerpts.push(...extractExcerpts(doc.index, needle, 1));
    hits.push({
      id: doc.id,
      title: doc.title,
      status: doc.status,
      date: doc.date,
      score: Math.round(normalized * 100) / 100,
      excerpts: Array.from(new Set(excerpts)).slice(0, 4),
      progress: TrackManager.computeProgress(doc.id),
    });
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, maxResults);
}

export function formatConductorSearchResults(query: string, hits: TrackSearchHit[]): string {
  if (hits.length === 0) {
    return `AUCUN TRACK SIMILAIRE TROUVE POUR : "${query}"\n\nAucun track (actif ou archive) ne mentionne ce sujet. Vous pouvez creer un nouveau track sans risque de duplication.`;
  }
  const statusIcon: Record<string, string> = { active: '🟢', done: '🟡', archived: '🔴' };
  let out = `TRACKS SIMILAIRES POUR : "${query}" (${hits.length} resultat(s))\n`;
  hits.forEach((h, i) => {
    const prog = h.progress.total > 0 ? `${h.progress.done}/${h.progress.total} (${h.progress.percent}%)` : 'n/a';
    out += `\n${i + 1}. ${statusIcon[h.status]} ${h.id} — ${h.title}\n`;
    out += `   Statut : ${h.status} | Date : ${h.date || 'inconnue'} | Score : ${h.score} | Progression : ${prog}\n`;
    for (const ex of h.excerpts) {
      out += `   Extrait : ${ex}\n`;
    }
  });
  return out;
}
