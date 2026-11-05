import { Injectable, computed, inject, signal } from '@angular/core';
import { SearchSelectOption } from '../../shared/components/search-select/search-select.component';
import { JornadaRecoleccionRepository, SeleccionLineaRecoleccion, claveSeleccion } from '../../shared/dexiedb/repository/jornada-recoleccion.repository';
import { CatalogosApiService } from '../../shared/services/catalogos-api.service';
import { ConfirmModalService } from '../../shared/services/confirm-modal.service';
import { ConnectivityService } from '../../shared/services/connectivity.service';
import { FeedbackModalService } from '../../shared/services/feedback-modal.service';
import { JornadasAnotadorApiService } from '../../shared/services/jornadas-anotador-api.service';
import { LoadingService } from '../../shared/services/loading.service';
import { MaestrosApiService } from '../../shared/services/maestros-api.service';
import { SobreSp } from '../../shared/services/catalogos-api.service';
import { opcionesDe } from '../../shared/utils/opciones-select';
import { JornadaStore } from './jornada.store';
import { Fila, esActivo, fechaHora, texto } from './jornada.utils';

/** Lo que un empacador tiene registrado en la recolección abierta (una sola fila por empacador). */
export interface CajasRegistradas {
  cantidad: number;
  formatoId: string;
  tipoEmpaqueId: string;
  calibreNombre: string;
}

/**
 * Estado y acciones de la pestaña "Recolección de cajas": recolección del anotador, formato y tipo de empaque elegidos en cada línea
 * (se recuerdan en el equipo) y consulta de los tipos de empaque permitidos por la matriz de compatibilidad.
 */
@Injectable()
export class RecoleccionStore {
  private readonly jornadaStore = inject(JornadaStore);
  private readonly connectivity = inject(ConnectivityService);
  private readonly loading = inject(LoadingService);
  private readonly feedback = inject(FeedbackModalService);
  private readonly confirm = inject(ConfirmModalService);
  private readonly jornadasApi = inject(JornadasAnotadorApiService);
  private readonly catalogosApi = inject(CatalogosApiService);
  private readonly maestrosApi = inject(MaestrosApiService);
  private readonly seleccionesRepo = inject(JornadaRecoleccionRepository);

  constructor() {
    // Cada vez que se relee la jornada se actualizan las recolecciones y se limpia lo guardado que ya no corresponde.
    this.jornadaStore.alActualizarLineas(async (conJornada) => {
      if (conJornada) await this.cargarRecolecciones();
      await this.podarSelecciones();
    });
  }

  // ---- Recolecciones ----

  /** Recolecciones de la jornada (las de todos los anotadores del acopio). */
  readonly recolecciones = signal<Fila[]>([]);
  /** Mi recolección abierta (una sola por anotador). */
  readonly miRecoleccion = computed(() => this.recolecciones().find((r) => !!r['mia'] && texto(r['estado']) === 'ABIERTA') ?? null);
  /** Recolecciones abiertas de otros anotadores. */
  readonly recoleccionesDeOtros = computed(() => this.recolecciones().filter((r) => !r['mia'] && texto(r['estado']) === 'ABIERTA'));

  /** Lo que cada empacador (numeroDocumento) tiene registrado en MI recolección abierta: una sola fila con cantidad, formato y tipo. Al abrir otra recolección vuelve a cero. */
  readonly cajasPorEmpacador = signal<ReadonlyMap<string, CajasRegistradas>>(new Map());

  /** Lo que el empacador ya tiene registrado en mi recolección abierta (undefined si todavía no registró). */
  registroDe(empacador: Fila | undefined): CajasRegistradas | undefined {
    return empacador ? this.cajasPorEmpacador().get(texto(empacador['numeroDocumento'])) : undefined;
  }

  /** Cajas que lleva el empacador en mi recolección abierta (0 si todavía no registró). */
  cajasDe(empacador: Fila | undefined): number {
    return this.registroDe(empacador)?.cantidad ?? 0;
  }

  async cargarRecolecciones(): Promise<void> {
    const r = await this.jornadasApi.recolecciones();
    if (r.error) throw new Error(r.mensaje || 'No se pudieron consultar las recolecciones.');
    this.recolecciones.set(r.data ?? []);
  }

