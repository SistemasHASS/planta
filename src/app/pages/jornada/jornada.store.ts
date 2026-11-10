import { Injectable, computed, inject, signal } from '@angular/core';
import { SearchSelectOption } from '../../shared/components/search-select/search-select.component';
import { CatalogosRepository } from '../../shared/dexiedb/repository/catalogos.repository';
import { Usuario } from '../../shared/interfaces/auth.interface';
import { AuthService } from '../../shared/services/auth.service';
import { ConfirmModalService } from '../../shared/services/confirm-modal.service';
import { ConnectivityService } from '../../shared/services/connectivity.service';
import { FeedbackModalService } from '../../shared/services/feedback-modal.service';
import { JornadasAnotadorApiService } from '../../shared/services/jornadas-anotador-api.service';
import { LoadingService } from '../../shared/services/loading.service';
import { ProcesosApiService } from '../../shared/services/procesos-api.service';
import { Fila, fecha, lineaTexto, texto } from './jornada.utils';

/** Se ejecuta después de leer las líneas (conJornada=true) o al saber que no hay jornada abierta (conJornada=false). */
type GanchoLineas = (conJornada: boolean) => Promise<void>;

/**
 * Estado y acciones de la jornada del acopio (jornada, líneas, puestos). Se provee en `JornadaComponent`: vive mientras dure la página
 * y lo comparten todos sus componentes hijos.
 *
 * La jornada es del ACOPIO: una sola abierta por acopio, la abre cualquier anotador y trabajan varios dentro de ella (cada uno toma sus líneas).
 * El acopio sale del token (la API solo devuelve los procesos del acopio asignado); la campaña, de los Parametros guardados.
 */
@Injectable()
export class JornadaStore {
  private readonly auth = inject(AuthService);
  private readonly catalogos = inject(CatalogosRepository);
  private readonly connectivity = inject(ConnectivityService);
  private readonly loading = inject(LoadingService);
  private readonly feedback = inject(FeedbackModalService);
  private readonly confirm = inject(ConfirmModalService);
  private readonly jornadasApi = inject(JornadasAnotadorApiService);
  private readonly procesosApi = inject(ProcesosApiService);

  readonly usuario = signal<Usuario | null>(null);
  readonly cargado = signal(false);

  readonly jornada = signal<Fila | null>(null);
  readonly procesos = signal<Fila[]>([]);
  readonly procesoId = signal<string | null>(null);
  readonly lineas = signal<Fila[]>([]);

  readonly misLineas = computed(() => this.lineas().filter((l) => texto(l['situacion']) === 'MIA'));
  readonly tomadas = computed(() => this.misLineas().length);
  /** Números (o nombres de curo) de las líneas que tomé, para mostrarlos cuando la tarjeta "Mis líneas" está contraída. */
  readonly numerosMios = computed(() => this.misLineas().map((l) => (texto(l['maquinaNombre']) && l['curo'] ? `${texto(l['maquinaNombre'])} · Curo ${texto(l['curo'])}` : texto(l['numero']))).join(' · '));
  /** Lineas (idLinea) con su detalle de puestos desplegado. */
  readonly desplegadas = signal<ReadonlySet<number>>(new Set());
  /** Empacadores asignados en cada posición ("idLinea-puesto"), tal como los devuelve el servidor. */
  readonly asignados = signal<Map<string, Fila>>(new Map());

  readonly opcionesProceso = computed<SearchSelectOption[]>(() =>
    this.procesos().map((p) => {
      const etiqueta = `${fecha(p['fechaProceso'])} · ${texto(p['turno'])}`;
      return { value: texto(p['idProceso']), label: etiqueta, searchText: `${etiqueta} ${texto(p['idProceso'])}` };
    }),
  );

  /** El proceso de la jornada ya se cerró (el anotador debería cerrar su jornada). */
  readonly procesoCerrado = computed(() => {
    const j = this.jornada();
    return !!j && texto(j['estadoProceso']).toUpperCase() !== 'ABIERTO';
  });

  private readonly ganchos: GanchoLineas[] = [];

  /** Otros stores (p. ej. el de recolección) se enganchan para actualizarse cada vez que se relee la jornada. */
  alActualizarLineas(gancho: GanchoLineas): void {
    this.ganchos.push(gancho);
  }

  private async notificar(conJornada: boolean): Promise<void> {
    for (const g of this.ganchos) await g(conJornada);
  }

  // ---- Claves y consultas de puestos ----

  clave(idLinea: number, puesto: number): string {
    return `${idLinea}-${puesto}`;
  }

  asignadoEn(linea: Fila, puesto: number): Fila | undefined {
    return this.asignados().get(this.clave(Number(linea['idLinea']), puesto));
  }

