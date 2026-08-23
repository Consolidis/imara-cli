/**
 * Détecte si une erreur est une annulation (AbortError) — utilisateur (ESC/Ctrl+C)
 * ou timeout interne.
 *
 * Une annulation ne doit JAMAIS être :
 * - considérée comme retriable (elle remonte immédiatement, sans nouvelle tentative) ;
 * - masquée par un fallback cache (l'agent doit s'arrêter, pas répondre depuis le cache) ;
 * - comptée comme un échec de service par le circuit breaker.
 */
export function isAbortError(error: unknown): boolean {
  if (!error) return false;
  if (error instanceof Error && error.name === 'AbortError') return true;
  const msg = error instanceof Error ? error.message : String(error);
  const lower = msg.toLowerCase();
  return (
    lower.includes('the operation was aborted') ||
    lower.includes('aborted by external signal') ||
    lower.includes('fetch aborted') ||
    lower.includes('abort error')
  );
}
