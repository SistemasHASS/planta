import { Injectable, signal } from '@angular/core';

export interface ConfirmModalState {
  visible: boolean;
  title: string;
  message: string;
  detail?: string;
  eyebrow: string;
  confirmText: string;
  cancelText: string;
  tone: 'danger' | 'warning' | 'success';
}

export interface ConfirmModalOptions {
  title?: string;
  message: string;
  detail?: string;
  /** Texto pequeño sobre el titulo (por defecto 'Verifica la eliminacion'). */
  eyebrow?: string;
  confirmText?: string;
  cancelText?: string;
  tone?: ConfirmModalState['tone'];
}

const DEFAULT_STATE: ConfirmModalState = {
  visible: false,
  title: 'Confirmar accion',
  message: '',
  detail: '',
  eyebrow: 'Verifica la eliminacion',
  confirmText: 'Confirmar',
  cancelText: 'Cancelar',
  tone: 'warning'
};

@Injectable({ providedIn: 'root' })
export class ConfirmModalService {
  readonly state = signal<ConfirmModalState>(DEFAULT_STATE);
  private resolver: ((confirmed: boolean) => void) | null = null;

  confirm(options: ConfirmModalOptions): Promise<boolean> {
    this.resolveCurrent(false);

    this.state.set({
      visible: true,
      title: options.title ?? DEFAULT_STATE.title,
      message: options.message,
      detail: options.detail ?? '',
      eyebrow: options.eyebrow ?? DEFAULT_STATE.eyebrow,
      confirmText: options.confirmText ?? DEFAULT_STATE.confirmText,
      cancelText: options.cancelText ?? DEFAULT_STATE.cancelText,
      tone: options.tone ?? DEFAULT_STATE.tone
    });

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

    this.state.update((current) => ({ ...current, visible: false }));
  }
}
