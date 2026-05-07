import { Injectable, signal } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ConnectivityService {

  readonly isOnline = signal<boolean>(navigator.onLine);

  private readonly onlineStatus = new BehaviorSubject<boolean>(navigator.onLine);
  public readonly isOnline$ = this.onlineStatus.asObservable();

  private readonly intervalMs = 60_000;
  private readonly timeoutMs = 3_000;
  private readonly healthUrl = `${environment.apiUrl}/health`;

  constructor() {
    window.addEventListener('online', () => void this.checkConnection());
    window.addEventListener('offline', () => this.setStatus(false));

    void this.checkConnection();
    setInterval(() => void this.checkConnection(), this.intervalMs);
  }

  get currentStatus(): boolean {
    return this.isOnline();
  }

  private setStatus(next: boolean): void {
    if (this.isOnline() === next) return;
    this.isOnline.set(next);
    this.onlineStatus.next(next);
  }

  async checkConnection(): Promise<void> {
    if (!navigator.onLine) {
      this.setStatus(false);
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(this.healthUrl, {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal,
      });

      this.setStatus(res.ok);
    } catch {
      this.setStatus(false);
    } finally {
      clearTimeout(timeoutId);
    }
  }
}