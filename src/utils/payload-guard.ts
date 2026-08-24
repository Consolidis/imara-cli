// Gestion intelligente du poids de payload réseau.
// Source unique de vérité pour les seuils (IMARA_PAYLOAD_WARN_KB / IMARA_PAYLOAD_MAX_KB),
// estimation de taille réelle, classification ok/warn/critical et auto-allègement
// (troncature ciblée des résultats d'outils les plus volumineux).
import { Message } from '../agent/agent.types';

// Marqueur inséré dans les résultats d'outils tronqués par l'allègement automatique.
export const TRUNCATION_MARKER = "RESULTAT D'OUTIL TRONQUE (allègement automatique)";

// Ratio de conservation : on garde 25% du début d'un résultat d'outil tronqué.
const KEEP_RATIO = 0.25;
// Garde-fou minimal pour ne pas réduire un résultat à une chaîne vide inexploitable.
const MIN_KEEP_CHARS = 400;

export interface PayloadThresholds {
  warnKB: number;
  maxKB: number;
}

export interface PayloadState {
  sizeKB: number;
  state: 'ok' | 'warn' | 'critical';
}

export interface ShrinkResult {
  messages: Message[];
  freedKB: number;
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n) || n <= 0) return fallback;
  return n;
}

/** Seuils configurables par variables d'environnement (défauts : 600 Ko / 1000 Ko). */
export function getPayloadThresholds(): PayloadThresholds {
  const warnKB = parsePositiveInt(process.env.IMARA_PAYLOAD_WARN_KB, 600);
  const maxKB = parsePositiveInt(process.env.IMARA_PAYLOAD_MAX_KB, 1000);
  // Invariant : le seuil d'alerte ne dépasse jamais le seuil critique.
  return { warnKB: Math.min(warnKB, maxKB), maxKB };
}

/** Taille réelle (Ko, 1 décimale) du payload JSON qui sera envoyé au réseau. */
export function estimatePayloadKB(messages: Message[]): number {
  if (messages.length === 0) return 0;
  let raw: number;
  try {
    const json = JSON.stringify(messages);
    raw = (json.length / 1024) * 10;
  } catch {
    // Fallback approximatif si JSON.stringify échoue (circularité improbable ici) :
    // somme des longueurs des contenus texte et tool_calls.
    let total = 0;
    for (const m of messages) {
      total += (m.content || '').length;
      if (m.tool_calls) {
        try {
          total += JSON.stringify(m.tool_calls).length;
        } catch {
          /* ignore */
        }
      }
    }
    raw = (total / 1024) * 10;
  }
  // Plancher : un payload non vide pèse toujours au moins 0.1 Ko (évite un 0
  // trompeur pour les très petits échanges avant comparaison aux seuils).
  return Math.max(0.1, Math.round(raw) / 10);
}

/** Classe le payload : ok (< warn), warn (warn..max), critical (> max). */
export function computePayloadState(messages: Message[]): PayloadState {
  const { warnKB, maxKB } = getPayloadThresholds();
  const sizeKB = estimatePayloadKB(messages);
  let state: PayloadState['state'] = 'ok';
  if (sizeKB > maxKB) {
    state = 'critical';
  } else if (sizeKB > warnKB) {
    state = 'warn';
  }
  return { sizeKB, state };
}

/** Conserve le début d'un contenu et ajoute le marqueur de troncature. */
function truncateContent(content: string): string {
  const maxKeep = Math.max(MIN_KEEP_CHARS, Math.floor(content.length * KEEP_RATIO));
  const kept = content.slice(0, maxKeep);
  const freedChars = content.length - kept.length;
  return `${kept}\n\n[... ${TRUNCATION_MARKER} — ${freedChars.toLocaleString()} caractères retirés]\n`;
}

/**
 * Allège le payload en tronquant les résultats d'outils (role 'tool') les plus
 * volumineux, en partant du plus gros, jusqu'à rentrer dans le budget demandé.
 * Conserve le début de chaque résultat + marqueur explicite.
 * Retourne les messages modifiés et le volume libéré en Ko.
 */
export function shrinkPayloadForBudget(messages: Message[], budgetKB: number): ShrinkResult {
  const cloned: Message[] = messages.map(m => ({ ...m }));
  const beforeKB = estimatePayloadKB(cloned);
  if (beforeKB <= budgetKB) {
    return { messages: cloned, freedKB: 0 };
  }
  // Candidats : résultats d'outils triés par longueur décroissante.
  const toolIndexes = cloned
    .map((m, i) => ({ index: i, len: (m.content || '').length }))
    .filter(x => x.len > MIN_KEEP_CHARS)
    .sort((a, b) => b.len - a.len);

  let currentKB = beforeKB;
  for (const { index } of toolIndexes) {
    if (currentKB <= budgetKB) break;
    const originalLen = (cloned[index].content || '').length;
    cloned[index].content = truncateContent(cloned[index].content);
    const newLen = (cloned[index].content || '').length;
    if (newLen >= originalLen) continue; // pas de réduction : on passe au suivant
    currentKB = estimatePayloadKB(cloned);
  }
  const freedKB = Math.max(0, Math.round((beforeKB - currentKB) * 10) / 10);
  return { messages: cloned, freedKB };
}
