import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideBuilding2, LucideInbox, LucidePencil, LucideRefreshCcw, LucideSearch, LucideWifiOff, LucideX } from '@lucide/angular';
import { PaginatorComponent } from '../../shared/components/paginator/paginator.component';
import { CatalogosRepository } from '../../shared/dexiedb/repository/catalogos.repository';
import { Configuracion } from '../../shared/interfaces/administracion.interface';
import { Usuario } from '../../shared/interfaces/auth.interface';
import { AlertaService } from '../../shared/services/alerta.service';
import { AuthService } from '../../shared/services/auth.service';
import { CatalogosApiService } from '../../shared/services/catalogos-api.service';
import { ConnectivityService } from '../../shared/services/connectivity.service';
import { FeedbackModalService } from '../../shared/services/feedback-modal.service';
import { LoadingService } from '../../shared/services/loading.service';
import { esDispositivoMovil } from '../../shared/utils/archivo';
import { crearPaginacion } from '../../shared/utils/paginacion';
import { AcopioConfig } from './acopios-config.interface';
import { ModalEditarAcopioComponent } from './components/modal-editar-acopio/modal-editar-acopio.component';

const texto = (valor: unknown): string => String(valor ?? '').trim();

/**
 * Configuración de acopios (solo administrador, solo en línea): para cada acopio se elige la serie de guía
 * y los tipos de proceso empacado activos. Todo se lee y se guarda en el servidor; no se guarda nada en el equipo
 * (solo se lee del equipo cuál es la campaña elegida en Parámetros).
 */
@Component({
  selector: 'app-acopios-config',
  imports: [
    FormsModule,
    PaginatorComponent,
    ModalEditarAcopioComponent,
    LucideBuilding2,
    LucideInbox,
    LucidePencil,
    LucideRefreshCcw,
    LucideSearch,
    LucideWifiOff,
    LucideX,
  ],
  templateUrl: './acopios-config.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AcopiosConfigComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly catalogos = inject(CatalogosRepository);
  private readonly catalogosApi = inject(CatalogosApiService);
  private readonly connectivity = inject(ConnectivityService);
  private readonly loading = inject(LoadingService);
  private readonly feedback = inject(FeedbackModalService);
  private readonly alertService = inject(AlertaService);

  readonly online = computed(() => this.connectivity.online());
  readonly usuario = signal<Usuario | null>(null);
  /** Campaña elegida en Parámetros (solo se lee su idProyecto). */
  readonly cfg = signal<Configuracion | null>(null);

  readonly acopios = signal<AcopioConfig[]>([]);
  readonly filtroTexto = signal('');
  /** Acopio que se está editando (null = ventana cerrada). */
  readonly editando = signal<AcopioConfig | null>(null);

  /** Acopios que coinciden con lo escrito en el buscador (código, nombre o serie). */
  readonly acopiosFiltrados = computed(() => {
    const buscado = this.filtroTexto().trim().toLowerCase();
    if (!buscado) return this.acopios();
    return this.acopios().filter((a) =>
      [a.codigoAcopio, a.acopioNombre, a.serieGuia].some((valor) => texto(valor).toLowerCase().includes(buscado)),
    );
  });
  readonly paginacion = crearPaginacion(() => this.acopiosFiltrados(), 25);

  async ngOnInit(): Promise<void> {
    const session = await this.auth.getSession();
    this.usuario.set(session?.user ?? null);
    await this.cargarConfiguracion();
    await this.cargarAcopios();
  }

  /** Lee del equipo cuál es la campaña elegida (necesaria para pedir los acopios). */
  private async cargarConfiguracion(): Promise<void> {
    const nro = texto(this.usuario()?.documentoIdentidad);
    this.cfg.set(nro ? ((await this.catalogos.configuracionRepo.getByField('nrodocumento', nro)) ?? null) : null);
  }

  /** Pide al servidor los acopios con su configuración y los muestra (no guarda nada en el equipo). */
  async cargarAcopios(): Promise<void> {
    const idProyecto = texto(this.cfg()?.idProyecto);
    if (!idProyecto) {
      this.acopios.set([]);
      return;
    }
    if (!this.online()) {
      this.acopios.set([]);
      this.feedback.error('Error de conexión: necesitas internet para ver los acopios.', 'Sin conexión');
      return;
    }

    this.loading.show('Cargando acopios...');
    try {
      const sobre = await this.catalogosApi.acopios(idProyecto);
      if (sobre?.error) {
        this.acopios.set([]);
        this.feedback.error(sobre.mensaje || 'No se pudieron obtener los acopios.');
        return;
      }
      const filas = Array.isArray(sobre?.data) ? sobre.data : [];
      this.acopios.set(
        filas.map((fila) => ({
          id: Number(fila['id'] ?? 0),
          codigoAcopio: texto(fila['codigoAcopio']),
          acopioNombre: texto(fila['acopioNombre']),
          serieGuia: texto(fila['serieGuia']),
          tiposProcesoEmpacado: Array.isArray(fila['tiposProcesoEmpacado']) ? fila['tiposProcesoEmpacado'] : [],
        })),
      );
      this.paginacion.page.set(1);
    } catch {
      this.acopios.set([]);
      this.feedback.error('Error de conexión: no se pudieron obtener los acopios.', 'Sin conexión');
    } finally {
      await this.loading.hideAfterMinimum();
    }
  }

  /** Nombres de los tipos de proceso que están activos en el acopio. */
  tiposActivos(acopio: AcopioConfig): string[] {
    return acopio.tiposProcesoEmpacado.filter((t) => t.activo).map((t) => t.nombre);
  }

  /** Celular o tablet: un toque sobre la fila abre la edición. */
  alTocarFila(acopio: AcopioConfig): void {
    if (esDispositivoMovil()) this.editar(acopio);
  }

  /** Computador: doble clic sobre la fila abre la edición. */
  alHacerDobleClicFila(acopio: AcopioConfig): void {
    if (!esDispositivoMovil()) this.editar(acopio);
  }

  editar(acopio: AcopioConfig): void {
    this.editando.set(acopio);
  }

  /** El modal ya guardó: se cierra, se avisa y se vuelve a pedir la lista al servidor. */
  async alGuardar(mensaje: string): Promise<void> {
    this.editando.set(null);
    this.alertService.showAlert('Éxito', mensaje, 'success');
    await this.cargarAcopios();
  }
}
