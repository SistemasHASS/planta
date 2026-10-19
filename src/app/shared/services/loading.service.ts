import { Injectable, signal } from '@angular/core';

export interface LoadingState {
  visible: boolean;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class LoadingService {
  private openedAt = 0;
  /** Cambia con cada show(): un cierre pendiente no debe ocultar una carga que se abrio despues. */
  private version = 0;

  readonly state = signal<LoadingState>({
    visible: false,
    message: 'Cargando...'
  });

  show(message = 'Cargando...'): void {
    this.openedAt = Date.now();
    this.version++;
    this.state.set({ visible: true, message });
  }

  update(message: string): void {
    this.state.update((current) => ({ ...current, message }));
  }

  hide(): void {
    this.state.update((current) => ({ ...current, visible: false }));
  }

  async hideAfterMinimum(minimumMs = 650): Promise<void> {
    const version = this.version;
    const elapsed = Date.now() - this.openedAt;
    const pendingMs = Math.max(0, minimumMs - elapsed);

    if (pendingMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, pendingMs));
    }

    if (version === this.version) this.hide();
  }
}
