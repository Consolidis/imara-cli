import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  getPayloadThresholds,
  estimatePayloadKB,
  computePayloadState,
  shrinkPayloadForBudget,
  TRUNCATION_MARKER,
} from '../utils/payload-guard';
import { Message } from '../agent/agent.types';

afterEach(() => {
  vi.unstubAllEnvs();
});

function buildToolResult(sizeChars: number, name = 'read_file'): Message {
  return {
    role: 'tool',
    tool_call_id: `call_${name}`,
    name,
    content: 'a'.repeat(sizeChars),
  };
}

describe('payload-guard — seuils configurables', () => {
  it('retourne les défauts 600 Ko / 1000 Ko', () => {
    expect(getPayloadThresholds()).toEqual({ warnKB: 600, maxKB: 1000 });
  });

  it('respecte IMARA_PAYLOAD_WARN_KB / IMARA_PAYLOAD_MAX_KB', () => {
    vi.stubEnv('IMARA_PAYLOAD_WARN_KB', '250');
    vi.stubEnv('IMARA_PAYLOAD_MAX_KB', '900');
    expect(getPayloadThresholds()).toEqual({ warnKB: 250, maxKB: 900 });
  });

  it('maintient l’invariant warn <= max même si mal configuré', () => {
    vi.stubEnv('IMARA_PAYLOAD_WARN_KB', '900');
    vi.stubEnv('IMARA_PAYLOAD_MAX_KB', '500');
    expect(getPayloadThresholds()).toEqual({ warnKB: 500, maxKB: 500 });
  });
});

describe('payload-guard — estimation', () => {
  it('mesure correctement un payload réel (proche de length/1024)', () => {
    const messages: Message[] = [
      { role: 'system', content: 'Tu es Imara.' },
      { role: 'user', content: 'a'.repeat(50_000) },
    ];
    const sizeKB = estimatePayloadKB(messages);
    // 50 000 chars ≈ 48.8 Ko + surcoût JSON : la mesure doit être dans une fourchette réaliste.
    expect(sizeKB).toBeGreaterThan(45);
    expect(sizeKB).toBeLessThan(55);
  });

  it('est robuste avec des messages vides', () => {
    expect(estimatePayloadKB([])).toBe(0);
    expect(estimatePayloadKB([{ role: 'user', content: '' }])).toBeGreaterThan(0);
  });
});

describe('payload-guard — classification ok / warn / critical', () => {
  it('classe ok sous le seuil d’alerte', () => {
    const state = computePayloadState([{ role: 'user', content: 'bonjour' }]);
    expect(state.state).toBe('ok');
    expect(state.sizeKB).toBeGreaterThan(0);
  });

  it('classe warn entre alerte et limite', () => {
    // ~684 Ko : au-delà de 600 Ko mais sous 1000 Ko.
    const messages: Message[] = [buildToolResult(700_000)];
    const state = computePayloadState(messages);
    expect(state.state).toBe('warn');
  });

  it('classe critical au-delà de la limite', () => {
    // ~1074 Ko : au-delà de 1000 Ko.
    const messages: Message[] = [buildToolResult(1_100_000)];
    const state = computePayloadState(messages);
    expect(state.state).toBe('critical');
  });

  it('respecte les seuils custom via env', () => {
    vi.stubEnv('IMARA_PAYLOAD_WARN_KB', '200');
    vi.stubEnv('IMARA_PAYLOAD_MAX_KB', '500');
    // ~293 Ko : warn avec seuil 200.
    expect(computePayloadState([buildToolResult(300_000)]).state).toBe('warn');
    // ~586 Ko : critical avec max 500.
    expect(computePayloadState([buildToolResult(600_000)]).state).toBe('critical');
  });
});

describe('payload-guard — allègement (shrinkPayloadForBudget)', () => {
  it('ne modifie rien si le payload tient déjà dans le budget', () => {
    const messages: Message[] = [
      { role: 'user', content: 'petite question' },
      buildToolResult(2_000),
    ];
    const result = shrinkPayloadForBudget(messages, 500);
    expect(result.freedKB).toBe(0);
    expect(result.messages).toEqual(messages);
    expect(result.messages[1].content).not.toContain(TRUNCATION_MARKER);
  });

  it('tronque le plus gros tool result, conserve le début, ajoute le marqueur', () => {
    const messages: Message[] = [
      buildToolResult(800_000, 'investigate_project'),
      buildToolResult(50_000, 'web_search'),
    ];
    const result = shrinkPayloadForBudget(messages, 300);
    expect(result.freedKB).toBeGreaterThan(0);
    // Le message le plus gros doit être tronqué (marqueur présent).
    const big = result.messages.find(m => m.name === 'investigate_project')!;
    expect(big.content).toContain(TRUNCATION_MARKER);
    // Le début original est conservé.
    expect(big.content.startsWith('a'.repeat(10))).toBe(true);
    // Le petit résultat d'outil reste intact (on part du plus gros seulement).
    const small = result.messages.find(m => m.name === 'web_search')!;
    expect(small.content).not.toContain(TRUNCATION_MARKER);
    // Le payload tronqué tient dans le budget.
    expect(estimatePayloadKB(result.messages)).toBeLessThanOrEqual(300);
  });

  it('trongue les résultats en partant du plus volumineux', () => {
    const messages: Message[] = [
      buildToolResult(20_000, 'petit'),
      buildToolResult(700_000, 'gros'),
    ];
    const result = shrinkPayloadForBudget(messages, 200);
    expect(result.messages.find(m => m.name === 'gros')!.content).toContain(TRUNCATION_MARKER);
    expect(result.messages.find(m => m.name === 'petit')!.content).not.toContain(TRUNCATION_MARKER);
  });
});