  /** Lo que ya registró cada empacador en mi recolección abierta (la suma la hace el servidor). Solo se pide al entrar a Recolección de cajas y tras cambios allí. */
  async cargarCajas(): Promise<void> {
    if (!this.miRecoleccion()) {
      this.cajasPorEmpacador.set(new Map());
      return;
    }
    const r = await this.jornadasApi.resumenCajas();
    if (r.error) throw new Error(r.mensaje || 'No se pudieron consultar las cajas registradas.');
    this.cajasPorEmpacador.set(new Map((r.data ?? []).map((f): [string, CajasRegistradas] => [
      texto(f['numeroDocumento']),
      { cantidad: Number(f['totalCajas']) || 0, formatoId: texto(f['formatoId']), tipoEmpaqueId: texto(f['tipoEmpaqueId']), calibreNombre: texto(f['calibreNombre']) },
    ])));
  }

  /**
   * Registra (o corrige) las cajas del empacador de un puesto: una sola fila por empacador en la recolección.
   * La usan el registro manual y la recolección rápida. Después vuelve a leer las recolecciones y, si se guardó, el total de cada empacador.
   */
  async registrarCajas(datos: { idLinea: number; puesto: number; formatoId: string; tipoEmpaqueId: string; cantidad: number; calibreNombre: string }): Promise<SobreSp<Fila[]>> {
    const resp = await this.jornadasApi.registrarCajas({
      idLinea: datos.idLinea,
      puesto: datos.puesto,
      formatoId: Number(datos.formatoId),
      tipoEmpaqueId: Number(datos.tipoEmpaqueId),
      cantidadCajas: datos.cantidad,
      calibreNombre: datos.calibreNombre,
    });
    // Puede que la recolección o la jornada ya no estén abiertas: se refresca para que la pantalla lo muestre.
    try {
      await this.cargarRecolecciones();
      if (!resp.error) await this.cargarCajas();
    } catch { /* las cajas ya se guardaron; el total se actualiza en la próxima carga */ }
    return resp;
  }

  async iniciarRecoleccion(): Promise<void> {
    await this.ejecutarRecoleccion('Iniciando recolección...', 'No se pudo iniciar la recolección.', () => this.jornadasApi.iniciarRecoleccion());
  }

  async cerrarRecoleccion(): Promise<void> {
    const mia = this.miRecoleccion();
    if (!mia) return;
    const ok = await this.confirm.confirm({
      title: 'Cerrar recolección',
      eyebrow: 'Confirma la acción',
      message: `¿Seguro que deseas cerrar la recolección ${texto(mia['numero'])}?`,
      detail: `Iniciada ${fechaHora(mia['fechaInicio'])}`,
      confirmText: 'Cerrar recolección',
      tone: 'warning',
    });
    if (!ok) return;
    await this.ejecutarRecoleccion('Cerrando recolección...', 'No se pudo cerrar la recolección.', () => this.jornadasApi.cerrarRecoleccion(Number(mia['id'])));
  }

  /** Llama al servidor, avisa si falló y vuelve a leer las recolecciones. */
  private async ejecutarRecoleccion(mensajeCarga: string, mensajeError: string, accion: () => Promise<{ error?: boolean; mensaje?: string | null }>): Promise<void> {
    if (!this.connectivity.online()) {
      this.feedback.error('No hay conexión a internet');
      return;
    }
    this.loading.show(mensajeCarga);
    try {
      const r = await accion();
      if (r.error) this.feedback.error(r.mensaje || mensajeError);
      await this.cargarRecolecciones();
      await this.cargarCajas();
    } catch {
      this.feedback.error(mensajeError);
    } finally {
      this.loading.hide();
    }
  }

  // ---- Formato y tipo de empaque por línea ----

  /** Formatos activos del cultivo (siempre del servidor, no se guardan en el dispositivo). */
  readonly opcionesFormato = signal<SearchSelectOption[]>([]);
  /** Formato elegido en cada línea (idLinea -> id del formato). */
  readonly formatoPorLinea = signal<ReadonlyMap<number, string>>(new Map());
  /** Tipos de empaque permitidos por la matriz para el formato de cada línea (idLinea -> opciones). */
  readonly tiposEmpaquePorLinea = signal<ReadonlyMap<number, SearchSelectOption[]>>(new Map());
  /** Tipo de empaque elegido en cada línea (idLinea -> id). */
  readonly tipoEmpaquePorLinea = signal<ReadonlyMap<number, string>>(new Map());

