import { Injectable, inject } from '@angular/core';
import { ConfirmModalService } from './confirm-modal.service';
import { FeedbackModalService } from './feedback-modal.service';
import { LoadingService } from './loading.service';

export type TipoAlerta = 'success' | 'error' | 'warning' | 'info' | 'question';

/**
 * Avisos y confirmaciones con los mismos nombres que usaba la aplicacion anterior (showAlert, showConfirm,
 * mostrarModalCarga...), pero sobre los modales del proyecto (feedback, confirmacion y carga).
 * Las pantallas grandes (Palets, Guias) se escribieron con estos nombres; asi conservan su logica tal cual.
 */
@Injectable({ providedIn: 'root' })
export class AlertaService {
  private readonly feedback = inject(FeedbackModalService);
  private readonly confirm = inject(ConfirmModalService);
  private readonly loading = inject(LoadingService);

  /** Mientras es mayor que 0, mostrarModalCarga / cerrarModalCarga no hacen nada (cascadas que se cargan en silencio). */
  private silencio = 0;

  /** Aviso corto. Los de exito se cierran solos a los 3 segundos; errores y avisos esperan a que la persona los cierre. */
  showAlert(title: string, message: string, tipo: TipoAlerta = 'info'): void {
    this.mostrar(title, message, tipo, true);
  }

  /** Aviso que la persona debe cerrar. */
  showAlertAcept(title: string, message: string, tipo: TipoAlerta = 'info'): void {
    this.mostrar(title, message, tipo, false);
  }

  showConfirm(title: string, message: string, tipo: TipoAlerta = 'warning'): Promise<boolean> {
    return this.confirm.confirm({
      title,
      eyebrow: 'Confirma la accion',
      message: this.aTexto(message),
      confirmText: 'Aceptar',
      cancelText: 'Cancelar',
      tone: tipo === 'error' ? 'danger' : tipo === 'success' ? 'success' : 'warning',
    });
  }

  /** Confirmacion con textos propios en los botones. */
  showOptions(title: string, message: string, tipo: TipoAlerta, confirmText: string, cancelText: string): Promise<boolean> {
    const [mensaje, ...resto] = this.aTexto(message).split('\n\n');
    return this.confirm.confirm({
      title,
      eyebrow: 'Confirma la accion',
      message: mensaje,
      detail: resto.join('\n\n'),
      confirmText,
      cancelText,
      tone: confirmText.toLowerCase().includes('elimin') ? 'danger' : 'warning',
    });
  }

  mostrarModalCarga(mensaje = 'Espere, por favor...'): void {
    if (this.silencio === 0) this.loading.show(mensaje);
  }

  cerrarModalCarga(): void {
    if (this.silencio === 0) this.loading.hide();
  }

  /** Pausa el modal de carga (cascadas que se cargan sin molestar). Cada `silenciar()` se deshace con un `reanudar()`. */
  silenciar(): void {
    this.silencio++;
  }

  reanudar(): void {
    this.silencio = Math.max(0, this.silencio - 1);
  }

  /** Ejecuta `accion` sin mostrar ni cerrar el modal de carga (los avisos si se muestran). */
  async enSilencio<T>(accion: () => Promise<T>): Promise<T> {
    this.silencio++;
    try {
      return await accion();
    } finally {
      this.silencio--;
    }
  }

  private mostrar(title: string, message: string, tipo: TipoAlerta, autoCierre: boolean): void {
    const texto = this.aTexto(message);
    const tipoModal = tipo === 'success' ? 'success' : tipo === 'error' ? 'error' : 'warning';
    this.feedback.open(tipoModal, { title, message: texto });
    if (autoCierre && tipo === 'success') {
      setTimeout(() => {
        const estado = this.feedback.state();
        if (estado.visible && estado.title === title && estado.message === texto) this.feedback.close();
      }, 3000);
    }
  }

  /** Los mensajes de la aplicacion anterior podian traer HTML basico (br, div): se convierte a texto. */
  private aTexto(valor: string): string {
    return String(valor ?? '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(div|p|h\d|li)>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
}
