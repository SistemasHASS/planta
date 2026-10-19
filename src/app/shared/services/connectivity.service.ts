import { computed, Injectable, signal } from '@angular/core';
import { environment } from '../../../environments/environment';

const HEALTH_CHECK_INTERVAL_MS = 30_000;
const HEALTH_CHECK_TIMEOUT_MS = 3_000;
const OFFLINE_COOLDOWN_MS = 15_000;

@Injectable({ providedIn: 'root' })
export class ConnectivityService {
  private readonly browserOnline = signal(typeof navigator === 'undefined' ? true : navigator.onLine);
  private readonly apiAvailable = signal(true);
  private readonly healthUrl = `${environment.apiBaseUrl}/health`;
  private cooldownUntil = 0;
  private checkPromise: Promise<boolean> | null = null;

  readonly online = computed(() => this.browserOnline() && this.apiAvailable());
  readonly serverAvailable = computed(() => this.apiAvailable());
  readonly hasInternet = computed(() => this.browserOnline());
  readonly label = computed(() => this.online() ? 'Conectado' : 'Sin conexion');

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.browserOnline.set(true);
        this.clearCooldown();
        void this.checkConnection();
      });

      window.addEventListener('offline', () => {
        this.browserOnline.set(false);
        this.apiAvailable.set(false);
        this.triggerCooldown();
      });

      void this.checkConnection();
      window.setInterval(() => void this.checkConnection(), HEALTH_CHECK_INTERVAL_MS);
    }
  }

  get isInCooldown(): boolean {
    return Date.now() < this.cooldownUntil;
  }

  isOnline(): boolean {
    return this.online();
  }

  triggerCooldown(durationMs = OFFLINE_COOLDOWN_MS): void {
    this.cooldownUntil = Date.now() + durationMs;
  }

  clearCooldown(): void {
    this.cooldownUntil = 0;
  }

  forceOffline(): void {
    this.apiAvailable.set(false);
    this.triggerCooldown();
  }

  forceStatus(next: boolean): void {
    this.apiAvailable.set(next);
    if (next) {
      this.browserOnline.set(typeof navigator === 'undefined' ? true : navigator.onLine);
      this.clearCooldown();
    }
  }

  async checkConnection(): Promise<boolean> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.browserOnline.set(false);
      this.apiAvailable.set(false);
      return false;
    }

    this.browserOnline.set(true);

    if (this.checkPromise) {
      return this.checkPromise;
    }

    this.checkPromise = this.resolveConnection();
    const result = await this.checkPromise;
    this.checkPromise = null;
    return result;
  }

  private async resolveConnection(): Promise<boolean> {
    const ok = await this.pingBackend();
    this.apiAvailable.set(ok);

    if (ok) {
      this.clearCooldown();
    }

    return this.online();
  }

  private async pingBackend(): Promise<boolean> {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT_MS);

    try {
      const response = await fetch(this.healthUrl, {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal
      });

      return response.ok;
    } catch {
      return false;
    } finally {
      window.clearTimeout(timeoutId);
    }
  }
}