  /** Nombre del calibre de cada tipo de empaque visto (id del tipo -> calibre), para mandarlo al registrar cajas. */
  private readonly calibrePorTipo = new Map<string, string>();

  calibreDe(tipoEmpaqueId: string): string {
    return this.calibrePorTipo.get(tipoEmpaqueId) ?? '';
  }

  formatoDe(linea: Fila): string | null {
    return this.formatoPorLinea().get(Number(linea['idLinea'])) ?? null;
  }

  tiposEmpaqueDe(linea: Fila): SearchSelectOption[] {
    return this.tiposEmpaquePorLinea().get(Number(linea['idLinea'])) ?? [];
  }

  tipoEmpaqueDe(linea: Fila): string | null {
    return this.tipoEmpaquePorLinea().get(Number(linea['idLinea'])) ?? null;
  }

  /** Al entrar a la pestaña: trae los formatos y vuelve a poner lo que el anotador había elegido. */
  async entrar(): Promise<void> {
    await this.cargarFormatos();
    await this.restaurarSelecciones();
    await this.cargarCajas();
  }

  async elegirTipoEmpaque(linea: Fila, opcion: SearchSelectOption): Promise<void> {
    const id = Number(linea['idLinea']);
    const formato = this.formatoPorLinea().get(id);
    if (!formato) return;
    // La "x" del select manda un valor vacío: se quita solo el tipo de empaque y el formato se queda.
    if (!opcion.value) {
      this.tipoEmpaquePorLinea.update((actual) => { const n = new Map(actual); n.delete(id); return n; });
      await this.guardarSeleccion(id, formato, null);
      return;
    }
    this.tipoEmpaquePorLinea.update((actual) => new Map(actual).set(id, opcion.value));
    await this.guardarSeleccion(id, formato, opcion.value);
  }

  /** Al elegir el formato se piden al servidor los tipos de empaque que la matriz de compatibilidad le asocia. */
  async elegirFormato(linea: Fila, opcion: SearchSelectOption): Promise<void> {
    const id = Number(linea['idLinea']);
    const formatoAnterior = this.formatoPorLinea().get(id);
    if (formatoAnterior === opcion.value) return;

    // La "x" del select manda un valor vacío: la línea queda sin formato ni tipo de empaque.
    if (!opcion.value) {
      const sinLinea = (mapa: ReadonlyMap<number, any>) => { const n = new Map(mapa); n.delete(id); return n; };
      this.formatoPorLinea.update(sinLinea);
      this.tipoEmpaquePorLinea.update(sinLinea);
      this.tiposEmpaquePorLinea.update(sinLinea);
      await this.borrarSeleccion(id);
      return;
    }

    if (!this.connectivity.online()) {
      this.feedback.error('No hay conexión a internet');
      return;
    }
    this.loading.show('Cargando tipos de empaque...');
    try {
      const tipos = await this.tiposEmpaqueDeFormato(opcion.value);
      this.formatoPorLinea.update((actual) => new Map(actual).set(id, opcion.value));
      // El tipo de empaque elegido antes puede no corresponder al nuevo formato.
      this.tipoEmpaquePorLinea.update((actual) => { const n = new Map(actual); n.delete(id); return n; });
      this.tiposEmpaquePorLinea.update((actual) => new Map(actual).set(id, tipos));
      await this.guardarSeleccion(id, opcion.value, null);
      if (tipos.length === 0) this.feedback.warning('La matriz de compatibilidad no tiene tipos de empaque para este formato.', 'Sin tipos de empaque');
    } catch (e) {
      // Si no se pudieron traer los tipos de empaque, la línea queda como estaba.
      this.feedback.error(e instanceof Error && e.message ? e.message : 'No se pudieron consultar los tipos de empaque.');
    } finally {
      this.loading.hide();
    }
  }

  /** Tipos de empaque permitidos para un formato (consulta al servidor, con el calibre en línea). */
  async tiposEmpaqueDeFormato(formatoId: string): Promise<SearchSelectOption[]> {
    return this.opcionesTiposEmpaque(formatoId, await this.calibresDelServidor());
  }

