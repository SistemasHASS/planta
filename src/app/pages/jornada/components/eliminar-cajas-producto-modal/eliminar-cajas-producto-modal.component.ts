import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { LucideTrash2 } from '@lucide/angular';
import { ConfirmModalService } from '../../../../shared/services/confirm-modal.service';
import { ConnectivityService } from '../../../../shared/services/connectivity.service';
import { FeedbackModalService } from '../../../../shared/services/feedback-modal.service';
import { JornadasAnotadorApiService } from '../../../../shared/services/jornadas-anotador-api.service';
import { LoadingService } from '../../../../shared/services/loading.service';
import { portalToBody } from '../../../../shared/utils/portal';
import { Fila } from '../../jornada.utils';

const MAXIMO_OBSERVACION = 500;
const numero = (v: unknown): number => Number(v) || 0;

/**
 * Eliminar las cajas de un producto (formato + tipo de empaque) de la producción del día: primero se consulta cuántas hay registradas, cuántas están libres y cuántas ya están en un palet,
 * y el anotador decide. Solo se eliminan las libres; las que ya están en un palet no se tocan (hay que sacarlas primero del palet). El motivo es opcional.
 * Es una acción delicada: al pulsar Eliminar se vuelve a consultar (con el loading de la app) y se pide una segunda confirmación con el modal de confirmación de la app.
 */
@Component({
  selector: 'app-eliminar-cajas-producto-modal',
  imports: [LucideTrash2],
  templateUrl: './eliminar-cajas-producto-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EliminarCajasProductoModalComponent implements OnInit {
  constructor() {
    // Fuera del contenedor con scroll de la página: en Safari / iOS la ventana quedaba dentro de él y se veía cortada.
    portalToBody();
  }

  private readonly api = inject(JornadasAnotadorApiService);
  private readonly feedback = inject(FeedbackModalService);
  private readonly connectivity = inject(ConnectivityService);
  private readonly loading = inject(LoadingService);
  private readonly confirmModal = inject(ConfirmModalService);

  readonly formatoId = input.required<number>();
  readonly tipoEmpaqueGrupoId = input.required<number>();
  /** Textos para mostrar (formato y tipo de empaque de la tarjeta elegida). */
  readonly formato = input.required<string>();
  readonly detalle = input.required<string>();

  readonly closed = output<void>();
  /** Se eliminaron cajas: la pantalla vuelve a pedir la producción. */
  readonly eliminado = output<void>();

  protected readonly maximoObservacion = MAXIMO_OBSERVACION;
  protected readonly cargando = signal(true);
  protected readonly error = signal('');
  protected readonly info = signal<Fila | null>(null);
  protected readonly motivo = signal('');

  protected readonly registradas = computed(() => numero(this.info()?.['cajasRegistradas']));
  protected readonly libres = computed(() => numero(this.info()?.['cajasLibres']));
  protected readonly enPalets = computed(() => numero(this.info()?.['cajasEnPalets']));
  protected readonly registros = computed(() => numero(this.info()?.['registros']));
  protected readonly empacadores = computed(() => numero(this.info()?.['empacadores']));
  protected readonly detallePalets = computed(() => String(this.info()?.['detallePalets'] ?? ''));
  protected readonly puedeEliminar = computed(() => !!this.info()?.['puedeEliminar']);

  ngOnInit(): Promise<void> {
    return this.consultar();
  }

  protected async consultar(): Promise<void> {
    if (!this.connectivity.online()) {
      this.error.set('No hay conexión a internet.');
      this.cargando.set(false);
      return;
    }
    this.cargando.set(true);
    this.error.set('');
    try {
      await this.leer();
    } catch (e) {
      this.error.set(e instanceof Error && e.message ? e.message : 'No se pudo consultar las cajas.');
    } finally {
      this.cargando.set(false);
    }
  }

  /** Pide a la base las cajas registradas / libres / en palets del producto (lanza el error si falla). */
  private async leer(): Promise<void> {
    const r = await this.api.consultarEliminarProducto(this.formatoId(), this.tipoEmpaqueGrupoId());
    if (r.error) throw new Error(r.mensaje || 'No se pudo consultar las cajas.');
    const fila = r.data?.[0] ?? null;
    if (!fila) throw new Error('No se pudo consultar las cajas.');
    this.info.set(fila);
  }

  protected escribirMotivo(evento: Event): void {
    this.motivo.set((evento.target as HTMLTextAreaElement).value);
  }

  /** Botón Eliminar: loading mientras se vuelve a consultar (las cajas pudieron pasar a un palet) y luego la segunda confirmación. */
  protected async pedirConfirmacion(): Promise<void> {
    if (!this.puedeEliminar()) return;
    if (!this.connectivity.online()) {
      this.feedback.error('No hay conexión a internet');
      return;
    }
    this.loading.show('Verificando cajas...');
    try {
      await this.leer();
    } catch (e) {
      this.feedback.error(e instanceof Error && e.message ? e.message : 'No se pudo consultar las cajas.');
      return;
    } finally {
      await this.loading.hideAfterMinimum();
    }
    if (!this.puedeEliminar()) return;

    const libres = this.libres();
    const producto = `${this.formato()} · ${this.detalle()}`;
    const confirmado = await this.confirmModal.confirm({
      title: '¿Seguro que quieres eliminar?',
      eyebrow: 'Acción irreversible',
      message: this.registradas() === 0
        ? `Se quitarán ${this.registros()} ${this.registros() === 1 ? 'registro' : 'registros'} en 0 cajas. Una vez eliminados no se puede deshacer.`
        : `Se descuentan del stock y los registros quedan anulados.${this.enPalets() > 0 ? ` Las ${this.enPalets()} cajas que están en palets no se eliminan.` : ''} Una vez eliminadas no se puede deshacer.`,
      detail: this.registradas() === 0 ? producto : `${libres} ${libres === 1 ? 'caja' : 'cajas'} · ${producto}`,
      confirmText: 'Sí, eliminar',
      cancelText: 'Volver',
      tone: 'danger',
    });
    if (confirmado) await this.confirmar();
  }

  protected async confirmar(): Promise<void> {
    if (!this.puedeEliminar()) return;
    if (!this.connectivity.online()) {
      this.feedback.error('No hay conexión a internet');
      return;
    }
    const libres = this.libres();
    this.loading.show('Eliminando cajas...');
    try {
      const r = await this.api.eliminarProducto(this.formatoId(), this.tipoEmpaqueGrupoId(), this.motivo().trim());
      if (r.error) throw new Error(r.mensaje || 'No se pudieron eliminar las cajas.');
      this.eliminado.emit();
      this.closed.emit();
      this.feedback.success(
        libres === 1 ? 'Se eliminó 1 caja.' : `Se eliminaron ${libres} cajas.`,
        'Cajas eliminadas',
      );
    } catch (e) {
      // La base rechazó (ej. las cajas pasaron a un palet mientras tanto): se avisa y se vuelve a consultar para mostrar el estado real.
      this.feedback.error(e instanceof Error && e.message ? e.message : 'No se pudieron eliminar las cajas.');
      await this.consultar();
    } finally {
      await this.loading.hideAfterMinimum();
    }
  }
}
