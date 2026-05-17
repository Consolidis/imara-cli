import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { networkEvents } from './events';

export type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerConfig {
  failureThreshold?: number;
  successThreshold?: number;
  timeoutMs?: number;
}

export class CircuitBreakerOpenError extends Error {
  constructor(message = 'Le service Imara est momentanément hors ligne. Tentative en mode dégradé...') {
    super(message);
    this.name = 'CircuitBreakerOpenError';
  }
}

interface PersistentStateSchema {
  state: CircuitBreakerState;
  failureCount: number;
  successCount: number;
  lastStateChange: number;
}

export class CircuitBreaker {
  private id: string;
  private failureThreshold: number;
  private successThreshold: number;
  private timeoutMs: number;

  constructor(id: string, config: CircuitBreakerConfig = {}) {
    this.id = id;
    this.failureThreshold = config.failureThreshold ?? 5;
    this.successThreshold = config.successThreshold ?? 2;
    this.timeoutMs = config.timeoutMs ?? 60000;

    // Ensure state is initialized
    const s = this.getOrInitializeState();
    this.updateNetworkStatus(s.state);
  }

  private getPersistencePath(): string {
    return join(homedir(), '.imara', 'circuit-breaker.json');
  }

  private loadAllBreakers(): Record<string, PersistentStateSchema> {
    const path = this.getPersistencePath();
    if (!existsSync(path)) return {};
    try {
      return JSON.parse(readFileSync(path, 'utf-8'));
    } catch {
      return {};
    }
  }

  private saveAllBreakers(data: Record<string, PersistentStateSchema>): void {
    const path = this.getPersistencePath();
    try {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, JSON.stringify(data, null, 2), 'utf-8');
    } catch {
      // Ignored: silent fallback
    }
  }

  private loadPersistentState(): PersistentStateSchema | null {
    const all = this.loadAllBreakers();
    return all[this.id] || null;
  }

  private savePersistentState(state: PersistentStateSchema): void {
    const all = this.loadAllBreakers();
    all[this.id] = state;
    this.saveAllBreakers(all);
  }

  private getOrInitializeState(): PersistentStateSchema {
    const s = this.loadPersistentState();
    if (s) return s;

    const initial: PersistentStateSchema = {
      state: 'CLOSED',
      failureCount: 0,
      successCount: 0,
      lastStateChange: Date.now(),
    };
    this.savePersistentState(initial);
    return initial;
  }

  getState(): CircuitBreakerState {
    const s = this.getOrInitializeState();

    // If state is OPEN, check if the timeout has expired to transition to HALF_OPEN
    if (s.state === 'OPEN' && Date.now() - s.lastStateChange >= this.timeoutMs) {
      const updated: PersistentStateSchema = {
        ...s,
        state: 'HALF_OPEN',
        successCount: 0,
        lastStateChange: Date.now(),
      };
      this.savePersistentState(updated);
      this.updateNetworkStatus('HALF_OPEN');
      return 'HALF_OPEN';
    }

    return s.state;
  }

  isOpen(): boolean {
    return this.getState() === 'OPEN';
  }

  recordSuccess(): void {
    const s = this.getOrInitializeState();

    if (s.state === 'HALF_OPEN') {
      const nextSuccess = s.successCount + 1;
      if (nextSuccess >= this.successThreshold) {
        this.transitionTo('CLOSED', s);
      } else {
        this.savePersistentState({
          ...s,
          successCount: nextSuccess,
        });
      }
    } else if (s.state === 'CLOSED') {
      if (s.failureCount > 0) {
        this.savePersistentState({
          ...s,
          failureCount: 0,
        });
      }
    }
  }

  recordFailure(): void {
    const s = this.getOrInitializeState();

    if (s.state === 'CLOSED') {
      const nextFailures = s.failureCount + 1;
      if (nextFailures >= this.failureThreshold) {
        this.transitionTo('OPEN', s);
      } else {
        this.savePersistentState({
          ...s,
          failureCount: nextFailures,
        });
      }
    } else if (s.state === 'HALF_OPEN') {
      // Any failure in HALF_OPEN trips it immediately back to OPEN
      this.transitionTo('OPEN', s);
    }
  }

  private transitionTo(newState: CircuitBreakerState, current: PersistentStateSchema): void {
    const updated: PersistentStateSchema = {
      state: newState,
      failureCount: newState === 'OPEN' ? current.failureCount + 1 : 0,
      successCount: 0,
      lastStateChange: Date.now(),
    };
    this.savePersistentState(updated);
    this.updateNetworkStatus(newState);
  }

  private updateNetworkStatus(state: CircuitBreakerState): void {
    if (state === 'CLOSED') {
      networkEvents.setStatus('online');
    } else if (state === 'OPEN') {
      networkEvents.setStatus('offline');
    } else if (state === 'HALF_OPEN') {
      networkEvents.setStatus('degraded');
    }
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.isOpen()) {
      throw new CircuitBreakerOpenError();
    }

    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  clearPersistence(): void {
    const all = this.loadAllBreakers();
    delete all[this.id];
    this.saveAllBreakers(all);
  }
}