  /** Tipos de empaque activos que la matriz asocia al formato, con "descripción — categoría — calibre". */
  private async opcionesTiposEmpaque(formatoId: string, calibres: Record<string, any>[]): Promise<SearchSelectOption[]> {
    const r = await this.jornadasApi.tiposEmpaque(this.cultivoDeJornada(), Number(formatoId));
    if (r.error) throw new Error(r.mensaje || 'No se pudieron consultar los tipos de empaque.');
    const activos = (r.data ?? []).filter((t) => esActivo(t['activo']));
    const mismoId = (a: unknown, b: unknown): boolean => texto(a) !== '' && (texto(a) === texto(b) || Number(a) === Number(b));
    for (const t of activos) {
      t['nombreCalibre'] = texto(calibres.find((c) => mismoId(c['id'] ?? c['Id'], t['calibreId']))?.['calibre']);
      this.calibrePorTipo.set(texto(t['id']), t['nombreCalibre']);
    }
    return opcionesDe(activos, 'id', ['descripcion', 'categoria', 'nombreCalibre']);
  }

  /** El nombre del calibre es de apimaestra: se pide en línea al endpoint. */
  private async calibresDelServidor(): Promise<Record<string, any>[]> {
    return (await this.maestrosApi.calibres()) as Record<string, any>[];
  }

  /** Cultivo del proceso de la jornada abierta (viene del servidor con la jornada). */
  private cultivoDeJornada(): string {
    const cultivo = texto(this.jornadaStore.jornada()?.['codigoCultivo']);
    if (!cultivo) throw new Error('No se encontró el cultivo de la jornada.');
    return cultivo;
  }

  private async cargarFormatos(): Promise<void> {
    const r = await this.catalogosApi.porCultivo('formatos', this.cultivoDeJornada());
    if (r.error) throw new Error(r.mensaje || 'No se pudieron consultar los formatos.');
    const activos = (Array.isArray(r.data) ? r.data : []).filter((f) => esActivo(f['activo']));
    this.opcionesFormato.set(opcionesDe(activos, 'id', ['descripcion']));
  }

  // ---- Elección por línea guardada en el equipo (para que no se pierda al actualizar) ----

  private claveUsuario(): string {
    const u = this.jornadaStore.usuario();
    return texto(u?.usuario) || texto(u?.documentoIdentidad);
  }

  private idJornadaActual(): number {
    return Number(this.jornadaStore.jornada()?.['id'] ?? 0);
  }

  private jornadaAbierta(): number {
    return this.jornadaStore.jornada() ? this.idJornadaActual() : 0;
  }

  /** Guarda la elección de la línea. Si el equipo no deja guardar, la pantalla sigue funcionando (solo no se recuerda). */
  private async guardarSeleccion(idLinea: number, formatoId: string, tipoEmpaqueId: string | null): Promise<void> {
    const usuario = this.claveUsuario();
    const idJornada = this.idJornadaActual();
    if (!usuario || !idJornada) return;
    try {
      await this.seleccionesRepo.save({ clave: claveSeleccion(usuario, idJornada, idLinea), usuario, idJornada, idLinea, formatoId, tipoEmpaqueId });
    } catch (e) {
      console.warn('[jornada] No se pudo guardar la elección de la línea', e);
    }
  }

  private async borrarSeleccion(idLinea: number): Promise<void> {
    const usuario = this.claveUsuario();
    const idJornada = this.idJornadaActual();
    if (!usuario || !idJornada) return;
    try {
      await this.seleccionesRepo.delete(claveSeleccion(usuario, idJornada, idLinea));
    } catch (e) {
      console.warn('[jornada] No se pudo borrar la elección de la línea', e);
    }
  }

  /**
   * Borra lo guardado que ya no corresponde: de otras jornadas, de líneas que ya no son mías (las solté o las tomó otro) o de una
   * jornada que ya no está abierta. También lo quita de la pantalla.
   */
  private async podarSelecciones(): Promise<void> {
    const mias = new Set(this.jornadaStore.misLineas().map((l) => Number(l['idLinea'])));
    const quitar = (mapa: ReadonlyMap<number, any>) => new Map([...mapa].filter(([idLinea]) => mias.has(idLinea)));
    this.formatoPorLinea.update(quitar);
    this.tipoEmpaquePorLinea.update(quitar);
    this.tiposEmpaquePorLinea.update(quitar);

    const usuario = this.claveUsuario();
    if (!usuario) return;
    const idJornada = this.jornadaAbierta();
    try {
      const guardadas = await this.seleccionesRepo.porUsuario(usuario);
      const sobran = guardadas.filter((g) => !idJornada || g.idJornada !== idJornada || !mias.has(g.idLinea)).map((g) => g.clave);
      await this.seleccionesRepo.eliminarVarios(sobran);
    } catch (e) {
      console.warn('[jornada] No se pudo limpiar lo guardado', e);
    }
  }

