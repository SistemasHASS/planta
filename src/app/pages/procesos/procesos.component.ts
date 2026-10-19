import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  LucideBox,
  LucideCalendarClock,
  LucideCircleStop,
  LucideFunnel,
  LucideMoon,
  LucidePencil,
  LucidePlay,
  LucideRefreshCcw,
  LucideRotateCcw,
  LucideSettings,
  LucideSun,
  LucideX,
} from '@lucide/angular';
import { SearchSelectComponent, SearchSelectOption } from '../../shared/components/search-select/search-select.component';
import { EditarPersonalModalComponent } from './components/editar-personal-modal/editar-personal-modal.component';
import { PersonalListaModalComponent } from './components/personal-lista-modal/personal-lista-modal.component';
import { MAX_LOGISTICOS, MAX_SUPERVISORES, SelectorPersonalComponent } from './components/selector-personal/selector-personal.component';
import { PaginatorComponent } from '../../shared/components/paginator/paginator.component';
import { CatalogosOperativosRepository } from '../../shared/dexiedb/repository/catalogos-operacionales.repository';
import { CatalogosRepository } from '../../shared/dexiedb/repository/catalogos.repository';
import { Configuracion } from '../../shared/interfaces/administracion.interface';
import { Campania, Cultivo, Fundo, PersonalLogistico, Supervisor } from '../../shared/interfaces/catalogo.interface';
import { Proceso } from '../../shared/interfaces/proceso.interface';
import { Usuario } from '../../shared/interfaces/auth.interface';
import { AuthService } from '../../shared/services/auth.service';
import { ConfirmModalService } from '../../shared/services/confirm-modal.service';
import { ConnectivityService } from '../../shared/services/connectivity.service';
import { FeedbackModalService } from '../../shared/services/feedback-modal.service';
import { LoadingService } from '../../shared/services/loading.service';
import { ProcesosApiService } from '../../shared/services/procesos-api.service';
import { ProcesosSyncService } from '../../shared/services/procesos-sync.service';
import { nowPeruDate, nowPeruDateTime } from '../../shared/utils/date-time.util';
import { crearPaginacion } from '../../shared/utils/paginacion';
import { permisos } from '../../shared/utils/permisos';

const texto = (v: unknown): string => String(v ?? '').trim();

interface NuevoProceso {
  fechaProceso: string;
  turno: string;
  supervisores: Supervisor[];
  logisticos: PersonalLogistico[];
}

/** Lunes y domingo (yyyy-MM-dd) de la semana de la fecha dada. */
const semanaActual = (hoy: string): { desde: string; hasta: string } => {
  const base = new Date(`${hoy}T00:00:00Z`);
  const dia = base.getUTCDay() === 0 ? 7 : base.getUTCDay();
  const fmt = (d: Date): string => d.toISOString().slice(0, 10);
  const lunes = new Date(base);
  lunes.setUTCDate(base.getUTCDate() - (dia - 1));
  const domingo = new Date(lunes);
  domingo.setUTCDate(lunes.getUTCDate() + 6);
  return { desde: fmt(lunes), hasta: fmt(domingo) };
};

const nuevoVacio = (): NuevoProceso => ({ fechaProceso: nowPeruDate(), turno: '', supervisores: [], logisticos: [] });

/**
 * Procesos (rol Logistica / Administrador): un proceso es un turno (DIA o NOCHE) de un acopio en una fecha.
 * Solo en línea: crea, cierra, reabre y edita de frente en el servidor; no se guarda nada en el equipo.
 */
