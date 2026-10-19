import { Injectable, signal } from '@angular/core';
import { PendingSyncSummary } from './pending-sync.service';

export interface PendingLogoutModalState {
  visible: boolean;
  summary: PendingSyncSummary | null;
}

@Injectable({ providedIn: 'root' })
export class PendingLogoutModalService {
  readonly state = signal<PendingLogoutModalState>({ visible: false, summary: null });
  private resolver: ((confirmed: boolean) => void) | null = null;

  confirm(summary: PendingSyncSummary): Promise<boolean> {
    this.resolveCurrent(false);
    this.state.set({ visible: true, summary });
    return new Promise<boolean>((resolve) => {
      this.resolver = resolve;
    });
  }

  accept(): void {
    this.resolveCurrent(true);
  }

  cancel(): void {
    this.resolveCurrent(false);
  }

  private resolveCurrent(confirmed: boolean): void {
    if (this.resolver) {
      this.resolver(confirmed);
      this.resolver = null;
    }

    this.state.set({ visible: false, summary: null });
  }
}
