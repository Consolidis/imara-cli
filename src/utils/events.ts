import { EventEmitter } from 'events';

export type NetworkStatus = 'online' | 'degraded' | 'offline';

export class NetworkEvents extends EventEmitter {
  private currentStatus: NetworkStatus = 'online';

  getStatus(): NetworkStatus {
    return this.currentStatus;
  }

  setStatus(status: NetworkStatus): void {
    if (this.currentStatus !== status) {
      this.currentStatus = status;
      this.emit('status', status);
    }
  }
}

export const networkEvents = new NetworkEvents();
