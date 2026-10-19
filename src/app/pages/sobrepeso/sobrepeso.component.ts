import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideChevronDown, LucideListFilter, LucideGauge, LucideInbox, LucidePencil, LucidePlus, LucidePower, LucideRefreshCcw, LucideSearch, LucideWifiOff, LucideX } from '@lucide/angular';
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
import { opcionesDe } from '../../shared/utils/opciones-select';
import { crearFiltrosColumna } from '../../shared/utils/filtros-columna';
import { crearPaginacion } from '../../shared/utils/paginacion';
import { ModalReglaSobrepesoComponent } from './components/modal-regla-sobrepeso/modal-regla-sobrepeso.component';
import { ReglaSobrepeso, reglaAJson } from './sobrepeso.interface';

type Fila = Record<string, any>;

const texto = (valor: unknown): string => String(valor ?? '').trim();

/** El servidor puede mandar bit como true/false, 1/0 o texto. */
const esVerdadero = (valor: unknown): boolean => {
  if (typeof valor === 'string') return ['1', 'true', 'si', 'sí'].includes(valor.trim().toLowerCase());
  return valor === true || valor === 1;
};

/** Deja la fecha como aaaa-mm-dd (el servidor la manda con hora). */
const soloFecha = (valor: unknown): string => texto(valor).slice(0, 10);

type FiltroEstado = '' | 'activos' | 'inactivos';

/**
 * Reglas de sobrepeso (solo administrador, solo en línea): porcentaje de sobrepeso por consignatario, formato,
 * destino y transporte de la campaña elegida. Las reglas se leen y se guardan en el servidor; del equipo solo se
 * leen la campaña elegida y los nombres de los catálogos (consignatarios, destinos y transportes); el nombre del formato ya viene en la lista de reglas.
 */
