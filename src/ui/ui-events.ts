import { EventEmitter } from 'events';

export type AgentPhase = 'idle' | 'thinking' | 'tool';

export class UIEvents extends EventEmitter {
  private phase: AgentPhase = 'idle';
  private activity = '';

  getPhase(): AgentPhase {
    return this.phase;
  }

  getActivity(): string {
    return this.activity;
  }

  setPhase(phase: AgentPhase, activity = ''): void {
    this.phase = phase;
    this.activity = activity;
    this.emit('phase', phase, activity);
  }
}

export const uiEvents = new UIEvents();