@Component({
  selector: 'app-procesos',
  imports: [
    FormsModule,
    SearchSelectComponent,
    SelectorPersonalComponent,
    EditarPersonalModalComponent,
    PersonalListaModalComponent,
    RouterLink,
    PaginatorComponent,
    LucideBox,
    LucideCalendarClock,
    LucideCircleStop,
    LucideFunnel,
    LucideMoon,
    LucidePencil,
    LucidePlay,
    LucideRefreshCcw,
    LucideRotateCcw,
      LucideSettings,
    LucideSun,
    LucideX,
  ],
  templateUrl: './procesos.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProcesosComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly api = inject(ProcesosApiService);
  private readonly sync = inject(ProcesosSyncService);
  private readonly catalogos = inject(CatalogosRepository);
  private readonly operativos = inject(CatalogosOperativosRepository);
  private readonly connectivity = inject(ConnectivityService);
  private readonly loading = inject(LoadingService);
  private readonly feedback = inject(FeedbackModalService);
  private readonly confirm = inject(ConfirmModalService);

  readonly usuario = signal<Usuario | null>(null);
  readonly cfg = signal<Configuracion | null>(null);
  readonly campania = signal<Campania | null>(null);
  readonly fundo = signal<Fundo | null>(null);
  readonly cultivo = signal<Cultivo | null>(null);

  readonly procesos = signal<Proceso[]>([]);
  readonly cargando = signal(true);
  readonly creando = signal(false);

  // Filtros del listado: se envían al SP (la búsqueda se hace en el servidor). El acopio solo lo elige el administrador.
  readonly fDesde = signal('');
  readonly fHasta = signal('');
  readonly fTurno = signal('');
  readonly fAcopio = signal('');
  readonly fEstado = signal('');
  readonly acopioNombres = signal<Record<string, string>>({});
  readonly acopioOpciones = computed<SearchSelectOption[]>(() => [
    { value: '', label: 'Todos los acopios' },
    // "Todos" va primero; los acopios, ordenados por nombre.
    ...Object.entries(this.acopioNombres())
      .map(([value, label]) => ({ value, label: `${label} (${value})` }))
      .sort((a, b) => a.label.localeCompare(b.label, 'es')),
  ]);
  readonly turnoOpciones: SearchSelectOption[] = [
    { value: '', label: 'Todos los turnos' },
    { value: 'DIA', label: '☀️ DIA' },
    { value: 'NOCHE', label: '🌙 NOCHE' },
  ];
  /** Turno al abrir un proceso nuevo (sin la opcion "Todos" del filtro). */
  readonly turnoNuevoOpciones: SearchSelectOption[] = [
    { value: 'DIA', label: '☀️ DIA' },
    { value: 'NOCHE', label: '🌙 NOCHE' },
  ];
  readonly estadoOpciones: SearchSelectOption[] = [
    { value: '', label: 'Todos los estados' },
    { value: 'ABIERTO', label: 'ABIERTO' },
    { value: 'CERRADO', label: 'CERRADO' },
  ];

  readonly nuevo = signal<NuevoProceso>(nuevoVacio());
  readonly supervisoresDisponibles = signal<Supervisor[]>([]);
  readonly logisticosDisponibles = signal<PersonalLogistico[]>([]);
  readonly cargandoPersonal = signal(false);

  readonly supPorProceso = signal<Record<string, Supervisor[]>>({});
  readonly logPorProceso = signal<Record<string, PersonalLogistico[]>>({});

  readonly editando = signal<Proceso | null>(null);
  readonly personalModal = signal<{ titulo: string; filas: { nombreCompleto: string; dni: string }[] } | null>(null);

  readonly rol = computed(() => texto(this.usuario()?.idRol).toUpperCase());
  readonly esLogistica = computed(() => permisos.esLogistica(this.rol()));
  readonly esAdmin = computed(() => permisos.esAdmin(this.rol()));
  readonly puedeCrear = computed(() => permisos.puedeCrearProceso(this.rol()));
  readonly puedeReabrir = computed(() => permisos.puedeReabrirProceso(this.rol()));
  readonly online = this.connectivity.online;

  readonly activos = computed(() => this.procesos().filter((p) => p.estado === 'ABIERTO'));
  readonly historial = computed(() => this.procesos());
  readonly paginacion = crearPaginacion(() => this.historial(), 10);

  readonly etiquetaFundo = computed(() => {
    const f = this.fundo();
    return f ? `${texto(f.nombreFundo)}` : texto(this.cfg()?.idFundo) || '—';
  });

  readonly etiquetaCultivo = computed(() => {
    const c = this.cultivo();
    return c ? `${texto(c.descripcion)}` : texto(this.cfg()?.codigoCultivo) || '—';
  });

  /** Periodo de la campaña: fecha de inicio y de fin (dd/MM/yyyy). */
  readonly periodoCampania = computed(() => {
    const f = (v: unknown): string => {
      const [y, m, d] = texto(v).split('T')[0].split('-');
      return y && m && d ? `${d}/${m}/${y}` : '—';
    };
    const c = this.campania();
    return `${f(c?.fecha_inicio)} al ${f(c?.fecha_fin)}`;
  });

  readonly etiquetaCampania = computed(() => {
    const id = texto(this.cfg()?.idProyecto);
    const desc = texto(this.campania()?.descripcion);
    return id && desc && id !== desc ? ` ${desc}` : id || desc || '—';
  });

  async ngOnInit(): Promise<void> {
    const session = await this.auth.getSession();
    this.usuario.set(session?.user ?? null);
    this.loading.show('Cargando procesos...');
    try {
      await this.cargarConfiguracion();
      const semana = semanaActual(nowPeruDate());
      this.fDesde.set(semana.desde);
      this.fHasta.set(semana.hasta);
      if (this.esAdmin()) await this.cargarAcopiosLocales();
      // Todo es en línea y no se guarda nada en el equipo (solo se lee la campaña elegida en Parámetros).
      // El personal no se pide al entrar: Logística lo pide al elegir fecha y turno (para que esté actualizado) y el administrador al editar.
      await this.cargarProcesos();
    } finally {
      await this.loading.hideAfterMinimum();
    }
  }

  // ───────── Carga ─────────

  private async cargarConfiguracion(): Promise<void> {
    const nro = texto(this.usuario()?.documentoIdentidad);
    const cfg = nro ? ((await this.catalogos.configuracionRepo.getByField('nrodocumento', nro)) ?? null) : null;
    this.cfg.set(cfg);
    if (cfg) {
      this.campania.set((await this.catalogos.campaniaRepo.getByField('idproyecto', cfg.idProyecto)) ?? null);
      // Fundo y cultivo se muestran con su nombre, tomado de los catálogos guardados.
      this.fundo.set((await this.catalogos.fundoRepo.getByField('id', cfg.idFundo as any)) ?? null);
      this.cultivo.set((await this.catalogos.cultivoRepo.getByField('codigo', cfg.codigoCultivo)) ?? null);
    }
  }

  /** Solo en línea: lista los procesos del servidor y los muestra sin guardar nada en el equipo. */
  async cargarProcesos(): Promise<void> {
    return this.cargarProcesosEnLinea();
  }

  /** Administrador: nombres de acopio desde el catálogo guardado (solo lectura). */
  private async cargarAcopiosLocales(): Promise<void> {
    const lista = await this.operativos.acopiosRepo.getAll();
    const mapa: Record<string, string> = {};
    for (const a of lista) {
      const codigo = texto(a.codigoAcopio);
      if (codigo) mapa[codigo] = texto(a.acopioNombre) || codigo;
    }
    this.acopioNombres.set(mapa);
  }

  nombreAcopio(codigo: string | null | undefined): string {
    const c = texto(codigo);
    return this.acopioNombres()[c] ?? c;
  }

  async filtrarAdmin(): Promise<void> {
    if (this.fDesde() && this.fHasta() && this.fDesde() > this.fHasta()) {
      this.feedback.warning('La fecha "Desde" no puede ser mayor que "Hasta".', 'Validación');
      return;
    }
    this.paginacion.page.set(1);
    this.loading.show('Buscando procesos...');
    await this.cargarProcesos();
    await this.loading.hideAfterMinimum();
  }

  async limpiarFiltrosAdmin(): Promise<void> {
    const semana = semanaActual(nowPeruDate());
    this.fDesde.set(semana.desde);
    this.fHasta.set(semana.hasta);
    this.fTurno.set('');
    this.fAcopio.set('');
    this.fEstado.set('');
    await this.filtrarAdmin();
  }

  /** Lista los procesos del servidor (el administrador con sus filtros; Logística, los de su acopio). Nada se guarda en el equipo. */
  private async cargarProcesosEnLinea(): Promise<void> {
    this.cargando.set(true);
    try {
      const cfg = this.cfg();
      if (!cfg) {
        this.procesos.set([]);
        return;
      }
      if (!this.online()) {
        this.procesos.set([]);
        this.feedback.error('Error de conexión: necesitas internet para ver los procesos.', 'Sin conexión');
        return;
      }
      // Logística filtra igual que el administrador, pero el acopio siempre es el suyo (lo fija el servidor).
      const filtros = { fechaDesde: this.fDesde(), fechaHasta: this.fHasta(), turno: this.fTurno(), codigoAcopio: this.esAdmin() ? this.fAcopio() : '', estado: this.fEstado() };
      const sobre = await this.api.listar(cfg.idProyecto, cfg.codigoCultivo, filtros);
      if (sobre?.error) {
        this.procesos.set([]);
        this.feedback.error(sobre.mensaje || 'No se pudieron obtener los procesos.');
        return;
      }
      const filas = Array.isArray(sobre?.data) ? sobre.data : [];
      const sup: Record<string, Supervisor[]> = {};
      const log: Record<string, PersonalLogistico[]> = {};
      const lista: Proceso[] = [];
      for (const fila of filas) {
        const { proceso } = this.sync.normalizar(fila);
        proceso.acopioNombre = this.acopioNombres()[texto(proceso.codigoAcopio)] ?? proceso.acopioNombre;
        const id = texto(proceso.idProceso);
        lista.push(proceso);
        sup[id] = this.unicos((Array.isArray(fila['supervisores']) ? fila['supervisores'] : []).map((x: any) => ({ id: Number(x.idSupervisor), nombreCompleto: texto(x.nombreCompleto), dni: texto(x.dni) }) as Supervisor));
        log[id] = this.unicos((Array.isArray(fila['logisticos']) ? fila['logisticos'] : []).map((x: any) => ({ id: Number(x.idLogistico), nombreCompleto: texto(x.nombreCompleto), dni: texto(x.dni) }) as PersonalLogistico));
      }
      this.procesos.set(lista);
      this.supPorProceso.set(sup);
      this.logPorProceso.set(log);
    } catch {
      this.procesos.set([]);
      this.feedback.error('Error de conexión: no se pudieron obtener los procesos.', 'Sin conexión');
    } finally {
      this.cargando.set(false);
    }
  }

  private unicos<T extends { id: number }>(items: (T | undefined)[]): T[] {
    return Array.from(new Map(items.filter((x): x is T => !!x).map((x) => [Number(x.id), x])).values());
  }

  /** Personal disponible para la fecha del formulario (se pide al servidor; no se guarda en el equipo). */
  async cargarPersonal(): Promise<void> {
    // El administrador no usa este formulario: el personal lo pide la ventana de edición.
    if (this.esAdmin()) return;
    this.supervisoresDisponibles.set([]);
    this.logisticosDisponibles.set([]);
    const cfg = this.cfg();
    // Solo se pide cuando ya hay fecha y turno.
    if (!cfg || !this.nuevo().fechaProceso || !this.nuevo().turno) return;
    if (!this.online()) {
      this.feedback.error('Error de conexión: necesitas internet para cargar el personal.', 'Sin conexión');
      return;
    }
    this.cargandoPersonal.set(true);
    this.loading.show('Cargando personal disponible...');
    try {
      const fecha = this.nuevo().fechaProceso;
      const [respSup, respLog] = await Promise.all([
        this.api.supervisoresDisponibles(cfg.idProyecto, fecha),
        this.api.personalLogisticoDisponible(cfg.idProyecto, fecha),
      ]);
      this.supervisoresDisponibles.set(this.soloActivos<Supervisor>(respSup?.error ? [] : respSup?.data));
      this.logisticosDisponibles.set(this.soloActivos<PersonalLogistico>(respLog?.error ? [] : respLog?.data));
    } catch {
      this.feedback.error('Error de conexión: no se pudo cargar el personal disponible.', 'Sin conexión');
    } finally {
      this.cargandoPersonal.set(false);
      await this.loading.hideAfterMinimum();
    }
  }

  private soloActivos<T extends { activo?: unknown }>(filas: unknown): T[] {
    if (!Array.isArray(filas)) return [];
    return (filas as T[]).filter((fila) => fila.activo === true || Number(fila.activo) === 1);
  }

  // ───────── Formulario ─────────

  cambiarFecha(valor: string): void {
    this.nuevo.update((n) => ({ ...n, fechaProceso: valor }));
    void this.cargarPersonal();
  }

  cambiarTurno(valor: string): void {
    this.nuevo.update((n) => ({ ...n, turno: valor, supervisores: [], logisticos: [] }));
    void this.cargarPersonal();
  }

  // ───────── Crear ─────────

  private crearIdProceso(fecha: string, turno: string): string {
    const partes = {
      idProyecto: texto(this.cfg()?.idProyecto),
      idEmpresa: texto(this.usuario()?.idEmpresa),
      codigoCultivo: texto(this.cfg()?.codigoCultivo),
      codigoAcopio: texto(this.usuario()?.codigoAcopio),
      fecha: texto(fecha).replaceAll('-', ''),
      turno: texto(turno),
    };
    const faltantes = Object.entries(partes).filter(([, v]) => !v).map(([k]) => k);
    if (faltantes.length > 0) {
      this.feedback.error(`Faltan datos para generar el idProceso: ${faltantes.join(', ')}. Vuelva a iniciar sesión.`);
      throw new Error('idProceso incompleto');
    }
    return Object.values(partes).join('');
  }

  async crearProceso(): Promise<void> {
    const n = this.nuevo();
    const cfg = this.cfg();
    const codigoAcopio = texto(this.usuario()?.codigoAcopio);
    if (!cfg) return this.feedback.warning('Primero configura la campaña en Parámetros.', 'Validación');
    if (!codigoAcopio || codigoAcopio === '0') {
      return this.feedback.warning('Su usuario no tiene un acopio asignado. Comuníquese con el administrador del sistema.', 'Validación');
    }
    if (!n.fechaProceso) return this.feedback.warning('Complete la fecha.', 'Validación');
    if (!n.turno) return this.feedback.warning('Complete el turno.', 'Validación');
    if (n.supervisores.length < 1 || n.supervisores.length > MAX_SUPERVISORES) return this.feedback.warning('Seleccione entre 1 y 2 supervisores.', 'Validación');
    if (n.logisticos.length < 1 || n.logisticos.length > MAX_LOGISTICOS) return this.feedback.warning('Seleccione entre 1 y 5 personas de logística.', 'Validación');

    if (!this.online()) return this.feedback.warning('Necesitas internet para abrir un proceso.', 'Sin conexión');

    this.creando.set(true);
    this.loading.show('Abriendo proceso...');
    try {
      const idProceso = this.crearIdProceso(n.fechaProceso, n.turno);
      const mismoTurno = `Este acopio ya tiene un proceso para la fecha ${n.fechaProceso} en el turno ${n.turno} y ${texto(this.campania()?.descripcion)}.`;

      const validacion = await this.api.buscar(cfg.idProyecto, cfg.codigoCultivo, n.turno, n.fechaProceso);
      if (validacion.error) return this.terminarConError(validacion.mensaje ?? 'No se pudo validar el turno.');
      if (Array.isArray(validacion.data) && validacion.data.length > 0) return this.terminarConError(mismoTurno);

      const proceso: Proceso = {
        idProceso,
        idProyecto: texto(cfg.idProyecto),
        codigoAcopio,
        acopioNombre: texto(this.usuario()?.acopioNombre),
        fechaProceso: n.fechaProceso,
        estado: 'ABIERTO',
        fechaApertura: nowPeruDateTime(),
        turno: n.turno,
      };
      const dLog = n.logisticos.map((l) => ({ idProceso, idLogistico: l.id }));
      const dSup = n.supervisores.map((s) => ({ idProceso, idSupervisor: s.id }));
      const r = await this.api.sincronizarProceso(proceso, dLog, dSup, cfg.codigoCultivo, cfg.idProyecto);
      if (r.error) return this.terminarConError(r.mensaje ?? 'Error al sincronizar.');

      this.nuevo.set(nuevoVacio());
      await this.cargarProcesos();
      await this.cargarPersonal();
      await this.loading.hideAfterMinimum();
      this.feedback.success(r.mensaje ?? 'Proceso abierto.');
    } catch (e) {
      this.loading.hide();
      if ((e as Error)?.message !== 'idProceso incompleto') this.feedback.error('No se pudo crear el proceso. Intenta nuevamente.');
    } finally {
      this.creando.set(false);
    }
  }

  /** Cierra la carga y avisa el motivo; lo ya elegido (fecha, turno y personal) se conserva para que la persona lo corrija. */
  private async terminarConError(mensaje: string): Promise<void> {
    await this.loading.hideAfterMinimum();
    this.feedback.error(mensaje);
  }

  // ───────── Cerrar / reabrir ─────────

  async cerrarProceso(p: Proceso): Promise<void> {
    const ok = await this.confirm.confirm({
      title: 'Cerrar proceso',
      eyebrow: 'Confirmar',
      message: `¿Cerrar el turno ${p.turno} del ${this.fechaCorta(p.fechaProceso)}?`,
      confirmText: 'Sí, cerrar',
      tone: 'warning',
    });
    if (ok) await this.cambiarEstado(p, 'cerrar');
  }

  async reabrirProceso(p: Proceso): Promise<void> {
    const ok = await this.confirm.confirm({
      title: 'Reabrir proceso',
      eyebrow: 'Confirmar',
      message: '¿Reabrir este proceso? Volverá a estado ABIERTO.',
      confirmText: 'Sí, reabrir',
      tone: 'warning',
    });
    if (ok) await this.cambiarEstado(p, 'reabrir');
  }

  private async cambiarEstado(p: Proceso, modo: 'cerrar' | 'reabrir'): Promise<void> {
    const cfg = this.cfg();
    if (!cfg) return;
    if (!this.online()) {
      this.feedback.warning('Necesitas internet para esta acción.', 'Sin conexión');
      return;
    }
    const idProceso = texto(p.idProceso);
    this.loading.show(modo === 'cerrar' ? 'Cerrando proceso...' : 'Reabriendo proceso...');
    try {
      const dLog = (this.logPorProceso()[idProceso] ?? []).map((l) => ({ idProceso, idLogistico: l.id, eliminado: 0 }));
      const dSup = (this.supPorProceso()[idProceso] ?? []).map((s) => ({ idProceso, idSupervisor: s.id, eliminado: 0 }));
      const r = await this.api.sincronizarProceso({ ...p, db: 0 }, dLog, dSup, cfg.codigoCultivo, cfg.idProyecto, modo);
      if (r.error) {
        this.loading.hide();
        this.feedback.error(r.mensaje ?? `Error al sincronizar el proceso ${idProceso}.`);
        return;
      }
      await this.cargarPersonal();
      await this.cargarProcesos();
      await this.loading.hideAfterMinimum();
      this.feedback.success(r.mensaje ?? 'Listo.');
    } catch {
      this.loading.hide();
      this.feedback.error('No se pudo completar la acción. Intenta nuevamente.');
    }
  }

  // ───────── Editar personal ─────────

  /** Supervisores y logística que tiene un proceso (lista vacía si no tiene). */
  supervisoresDe(p: Proceso): Supervisor[] {
    return this.supPorProceso()[texto(p.idProceso)] ?? [];
  }

  logisticosDe(p: Proceso): PersonalLogistico[] {
    return this.logPorProceso()[texto(p.idProceso)] ?? [];
  }

  /** Abre la ventana de edición (solo administrador). */
  editarProceso(p: Proceso): void {
    if (!texto(p.idProceso) || !this.cfg()) return;
    this.editando.set(p);
  }

  /** La ventana guardó los cambios: se cierra, se vuelve a listar y se avisa. */
  async edicionGuardada(mensaje: string): Promise<void> {
    this.editando.set(null);
    this.loading.show('Actualizando procesos...');
    await this.cargarProcesos();
    await this.loading.hideAfterMinimum();
    this.feedback.success(mensaje);
  }

  // ───────── Actualizar ─────────

  /** Todo es en línea: no hay nada pendiente, solo se vuelve a listar. */
  async sincronizar(): Promise<void> {
    this.loading.show('Actualizando procesos...');
    await this.cargarProcesos();
    await this.loading.hideAfterMinimum();
  }

  // ───────── Presentacion ─────────

  nombres(lista: { nombreCompleto: string }[] | undefined, max = 2): { texto: string; hayMas: boolean } {
    const nombres = (lista ?? []).map((x) => texto(x.nombreCompleto)).filter((x) => x);
    return { texto: nombres.slice(0, max).join(', ') || '—', hayMas: nombres.length > max };
  }

  verPersonal(tipo: 'SUP' | 'LOG', p: Proceso): void {
    const id = texto(p.idProceso);
    const filas = tipo === 'SUP' ? (this.supPorProceso()[id] ?? []) : (this.logPorProceso()[id] ?? []);
    this.personalModal.set({ titulo: tipo === 'SUP' ? 'Supervisores' : 'Logísticos', filas: filas.map((f) => ({ nombreCompleto: f.nombreCompleto, dni: f.dni })) });
  }

  fechaCorta(f: string | null | undefined): string {
    const [y, m, d] = texto(f).split('T')[0].split('-');
    return y && m && d ? `${d}/${m}/${y}` : '—';
  }

  fechaHora(f: string | null | undefined): string {
    const v = texto(f);
    if (!v) return '—';
    const [fecha, hora = ''] = v.split('T');
    return `${this.fechaCorta(fecha)}, ${hora.slice(0, 5)}`;
  }

  fechaLarga(f: string): string {
    const d = new Date(`${texto(f).split('T')[0]}T12:00:00`);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  esDia(p: Proceso): boolean {
    return p.turno === 'DIA';
  }

  trackProceso = (p: Proceso): string => p.idProceso;
}
