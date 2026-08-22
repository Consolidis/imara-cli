// Centralise le filtrage des messages d'erreur pour ne jamais exposer
// a l'utilisateur final le fournisseur LLM, le modele, ou des details techniques internes.

const LLM_PROVIDER_PATTERNS = [
  /\bdeepseek\b/i,
  /\bopenai\b/i,
  /\b(anthropic|claude)\b/i,
  /\bgemini\b/i,
  /\bgroq\b/i,
  /\bmistral\b/i,
  /\bcohere\b/i,
  /\btogether\s*ai\b/i,
  /\bperplexity\b/i,
  /\breplicate\b/i,
  /\bhugging\s*face\b/i,
  /\bfireworks\s*ai\b/i,
  /\bllama\b/i,
  /\bgpt-?3\.?\d*\b/i,
  /\bgpt-?4\.?\d*\b/i,
  /\bgpt-?4o\b/i,
  /\bo1\b/i,
  /\bdeepseek-chat\b/i,
  /\bdeepseek-reasoner\b/i,
  /\bclaude-?3\b/i,
];

const TECHNICAL_PATTERNS = [
  /cloudflare/i,
  /AiError/i,
  /Capacity temporarily exceeded/i,
  /\{"errors":/,
  /\{"success":/,
  /code":\s*\d{4}/,
  /ee[0-9a-f]{6,}/i,
  /at\s+\w+\s+\(.*:\d+:\d+\)/,
  /Error:\s+Error:/,
  /stack\s*trace/i,
  /\[object\s+Object\]/i,
];

/**
 * Nettoie un message d'erreur pour l'affichage utilisateur.
 * Supprime les references aux fournisseurs LLM, modeles, details techniques.
 * Produit un message generique et comprehensible.
 */
export function sanitizeUserErrorMessage(msg: string): string {
  if (!msg) return msg;

  let cleaned = msg;

  // 1. Masquer les noms de fournisseurs LLM et modeles
  for (const pattern of LLM_PROVIDER_PATTERNS) {
    cleaned = cleaned.replace(pattern, '[fournisseur IA]');
  }

  // 2. Masquer les patterns techniques
  for (const pattern of TECHNICAL_PATTERNS) {
    cleaned = cleaned.replace(pattern, '[detail technique]');
  }

  // 3. Nettoyer les fragments JSON, URL d'API, tokens residuels
  cleaned = cleaned.replace(/https?:\/\/[^\s]+/g, '[url]');
  cleaned = cleaned.replace(/sk-[a-zA-Z0-9]{20,}/g, '[cle API masquee]');
  cleaned = cleaned.replace(/[a-f0-9]{32,}/gi, '[hash]');

  // 4. Reduire les espaces multiples
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  // 5. Traduire les messages generiques restants en messages clairs
  const lower = cleaned.toLowerCase();

  if (lower.includes('401') || lower.includes('unauthorized') || lower.includes('authentifi')) {
    return 'Clé API invalide ou expirée. Relancez `imara login`.';
  }
  if (lower.includes('402') || lower.includes('solde') || lower.includes('credit') || lower.includes('wallet') || lower.includes('insufficient')) {
    return 'Crédits insuffisants. Rechargez votre wallet sur imara.consolidis.com.';
  }
  if (lower.includes('429') || lower.includes('rate limit') || lower.includes('quota') || lower.includes('satur') || lower.includes('trop de requetes')) {
    return 'Le service est temporairement saturé. Réessayez dans quelques secondes.';
  }
  if (lower.includes('503') || lower.includes('maintenance')) {
    return 'Imara est actuellement en maintenance. Réessayez plus tard.';
  }
  if (lower.includes('500') || lower.includes('502') || lower.includes('504') || lower.includes('indisponible')) {
    return 'Le service Imara est temporairement indisponible. Réessayez dans un instant.';
  }
  if (lower.includes('timed out') || lower.includes('timeout') || lower.includes('connexion')) {
    return 'Le service met trop de temps à répondre. Réessayez ou tapez /clear pour alléger le contexte.';
  }
  if (lower.includes('payload') && (lower.includes('volumineux') || lower.includes('trop'))) {
    return cleaned; // Deja un message clair
  }
  if (lower.includes('[fournisseur ia]')) {
    return 'Erreur du service de génération. Réessayez dans quelques instants.';
  }
  if (lower.includes('[detail technique]')) {
    return 'Une erreur technique est survenue. Réessayez dans un instant.';
  }

  return cleaned;
}

/**
 * Verifie si un message contient des details techniques internes
 * qui ne devraient jamais etre exposes.
 */
export function containsTechnicalDetails(msg: string): boolean {
  if (!msg) return false;
  for (const p of TECHNICAL_PATTERNS) {
    if (p.test(msg)) return true;
  }
  for (const p of LLM_PROVIDER_PATTERNS) {
    if (p.test(msg)) return true;
  }
  return false;
}
