import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideChevronDown, LucideListFilter, LucideInbox, LucideNetwork, LucidePencil, LucidePlus, LucidePower, LucideRefreshCcw, LucideSearch, LucideWifiOff, LucideX } from '@lucide/angular';
import { PaginatorComponent } from '../../shared/components/paginator/paginator.component';
import { SearchMultiSelectComponent } from '../../shared/components/search-multi-select/search-multi-select.component';
import { SearchSelectComponent, SearchSelectOption } from '../../shared/components/search-select/search-select.component';
import { CatalogosRepository } from '../../shared/dexiedb/repository/catalogos.repository';
import { Configuracion } from '../../shared/interfaces/administracion.interface';
import { Usuario } from '../../shared/interfaces/auth.interface';
import { AdministracionApiService } from '../../shared/services/administracion-api.service';
import { AlertaService } from '../../shared/services/alerta.service';
import { AuthService } from '../../shared/services/auth.service';
import { ConfirmModalService } from '../../shared/services/confirm-modal.service';
import { ConnectivityService } from '../../shared/services/connectivity.service';
import { FeedbackModalService } from '../../shared/services/feedback-modal.service';
import { LoadingService } from '../../shared/services/loading.service';
import { esDispositivoMovil } from '../../shared/utils/archivo';
import { crearFiltrosColumna } from '../../shared/utils/filtros-columna';
import { crearPaginacion } from '../../shared/utils/paginacion';
import { ModalMatrizComponent } from './components/modal-matriz/modal-matriz.component';
import { CatalogosExternos, MatrizFila, armarFila, matrizAJson } from './matriz-compatibilidad.interface';

type Fila = Record<string, any>;

const texto = (valor: unknown): string => String(valor ?? '').trim();

type FiltroEstado = '' | 'activos' | 'inactivos';

/**
 * Matriz de compatibilidad (solo administrador, solo en línea): combinaciones válidas de cliente, consignatario,
 * destino, formato, empaque, caja, clamshell y presentación de la campaña elegida. Solo las combinaciones se piden al entrar;
 * los catálogos se piden al abrir nueva/editar; del equipo solo se lee cuál es la campaña elegida en Parámetros.
 */