@Component({
  selector: 'app-sobrepeso',
  imports: [FormsModule, PaginatorComponent, SearchSelectComponent, SearchMultiSelectComponent, LucideListFilter, LucideChevronDown, ModalReglaSobrepesoComponent, LucideGauge, LucideInbox, LucidePencil, LucidePlus, LucidePower, LucideRefreshCcw, LucideSearch, LucideWifiOff, LucideX],
  templateUrl: './sobrepeso.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SobrepesoComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly catalogos = inject(CatalogosRepository);
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

  readonly reglas = signal<ReglaSobrepeso[]>([]);
  readonly filtroTexto = signal('');
  readonly filtroEstado = signal<FiltroEstado>('');

  /** Listas de los catálogos del equipo (para los nombres y para los buscadores del modal). */
  readonly optConsignatarios = signal<SearchSelectOption[]>([]);
  readonly optDestinos = signal<SearchSelectOption[]>([]);
  readonly optTransportes = signal<SearchSelectOption[]>([]);

  /** Ventana abierta: null = cerrada; { regla: null } = nueva; { regla } = editar. */
  readonly modal = signal<{ regla: ReglaSobrepeso | null } | null>(null);

  readonly estadoOpciones: SearchSelectOption[] = [
    { value: '', label: 'Todos los estados' },
    { value: 'activos', label: 'Activos' },
    { value: 'inactivos', label: 'Inactivos' },
  ];

  /** Filtros por columna desplegados o recogidos (empiezan recogidos). */
  readonly panelFiltros = signal(false);
  readonly cantidadFiltros = computed(() => Object.values(this.columnas.elegidos()).filter((v) => v.length > 0).length);

  /** Filtros múltiples por columna (solo sobre lo listado). */
  readonly columnas = crearFiltrosColumna<ReglaSobrepeso>(() => this.reglas(), [
    { clave: 'consignatario', etiqueta: 'Consignatario', placeholder: 'Todos los consignatarios', valor: (r) => r.consignatarioNombre },
    { clave: 'formato', etiqueta: 'Formato', placeholder: 'Todos los formatos', valor: (r) => r.formatoNombre },
    { clave: 'destino', etiqueta: 'Destino', placeholder: 'Todos los destinos', valor: (r) => r.destinoNombre },
    { clave: 'transporte', etiqueta: 'Transporte', placeholder: 'Todos los transportes', valor: (r) => r.transporteNombre },
    { clave: 'porcentaje', etiqueta: 'Porcentaje', placeholder: 'Todos los porcentajes', valor: (r) => this.porcentajeTexto(r.porcentaje) },
  ]);

  /** Reglas que cumplen el estado elegido y lo escrito (nombres, porcentaje, descripción). */
  readonly reglasFiltradas = computed(() => {
    const buscado = this.filtroTexto().trim().toLowerCase();
    const estado = this.filtroEstado();
    return this.reglas().filter((r) => {
      if (estado === 'activos' && !r.activo) return false;
      if (estado === 'inactivos' && r.activo) return false;
      if (!this.columnas.pasa(r)) return false;
      if (!buscado) return true;
      return [r.consignatarioNombre, r.documentoConsignatario, r.formatoNombre, r.destinoNombre, r.transporteNombre, this.porcentajeTexto(r.porcentaje), r.descripcion].some((valor) =>
        texto(valor).toLowerCase().includes(buscado),
      );
    });
  });
  readonly paginacion = crearPaginacion(() => this.reglasFiltradas(), 25);

  async ngOnInit(): Promise<void> {
    const session = await this.auth.getSession();
    this.usuario.set(session?.user ?? null);
    const nro = texto(this.usuario()?.documentoIdentidad);
    this.cfg.set(nro ? ((await this.catalogos.configuracionRepo.getByField('nrodocumento', nro)) ?? null) : null);
    await this.cargarCatalogos();
    await this.cargarReglas();
  }

  /** Lee del equipo los catálogos ya guardados (consignatarios, destinos y transportes) para mostrar nombres y elegir en el modal. */
  private async cargarCatalogos(): Promise<void> {
    const [consignatarios, destinos, transportes] = await Promise.all([
      this.catalogos.consignatariosRepo.getAll(),
      this.catalogos.destinosRepo.getAll(),
      this.catalogos.transportesRepo.getAll(),
    ]);
    this.optConsignatarios.set(opcionesDe(consignatarios as Fila[], 'documento', ['documento', 'nombre']));
    this.optDestinos.set(opcionesDe(destinos as Fila[], 'id', ['pais']));
    this.optTransportes.set(opcionesDe(transportes as Fila[], 'id', ['transporte']));
  }

  private nombreDe(opciones: SearchSelectOption[], valor: string): string {
    return opciones.find((o) => o.value === valor)?.label ?? '—';
  }

  porcentajeTexto(p: number): string {
    return Number.isFinite(Number(p)) ? `${(Number(p) * 100).toFixed(2)}%` : '—';
  }

  /** dd/mm/aaaa a partir de aaaa-mm-dd. */
  private fechaCorta(f: string): string {
    const [a, m, d] = f.split('-');
    return a && m && d ? `${d}/${m}/${a}` : '';
  }

  vigenciaTexto(r: ReglaSobrepeso): string {
    return `${this.fechaCorta(r.vigenciaDesde) || '—'} – ${this.fechaCorta(r.vigenciaHasta) || '∞'}`;
  }

  /** Pide al servidor las reglas de la campaña y las muestra (no guarda nada en el equipo). */
  async cargarReglas(): Promise<void> {
    const idProyecto = texto(this.cfg()?.idProyecto);
    const codigoCultivo = texto(this.cfg()?.codigoCultivo);
    if (!idProyecto || !codigoCultivo) {
      this.reglas.set([]);
      return;
    }
    if (!this.online()) {
      this.reglas.set([]);
      this.feedback.error('Error de conexión: necesitas internet para ver las reglas.', 'Sin conexión');
      return;
    }

    this.loading.show('Cargando reglas...');
    try {
      const sobre = await this.administracionApi.reglasSobrepeso(idProyecto, codigoCultivo);
      if (sobre?.error) {
        this.reglas.set([]);
        this.feedback.error(sobre.mensaje || 'No se pudieron obtener las reglas de sobrepeso.');
        return;
      }
      const filas = Array.isArray(sobre?.data) ? sobre.data : [];
      this.reglas.set(
        filas.map((fila) => {
          const documentoConsignatario = texto(fila['documentoConsignatario']);
          const formatoId = texto(fila['formatoId']);
          const destinoId = texto(fila['destinoId']);
          const transporteId = texto(fila['transporteId']);
          return {
            id: Number(fila['id'] ?? 0),
            documentoConsignatario,
            formatoId,
            destinoId,
            transporteId,
            porcentaje: Number(fila['porcentaje'] ?? 0),
            vigenciaDesde: soloFecha(fila['vigenciaDesde']),
            vigenciaHasta: soloFecha(fila['vigenciaHasta']),
            descripcion: texto(fila['descripcion']),
            activo: esVerdadero(fila['activo']),
            consignatarioNombre: this.nombreDe(this.optConsignatarios(), documentoConsignatario),
            formatoNombre: texto(fila['formato']) || '—',
            destinoNombre: this.nombreDe(this.optDestinos(), destinoId),
            transporteNombre: this.nombreDe(this.optTransportes(), transporteId),
          };
        }),
      );
      this.paginacion.page.set(1);
    } catch {
      this.reglas.set([]);
      this.feedback.error('Error de conexión: no se pudieron obtener las reglas.', 'Sin conexión');
    } finally {
      await this.loading.hideAfterMinimum();
    }
  }

  nueva(): void {
    this.modal.set({ regla: null });
  }

  editar(r: ReglaSobrepeso): void {
    this.modal.set({ regla: r });
  }

  /** Celular o tablet: un toque sobre la fila abre la edición. */
  alTocarFila(r: ReglaSobrepeso): void {
    if (esDispositivoMovil()) this.editar(r);
  }

  /** Computador: doble clic sobre la fila abre la edición. */
  alHacerDobleClicFila(r: ReglaSobrepeso): void {
    if (!esDispositivoMovil()) this.editar(r);
  }

  /** El modal ya guardó: se cierra, se avisa y se vuelve a pedir la lista al servidor. */
  async alGuardar(mensaje: string): Promise<void> {
    this.modal.set(null);
    this.alertService.showAlert('Éxito', mensaje, 'success');
    await this.cargarReglas();
  }

  /** Activa o desactiva la regla (pide confirmación y lo envía de frente al servidor). */
  async cambiarEstado(r: ReglaSobrepeso): Promise<void> {
    if (!this.online()) {
      this.feedback.warning('Necesitas internet para cambiar el estado.', 'Sin conexión');
      return;
    }

    const activar = !r.activo;
    const confirmado = await this.confirmModal.confirm({
      title: activar ? 'Activar regla' : 'Desactivar regla',
      eyebrow: 'Estado de la regla',
      message: activar ? 'La regla volverá a aplicarse en las guías.' : 'La regla dejará de aplicarse en las guías.',
      detail: `${r.consignatarioNombre} · ${r.destinoNombre} · ${this.porcentajeTexto(r.porcentaje)}`,
      confirmText: activar ? 'Activar' : 'Desactivar',
      cancelText: 'Cancelar',
      tone: activar ? 'success' : 'danger',
    });
    if (!confirmado) return;

    this.loading.show(activar ? 'Activando regla...' : 'Desactivando regla...');
    try {
      const json = reglaAJson({ ...r, activo: activar }, 'editado', texto(this.cfg()?.idProyecto), texto(this.cfg()?.codigoCultivo));
      const respuesta = await this.administracionApi.sincronizarReglasSobrepeso(json);
      this.loading.hide();
      if (respuesta?.error) {
        this.feedback.error(respuesta.mensaje || 'No se pudo cambiar el estado.');
        return;
      }
      this.alertService.showAlert('Éxito', activar ? 'Regla activada' : 'Regla desactivada', 'success');
      await this.cargarReglas();
    } catch {
      this.loading.hide();
      this.feedback.error('Ocurrió un error inesperado al cambiar el estado.');
    }
  }
}
