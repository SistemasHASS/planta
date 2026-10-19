import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import {
  LucideBox,
  LucideChevronDown,
  LucideChevronUp,
  LucideCircleAlert,
  LucideCircleCheck,
  LucideLayers,
  LucidePackage,
  LucideTruck,
  LucideWeight,
  LucideX,
} from '@lucide/angular';
import { DPalet, Palet } from '../../../../shared/interfaces/palet.interface';
import { Proceso } from '../../../../shared/interfaces/proceso.interface';
import { AlertaService } from '../../../../shared/services/alerta.service';
import { ConnectivityService } from '../../../../shared/services/connectivity.service';
import { LoadingService } from '../../../../shared/services/loading.service';
import { PaletsApiService } from '../../../../shared/services/palets-api.service';
import { PaletsSyncService } from '../../../../shared/services/palets-sync.service';
import { portalToBody } from '../../../../shared/utils/portal';

/**
 * Palets de un proceso del historial y su composición. Solo lectura: copia de la vista de la pantalla de palets
 * sin ninguna acción de crear, editar, cerrar, reabrir ni eliminar.
 */
@Component({
  selector: 'app-modal-palets-proceso',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    LucideBox,
    LucideChevronDown,
    LucideChevronUp,
    LucideCircleAlert,
    LucideCircleCheck,
    LucideLayers,
    LucidePackage,
    LucideTruck,
    LucideWeight,
    LucideX,
  ],
  templateUrl: './modal-palets-proceso.component.html',
  styleUrl: './modal-palets-proceso.component.scss',
})
export class ModalPaletsProcesoComponent implements OnInit {
  constructor() {
    portalToBody();
  }

  private readonly api = inject(PaletsApiService);
  private readonly paletsSync = inject(PaletsSyncService);
  private readonly alertService = inject(AlertaService);
  private readonly loading = inject(LoadingService);
  private readonly connectivity = inject(ConnectivityService);

  readonly proceso = input.required<Proceso>();
  readonly closed = output<void>();

  readonly palets = signal<Palet[]>([]);
  readonly paletSeleccionado = signal<Palet | null>(null);
  readonly composiciones = signal<DPalet[]>([]);
  readonly cargando = signal(true);

  readonly seccionActivosAbierta = signal(true);
  readonly seccionDespachadosAbierta = signal(true);
  readonly seccionComposicionAbierta = signal(true);
  readonly seccionObservacionesAbierta = signal(false);

  readonly paletsActivos = computed(() => this.palets().filter((p) => p.estado !== 'DESPACHADO'));
  readonly paletsDespachados = computed(() => this.palets().filter((p) => p.estado === 'DESPACHADO'));

  async ngOnInit(): Promise<void> {
    await this.cargarPalets();
  }

  private get online(): boolean {
    return this.connectivity.isOnline();
  }

  private async cargarPalets(): Promise<void> {
    const idProceso = String(this.proceso()?.idProceso ?? '').trim();
    this.cargando.set(true);
    try {
      if (!idProceso) { this.palets.set([]); return; }
      if (!this.online) {
        this.alertService.showAlert('Sin conexión', 'Se necesita internet para ver los palets del proceso.', 'warning');
        return;
      }
      const sobre = await this.api.porProceso(idProceso);
      if (sobre?.error) {
        this.alertService.showAlert('Error', sobre.mensaje || 'Error al obtener los palets del proceso', 'error');
        return;
      }
      const lista = (Array.isArray(sobre?.data) ? sobre.data : []) as unknown as Palet[];
      this.palets.set(lista.filter((p: any) => !p?.eliminado));
    } catch (error: any) {
      console.error(error);
      this.alertService.showAlert('Error', `${error?.error?.message ?? 'Error al obtener los palets del proceso'}`, 'error');
    } finally {
      this.cargando.set(false);
    }
  }