@Component({
  selector: 'app-matriz-compatibilidad',
  imports: [FormsModule, PaginatorComponent, SearchSelectComponent, SearchMultiSelectComponent, LucideListFilter, LucideChevronDown, ModalMatrizComponent, LucideInbox, LucideNetwork, LucidePencil, LucidePlus, LucidePower, LucideRefreshCcw, LucideSearch, LucideWifiOff, LucideX],
  templateUrl: './matriz-compatibilidad.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MatrizCompatibilidadComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly catalogosLocal = inject(CatalogosRepository);
  private readonly administracionApi = inject(AdministracionApiService);
  private readonly connectivity = inject(ConnectivityService);
  private readonly loading = inject(LoadingService);
  private readonly feedback = inject(FeedbackModalService);
  private readonly alertService = inject(AlertaService);
  private readonly confirmModal = inject(ConfirmModalService);

  readonly online = computed(() => this.connectivity.online());
  readonly usuario = signal<Usuario | null>(null);
  /** Campaña elegida en Parámetros. */
  readonly cfg = signal<Configuracion | null>(null);

  readonly matrices = signal<MatrizFila[]>([]);
  readonly filtroTexto = signal('');
  readonly filtroEstado = signal<FiltroEstado>('activos');

  /** Ventana abierta: null = cerrada; { matriz: null } = nueva; { matriz } = editar. */
  readonly modal = signal<{ matriz: MatrizFila | null } | null>(null);

  readonly estadoOpciones: SearchSelectOption[] = [
    { value: '', label: 'Todos los estados' },
    { value: 'activos', label: 'Activos' },
    { value: 'inactivos', label: 'Inactivos' },
  ];

  /** Filtros por columna desplegados o recogidos (empiezan recogidos). */
  readonly panelFiltros = signal(false);
  readonly cantidadFiltros = computed(() => Object.values(this.columnas.elegidos()).filter((v) => v.length > 0).length);

  /** Filtros múltiples por columna (solo sobre lo listado). */
  readonly columnas = crearFiltrosColumna<MatrizFila>(() => this.matrices(), [
    { clave: 'cliente', etiqueta: 'Cliente', placeholder: 'Todos los clientes', valor: (m) => m.clienteNombre },
    { clave: 'consignatario', etiqueta: 'Consignatario', placeholder: 'Todos los consignatarios', valor: (m) => m.consignatarioNombre },
    { clave: 'destino', etiqueta: 'Destino', placeholder: 'Todos los destinos', valor: (m) => m.destinoNombre },
    { clave: 'formato', etiqueta: 'Formato', placeholder: 'Todos los formatos', valor: (m) => m.formatoNombre },
    { clave: 'empaque', etiqueta: 'Empaque', placeholder: 'Todos los empaques', valor: (m) => m.tipoEmpaqueNombre },
    { clave: 'guia', etiqueta: 'Empaque guía', placeholder: 'Todos los empaques guía', valor: (m) => m.tipoEmpaqueGuiaNombre },
    { clave: 'calibre', etiqueta: 'Calibre', placeholder: 'Todos los calibres', valor: (m) => m.calibreNombre },
    { clave: 'caja', etiqueta: 'Caja', placeholder: 'Todas las cajas', valor: (m) => m.tipoCajaNombre },
    { clave: 'clamshell', etiqueta: 'Clamshell', placeholder: 'Todos los clamshell', valor: (m) => m.tipoClamshellNombre },
    { clave: 'presentacion', etiqueta: 'Presentación', placeholder: 'Todas las presentaciones', valor: (m) => m.presentacionNombre },
    { clave: 'categoria', etiqueta: 'Categoría', placeholder: 'Todas las categorías', valor: (m) => m.categoriaNombre },
  ]);

  /** Combinaciones que cumplen el estado elegido y lo escrito (cualquier nombre de la fila). */
  readonly matricesFiltradas = computed(() => {
    const buscado = this.filtroTexto().trim().toLowerCase();
    const estado = this.filtroEstado();
    return this.matrices().filter((m) => {
      if (estado === 'activos' && !m.activo) return false;
      if (estado === 'inactivos' && m.activo) return false;
      if (!this.columnas.pasa(m)) return false;
      if (!buscado) return true;
      return [
        m.clienteNombre, m.consignatarioNombre, m.documentoConsignatario, m.destinoNombre, m.formatoNombre, m.tipoEmpaqueNombre,
        m.tipoEmpaqueGuiaNombre, m.calibreNombre, m.tipoCajaNombre, m.tipoClamshellNombre, m.presentacionNombre, m.categoriaNombre,
      ].some((valor) => texto(valor).toLowerCase().includes(buscado));
    });
  });
  readonly paginacion = crearPaginacion(() => this.matricesFiltradas(), 25);

  async ngOnInit(): Promise<void> {
    const session = await this.auth.getSession();
    this.usuario.set(session?.user ?? null);
    const nro = texto(this.usuario()?.documentoIdentidad);
    this.cfg.set(nro ? ((await this.catalogosLocal.configuracionRepo.getByField('nrodocumento', nro)) ?? null) : null);
    await this.cargar();
  }

  /** La respuesta de un SP trae { error, data }; si falló o no hay filas, devuelve lista vacía. */
  private filas(sobre: { error?: boolean; data?: unknown } | undefined): Fila[] {
    return sobre && !sobre.error && Array.isArray(sobre.data) ? (sobre.data as Fila[]) : [];
  }

  /** Pide al servidor solo las combinaciones (los nombres vienen del SP) y arma la lista (no guarda nada en el equipo). */
  async cargar(): Promise<void> {
    const idProyecto = texto(this.cfg()?.idProyecto);
    const codigoCultivo = texto(this.cfg()?.codigoCultivo);
    if (!idProyecto || !codigoCultivo) {
      this.matrices.set([]);
      return;
    }
    if (!this.online()) {
      this.matrices.set([]);
      this.feedback.error('Error de conexión: necesitas internet para ver la matriz.', 'Sin conexión');
      return;
    }

    this.loading.show('Cargando matriz de compatibilidad...');
    try {
      const sobre = await this.administracionApi.matricesCompatibilidad(idProyecto, codigoCultivo);
      if (sobre?.error) {
        this.matrices.set([]);
        this.feedback.error(sobre.mensaje || 'No se pudo obtener la matriz de compatibilidad.');
        return;
      }
      const [consignatarios, destinos, calibres] = await Promise.all([
        this.catalogosLocal.consignatariosRepo.getAll(),
        this.catalogosLocal.destinosRepo.getAll(),
        this.catalogosLocal.calibresRepo.getAll(),
      ]);
      const externos: CatalogosExternos = { clientes: [], consignatarios: consignatarios as Fila[], destinos: destinos as Fila[], calibres: calibres as Fila[] };
      this.matrices.set(this.filas(sobre).map((fila) => armarFila(fila, externos)));
      this.paginacion.page.set(1);
    } catch {
      this.matrices.set([]);
      this.feedback.error('Error de conexión: no se pudo obtener la matriz de compatibilidad.', 'Sin conexión');
    } finally {
      await this.loading.hideAfterMinimum();
    }
  }

  nueva(): void {
    this.modal.set({ matriz: null });
  }

  editar(m: MatrizFila): void {
    this.modal.set({ matriz: m });
  }

  /** Celular o tablet: un toque sobre la fila abre la edición. */
  alTocarFila(m: MatrizFila): void {
    if (esDispositivoMovil()) this.editar(m);
  }

  /** Computador: doble clic sobre la fila abre la edición. */
  alHacerDobleClicFila(m: MatrizFila): void {
    if (!esDispositivoMovil()) this.editar(m);
  }

  /** El modal ya guardó: se cierra, se avisa y se vuelve a pedir todo al servidor. */
  async alGuardar(mensaje: string): Promise<void> {
    this.modal.set(null);
    this.alertService.showAlert('Éxito', mensaje, 'success');
    await this.cargar();
  }

  /** Activa o desactiva la combinación (pide confirmación y lo envía de frente al servidor). */
  async cambiarEstado(m: MatrizFila): Promise<void> {
    if (!this.online()) {
      this.feedback.warning('Necesitas internet para cambiar el estado.', 'Sin conexión');
      return;
    }

    const activar = !m.activo;
    const confirmado = await this.confirmModal.confirm({
      title: activar ? 'Activar combinación' : 'Desactivar combinación',
      eyebrow: 'Estado de la combinación',
      message: activar ? 'La combinación volverá a estar disponible.' : 'La combinación dejará de estar disponible.',
      detail: `${m.consignatarioNombre} · ${m.destinoNombre} · ${m.formatoNombre}`,
      confirmText: activar ? 'Activar' : 'Desactivar',
      cancelText: 'Cancelar',
      tone: activar ? 'success' : 'danger',
    });
    if (!confirmado) return;

    this.loading.show(activar ? 'Activando combinación...' : 'Desactivando combinación...');
    try {
      const json = matrizAJson({ ...m, activo: activar }, 'editado', texto(this.cfg()?.idProyecto), texto(this.cfg()?.codigoCultivo));
      const respuesta = await this.administracionApi.sincronizarMatricesCompatibilidad(json);
      this.loading.hide();
      if (respuesta?.error) {
        this.feedback.error(respuesta.mensaje || 'No se pudo cambiar el estado.');
        return;
      }
      this.alertService.showAlert('Éxito', activar ? 'Combinación activada' : 'Combinación desactivada', 'success');
      await this.cargar();
    } catch {
      this.loading.hide();
      this.feedback.error('Ocurrió un error inesperado al cambiar el estado.');
    }
  }
}
