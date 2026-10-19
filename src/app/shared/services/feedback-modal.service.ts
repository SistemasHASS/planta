import { Injectable, signal } from '@angular/core';

export type FeedbackModalType = 'success' | 'error' | 'warning';

export interface FeedbackModalSection {
  title: string;
  items: string[];
  type?: FeedbackModalType;
}

export interface FeedbackModalState {
  visible: boolean;
  type: FeedbackModalType;
  title: string;
  message: string;
  sections: FeedbackModalSection[];
  actionText: string;
  /** Segundo boton opcional (ej. Compartir): cierra el aviso y ejecuta `handler`. */
  secondaryAction: { text: string; handler: () => void } | null;
}

interface FeedbackModalOptions {
  title?: string;
  message: string;
  sections?: FeedbackModalSection[];
  actionText?: string;
  secondaryAction?: { text: string; handler: () => void };
  /** Se ejecuta cuando el aviso se cierra SIN usar la accion secundaria (boton principal, X, fondo o Esc). */
  onDismiss?: () => void;
}

const DEFAULT_TITLES: Record<FeedbackModalType, string> = {
  success: 'Proceso completado',
  error: 'No se pudo completar',
  warning: 'Revisa la informacion'
};

@Injectable({ providedIn: 'root' })
export class FeedbackModalService {
  private dismissHandler: (() => void) | null = null;

  readonly state = signal<FeedbackModalState>({
    visible: false,
    type: 'success',
    title: DEFAULT_TITLES.success,
    message: '',
    sections: [],
    actionText: 'Entendido',
    secondaryAction: null
  });

  success(message: string, title = DEFAULT_TITLES.success): void {
    this.open('success', { title, message });
  }

  error(message: string, title = DEFAULT_TITLES.error): void {
    this.open('error', { title, message });
  }

  warning(message: string, title = DEFAULT_TITLES.warning): void {
    this.open('warning', { title, message });
  }

  open(type: FeedbackModalType, options: FeedbackModalOptions): void {
    this.dismissHandler = options.onDismiss ?? null;
    this.state.set({
      visible: true,
      type,
      title: options.title ?? DEFAULT_TITLES[type],
      message: options.message,
      sections: options.sections ?? [],
      actionText: options.actionText ?? 'Entendido',
      secondaryAction: options.secondaryAction ?? null
    });
  }

  /** Cierra el aviso y ejecuta la accion secundaria (si hay). */
  runSecondary(): void {
    const accion = this.state().secondaryAction;
    this.dismissHandler = null;
    this.close();
    accion?.handler();
  }

  close(): void {
    const alCerrar = this.dismissHandler;
    this.dismissHandler = null;
    this.state.update((current) => ({ ...current, visible: false }));
    alCerrar?.();
  }
}