  async verDetalle(p: Palet): Promise<void> {
    this.paletSeleccionado.set(p);
    if (!this.online) {
      this.composiciones.set([]);
      this.alertService.showAlert('Sin conexión', 'Se necesita internet para ver el detalle del palet.', 'warning');
      return;
    }
    this.loading.show('Cargando detalle del palet...');
    try {
      const sobre = await this.api.dPaletsPorPalet(String(p?.idPalet ?? '').trim());
      if (sobre?.error) {
        this.composiciones.set([]);
        this.alertService.showAlert('Error', sobre.mensaje ?? 'Error al obtener el detalle del palet', 'error');
        return;
      }
      const items: any[] = Array.isArray(sobre?.data) ? sobre.data : [];
      const activos = (await this.paletsSync.resolverNombres(items)).filter((d: any) => !d?.eliminado);
      this.composiciones.set(activos);
      const totalCajas = activos.reduce((s: number, d: any) => s + (d?.cantidadCajas || 0), 0);
      const totalPeso = activos.reduce((s: number, d: any) => s + (d?.pesoTotal || 0), 0);
      const limite = p?.limiteCajasPorPalet ?? 0;
      const porcentaje = limite > 0 ? Math.round((totalCajas / limite) * 100) : 0;
      const actualizado = { ...p, cantidadCajas: totalCajas, pesoTotal: totalPeso, porcentajeAvance: porcentaje } as Palet;
      this.paletSeleccionado.set(actualizado);
      this.palets.update((l) => l.map((x) => (this.paletKey(x) === this.paletKey(p) ? actualizado : x)));
    } catch (err) {
      console.error('Error cargando detalle del palet:', err);
      this.composiciones.set([]);
      this.alertService.showAlert('Error', 'Error al obtener el detalle del palet', 'error');
    } finally {
      await this.loading.hideAfterMinimum();
    }
  }

  formatPeso(valor: number | undefined | null): string {
    const n = Number(valor ?? 0);
    return String(Math.ceil(n * 1000) / 1000);
  }

  paletKey(p: any): any {
    if (!p) return null;
    const k = String(p?.idPalet ?? '').trim();
    return k || p?.id;
  }

  esSeleccionado(p: Palet): boolean {
    const sel = this.paletSeleccionado();
    return !!sel && this.paletKey(sel) === this.paletKey(p);
  }

  toggleSeccionActivos(): void { this.seccionActivosAbierta.update((a) => !a); }
  toggleSeccionDespachados(): void { this.seccionDespachadosAbierta.update((a) => !a); }
  toggleSeccionComposicion(): void { this.seccionComposicionAbierta.update((a) => !a); }
  toggleSeccionObservaciones(): void { this.seccionObservacionesAbierta.update((a) => !a); }

  paletEstilo(estado: string, seleccionado: boolean): string {
    if (seleccionado) return 'border-emerald-300 border-l-emerald-500 from-emerald-50 to-white ring-1 ring-emerald-300 shadow-md dark:border-emerald-500/50 dark:from-emerald-500/20 dark:to-transparent dark:ring-emerald-500/40';
    switch (estado) {
      case 'ABIERTO': return 'border-l-sky-500 from-sky-50 to-white dark:from-sky-500/15 dark:to-transparent';
      case 'CERRADO_COMPLETO': return 'border-l-emerald-500 from-emerald-50 to-white dark:from-emerald-500/15 dark:to-transparent';
      case 'CERRADO_SALDO': return 'border-l-amber-500 from-amber-50 to-white dark:from-amber-500/15 dark:to-transparent';
      default: return 'border-l-slate-500 from-slate-200/70 to-white dark:from-slate-500/20 dark:to-transparent';
    }
  }

  getEstadoBadgeClass(estado: string): string {
    switch (estado) {
      case 'ABIERTO': return 'badge-info';
      case 'CERRADO_COMPLETO': return 'badge-success';
      case 'CERRADO_SALDO': return 'badge-warning';
      case 'DESPACHADO': return 'badge-neutral';
      default: return 'badge-ghost';
    }
  }

  getEstadoLabel(estado: string): string {
    switch (estado) {
      case 'ABIERTO': return 'ABIERTO';
      case 'CERRADO_COMPLETO': return 'CERRADO COMPLETO';
      case 'CERRADO_SALDO': return 'CERRADO SALDO';
      case 'DESPACHADO': return 'DESPACHADO';
      default: return 'DESCONOCIDO';
    }
  }
}
