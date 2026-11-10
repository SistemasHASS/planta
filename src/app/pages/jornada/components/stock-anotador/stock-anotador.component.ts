import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { LucideBoxes, LucideRefreshCcw } from '@lucide/angular';
import { ConnectivityService } from '../../../../shared/services/connectivity.service';
import { LoadingService } from '../../../../shared/services/loading.service';
import { JornadasAnotadorApiService } from '../../../../shared/services/jornadas-anotador-api.service';
import { Fila, texto } from '../../jornada.utils';

/**
 * Pestaña "Stock" del anotador: las cajas que ÉL registró y que Logística todavía no consumió en un palet, por formato y tipo de empaque.
 * Solo se ve lo propio (el servidor filtra por usuario); no se juntan los anotadores.
 */
@Component({
  selector: 'app-stock-anotador',
  imports: [LucideBoxes, LucideRefreshCcw],
  templateUrl: './stock-anotador.component.html',
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StockAnotadorComponent implements OnInit {
  private readonly api = inject(JornadasAnotadorApiService);
  private readonly connectivity = inject(ConnectivityService);
  private readonly loading = inject(LoadingService);

  protected readonly filas = signal<Fila[]>([]);
  protected readonly cargando = signal(true);
  protected readonly error = signal('');

  protected readonly totalCajas = computed(() => this.filas().reduce((suma, f) => suma + (Number(f['total']) || 0), 0));

  ngOnInit(): Promise<void> {
    return this.cargar();
  }

  /** Botón Actualizar: misma consulta, con el modal de loading en vez de dejar la tabla quieta. */
  protected async actualizar(): Promise<void> {
    if (this.cargando()) return;
    this.loading.show('Actualizando stock...');
    try {
      await this.cargar();
    } finally {
      await this.loading.hideAfterMinimum();
    }
  }

  protected async cargar(): Promise<void> {
    if (!this.connectivity.online()) {
      this.error.set('No hay conexión a internet.');
      this.cargando.set(false);
      return;
    }
    this.cargando.set(true);
    this.error.set('');
    try {
      const r = await this.api.stockAnotador();
      if (r.error) throw new Error(r.mensaje || 'No se pudo consultar el stock.');
      this.filas.set(r.data ?? []);
    } catch (e) {
      this.error.set(e instanceof Error && e.message ? e.message : 'No se pudo consultar el stock.');
    } finally {
      this.cargando.set(false);
    }
  }

  /** "Tipo de empaque — categoría — calibre" sin dejar huecos si algún dato no existe. */
  protected tipoEmpaque(f: Fila): string {
    return [f['tipoEmpaqueDescripcion'], f['categoriaNombre'], f['calibreNombre']].map(texto).filter(Boolean).join(' — ') || '—';
  }
}