  asignadosDe(linea: Fila): number {
    return this.puestosDe(linea).filter((p) => this.asignados().has(this.clave(Number(linea['idLinea']), p))).length;
  }

  /** Numeros de puesto de la linea: 1..cantidadPuestos. */
  puestosDe(linea: Fila): number[] {
    const total = Math.max(0, Number(linea['cantidadPuestos']) || 0);
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  estaDesplegada(linea: Fila): boolean {
    return this.desplegadas().has(Number(linea['idLinea']));
  }

  alternar(linea: Fila): void {
    const id = Number(linea['idLinea']);
    this.desplegadas.update((actual) => {
      const nuevo = new Set(actual);
      if (nuevo.has(id)) nuevo.delete(id);
      else nuevo.add(id);
      return nuevo;
    });
  }

  // ---- Carga ----

  async iniciar(): Promise<void> {
    this.usuario.set((await this.auth.getSession())?.user ?? null);
    await this.cargar();
  }

  async cargar(): Promise<void> {
    if (!this.connectivity.online()) {
      this.cargado.set(true);
      this.feedback.error('No hay conexión a internet');
      return;
    }

    this.loading.show('Cargando jornada...');
    try {
      const abierta = await this.jornadasApi.listar(true);
      if (abierta.error) throw new Error(abierta.mensaje || 'No se pudo consultar la jornada.');
      this.jornada.set(abierta.data?.[0] ?? null);

      if (!this.jornada()) {
        this.lineas.set([]);
        await this.notificar(false);
        await this.cargarProcesosAbiertos();
      } else {
        this.procesos.set([]);
        this.procesoId.set(null);
        await this.cargarLineas();
      }
      this.cargado.set(true);
      await this.loading.hideAfterMinimum();
    } catch (e) {
      this.loading.hide();
      this.cargado.set(true);
      this.feedback.error(e instanceof Error && e.message ? e.message : 'No se pudo cargar la jornada.');
    }
  }

  /** Lineas del acopio con su situacion (solo con jornada abierta). */
  async cargarLineas(): Promise<void> {
    const r = await this.jornadasApi.lineas();
    if (r.error) throw new Error(r.mensaje || 'No se pudieron consultar las líneas.');
    this.lineas.set(r.data ?? []);
    await this.cargarPuestos();
    await this.notificar(true);
  }

  /** Empacadores asignados a cada puesto (los guarda el servidor; aquí solo se leen). */
  async cargarPuestos(): Promise<void> {
    const r = await this.jornadasApi.puestos();
    if (r.error) throw new Error(r.mensaje || 'No se pudieron consultar los puestos.');
    const mapa = new Map<string, Fila>();
    for (const f of r.data ?? []) mapa.set(this.clave(Number(f['idLinea']), Number(f['puesto'])), f);
    this.asignados.set(mapa);
  }

  /** Procesos ABIERTOS del acopio asignado (la API filtra por el acopio del token). */
  private async cargarProcesosAbiertos(): Promise<void> {
    const cfg = await this.configuracion();
    if (!cfg) {
      this.procesos.set([]);
      return;
    }
    const r = await this.procesosApi.listar(cfg.idProyecto, cfg.codigoCultivo, { estado: 'ABIERTO' });
    if (r.error) throw new Error(r.mensaje || 'No se pudieron consultar los procesos.');
    const abiertos = (r.data ?? []).filter((p) => texto(p['estado']).toUpperCase() === 'ABIERTO');
    this.procesos.set(abiertos);
    // Un solo proceso abierto: ya queda elegido.
    this.procesoId.set(abiertos.length === 1 ? texto(abiertos[0]['idProceso']) : null);
  }

  private async configuracion(): Promise<{ idProyecto: string; codigoCultivo: string } | null> {
    const documento = texto(this.usuario()?.documentoIdentidad);
    if (!documento) return null;
    try {
      const cfg = await this.catalogos.configuracionRepo.getByField('nrodocumento', documento);
      const idProyecto = texto(cfg?.idProyecto);
      const codigoCultivo = texto(cfg?.codigoCultivo);
      return idProyecto && codigoCultivo ? { idProyecto, codigoCultivo } : null;
    } catch {
      return null;
    }
  }

  // ---- Jornada: abrir / cerrar ----

  async abrir(): Promise<void> {
    const idProceso = this.procesoId();
    if (!idProceso) {
      this.feedback.warning('Selecciona el proceso de la jornada.');
      return;
    }
    const cfg = await this.configuracion();
    if (!cfg) {
      this.feedback.warning('Primero guarda tus parámetros.', 'Configuración requerida');
      return;
    }
    if (!this.connectivity.online()) {
      this.feedback.error('No hay conexión a internet');
      return;
    }

    this.loading.show('Abriendo jornada...');
    try {
      const r = await this.jornadasApi.abrir(cfg.idProyecto, idProceso);
      if (r.error) {
        this.loading.hide();
        this.feedback.error(r.mensaje || 'No se pudo abrir la jornada.');
        // El proceso pudo haberse cerrado o ya existir una jornada: se refresca el estado.
        await this.cargar();
        return;
      }
      await this.cargar();
      this.feedback.success('Jornada abierta', 'Listo');
    } catch {
      this.loading.hide();
      this.feedback.error('No se pudo abrir la jornada.');
    }
  }

  async cerrar(): Promise<void> {
    const j = this.jornada();
    if (!j) return;
    const ok = await this.confirm.confirm({
      title: 'Cerrar jornada',
      eyebrow: 'Confirma la acción',
      message: '¿Seguro que deseas cerrar la jornada del acopio?',
      detail: `${fecha(j['fechaProceso'])} · ${texto(j['turno'])} · abierta por ${texto(j['nombreUsuarioApertura'])}`,
      confirmText: 'Cerrar jornada',
      tone: 'warning',
    });
    if (!ok) return;

    // Entre las dos confirmaciones se muestra el loading un instante para que no salgan una tras otra de golpe.
    this.loading.show('Verificando jornada...');
    await this.loading.hideAfterMinimum(600);

    // Segunda advertencia: cerrar la jornada no se puede deshacer desde esta pantalla.
    const segura = await this.confirm.confirm({
      title: 'Última advertencia',
      eyebrow: 'Esta acción no se puede deshacer',
      message: 'Al cerrar la jornada se cierra para todos los anotadores del acopio y se sueltan todas las líneas tomadas. Para continuar tendrán que abrir otra jornada.',
      detail: `${fecha(j['fechaProceso'])} · ${texto(j['turno'])}`,
      confirmText: 'Sí, cerrar jornada',
      cancelText: 'No, volver',
      tone: 'danger',
    });
    if (!segura) return;

    if (!this.connectivity.online()) {
      this.feedback.error('No hay conexión a internet');
      return;
    }

    this.loading.show('Cerrando jornada...');
    try {
      const r = await this.jornadasApi.cerrar(Number(j['id']));
      if (r.error) {
        this.loading.hide();
        this.feedback.error(r.mensaje || 'No se pudo cerrar la jornada.');
        return;
      }
      await this.cargar();
      this.feedback.success('Jornada cerrada', 'Listo');
    } catch {
      this.loading.hide();
      this.feedback.error('No se pudo cerrar la jornada.');
    }
  }

  // ---- Líneas: tomar / soltar ----

  /** Toma una linea libre. Si otro anotador la tomo antes, se avisa y se refresca la lista. */
  async tomar(linea: Fila): Promise<void> {
    if (!this.connectivity.online()) {
      this.feedback.error('No hay conexión a internet');
      return;
    }
    this.loading.show('Tomando línea...');
    try {
      const r = await this.jornadasApi.tomarLinea(Number(linea['idLinea']));
      if (r.error) {
        this.feedback.error(r.mensaje || 'No se pudo tomar la línea.');
      } else {
        // La linea recien tomada se muestra desplegada.
        this.desplegadas.update((actual) => new Set(actual).add(Number(linea['idLinea'])));
      }
      await this.cargarLineas();
      await this.loading.hideAfterMinimum();
    } catch {
      this.loading.hide();
      this.feedback.error('No se pudo tomar la línea.');
    }
  }

  /** Suelta una linea que tomaste. */
  async soltar(linea: Fila): Promise<void> {
    const ok = await this.confirm.confirm({
      title: 'Soltar línea',
      eyebrow: 'Confirma la acción',
      message: `¿Seguro que deseas soltar ${lineaTexto(linea)}?`,
      detail: 'Otro anotador podrá tomarla.',
      confirmText: 'Soltar línea',
      tone: 'warning',
    });
    if (!ok) return;
    if (!this.connectivity.online()) {
      this.feedback.error('No hay conexión a internet');
      return;
    }
    this.loading.show('Soltando línea...');
    try {
      const r = await this.jornadasApi.soltarLinea(Number(linea['idTomada']));
      if (r.error) this.feedback.error(r.mensaje || 'No se pudo soltar la línea.');
      await this.cargarLineas();
      await this.loading.hideAfterMinimum();
    } catch {
      this.loading.hide();
      this.feedback.error('No se pudo soltar la línea.');
    }
  }
}
