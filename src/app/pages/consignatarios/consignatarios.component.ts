import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideInbox, LucidePencil, LucideRefreshCcw, LucideSearch, LucideUsers, LucideWifiOff, LucideX } from '@lucide/angular';
import { PaginatorComponent } from '../../shared/components/paginator/paginator.component';
import { SearchMultiSelectComponent } from '../../shared/components/search-multi-select/search-multi-select.component';
import { CatalogosRepository } from '../../shared/dexiedb/repository/catalogos.repository';
import { Configuracion } from '../../shared/interfaces/administracion.interface';
import { AlertaService } from '../../shared/services/alerta.service';
import { AuthService } from '../../shared/services/auth.service';
import { CatalogosApiService } from '../../shared/services/catalogos-api.service';
import { ConnectivityService } from '../../shared/services/connectivity.service';
import { FeedbackModalService } from '../../shared/services/feedback-modal.service';
import { LoadingService } from '../../shared/services/loading.service';
import { esDispositivoMovil } from '../../shared/utils/archivo';
import { crearFiltrosColumna } from '../../shared/utils/filtros-columna';
import { crearPaginacion } from '../../shared/utils/paginacion';
import { ModalConsignatarioComponent } from './components/modal-consignatario/modal-consignatario.component';
import { ConsignatarioFila, armarConsignatario, texto } from './consignatarios.interface';

/**
 * Consignatarios - Maestro. Solo administrador y solo en línea: la lista viene del servidor y a cada consignatario
 * se le asigna su grupo cliente y sus códigos rancho (no se crean ni se desactivan). No se guarda nada en el equipo
 * (solo se lee cuál es la campaña elegida en Parámetros, para los códigos rancho del proyecto).
 */
@Component({
  selector: 'app-consignatarios',
  imports: [FormsModule, PaginatorComponent, SearchMultiSelectComponent, ModalConsignatarioComponent, LucideInbox, LucidePencil, LucideRefreshCcw, LucideSearch, LucideUsers, LucideWifiOff, LucideX],
  templateUrl: './consignatarios.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConsignatariosComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly catalogosLocal = inject(CatalogosRepository);
  private readonly catalogosApi = inject(CatalogosApiService);
  private readonly connectivity = inject(ConnectivityService);
  private readonly loading = inject(LoadingService);
  private readonly feedback = inject(FeedbackModalService);
  private readonly alertService = inject(AlertaService);

  readonly online = computed(() => this.connectivity.online());
  readonly cfg = signal<Configuracion | null>(null);
  readonly idProyecto = computed(() => texto(this.cfg()?.idProyecto));

  readonly registros = signal<ConsignatarioFila[]>([]);
  readonly filtroTexto = signal('');
  readonly modal = signal<ConsignatarioFila | null>(null);

  /** Filtro múltiple por grupo cliente (solo sobre lo listado). */
  readonly columnas = crearFiltrosColumna<ConsignatarioFila>(() => this.registros(), [
    { clave: 'grupo', etiqueta: 'Grupo cliente', placeholder: 'Todos (grupo cliente)', valor: (r) => r.nombreGrupoCliente || 'Sin grupo' },
  ]);

  readonly filtrados = computed(() => {
    const buscado = this.filtroTexto().trim().toLowerCase();
    return this.registros().filter((r) => {
      if (!this.columnas.pasa(r)) return false;
      if (!buscado) return true;
      return `${r.documento} ${r.nombre} ${r.nombreGrupoCliente} ${this.ranchos(r)}`.toLowerCase().includes(buscado);
    });
  });
  readonly paginacion = crearPaginacion(() => this.filtrados(), 25);

  ranchos(r: ConsignatarioFila): string {
    return r.codigosRancho.map((c) => c.codigo).join(', ');
  }

  async ngOnInit(): Promise<void> {
    const session = await this.auth.getSession();
    const nro = texto(session?.user?.documentoIdentidad);
    this.cfg.set(nro ? ((await this.catalogosLocal.configuracionRepo.getByField('nrodocumento', nro)) ?? null) : null);
    await this.cargar();
  }

  /** Pide al servidor los consignatarios (solo su endpoint; no guarda nada en el equipo). */
  async cargar(): Promise<void> {
    if (!this.online()) {
      this.registros.set([]);
      this.feedback.error('Error de conexión: necesitas internet para ver los datos.', 'Sin conexión');
      return;
    }
    this.loading.show('Cargando consignatarios...');
    try {
      const sobre = await this.catalogosApi.consignatarios();
      if (sobre?.error) {
        this.registros.set([]);
        this.feedback.error(sobre.mensaje || 'No se pudo obtener los consignatarios.');
        return;
      }
      const filas = Array.isArray(sobre?.data) ? sobre.data : [];
      this.registros.set(filas.map((f, i) => armarConsignatario(f, i)));
      this.paginacion.page.set(1);
    } catch {
      this.registros.set([]);
      this.feedback.error('Error de conexión: no se pudo obtener los consignatarios.', 'Sin conexión');
    } finally {
      await this.loading.hideAfterMinimum();
    }
  }

  editar(r: ConsignatarioFila): void {
    this.modal.set(r);
  }

  alTocarFila(r: ConsignatarioFila): void {
    if (esDispositivoMovil()) this.editar(r);
  }

  alHacerDobleClicFila(r: ConsignatarioFila): void {
    if (!esDispositivoMovil()) this.editar(r);
  }

  async alGuardar(mensaje: string): Promise<void> {
    this.modal.set(null);
    this.alertService.showAlert('Éxito', mensaje, 'success');
    await this.cargar();
  }
}
