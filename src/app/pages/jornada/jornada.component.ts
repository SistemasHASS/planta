import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { LucideCircleStop, LucidePackage, LucideRefreshCcw } from '@lucide/angular';
import { ConnectivityService } from '../../shared/services/connectivity.service';
import { FeedbackModalService } from '../../shared/services/feedback-modal.service';
import { LoadingService } from '../../shared/services/loading.service';
import { AbrirJornadaComponent } from './components/abrir-jornada/abrir-jornada.component';
import { AsignarEmpacadoresComponent } from './components/asignar-empacadores/asignar-empacadores.component';
import { MisLineasComponent } from './components/mis-lineas/mis-lineas.component';
import { RecoleccionCajasComponent } from './components/recoleccion-cajas/recoleccion-cajas.component';
import { JornadaStore } from './jornada.store';
import { fecha, fechaHora } from './jornada.utils';
import { RecoleccionStore } from './recoleccion.store';

type Pestana = 'asignar' | 'recoleccion';

/**
 * Panel de empaque del anotador (ANPLA). Es solo el contenedor: encabezado, tarjeta de la jornada y pestañas.
 * El estado vive en `JornadaStore` / `RecoleccionStore` (provistos aquí) y cada pestaña es su propio componente en `components/`.
 *  1. Sin jornada abierta en el acopio: `AbrirJornadaComponent`.
 *  2. Con jornada abierta: tarjeta de la jornada, "Mis líneas" y la pestaña elegida.
 */
@Component({
  selector: 'app-jornada',
  imports: [
    AbrirJornadaComponent,
    AsignarEmpacadoresComponent,
    MisLineasComponent,
    RecoleccionCajasComponent,
    LucideCircleStop,
    LucidePackage,
    LucideRefreshCcw,
  ],
  providers: [JornadaStore, RecoleccionStore],
  templateUrl: './jornada.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JornadaComponent implements OnInit {
  protected readonly store = inject(JornadaStore);
  private readonly recoleccion = inject(RecoleccionStore);
  private readonly connectivity = inject(ConnectivityService);
  private readonly loading = inject(LoadingService);
  private readonly feedback = inject(FeedbackModalService);

  protected readonly fecha = fecha;
  protected readonly fechaHora = fechaHora;

  /** Pestaña activa del panel. */
  protected readonly pestana = signal<Pestana>('asignar');

  ngOnInit(): Promise<void> {
    return this.store.iniciar();
  }

  /** Botón Actualizar: relee la jornada y, si estás en Recolección de cajas, también las cajas de cada empacador. */
  protected async actualizar(): Promise<void> {
    await this.store.cargar();
    if (this.pestana() !== 'recoleccion' || !this.store.jornada()) return;
    try {
      await this.recoleccion.cargarCajas();
    } catch (e) {
      this.feedback.error(e instanceof Error && e.message ? e.message : 'No se pudieron consultar las cajas registradas.');
    }
  }

  protected clasePestana(pestana: Pestana): string {
    return this.pestana() === pestana
      ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30 dark:bg-emerald-500 dark:text-emerald-950'
      : 'text-slate-600 hover:bg-slate-300/70 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white';
  }

  /** Cambia de pestaña: muestra el loading mientras relee del servidor lo que esa pestaña necesita. */
  protected async cambiarPestana(pestana: Pestana): Promise<void> {
    if (pestana === this.pestana()) return;
    if (!this.connectivity.online()) {
      this.feedback.error('No hay conexión a internet');
      return;
    }
    this.loading.show(pestana === 'recoleccion' ? 'Cargando recolección de cajas...' : 'Cargando asignación de empacadores...');
    try {
      await this.store.cargarLineas();
      if (pestana === 'recoleccion') await this.recoleccion.entrar();
      this.pestana.set(pestana);
      await this.loading.hideAfterMinimum();
    } catch (e) {
      this.loading.hide();
      this.feedback.error(e instanceof Error && e.message ? e.message : 'No se pudo cargar la pestaña.');
    }
  }
}