  /**
   * Al entrar a Recolección vuelve a poner lo que el anotador había elegido en cada una de sus líneas.
   * Solo se restaura lo que sigue siendo válido: el formato debe seguir activo y el tipo de empaque seguir permitido por la matriz para ese
   * formato; lo que ya no sirve se descarta (y se borra de lo guardado). Si el servidor no responde para una línea, se deja vacía sin borrar nada.
   */
  private async restaurarSelecciones(): Promise<void> {
    const usuario = this.claveUsuario();
    const idJornada = this.jornadaAbierta();
    if (!usuario || !idJornada) return;

    let guardadas: SeleccionLineaRecoleccion[] = [];
    try {
      guardadas = await this.seleccionesRepo.porUsuario(usuario);
    } catch (e) {
      console.warn('[jornada] No se pudo leer lo guardado', e);
      return;
    }
    const mias = new Set(this.jornadaStore.misLineas().map((l) => Number(l['idLinea'])));
    const formatosValidos = new Set(this.opcionesFormato().map((o) => o.value));
    const aRestaurar = guardadas.filter((g) => g.idJornada === idJornada && mias.has(g.idLinea));
    if (aRestaurar.length === 0) return;

    const descartar: string[] = [];
    const vigentes = aRestaurar.filter((g) => {
      if (formatosValidos.has(g.formatoId)) return true;
      descartar.push(g.clave); // el formato ya no está activo
      return false;
    });

    // Una sola consulta por formato distinto (varias líneas pueden compartirlo).
    const formatos = [...new Set(vigentes.map((g) => g.formatoId))];
    const tiposPorFormato = new Map<string, SearchSelectOption[]>();
    if (formatos.length > 0) {
      try {
        const calibres = await this.calibresDelServidor();
        await Promise.all(formatos.map(async (f) => {
          try {
            tiposPorFormato.set(f, await this.opcionesTiposEmpaque(f, calibres));
          } catch (e) {
            console.warn('[jornada] No se pudieron consultar los tipos de empaque del formato', f, e);
          }
        }));
      } catch (e) {
        console.warn('[jornada] No se pudieron consultar los calibres', e);
      }
    }

    const formatoPorLinea = new Map(this.formatoPorLinea());
    const tipoPorLinea = new Map(this.tipoEmpaquePorLinea());
    const tiposPorLinea = new Map(this.tiposEmpaquePorLinea());
    const actualizar: SeleccionLineaRecoleccion[] = [];
    for (const g of vigentes) {
      const tipos = tiposPorFormato.get(g.formatoId);
      if (!tipos) continue; // no se pudo consultar: queda vacía, lo guardado se conserva para el próximo intento
      formatoPorLinea.set(g.idLinea, g.formatoId);
      tiposPorLinea.set(g.idLinea, tipos);
      if (g.tipoEmpaqueId && tipos.some((t) => t.value === g.tipoEmpaqueId)) {
        tipoPorLinea.set(g.idLinea, g.tipoEmpaqueId);
      } else {
        tipoPorLinea.delete(g.idLinea);
        // El tipo guardado ya no lo permite la matriz: se queda solo el formato.
        if (g.tipoEmpaqueId) actualizar.push({ ...g, tipoEmpaqueId: null });
      }
    }
    this.formatoPorLinea.set(formatoPorLinea);
    this.tipoEmpaquePorLinea.set(tipoPorLinea);
    this.tiposEmpaquePorLinea.set(tiposPorLinea);

    try {
      await this.seleccionesRepo.eliminarVarios(descartar);
      if (actualizar.length > 0) await this.seleccionesRepo.bulkSave(actualizar);
    } catch (e) {
      console.warn('[jornada] No se pudo actualizar lo guardado', e);
    }
  }
}
