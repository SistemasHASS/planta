import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideInbox, LucidePencil, LucidePlus, LucideRefreshCcw, LucideSearch, LucideSprout, LucideWifiOff, LucideX } from '@lucide/angular';
import { PaginatorComponent } from '../../shared/components/paginator/paginator.component';
import { SearchMultiSelectComponent } from '../../shared/components/search-multi-select/search-multi-select.component';
import { CatalogosRepository } from '../../shared/dexiedb/repository/catalogos.repository';
import { Campania } from '../../shared/interfaces/catalogo.interface';
import { AlertaService } from '../../shared/services/alerta.service';
import { AuthService } from '../../shared/services/auth.service';
import { CatalogosApiService } from '../../shared/services/catalogos-api.service';
import { ConnectivityService } from '../../shared/services/connectivity.service';
import { FeedbackModalService } from '../../shared/services/feedback-modal.service';
import { LoadingService } from '../../shared/services/loading.service';
import { esDispositivoMovil } from '../../shared/utils/archivo';
import { crearFiltrosColumna } from '../../shared/utils/filtros-columna';
import { crearPaginacion } from '../../shared/utils/paginacion';
import { ModalVariedadComponent } from './components/modal-variedad/modal-variedad.component';
import { VariedadFila, armarVariedad, texto } from './variedades.interface';

/**
 * Variedades - Maestro. Solo administrador y solo en línea: la lista del cultivo de la campaña viene del servidor;
 * se pueden crear variedades de ensayo, editar su nombre y la procedencia de cualquier variedad.
 * No se guarda nada en el equipo (solo se lee la campaña elegida en Parámetros).
 */
@Component({
  selector: 'app-variedades',
  imports: [FormsModule, PaginatorComponent, SearchMultiSelectComponent, ModalVariedadComponent, LucideInbox, LucidePencil, LucidePlus, LucideRefreshCcw, LucideSearch, LucideSprout, LucideWifiOff, LucideX],
  templateUrl: './variedades.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VariedadesComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly catalogosLocal = inject(CatalogosRepository);
  private readonly catalogosApi = inject(CatalogosApiService);
  private readonly connectivity = inject(ConnectivityService);
  private readonly loading = inject(LoadingService);
  private readonly feedback = inject(FeedbackModalService);
  private readonly alertService = inject(AlertaService);

  readonly online = computed(() => this.connectivity.online());
  /** Campaña elegida en Parámetros (de ahí salen el cultivo y su nombre). */
  readonly campania = signal<Campania | null>(null);
  readonly codigoCultivo = computed(() => texto(this.campania()?.codcultivo));
  readonly faltaCampania = computed(() => !this.codigoCultivo());

  readonly registros = signal<VariedadFila[]>([]);
  readonly filtroTexto = signal('');
  /** Ventana abierta: null = cerrada; { registro: null } = nueva; { registro } = editar. */
  readonly modal = signal<{ registro: VariedadFila | null } | null>(null);

  /** Filtros múltiples por columna (solo sobre lo listado). */
  readonly columnas = crearFiltrosColumna<VariedadFila>(() => this.registros(), [
    { clave: 'tipo', etiqueta: 'Tipo', placeholder: 'Todos (tipo)', valor: (r) => (r.esEnsayo ? 'Ensayo' : 'Maestro') },
    { clave: 'procedencia', etiqueta: 'Procedencia', placeholder: 'Todas (procedencia)', valor: (r) => r.procedencia || 'Sin procedencia' },
  ]);

  readonly filtrados = computed(() => {
    const buscado = this.filtroTexto().trim().toLowerCase();
    return this.registros().filter((r) => {
      if (!this.columnas.pasa(r)) return false;
      if (!buscado) return true;
      return `${r.codigo} ${r.cultivo} ${r.idvariedad} ${r.variedad} ${r.procedencia}`.toLowerCase().includes(buscado);
    });
  });
  readonly paginacion = crearPaginacion(() => this.filtrados(), 25);

  async ngOnInit(): Promise<void> {
    const session = await this.auth.getSession();
    const nro = texto(session?.user?.documentoIdentidad);
    const cfg = nro ? await this.catalogosLocal.configuracionRepo.getByField('nrodocumento', nro) : null;
    const idProyecto = texto(cfg?.idProyecto);
    this.campania.set(idProyecto ? ((await this.catalogosLocal.campaniaRepo.getByField('idproyecto', idProyecto)) ?? null) : null);
    await this.cargar();
  }

  /** Pide al servidor las variedades (solo su endpoint; no guarda nada en el equipo). */
  async cargar(): Promise<void> {
    if (this.faltaCampania()) {
      this.registros.set([]);
      return;
    }
    if (!this.online()) {
      this.registros.set([]);
      this.feedback.error('Error de conexión: necesitas internet para ver los datos.', 'Sin conexión');
      return;
    }
    this.loading.show('Cargando variedades...');
    try {
      const sobre = await this.catalogosApi.variedades();
      if (sobre?.error) {
        this.registros.set([]);
        this.feedback.error(sobre.mensaje || 'No se pudo obtener las variedades.');
        return;
      }
      const filas = Array.isArray(sobre?.data) ? sobre.data : [];
      const nombreCultivo = texto(this.campania()?.fruta).toUpperCase();
      this.registros.set(
        filas
          .filter((f) => texto(f['idcultivo'] ?? f['codigoCultivo']) === this.codigoCultivo())
          .filter((f) => !['1', 'true'].includes(String(f['eliminado'] ?? '').toLowerCase()))
          .map((f, i) => {
            const fila = armarVariedad(f, i);
            return { ...fila, cultivo: (fila.cultivo || nombreCultivo).toUpperCase() };
          }),
      );
      this.paginacion.page.set(1);
    } catch {
      this.registros.set([]);
      this.feedback.error('Error de conexión: no se pudo obtener las variedades.', 'Sin conexión');
    } finally {
      await this.loading.hideAfterMinimum();
    }
  }

  nueva(): void {
    this.modal.set({ registro: null });
  }

  editar(r: VariedadFila): void {
    this.modal.set({ registro: r });
  }

  alTocarFila(r: VariedadFila): void {
    if (esDispositivoMovil()) this.editar(r);
  }

  alHacerDobleClicFila(r: VariedadFila): void {
    if (!esDispositivoMovil()) this.editar(r);
  }

  async alGuardar(mensaje: string): Promise<void> {
    this.modal.set(null);
    this.alertService.showAlert('Éxito', mensaje, 'success');
    await this.cargar();
  }
}
