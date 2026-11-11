import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { SearchSelectComponent } from '../../../../shared/components/search-select/search-select.component';
import { ConnectivityService } from '../../../../shared/services/connectivity.service';
import { FeedbackModalService } from '../../../../shared/services/feedback-modal.service';
import { LoadingService } from '../../../../shared/services/loading.service';
import { JornadaStore } from '../../jornada.store';
import { RecoleccionStore } from '../../recoleccion.store';
import { Fila, claveLinea, fechaHora, ladosDe } from '../../jornada.utils';
import { LucideHistory, LucideZap } from '@lucide/angular';
import { HistorialRecoleccionModalComponent } from '../historial-recoleccion-modal/historial-recoleccion-modal.component';
import { LineaPanelComponent } from '../linea-panel/linea-panel.component';
import { RecoleccionRapidaComponent } from '../recoleccion-rapida/recoleccion-rapida.component';
import { RegistroCajasInicial, RegistroCajasModalComponent } from '../registro-cajas-modal/registro-cajas-modal.component';
import { SinLineasComponent } from '../sin-lineas/sin-lineas.component';

/**
 * Pestaña "Recolección de cajas". La recolección es de cada anotador (otro del mismo acopio no usa la tuya).
 * Con la recolección abierta se elige el formato y el tipo de empaque de cada línea y, al tocar un empacador, se registran sus cajas.
 */
@Component({
  selector: 'app-recoleccion-cajas',
  imports: [HistorialRecoleccionModalComponent, LineaPanelComponent, LucideHistory, LucideZap, NgTemplateOutlet, RecoleccionRapidaComponent, RegistroCajasModalComponent, SearchSelectComponent, SinLineasComponent],
  templateUrl: './recoleccion-cajas.component.html',
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecoleccionCajasComponent {
  protected readonly store = inject(JornadaStore);
  protected readonly recoleccion = inject(RecoleccionStore);
  private readonly feedback = inject(FeedbackModalService);
  private readonly connectivity = inject(ConnectivityService);
  private readonly loading = inject(LoadingService);

  protected readonly fechaHora = fechaHora;
  /** Lado A y lado B de un curo de máquina (null si es una línea manual). */
  protected readonly ladosDe = ladosDe;
  protected readonly claveLinea = claveLinea;

  /** Botones de la barra de recolección: misma altura y forma; solo cambia el color (suaves, también en modo oscuro). */
  protected readonly botonBase =
    'inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent active:scale-[0.98] ';
  protected readonly botonIniciar =
    'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30 hover:bg-emerald-500 focus-visible:ring-emerald-400 dark:bg-emerald-500 dark:text-emerald-950 dark:hover:bg-emerald-400';
  protected readonly botonCerrar =
    'bg-rose-600 text-white shadow-sm shadow-rose-600/30 hover:bg-rose-500 focus-visible:ring-rose-400 dark:bg-rose-400 dark:text-rose-950 dark:shadow-none dark:hover:bg-rose-300';
  protected readonly botonRapido =
    'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30 hover:bg-indigo-500 focus-visible:ring-indigo-400 dark:bg-indigo-400 dark:text-indigo-950 dark:shadow-none dark:hover:bg-indigo-300';
  protected readonly botonNeutro =
    'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 focus-visible:ring-slate-400 dark:border-slate-200 dark:bg-slate-200 dark:text-slate-900 dark:hover:border-white dark:hover:bg-white';

  /** Empacador que ya registró cajas en esta recolección: azul, con el total en grande. */
  protected readonly conCajas =
    'border-sky-300 bg-sky-50 text-sky-800 hover:border-sky-500 hover:bg-sky-100 hover:shadow-sky-500/30 hover:ring-sky-400/60 dark:border-sky-700 dark:bg-sky-900/30 dark:text-sky-200 dark:hover:border-sky-400 dark:hover:bg-sky-800/60 dark:hover:text-white dark:hover:shadow-sky-400/20';
  /** Empacador que todavía no registró cajas: verde. */
  protected readonly sinCajas =
    'border-emerald-300 bg-emerald-50 text-emerald-800 hover:border-emerald-500 hover:bg-emerald-100 hover:shadow-emerald-500/30 hover:ring-emerald-400/60 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200 dark:hover:border-emerald-400 dark:hover:bg-emerald-800/60 dark:hover:text-white dark:hover:shadow-emerald-400/20';

  /** Ventana con el historial de mis recolecciones. */
  protected readonly historialAbierto = signal(false);

  /** Ventana de la recolección rápida (escanear el QR y escribir las cajas). */
  protected readonly rapidaAbierta = signal(false);

  /** Ventana de registro de cajas (null = cerrada). */
  protected readonly registro = signal<RegistroCajasInicial | null>(null);

  /**
   * Toca un empacador. Si ya tiene cajas en esta recolección, la ventana se abre con lo que tiene guardado (cantidad, formato y tipo de empaque)
   * para subir o bajar la cantidad o cambiar el formato o el tipo; si no, con lo elegido en su línea (o vacía para elegirlo ahí).
   */
  protected async abrirRegistro(linea: Fila, puesto: number): Promise<void> {
    const empacador = this.store.asignadoEn(linea, puesto);
    if (!empacador) return;
    if (!this.recoleccion.miRecoleccion()) {
      this.feedback.warning('Inicia una recolección para registrar cajas.', 'Recolección requerida');
      return;
    }

    const guardado = this.recoleccion.registroDe(empacador);
    if (!guardado) {
      this.registro.set({
        linea, puesto, empacador,
        formatoId: this.recoleccion.formatoDe(linea) ?? '',
        tipoEmpaqueId: this.recoleccion.tipoEmpaqueDe(linea) ?? '',
        tiposEmpaque: this.recoleccion.tiposEmpaqueDe(linea),
        cantidad: 1,
        existente: false,
        calibreNombre: '',
      });
      return;
    }

    // Los tipos de empaque del formato guardado: si es el mismo de la línea ya están; si no, se piden al servidor.
    let tiposEmpaque = this.recoleccion.formatoDe(linea) === guardado.formatoId ? this.recoleccion.tiposEmpaqueDe(linea) : [];
    if (tiposEmpaque.length === 0) {
      if (!this.connectivity.online()) {
        this.feedback.error('No hay conexión a internet');
        return;
      }
      this.loading.show('Cargando datos del empacador...');
      try {
        tiposEmpaque = await this.recoleccion.tiposEmpaqueDeFormato(guardado.formatoId);
      } catch (e) {
        this.feedback.error(e instanceof Error && e.message ? e.message : 'No se pudieron consultar los tipos de empaque.');
        return;
      } finally {
        this.loading.hide();
      }
    }
    this.registro.set({
      linea, puesto, empacador,
      formatoId: guardado.formatoId,
      tipoEmpaqueId: guardado.tipoEmpaqueId,
      tiposEmpaque,
      cantidad: guardado.cantidad,
      existente: true,
      calibreNombre: guardado.calibreNombre,
    });
  }
}
