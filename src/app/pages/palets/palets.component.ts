import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom, from } from 'rxjs';
import {
  LucideArrowLeftRight,
  LucideBox,
  LucideChevronDown,
  LucideChevronUp,
  LucideCircleAlert,
  LucideCircleCheck,
  LucideFileText,
  LucideLayers,
  LucidePackage,
  LucidePencil,
  LucidePlus,
  LucideRefreshCcw,
  LucideRotateCcw,
  LucideTrash2,
  LucideTruck,
  LucideWeight,
} from '@lucide/angular';
import { AdministracionRepository } from '../../shared/dexiedb/repository/administracion.repository';
import { CatalogosOperativosRepository } from '../../shared/dexiedb/repository/catalogos-operacionales.repository';
import { CatalogosRepository } from '../../shared/dexiedb/repository/catalogos.repository';
import { ProcesoRepository } from '../../shared/dexiedb/repository/proceso.repository';
import { Usuario } from '../../shared/interfaces/auth.interface';
import { Configuracion } from '../../shared/interfaces/administracion.interface';
import {
  Calibre,
  Categoria,
  CodigoRancho,
  Consignatario,
  Destino,
  Formato,
  LugarProduccion,
  Presentacion,
  TipoCaja,
  TipoClamshell,
  TipoEmpaque,
  TipoEmpaqueGuia,
  TipoProcesoEmpacado,
  Transporte,
  Variedad,
} from '../../shared/interfaces/catalogo.interface';
import { DPalet, Palet } from '../../shared/interfaces/palet.interface';
import { Proceso } from '../../shared/interfaces/proceso.interface';
import { AlertaService } from '../../shared/services/alerta.service';
import { AuthService } from '../../shared/services/auth.service';
import { CatalogosApiService } from '../../shared/services/catalogos-api.service';
import { ConnectivityService } from '../../shared/services/connectivity.service';
import { FeedbackModalService } from '../../shared/services/feedback-modal.service';
import { MaestrosApiService } from '../../shared/services/maestros-api.service';
import { PaletsApiService } from '../../shared/services/palets-api.service';
import { LoadingService } from '../../shared/services/loading.service';
import { PaletsSyncService } from '../../shared/services/palets-sync.service';
import { ProcesosApiService } from '../../shared/services/procesos-api.service';
import { ProcesosSyncService } from '../../shared/services/procesos-sync.service';
import { abrirOCompartirArchivo, descargarArchivo, esDispositivoMovil } from '../../shared/utils/archivo';
import { formatDateTime, formatTimeClave } from '../../shared/utils/date-time.util';
import { permisos } from '../../shared/utils/permisos';
import { FormCajas, ModalCajasComponent } from './components/modal-cajas/modal-cajas.component';
import { InfoEliminar, ModalEliminarPaletComponent } from './components/modal-eliminar-palet/modal-eliminar-palet.component';
import { ModalCerrarPaletComponent } from './components/modal-cerrar-palet/modal-cerrar-palet.component';

const texto = (v: unknown): string => String(v ?? '').trim();

/**
 * Palets de un proceso: crear, agregar cajas (composiciones), cerrar, reabrir, eliminar, ficha de composicion y
 * sincronizacion con el servidor. Trabaja con y sin internet (Dexie). La logica es la de la aplicacion anterior; solo cambian
 * la forma de llamar a la API (api/palets) y la pantalla.
 */
@Component({
  selector: 'app-palets',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    RouterLink,
    ModalCajasComponent,
    ModalCerrarPaletComponent,
    ModalEliminarPaletComponent,
    LucideArrowLeftRight,
    LucideBox,
    LucideChevronDown,
    LucideChevronUp,
    LucideCircleAlert,
    LucideCircleCheck,
      LucideFileText,
    LucideLayers,
    LucidePackage,
    LucidePencil,
      LucidePlus,
    LucideRefreshCcw,
    LucideRotateCcw,
    LucideTrash2,
    LucideTruck,
    LucideWeight,
    ],
  templateUrl: './palets.component.html',
})
export class PaletsComponent implements OnInit {
  private readonly api = inject(PaletsApiService);
  private readonly procesosApi = inject(ProcesosApiService);
  private readonly catalogosApi = inject(CatalogosApiService);
  private readonly maestros = inject(MaestrosApiService);
  private readonly procesosSync = inject(ProcesosSyncService);
  private readonly paletsSync = inject(PaletsSyncService);
  private readonly procesoRepo = inject(ProcesoRepository);
  private readonly catalogosRepo = inject(CatalogosRepository);
  private readonly catalogosOperativosRepo = inject(CatalogosOperativosRepository);
  private readonly administracionRepo = inject(AdministracionRepository);
  private readonly auth = inject(AuthService);
  private readonly loading = inject(LoadingService);
  private readonly connectivity = inject(ConnectivityService);
  private readonly feedback = inject(FeedbackModalService);
  private readonly alertService = inject(AlertaService);

  readonly usuario = signal<Usuario | null>(null);
  readonly savedConfig = signal<Configuracion | null>(null);

  readonly esAdmin = computed(() => permisos.esAdmin(this.usuario()?.idRol));
  readonly puedeCrearPalet = computed(() => permisos.puedeCrearPalet(this.usuario()?.idRol));
  readonly puedeAgregarCajas = computed(() => permisos.puedeAgregarCajas(this.usuario()?.idRol));
  readonly puedeCerrarPalet = computed(() => permisos.puedeCerrarPalet(this.usuario()?.idRol));
  readonly puedeReabrirPalet = computed(() => permisos.puedeReabrirPalet(this.usuario()?.idRol));
  readonly puedeEliminarPalet = computed(() => permisos.puedeEliminarPalet(this.usuario()?.idRol));

  // La aplicacion anterior llamaba a sus servicios y recibia [{ error, data, mensaje }]. Estos adaptadores devuelven esa misma
  // forma desde la API nueva, para que la logica de la pantalla siga igual.
  private readonly paletService = {
    listarPaletPorProceso: (idProceso: string) => from(this.api.porProceso(idProceso).then((s) => [s])),
    getTipoProcesoEmpacadoPorAcopio: (idProyecto: string) => from(this.procesosApi.tipoProcesoEmpacadoAcopio(idProyecto).then((s) => [s])),
    getDestinosPorMatrizCompatibilidad: (idProyecto: string, documentoConsignatario: string) =>
      from(this.api.destinosPorMatriz(idProyecto, documentoConsignatario).then((s) => [s])),
    getFormatosPorMatriz: (codigoCultivo: string, documentoConsignatario: string, destinoId: string) =>
      from(this.api.formatosPorMatriz({ codigoCultivo, documentoConsignatario, destinoId }).then((s) => [s])),
    getTiposEmpaqueGuiaPorMatriz: (codigoCultivo: string, documentoConsignatario: string, destinoId: string, formatoId: number) =>
      from(this.api.tiposEmpaqueGuiaPorMatriz({ codigoCultivo, documentoConsignatario, destinoId, formatoId }).then((s) => [s])),
    getPresentacionesPorMatriz: (codigoCultivo: string, documentoConsignatario: string, destinoId: string, formatoId: number, tipoEmpaqueGuiaId: number) =>
      from(this.api.presentacionesPorMatriz({ codigoCultivo, documentoConsignatario, destinoId, formatoId, tipoEmpaqueGuiaId }).then((s) => [s])),
    getTiposCajaPorMatriz: (codigoCultivo: string, documentoConsignatario: string, destinoId: string, formatoId: number, tipoEmpaqueGuiaId: number, presentacionId?: number) =>
      from(
        this.api
          .tiposCajaPorMatriz({ codigoCultivo, documentoConsignatario, destinoId, formatoId, tipoEmpaqueGuiaId, ...(presentacionId && presentacionId > 0 ? { presentacionId } : {}) })
          .then((s) => [s]),
      ),
    getTiposClamshellPorMatriz: (codigoCultivo: string, documentoConsignatario: string, destinoId: string, formatoId: number, tipoEmpaqueGuiaId: number, tipoCajaId?: number, presentacionId?: number) =>
      from(
        this.api
          .tiposClamshellPorMatriz({
            codigoCultivo,
            documentoConsignatario,
            destinoId,
            formatoId,
            tipoEmpaqueGuiaId,
            ...(tipoCajaId && tipoCajaId > 0 ? { tipoCajaId } : {}),
            ...(presentacionId && presentacionId > 0 ? { presentacionId } : {}),
          })
          .then((s) => [s]),
      ),
    getDPaletsPorAcopio: () => from(this.api.dPaletsPorAcopio().then((s) => [s])),
    getDPaletsPorPalet: (idPalet: string) => from(this.api.dPaletsPorPalet(idPalet).then((s) => [s])),
    sincronizar: (palets: unknown) => from(this.api.sincronizar(palets).then((s) => [s])),
    /** Devuelve la lista de resultados por detalle ({ idDPalet, success, mensaje }). */
    sincronizarDPalets: (dPalets: unknown[]) => from(this.api.sincronizarDPalets(dPalets).then((s) => (Array.isArray(s.data) ? s.data : []))),
  };

  private readonly catalogoService = {
    listarConsignatarios: () => from(this.catalogosApi.consignatarios().then((s) => [s])),
    listarVariedades: () => from(this.catalogosApi.variedades()),
    listarLugaresProduccion: (idProyecto: string) => from(this.catalogosApi.porProyecto('lugaresProduccion', idProyecto)),
    listarCodigosRanchoCatalogo: (idProyecto: string) => from(this.catalogosApi.porProyecto('codigosRancho', idProyecto)),
    listarTransporte: () => from(this.maestros.transporte()),
    listarPaises: () => from(this.maestros.paises()),
    listarFormatos: (c: string) => from(this.catalogosApi.porCultivo('formatos', c)),
    listarTiposEmpaqueGuia: (c: string) => from(this.catalogosApi.porCultivo('tiposEmpaqueGuia', c)),
    listarPresentaciones: (c: string) => from(this.catalogosApi.porCultivo('presentaciones', c)),
    listarTiposCaja: (c: string) => from(this.catalogosApi.porCultivo('tiposCaja', c)),
    listarTiposClamshell: (c: string) => from(this.catalogosApi.porCultivo('tiposClamshell', c)),
  };

  private _cargandoCascada = false;
  get online(): boolean {
    return this.connectivity.isOnline();
  }
  campania = signal<any>({});
  procesosAbiertos = signal<Proceso[]>([]);
  procesoSeleccionado = signal<Proceso | null>(null);
  palets = signal<Palet[]>([]);
  paletSeleccionado = signal<Palet | null>(null);
  composiciones = signal<DPalet[]>([]);

  consignatarios = signal<Consignatario[]>([]);
  variedades = signal<Variedad[]>([]);
  lugaresProduccion = signal<LugarProduccion[]>([]);
  transportes = signal<Transporte[]>([]);
  calibres = signal<Calibre[]>([]);
  categorias = signal<Categoria[]>([]);
  tiposProcesoEmpacado = signal<TipoProcesoEmpacado[]>([]);
  tiposEmpaque = signal<TipoEmpaque[]>([]);

  filteredDestinos = signal<any[]>([]);
  filteredFormatos = signal<any[]>([]);
  filteredTiposEmpaqueGuia = signal<any[]>([]);
  filteredPresentaciones = signal<any[]>([]);
  filteredTiposCaja = signal<any[]>([]);
  filteredTiposClamshell = signal<any[]>([]);
  filteredCodigosRancho = signal<any[]>([]);
  filteredVariedades = signal<Variedad[]>([]);

  destinos = signal<Destino[]>([]);
  formatos = signal<Formato[]>([]);
  tiposEmpaqueGuia = signal<TipoEmpaqueGuia[]>([]);
  presentaciones = signal<Presentacion[]>([]);
  tiposCaja = signal<TipoCaja[]>([]);
  tiposClamshell = signal<TipoClamshell[]>([]);
  codigosRancho = signal<CodigoRancho[]>([]);

  modalAgregarCajasAbierto = signal(false);
  modoEdicionCajas = signal(false);
  dpaletEditando = signal<DPalet | undefined>(undefined);
  tiposProcesoEmpacadoModal = signal<TipoProcesoEmpacado[]>([]);
  tipoProcesoEmpacadoDisabled = signal(false);
  codigoRanchoDisabled = signal(true);
  formCajas = signal<FormCajas>({
    consignatarioId: '',
    destinoId: 0,
    formatoId: 0,
    tipoEmpaqueId: 0,
    calibreId: 0,
    categoriaId: 0,
    tipoEmpaqueGuiaId: 0,
    tipoCajaId: 0,
    tipoClamshellId: 0,
    presentacionId: 0,
    tipoProcesoEmpacadoId: 1,
    variedadId: 0,
    variedadGuiaId: '',
    lugarProduccionId: 0,
    codigoRanchoId: 0,
    transporteId: '',
    cantidadCajas: 0,
    esReposicion: false,
    esEnsayo: false,
  });

  cerrarPaletTieneObs = signal(false);
  cerrarPaletObservaciones = signal('');
  cerrarPaletMedida = signal('');
  modalCerrarPaletAbierto = signal(false);

  // UI state signals
  isLoading = signal(false);
  seccionActivosAbierta = signal(true);
  seccionDespachadosAbierta = signal(true);
  seccionComposicionAbierta = signal(true);
  seccionObservacionesAbierta = signal(false);
  showModalAgregarCajas = computed(() => this.modalAgregarCajasAbierto());
  showModalCerrarPalet = computed(() => this.modalCerrarPaletAbierto());

  readonly paletsActivos = computed(() =>
    this.palets().filter(p => p.estado !== 'DESPACHADO')
  );

  readonly paletsDespachados = computed(() =>
    this.palets().filter(p => p.estado === 'DESPACHADO')
  );

  sincronizadoLabel(db?: number): string {
    return db === 1 ? 'Sincronizado' : 'No sincronizado';
  }

  sincronizadoClass(db?: number): string {
    return db === 1 ? 'badge-success' : 'badge-error';
  }

  formatPeso(valor: number | undefined | null): string {
    const n = Number(valor ?? 0);
    return String(Math.ceil(n * 1000) / 1000);
  }

  private resolverNombresDPalets(dpalets: any[]): Promise<DPalet[]> {
    return this.paletsSync.resolverNombres(dpalets);
  }

  async ngOnInit(): Promise<void> {
    this.loading.show('Cargando palets...');
    try {
      const session = await this.auth.getSession();
      this.usuario.set(session?.user ?? null);
      await this.cargarConfiguracion();
      await this.cargarDesdeDexieCampania();
      await this.cargarProcesos();
    } finally {
      await this.loading.hideAfterMinimum();
    }
  }

  private async cargarDesdeDexieCampania(): Promise<void> {
    try {
      const campania = await this.catalogosRepo.campaniaRepo.getByField('idproyecto', this.savedConfig()?.idProyecto || '');
      this.campania.set(campania);
    } catch (error) {
      console.error('Error cargando campanias desde Dexie', error);
      this.campania.set([]);
    }
  }

  private async cargarConfiguracion(): Promise<void> {
    try {
      const nro = texto(this.usuario()?.documentoIdentidad);
      const cfg = nro ? await this.catalogosRepo.configuracionRepo.getByField('nrodocumento', nro) : null;
      this.savedConfig.set(cfg ?? null);
    } catch (error) {
      console.error('Error cargando configuracion desde Dexie', error);
      this.savedConfig.set(null);
    }
  }

  /** Con internet pide los procesos abiertos al servidor y los muestra sin guardarlos en Dexie; sin internet usa los que ya hubiera en el equipo. */
  async cargarProcesos(): Promise<void> {
    this.procesosAbiertos.set([]);
    const cfg = this.savedConfig();
    if (this.online && cfg) {
      try {
        const sobre = await this.procesosApi.listar(cfg.idProyecto, cfg.codigoCultivo, { estado: 'ABIERTO' });
        if (sobre?.error) {
          this.alertService.showAlert('Error', sobre.mensaje || 'No se pudieron obtener los procesos.', 'error');
          return;
        }
        const data = Array.isArray(sobre?.data) ? sobre.data : [];
        const procesos = data.map((x) => this.procesosSync.normalizar(x).proceso as Proceso);
        this.procesosAbiertos.set(procesos.filter((p) => p.estado === 'ABIERTO'));
        return;
      } catch (error) {
        console.error('Error obteniendo procesos', error);
        this.alertService.showAlert('Error', 'No se pudieron obtener los procesos.', 'error');
        return;
      }
    }
    const listaProcesos = await this.procesoRepo.procesosRepo.getAll();
    this.procesosAbiertos.set(listaProcesos.filter((p: Proceso) => p.estado === 'ABIERTO'));
  }

  /** Pide los palets del proceso a la API y los muestra tal cual llegan; no usa Dexie. */
  async listarPaletsForProceso(idproceso: string, _options?: { showLoading?: boolean }): Promise<void> {
    const idProceso = String(idproceso ?? '').trim();
    if (!idProceso) {
      this.palets.set([]);
      return;
    }
    if (!this.online) {
      this.palets.set([]);
      this.alertService.showAlert('Sin conexión', 'Se necesita internet para ver los palets del proceso.', 'warning');
      return;
    }
    try {
      const sobre = await this.api.porProceso(idProceso);
      if (sobre?.error) {
        this.palets.set([]);
        this.alertService.showAlert('Error', sobre.mensaje || 'Error al obtener los palets del proceso', 'error');
        return;
      }
      const apiPalets = (Array.isArray(sobre?.data) ? sobre.data : []) as unknown as Palet[];
      this.palets.set(apiPalets.filter((p: any) => !p?.eliminado).map((p) => ({ ...(p as any), bd: 1 }) as Palet));
    } catch (error: any) {
      console.error(error);
      this.palets.set([]);
      this.alertService.showAlert('Error', `${error?.error?.message ?? 'Error al obtener los palets del proceso'}`, 'error');
    } finally {
      await this.loading.hideAfterMinimum();
    }
  }

  async descargarFichaComposicion(palet: any): Promise<void> {
    if (!palet?.idPalet) return;
    if (!this.online) {
      this.alertService.showAlert('Sin conexión', 'La ficha de composición se genera en el servidor. Conéctese a internet para descargarla.', 'warning');
      return;
    }

    this.loading.show('Generando ficha...');
    try {
      const blob = await this.api.fichaComposicion(palet.idPalet);
      await this.loading.hideAfterMinimum();
      const nombre = `FichaComposicion_${palet.numeroPalet || palet.idPalet}.pdf`;

      if (esDispositivoMovil()) {
        // Android / iOS: el archivo llego despues de esperar a la API, asi que solo se puede abrir desde un toque de la persona.
        this.feedback.open('success', {
          title: 'Ficha lista',
          message: `La ficha del palet #${palet.numeroPalet || palet.idPalet} está lista. Toque "Abrir ficha" para verla o compartirla.`,
          actionText: 'Cerrar',
          secondaryAction: { text: 'Abrir ficha', handler: () => abrirOCompartirArchivo(blob, nombre) },
        });
      } else {
        descargarArchivo(blob, nombre);
      }
    } catch (error) {
      console.error('Error al descargar ficha de composición', error);
      await this.loading.hideAfterMinimum();
      this.alertService.showAlert('Error', 'No se pudo descargar la ficha de composición.', 'error');
    }
  }

  /** Actualizar: vuelve a pedir a la API los palets del proceso abierto, los lista y cierra el detalle abierto; no usa Dexie. */
  async onSincronizar(): Promise<void> {
    const proceso = this.procesoSeleccionado();
    if (!proceso) return;
    if (!this.online) {
      this.alertService.showAlert('Sin conexión', 'Se necesita internet para actualizar los palets.', 'warning');
      return;
    }
    this.loading.show('Actualizando palets...');
    try {
      await this.listarPaletsForProceso(proceso.idProceso);
      // Solo se actualizan los palets: se cierra el detalle abierto para que se vuelva a abrir con datos nuevos
      this.paletSeleccionado.set(null);
      this.composiciones.set([]);
    } finally {
      await this.loading.hideAfterMinimum();
    }
  }

  async seleccionarProceso(p: Proceso): Promise<void> {
    this.loading.show('Cargando palets del proceso...');
    this.procesoSeleccionado.set(p);
    this.paletSeleccionado.set(null);
    this.composiciones.set([]);
    try {
      await this.listarPaletsForProceso(p.idProceso);
    } finally {
      await this.loading.hideAfterMinimum();
    }
  }

  cambiarProceso(): void {
    this.procesoSeleccionado.set(null);
    this.paletSeleccionado.set(null);
    this.palets.set([]);
    this.composiciones.set([]);
  }

  paletKey(p: any): any {
    if (!p) return null;
    const k = String(p?.idPalet ?? '').trim();
    return k || p?.id;
  }

  /** Sin internet no se puede trabajar con palets: todo se pide y se guarda en el servidor. */
  private exigirInternet(): boolean {
    if (this.online) return true;
    this.alertService.showAlert('Sin conexión', 'Se necesita internet para trabajar con los palets.', 'warning');
    return false;
  }

  /** Cambia en la lista (y en el palet abierto) el palet con los datos nuevos. */
  private reemplazarPalet(actualizado: Palet): void {
    const uk = String(actualizado?.idPalet ?? '').trim();
    this.paletSeleccionado.set(actualizado);
    this.palets.update((lista) =>
      lista.map((item) => {
        const pk = String(item?.idPalet ?? '').trim();
        return pk && uk && pk === uk ? actualizado : item;
      }),
    );
  }

  /** Detalle (composiciones) de un palet directo de la API; no usa Dexie. Devuelve null si falla (ya avisó). */
  private async pedirDetallePalet(idPalet: string): Promise<DPalet[] | null> {
    const resp: any = await firstValueFrom(this.paletService.getDPaletsPorPalet(String(idPalet ?? '').trim()));
    const first = Array.isArray(resp) ? resp[0] : resp;
    if (first?.error) {
      this.alertService.showAlert('Error', first?.mensaje ?? 'Error al obtener el detalle del palet', 'error');
      return null;
    }
    const items: any[] = first?.data ?? [];
    const enriquecidos = await this.resolverNombresDPalets(items);
    return enriquecidos.filter((d: any) => !d?.eliminado);
  }

  async verDetalle(p: Palet): Promise<void> {
    this.paletSeleccionado.set(p);
    if (!this.exigirInternet()) {
      this.composiciones.set([]);
      return;
    }
    this.loading.show('Cargando detalle del palet...');
    try {
      const activos = await this.pedirDetallePalet(p?.idPalet ?? '');
      if (!activos) {
        this.composiciones.set([]);
        return;
      }
      this.composiciones.set(activos);

      // Totales del palet solo con las composiciones no eliminadas
      const totalCajas = activos.reduce((sum: number, d: any) => sum + (d?.cantidadCajas || 0), 0);
      const totalPeso = activos.reduce((sum: number, d: any) => sum + (d?.pesoTotal || 0), 0);
      const limite = p?.limiteCajasPorPalet ?? 0;
      const porcentaje = limite > 0 ? Math.round((totalCajas / limite) * 100) : 0;
      this.reemplazarPalet({ ...p, cantidadCajas: totalCajas, pesoTotal: totalPeso, porcentajeAvance: porcentaje });
    } catch (err) {
      console.error('Error cargando detalle del palet:', err);
      this.composiciones.set([]);
      this.alertService.showAlert('Error', 'Error al obtener el detalle del palet', 'error');
    } finally {
      await this.loading.hideAfterMinimum();
    }
  }

  async crearPalet(): Promise<void> {
    const proceso = this.procesoSeleccionado();
    if (!proceso) {
      this.alertService.showAlert('Validación', 'Debe seleccionar un proceso primero', 'warning');
      return;
    }
    if (!this.exigirInternet()) return;
    try {
      this.loading.show('Creando palet...');
      let fecha = new Date();
      let fechaApertura = formatDateTime(fecha);
      let newPalets: Palet = {
        id: 0,
        idPalet: this.createIdPalet(proceso.idProceso),
        idProceso: proceso.idProceso,
        codigoAcopio: proceso.codigoAcopio,
        acopioNombre: proceso.acopioNombre,
        formatoId: 0,
        estado: 'ABIERTO',
        fechaApertura: fechaApertura || '',
        cantidadCajas: 0,
        pesoTotal: 0,
        porcentajeAvance: 0,
        observaciones: '',
        medidaCorrectiva: '',
        modo: 'nuevo'
      }
      let resp = await firstValueFrom(this.paletService.sincronizar(newPalets));
      if (resp.length > 0) {
        if (resp[0].error) {
          await this.loading.hideAfterMinimum();
          this.alertService.showAlertAcept('Error', resp[0].mensaje ?? 'Error al crear el palet', 'error');
        } else {
          await this.listarPaletsForProceso(proceso.idProceso, { showLoading: false });
          this.alertService.showAlertAcept('Éxito', 'Palet creado exitosamente.', 'success');
        }
      } else {
        await this.loading.hideAfterMinimum();
        this.alertService.showAlertAcept('Error', 'Error al crear el Palet, por favor vuelva a Iniciar Sesión.', 'error');
      }
    } catch (error) {
      console.error('Error creando palet:', error);
      await this.loading.hideAfterMinimum();
    }
  }

  createIdPalet(idproceso: string) {
    let dateTime = new Date();
    let dateTimeString = formatTimeClave(dateTime);
    return [idproceso, dateTimeString].join('');
  }

  async abrirModalAgregarCajas(palet: Palet): Promise<void> {
    const codigoAcopio = String(palet?.codigoAcopio ?? this.procesoSeleccionado()?.codigoAcopio ?? '').trim();
    if (!codigoAcopio) {
      this.alertService.showAlert('Validación', 'No se pudo determinar el acopio del palet.', 'warning');
      return;
    }

    this.paletSeleccionado.set(palet);
    this.loading.show('Preparando el formulario...');

    let tipos: TipoProcesoEmpacado[] = [];

    try {
      console.log(this.online)
      if (this.online) {
        const idproyecto = String(this.savedConfig()?.idProyecto ?? '').trim();
        const resp: any = await firstValueFrom(this.paletService.getTipoProcesoEmpacadoPorAcopio(idproyecto));
        const items = Array.isArray(resp) ? resp : (resp?.data ?? []);
        tipos = (items[0]?.data ?? []).map((x: any) => ({
          id: x?.id ?? x?.Id ?? 0,
          codigo: String(x?.codigo ?? x?.Codigo ?? '').trim(),
          nombre: String(x?.nombre ?? x?.Nombre ?? '').trim(),
          idproyecto: idproyecto,
          activo: true,
          fechaCreacion: '',
        }));
      } else {
        const detalles = await this.catalogosOperativosRepo.acopiosDetallesRepo.getAcopioDetalle(codigoAcopio);
        const activos = (detalles ?? []).filter((d: any) => d?.activo === true);
        for (const d of activos) {
          const codigoTipo = String((d as any)?.codigoTipoProcesoEmpacado ?? '').trim();
          if (!codigoTipo) continue;
          const tipo = await this.catalogosRepo.tipoProcesoEmpacadoRepo.getByField('codigo', codigoTipo);
          if (tipo) {
            tipos.push(tipo);
          }
        }
      }

      await this.cargarConsignatarios();
      await this.cargarVariedadesYLugares();
      await this.cargarTransportes();
      await this.loadCodigosRancho();
    } catch (err) {
      console.error('Error cargando tipos proceso empacado:', err);
    } finally {
      await this.loading.hideAfterMinimum();
    }

    if (tipos.length === 0) {
      this.alertService.showAlert('Información', 'El acopio no tiene configurado el Tipo de Proceso Empacado.', 'warning');
      return;
    }
    this.tiposProcesoEmpacadoModal.set(tipos);

    if (tipos.length === 1) {
      this.tipoProcesoEmpacadoDisabled.set(true);
      this.updateFormCajas('tipoProcesoEmpacadoId', tipos[0].id);
    } else {
      this.tipoProcesoEmpacadoDisabled.set(false);
      this.updateFormCajas('tipoProcesoEmpacadoId', 0);
    }

    // Si el palet ya tiene composiciones, precargar consignatario/destino/formato y bloquear
    const comps = this.composiciones();
    if (comps.length > 0) {
      const comp = comps[0];
      const consignatario = this.consignatarios().find(c => c.documento === comp.documentoConsignatario);
      if (consignatario) {
        this._cargandoCascada = true;
        this.alertService.silenciar();
        try {
          await this.onConsignatarioChange(String(consignatario.documento));
          if (comp.destinoId) {
            await this.onDestinoChange(String(comp.destinoId));
          }
          if (comp.formatoId) {
            await this.onFormatoChange(String(comp.formatoId));
          }
        } catch (err) {
          console.error('Error precargando cascada del palet:', err);
        } finally {
          this.alertService.reanudar();
          this._cargandoCascada = false;
        }
      }
    }

    this.modoEdicionCajas.set(false);
    this.dpaletEditando.set(undefined);
    this.modalAgregarCajasAbierto.set(true);
  }

  async abrirModalEditarCajas(dpalet: DPalet): Promise<void> {
    const palet = this.paletSeleccionado();
    if (!palet) return;
    this.paletSeleccionado.set(palet);
    this.dpaletEditando.set(dpalet);
    this.modoEdicionCajas.set(true);
    this.formCajas.set({
      consignatarioId: 0,
      destinoId: (dpalet.destinoId as any) || 0,
      formatoId: dpalet.formatoId || 0,
      tipoEmpaqueId: dpalet.tiposEmpaqueId || 0,
      calibreId: Number(dpalet.calibreId) || 0,
      categoriaId: 0,
      tipoEmpaqueGuiaId: dpalet.tipoEmpaqueGuiaId ?? 0,
      tipoCajaId: dpalet.tipoCajaId || 0,
      tipoClamshellId: dpalet.tipoClamshellId || 0,
      presentacionId: dpalet.presentacionId ?? 0,
      tipoProcesoEmpacadoId: dpalet.tipoProcesoEmpacadoId ?? 1,
      variedadId: dpalet.variedadId || 0,
      variedadGuiaId: dpalet.variedadGuiaId ?? '',
      lugarProduccionId: dpalet.lugarProduccionId || 0,
      codigoRanchoId: dpalet.codigoRanchoId || 0,
      transporteId: dpalet.transporteId || '',
      cantidadCajas: dpalet.cantidadCajas || 0,
      esReposicion: dpalet.esReposicion ?? false,
      esEnsayo: dpalet.esEnsayo ?? false,
    });
    const codigoAcopio = String(palet?.codigoAcopio ?? this.procesoSeleccionado()?.codigoAcopio ?? '').trim();
    this.loading.show('Cargando datos de la línea...');
    let tipos: TipoProcesoEmpacado[] = [];
    try {
      if (this.online) {
        const idproyecto = String(this.savedConfig()?.idProyecto ?? '').trim();
        const resp: any = await firstValueFrom(this.paletService.getTipoProcesoEmpacadoPorAcopio(idproyecto));
        const items = Array.isArray(resp) ? resp : (resp?.data ?? []);
        tipos = (items[0]?.data ?? []).map((x: any) => ({
          id: x?.id ?? x?.Id ?? 0,
          codigo: String(x?.codigo ?? x?.Codigo ?? '').trim(),
          nombre: String(x?.nombre ?? x?.Nombre ?? '').trim(),
          idproyecto: idproyecto,
          activo: true,
          fechaCreacion: '',
        }));
      } else {
        const detalles = await this.catalogosOperativosRepo.acopiosDetallesRepo.getAcopioDetalle(codigoAcopio);
        for (const d of (detalles ?? []).filter((d: any) => d?.activo === true)) {
          const codigoTipo = String((d as any)?.codigoTipoProcesoEmpacado ?? '').trim();
          if (!codigoTipo) continue;
          const tipo = await this.catalogosRepo.tipoProcesoEmpacadoRepo.getByField('codigo', codigoTipo);
          if (tipo) tipos.push(tipo);
        }
      }
      await this.cargarConsignatarios();
      await this.cargarVariedadesYLugares();
      await this.cargarTransportes();
      await this.loadCodigosRancho();
    } catch (err) { 
      console.error('Error cargando tipos proceso empacado:', err); 
    }finally { 
      await this.loading.hideAfterMinimum(); 
    }

    this.tiposProcesoEmpacadoModal.set(tipos);
    if (tipos.length === 1) { this.tipoProcesoEmpacadoDisabled.set(true); }
    else { this.tipoProcesoEmpacadoDisabled.set(false); }

    const consignatarioReal = this.consignatarios().find(c => c.documento === dpalet.documentoConsignatario);
    const consignatarioIdReal = consignatarioReal?.documento ?? '';
    if (consignatarioIdReal) {
      this.updateFormCajas('consignatarioId', consignatarioIdReal);
    }

    // Ejecutar cascada desde consignatario para poblar listas filtradas
    const valoresPrevios = { ...this.formCajas() };
    
    this._cargandoCascada = true;
    this.alertService.silenciar();
    try {
      if (consignatarioIdReal) {
        await this.onConsignatarioChange(String(consignatarioIdReal));
        this.updateFormCajas('destinoId', valoresPrevios.destinoId);
        if (valoresPrevios.destinoId) await this.onDestinoChange(String(valoresPrevios.destinoId));
        this.updateFormCajas('formatoId', valoresPrevios.formatoId);
        if (valoresPrevios.formatoId) await this.onFormatoChange(String(valoresPrevios.formatoId));
        this.updateFormCajas('tipoEmpaqueGuiaId', valoresPrevios.tipoEmpaqueGuiaId);
        if (valoresPrevios.tipoEmpaqueGuiaId) await this.onTipoEmpaqueGuiaChange(String(valoresPrevios.tipoEmpaqueGuiaId));
        this.updateFormCajas('presentacionId', valoresPrevios.presentacionId);
        if (valoresPrevios.presentacionId) await this.onPresentacionChange(String(valoresPrevios.presentacionId));
        // onPresentacionChange resetea tipoCajaId a 0; restaurarlo después
        this.updateFormCajas('tipoCajaId', valoresPrevios.tipoCajaId);
        if (valoresPrevios.tipoCajaId) await this.onTipoCajaChange(String(valoresPrevios.tipoCajaId));
        this.updateFormCajas('tipoClamshellId', valoresPrevios.tipoClamshellId);
        this.updateFormCajas('calibreId', valoresPrevios.calibreId);
        this.updateFormCajas('tipoEmpaqueId', valoresPrevios.tipoEmpaqueId);
        this.updateFormCajas('codigoRanchoId', valoresPrevios.codigoRanchoId);
      }
      this._filtrarVariedadesPorEnsayo();
    } catch (err) { console.error('Error precargando cascada edicion:', err); }
    finally {
      this.alertService.reanudar();
      this._cargandoCascada = false;
    }

    this.modalAgregarCajasAbierto.set(true);
  }

  async  onModalCampoChange(event: { campo: string; valor: any }): Promise<void> {
    const { campo, valor } = event;
    this.updateFormCajas(campo, valor);
    switch (campo) {
      case 'consignatarioId': await this.onConsignatarioChange(String(valor)); break;
      case 'destinoId': await this.onDestinoChange(String(valor)); break;
      case 'formatoId': await this.onFormatoChange(String(valor)); break;
      case 'tipoEmpaqueGuiaId': await this.onTipoEmpaqueGuiaChange(String(valor)); break;
      case 'presentacionId': await this.onPresentacionChange(String(valor)); break;
      case 'tipoCajaId': await this.onTipoCajaChange(String(valor)); break;
      case 'tipoClamshellId': this.onTipoClamshellChange(String(valor)); break;
      case 'variedadId': this.onVariedadChange(String(valor)); break;
      case 'esEnsayo': this.onEsEnsayoChange(valor); break;
      case 'esReposicion': this.onEsReposicionChange(valor); break;
    }
  }

  async submitEditarCajas(): Promise<void> {
    const palet = this.paletSeleccionado();
    const dpaletOriginal = this.dpaletEditando();
    if (!palet || !dpaletOriginal) return;

    const f = this.formCajas();
    if (!f.tipoProcesoEmpacadoId || !f.consignatarioId || !f.destinoId || !f.formatoId || !f.variedadId || !f.cantidadCajas) {
      this.alertService.showAlert('Validacion', 'Complete todos los campos requeridos', 'warning'); return;
    }
    if (!f.tipoEmpaqueGuiaId || !f.tipoCajaId || !f.tipoClamshellId) {
      this.alertService.showAlert('Validacion', 'Complete la seleccion de empaque (Tipo Empaque Guia, Tipo Caja, Tipo Clamshell)', 'warning'); return;
    }
    if (!f.lugarProduccionId || !f.codigoRanchoId) {
      this.alertService.showAlert('Validacion', 'Seleccione Lugar de Produccion y Codigo de Rancho', 'warning'); return;
    }
    if (!f.transporteId) { this.alertService.showAlert('Validacion', 'Seleccione Via de Transporte', 'warning'); return; }
    if (!f.cantidadCajas || f.cantidadCajas <= 0) { this.alertService.showAlert('Validacion', 'La cantidad de cajas debe ser mayor a 0', 'warning'); return; }

    const formatoSel = this.filteredFormatos().find((fmt: any) => fmt.id === f.formatoId);
    const pesoPorCaja = formatoSel?.pesoPorCaja ?? 10;
    const limiteCajasPorPalet = formatoSel?.limiteCajasPorPalet ?? 0;

    const cantidadOriginal = dpaletOriginal.cantidadCajas || 0;
    const cantidadDeOtras = (palet.cantidadCajas || 0) - cantidadOriginal;
    const totalProyectado = cantidadDeOtras + f.cantidadCajas;

    if (limiteCajasPorPalet > 0 && totalProyectado > limiteCajasPorPalet) {
      const faltantes = limiteCajasPorPalet - cantidadDeOtras;
      const msg = faltantes > 0
        ? `Solo puede poner ${faltantes} caja(s) en esta línea. El límite del formato es ${limiteCajasPorPalet} cajas.`
        : `El palet ya alcanzó el límite de ${limiteCajasPorPalet} cajas.`;
      this.alertService.showAlert('Validación',
        `El total de cajas (${totalProyectado}) excede el límite permitido. ${msg}`, 'warning');
      return;
    }

    const consignatario = this.consignatarios().find(c => c.documento === f.consignatarioId);
    const destino = this.filteredDestinos().find(d => String(d.id) === String(f.destinoId));
    const formato = this.filteredFormatos().find(fmt => fmt.id === f.formatoId);
    const variedad = this.filteredVariedades().find(v => String(v.codigo) === String(f.variedadId));
    const presentacion = this.filteredPresentaciones().find(p => p.id === (f.presentacionId ?? 0));
    const tipoEmpaqueGuia = this.filteredTiposEmpaqueGuia().find(t => t.id === (f.tipoEmpaqueGuiaId ?? 0));
    const codigoRancho = this.filteredCodigosRancho().find(c => c.id === f.codigoRanchoId);
    const lugarProduccion = this.lugaresProduccion().find(l => l.id === f.lugarProduccionId);
    const transporte = this.transportes().find(t => String(t.id) === String(f.transporteId));
    const tipoProcesoEmpacado = this.tiposProcesoEmpacadoModal().find(t => t.id === (f.tipoProcesoEmpacadoId ?? 0));

    const dpaletEditado: DPalet = {
      ...dpaletOriginal,
      idProceso: palet.idProceso,
      documentoCliente: consignatario?.documento ?? undefined,
      destinoId: String(f.destinoId ?? ''),
      destinoNombre: destino?.pais ?? undefined,
      documentoConsignatario: consignatario?.documento ?? '',
      consignatarioNombre: consignatario?.nombre ?? '',
      formatoId: f.formatoId,
      formatoNombre: formato?.descripcion ?? undefined,
      tiposEmpaqueId: f.tipoEmpaqueId || 1,
      calibreId: f.calibreId?.toString() ?? undefined,
      presentacionId: f.presentacionId ?? null,
      presentacionNombre: presentacion?.nombre ?? undefined,
      variedadId: String(f.variedadId ?? ''),
      variedadNombre: variedad?.variedad ?? undefined,
      lugarProduccionId: f.lugarProduccionId,
      lugarProduccionNombre: lugarProduccion?.descripcion ?? undefined,
      codigoRanchoId: f.codigoRanchoId,
      codigoRanchoNombre: codigoRancho?.codigo ?? undefined,
      cantidadCajas: f.cantidadCajas,
      tipoCajaId: f.tipoCajaId ?? 0,
      tipoClamshellId: f.tipoClamshellId ?? 0,
      pesoPorCaja: pesoPorCaja,
      pesoTotal: f.cantidadCajas * pesoPorCaja,
      tipoEmpaqueGuiaId: f.tipoEmpaqueGuiaId ?? null,
      tipoEmpaqueGuiaNombre: tipoEmpaqueGuia?.nombre ?? undefined,
      transporteId: f.transporteId || '',
      transporteNombre: transporte?.transporte ?? undefined,
      tipoProcesoEmpacadoId: f.tipoProcesoEmpacadoId ?? null,
      tipoProcesoEmpacadoNombre: tipoProcesoEmpacado?.nombre ?? undefined,
      esReposicion: f.esReposicion ?? false,
      variedadGuiaId: f.esEnsayo && f.variedadGuiaId ? String(f.variedadGuiaId) : null,
      esEnsayo: f.esEnsayo ?? false,
      eliminado: false,
      fechaCreacion: dpaletOriginal.fechaCreacion ?? new Date().toISOString(),
      bd:0
    };

    if (!this.exigirInternet()) return;
    try {
      this.loading.show('Guardando cambios...');
      await firstValueFrom(this.paletService.sincronizarDPalets([dpaletEditado]));

      // Totales del palet: las composiciones abiertas con la editada reemplazada
      const clave = (d: any) => String(d?.idDPalet ?? d?.id ?? '');
      const activos = this.composiciones()
        .map((d) => (clave(d) === clave(dpaletEditado) ? dpaletEditado : d))
        .filter((d: any) => !d?.eliminado);
      const nuevaCantidad = activos.reduce((sum: number, d: any) => sum + (d.cantidadCajas || 0), 0);
      const nuevoPeso = activos.reduce((sum: number, d: any) => sum + (d.pesoTotal || 0), 0);
      const nuevoPorcentaje = limiteCajasPorPalet > 0 ? Math.round((nuevaCantidad / limiteCajasPorPalet) * 100) : 0;
      const paletActualizado: Palet = {
        ...palet,
        cantidadCajas: nuevaCantidad,
        pesoTotal: nuevoPeso,
        limiteCajasPorPalet: limiteCajasPorPalet > 0 ? limiteCajasPorPalet : (palet.limiteCajasPorPalet ?? 0),
        porcentajeAvance: nuevoPorcentaje,
        formatoId: dpaletEditado.formatoId ?? 0,
        modo: 'editado',
      };
      await firstValueFrom(this.paletService.sincronizar(paletActualizado));
      this.reemplazarPalet(paletActualizado);
      await this.verDetalle(paletActualizado);
      await this.loading.hideAfterMinimum();
      this.alertService.showAlert('Exito', 'Cajas actualizadas correctamente', 'success');
      this.cerrarModalAgregarCajas();
      if (limiteCajasPorPalet > 0 && nuevaCantidad >= limiteCajasPorPalet) {
        this.abrirModalCerrarPalet(paletActualizado);
      }
    } catch (err) {
      console.error('Error editando cajas:', err);
      await this.loading.hideAfterMinimum();
      this.alertService.showAlertAcept('Error', 'Error al actualizar las cajas', 'error');
    }
  }

  private async cargarConsignatarios(): Promise<void> {
    try {
      if (this.online) {
        const resp: any = await firstValueFrom(this.catalogoService.listarConsignatarios());
        if (resp.length > 0) {
          await this.catalogosRepo.consignatariosRepo.clear();
          for (const c of (resp[0].data ?? [])) {
            await this.catalogosRepo.consignatariosRepo.save(c);
          }
          let consignatarios= await this.catalogosRepo.consignatariosRepo.getAll();
          this.consignatarios.set(consignatarios);
        }
      } else {
        const consignatariosDexie = await this.catalogosRepo.consignatariosRepo.getAll();
        this.consignatarios.set(consignatariosDexie ?? []);
      }
    } catch (error) {
      console.error('Error cargando consignatarios:', error);
      const consignatariosDexie = await this.catalogosRepo.consignatariosRepo.getAll();
      this.consignatarios.set(consignatariosDexie ?? []);
    }
  }

  private async cargarVariedadesYLugares(): Promise<void> {
    try {
      const codigoCultivo = String(this.savedConfig()?.codigoCultivo ?? '').trim();
      const idProyecto = String(this.savedConfig()?.idProyecto ?? '').trim();

      // Variedades
      if (this.online) {
        const vResp: any = await firstValueFrom(this.catalogoService.listarVariedades());
        if (!vResp.error) {
          const dexiedb = await this.catalogosRepo.variedadesRepo.getAll();
          if (dexiedb.length > 0) {
            await this.catalogosRepo.variedadesRepo.clear();
          }
          const todasVariedades = (vResp.data ?? []);
          const filtradasCultivo = todasVariedades.filter((v: any) => String(v?.idcultivo ?? '') === codigoCultivo);
          for (const v of filtradasCultivo) {
            v.bd = 1;
            await this.catalogosRepo.variedadesRepo.save(v);
          }
          this.variedades.set(filtradasCultivo);
        }
      } else {
        const variedadesDexie = await this.catalogosRepo.variedadesRepo.getAll();
        const filtradasCultivo = (variedadesDexie ?? []).filter((v: Variedad) => String(v?.idcultivo ?? '') === codigoCultivo);
        this.variedades.set(filtradasCultivo);
      }

      // Lugares de producción
      if (this.online) {
        const lResp: any = await firstValueFrom(this.catalogoService.listarLugaresProduccion(idProyecto));
        if (!lResp.error) {
          const dexiedb = await this.catalogosRepo.lugaresProduccionRepo.getAll();
          if (dexiedb.length > 0) {
            await this.catalogosRepo.lugaresProduccionRepo.clear();
          }
          for (const l of (lResp.data ?? [])) {
            l.bd = 1;
            await this.catalogosRepo.lugaresProduccionRepo.save(l);
          }
          this.lugaresProduccion.set(lResp.data ?? []);
        }
      } else {
        const lugaresDexie = await this.catalogosRepo.lugaresProduccionRepo.getAll();
        this.lugaresProduccion.set(lugaresDexie ?? []);
      }

      this._filtrarVariedadesPorEnsayo();
    } catch (error) {
      console.error('Error cargando variedades/lugares:', error);
      const codigoCultivo = String(this.savedConfig()?.codigoCultivo ?? '').trim();
      const variedadesDexie = await this.catalogosRepo.variedadesRepo.getAll();
      const filtradasCultivo = (variedadesDexie ?? []).filter((v: Variedad) => String(v?.idcultivo ?? '') === codigoCultivo);
      this.variedades.set(filtradasCultivo);
      const lugaresDexie = await this.catalogosRepo.lugaresProduccionRepo.getAll();
      this.lugaresProduccion.set(lugaresDexie ?? []);
      this._filtrarVariedadesPorEnsayo();
    }
  }

  private _filtrarVariedadesPorEnsayo(): void {
    const esEnsayo = this.formCajas().esEnsayo;
    const codigoCultivo = String(this.savedConfig()?.codigoCultivo ?? '').trim();
    const todas = this.variedades();
    const filtradas = (todas ?? []).filter((v: Variedad) =>
      String(v?.idcultivo ?? '') === codigoCultivo &&
      Boolean(v?.esEnsayo) === esEnsayo
    );
    this.filteredVariedades.set(filtradas);
  }

  private async cargarTransportes(): Promise<void> {
    try {
      if (this.online) {
        const resp: any = await firstValueFrom(this.catalogoService.listarTransporte());
        const data = Array.isArray(resp) ? resp : (resp?.data ?? []);
        if (data.length > 0) {
          const dexiedb = await this.catalogosRepo.transportesRepo.getAll();
          if (dexiedb.length > 0) {
            await this.catalogosRepo.transportesRepo.clear();
          }
          for (const t of data) {
            t.bd = 1;
            await this.catalogosRepo.transportesRepo.save(t);
          }
          this.transportes.set(data);
        }
      } else {
        const transportesDexie = await this.catalogosRepo.transportesRepo.getAll();
        this.transportes.set(transportesDexie ?? []);
      }
    } catch (error) {
      console.error('Error cargando transportes:', error);
      const transportesDexie = await this.catalogosRepo.transportesRepo.getAll();
      this.transportes.set(transportesDexie ?? []);
    }
  }

  cerrarModalAgregarCajas(): void {
    this.modalAgregarCajasAbierto.set(false);
    this.modoEdicionCajas.set(false);
    this.dpaletEditando.set(undefined);
    this.tiposProcesoEmpacadoModal.set([]);
    this.tipoProcesoEmpacadoDisabled.set(false);

    this.filteredDestinos.set([]);
    this.filteredFormatos.set([]);
    this.filteredTiposEmpaqueGuia.set([]);
    this.filteredPresentaciones.set([]);
    this.filteredTiposCaja.set([]);
    this.filteredTiposClamshell.set([]);
    this.filteredCodigosRancho.set([]);
    this.filteredVariedades.set([]);
    this.transportes.set([]);
    this._matrizResults = [];
    this.formCajas.set({
      consignatarioId: 0,
      destinoId: 0,
      formatoId: 0,
      tipoEmpaqueId: 0,
      calibreId: 0,
      categoriaId: 0,
      tipoEmpaqueGuiaId: 0,
      tipoCajaId: 0,
      tipoClamshellId: 0,
      presentacionId: 0,
      tipoProcesoEmpacadoId: 0,
      variedadId: 0,
      variedadGuiaId: '',
      lugarProduccionId: 0,
      codigoRanchoId: 0,
      transporteId: '',
      cantidadCajas: 0,
      esReposicion: false,
      esEnsayo: false,
    });
  }

  async submitAgregarCajas(): Promise<void> {
    const palet = this.paletSeleccionado();
    if (!palet) return;

    const f = this.formCajas();
    if (!f.tipoProcesoEmpacadoId || !f.consignatarioId || !f.destinoId || !f.formatoId || !f.variedadId || !f.cantidadCajas) {
      this.alertService.showAlert('Validación', 'Complete todos los campos requeridos', 'warning');
      return;
    }
    if (!f.tipoEmpaqueGuiaId || !f.tipoCajaId || !f.tipoClamshellId) {
      this.alertService.showAlert('Validación', 'Complete la selección de empaque (Tipo Empaque Guía, Tipo Caja, Tipo Clamshell)', 'warning');
      return;
    }
    if (!f.lugarProduccionId || !f.codigoRanchoId) {
      this.alertService.showAlert('Validación', 'Seleccione Lugar de Producción y Código de Rancho', 'warning');
      return;
    }
    if (!f.transporteId) {
      this.alertService.showAlert('Validación', 'Seleccione Vía de Transporte', 'warning');
      return;
    }
    if (!f.cantidadCajas || f.cantidadCajas <= 0) {
      this.alertService.showAlert('Validación', 'La cantidad de cajas debe ser mayor a 0', 'warning');
      return;
    }

    const formatoSel = this.filteredFormatos().find((fmt: any) => fmt.id === f.formatoId);
    const pesoPorCaja = formatoSel?.pesoPorCaja ?? 10;
    const limiteCajasPorPalet = formatoSel?.limiteCajasPorPalet ?? 0;

    const comps = this.composiciones();
    if (comps.length > 0) {
      const formatoExistente = comps[0].formatoId;
      if (f.formatoId !== formatoExistente) {
        const formatoActual = comps[0].formatoNombre || `ID ${formatoExistente}`;
        this.alertService.showAlert('Validación',
          `No se pueden mezclar formatos con diferente cantidad de cajas por palet. Este palet ya tiene cajas con formato "${formatoActual}".`, 'warning');
        return;
      }
    }

    if (limiteCajasPorPalet > 0) {
      const totalCajas = (palet.cantidadCajas || 0) + f.cantidadCajas;
      if (totalCajas > limiteCajasPorPalet) {
        const faltantes = limiteCajasPorPalet - (palet.cantidadCajas || 0);
        const msg = faltantes > 0
          ? `Solo puede agregar ${faltantes} caja(s) más. El límite del formato es ${limiteCajasPorPalet} cajas.`
          : `El palet ya alcanzó el límite de ${limiteCajasPorPalet} cajas.`;
        this.alertService.showAlert('Validación',
          `El total de cajas (${totalCajas}) excede el límite permitido. ${msg}`, 'warning');
        return;
      }
    }

    const consignatario = this.consignatarios().find(c => c.documento === f.consignatarioId);
    const destino = this.filteredDestinos().find(d => String(d.id) === String(f.destinoId));
    const formato = this.filteredFormatos().find(fmt => fmt.id === f.formatoId);
    const variedad = this.filteredVariedades().find(v => String(v.codigo) === String(f.variedadId));
    const presentacion = this.filteredPresentaciones().find(p => p.id === (f.presentacionId ?? 0));
    const tipoEmpaqueGuia = this.filteredTiposEmpaqueGuia().find(t => t.id === (f.tipoEmpaqueGuiaId ?? 0));
    const codigoRancho = this.filteredCodigosRancho().find(c => c.id === f.codigoRanchoId);
    const lugarProduccion = this.lugaresProduccion().find(l => l.id === f.lugarProduccionId);
    const transporte = this.transportes().find(t => String(t.id) === String(f.transporteId));
    const tipoProcesoEmpacado = this.tiposProcesoEmpacadoModal().find(t => t.id === (f.tipoProcesoEmpacadoId ?? 0));

    const nuevoDPalet: DPalet = {
      id: 0,
      idPalet: palet.idPalet ?? '',
      idProceso: palet.idProceso,
      idDPalet: (palet.idPalet ?? '') + '-' + Date.now(),
      documentoCliente: consignatario?.documento ?? undefined,
      destinoId: String(f.destinoId ?? ''),
      destinoNombre: destino?.pais ?? undefined,
      documentoConsignatario: consignatario?.documento ?? '',
      consignatarioNombre: consignatario?.nombre ?? '',
      formatoId: f.formatoId,
      formatoNombre: formato?.descripcion ?? undefined,
      tiposEmpaqueId: f.tipoEmpaqueId || 1,
      calibreId: f.calibreId?.toString() ?? undefined,
      presentacionId: f.presentacionId ?? null,
      presentacionNombre: presentacion?.nombre ?? undefined,
      variedadId: String(f.variedadId ?? ''),
      variedadNombre: variedad?.variedad ?? undefined,
      lugarProduccionId: f.lugarProduccionId,
      lugarProduccionNombre: lugarProduccion?.descripcion ?? undefined,
      codigoRanchoId: f.codigoRanchoId,
      codigoRanchoNombre: codigoRancho?.codigo ?? undefined,
      cantidadCajas: f.cantidadCajas,
      tipoCajaId: f.tipoCajaId ?? 0,
      tipoClamshellId: f.tipoClamshellId ?? 0,
      pesoPorCaja: pesoPorCaja,
      pesoTotal: f.cantidadCajas * pesoPorCaja,
      tipoEmpaqueGuiaId: f.tipoEmpaqueGuiaId ?? null,
      tipoEmpaqueGuiaNombre: tipoEmpaqueGuia?.nombre ?? undefined,
      transporteId: f.transporteId || '',
      transporteNombre: transporte?.transporte ?? undefined,
      tipoProcesoEmpacadoId: f.tipoProcesoEmpacadoId ?? null,
      tipoProcesoEmpacadoNombre: tipoProcesoEmpacado?.nombre ?? undefined,
      esReposicion: f.esReposicion ?? false,
      variedadGuiaId: f.esEnsayo && f.variedadGuiaId ? String(f.variedadGuiaId) : null,
      esEnsayo: f.esEnsayo ?? false,
      eliminado: false,
      bd:0,
      fechaCreacion: new Date().toISOString()
    };

    if (!this.exigirInternet()) return;
    try {
      this.loading.show('Guardando cajas...');
      await firstValueFrom(this.paletService.sincronizarDPalets([nuevoDPalet]));

      const nuevaCantidad = (palet.cantidadCajas || 0) + f.cantidadCajas;
      const nuevoPeso = (palet.pesoTotal || 0) + (f.cantidadCajas * pesoPorCaja);
      const nuevoPorcentaje = limiteCajasPorPalet > 0 ? Math.round((nuevaCantidad / limiteCajasPorPalet) * 100) : 0;
      const paletActualizado: Palet = {
        ...palet,
        cantidadCajas: nuevaCantidad,
        pesoTotal: nuevoPeso,
        limiteCajasPorPalet: limiteCajasPorPalet > 0 ? limiteCajasPorPalet : (palet.limiteCajasPorPalet ?? 0),
        porcentajeAvance: nuevoPorcentaje,
        formatoId: nuevoDPalet.formatoId ?? 0,
        modo: 'editado',
      };

      await firstValueFrom(this.paletService.sincronizar(paletActualizado));
      this.reemplazarPalet(paletActualizado);
      await this.verDetalle(paletActualizado);

      await this.loading.hideAfterMinimum();
      this.alertService.showAlert('Éxito', 'Cajas agregadas correctamente', 'success');
      this.cerrarModalAgregarCajas();
      if (limiteCajasPorPalet > 0 && nuevaCantidad >= limiteCajasPorPalet) {
        this.abrirModalCerrarPalet(paletActualizado);
      }
    } catch (err) {
      console.error('Error guardando cajas:', err);
      await this.loading.hideAfterMinimum();
      this.alertService.showAlertAcept('Error', 'Error al guardar las cajas', 'error');
    }
  }

  abrirModalCerrarPalet(palet: Palet): void {
    this.paletSeleccionado.set(palet);
    this.modalCerrarPaletAbierto.set(true);
    this.cerrarPaletTieneObs.set(false);
    this.cerrarPaletObservaciones.set('');
    this.cerrarPaletMedida.set('');
  }

  cerrarModalCerrarPalet(): void {
    this.modalCerrarPaletAbierto.set(false);
  }

  async confirmarCerrarPalet(): Promise<void> {
    const palet = this.paletSeleccionado();
    if (!palet) return;

    if (!this.exigirInternet()) return;
    const tieneObs = this.cerrarPaletTieneObs();
    const obs = this.cerrarPaletObservaciones();
    const medida = this.cerrarPaletMedida();
    this.loading.show('Cerrando palet...');

    const estadoCerrado = (palet.cantidadCajas || 0) >= (palet.limiteCajasPorPalet || 0) ? 'CERRADO_COMPLETO' : 'CERRADO_SALDO';

    const paletCerrado: Palet = {
      ...palet,
      estado: estadoCerrado,
      observaciones: tieneObs ? obs : palet.observaciones,
      medidaCorrectiva: medida || palet.medidaCorrectiva,
      modo: 'editado',
    };

    try {
      await firstValueFrom(this.paletService.sincronizar(paletCerrado));
      this.reemplazarPalet(paletCerrado);
      await this.loading.hideAfterMinimum();
      this.alertService.showAlert('Éxito', 'Palet cerrado correctamente', 'success');
      this.cerrarModalCerrarPalet();
    } catch (err) {
      console.error('Error cerrando palet:', err);
      await this.loading.hideAfterMinimum();
      const msg = (err as any)?.error?.message ?? 'Error al cerrar el palet';
      this.alertService.showAlertAcept('Error', String(msg), 'error');
    }
  }

  /** Detalle de lo que se va a eliminar (modal propio). Se resuelve con lo que elija la persona. */
  readonly eliminarInfo = signal<InfoEliminar | null>(null);
  private resolverEliminar?: (ok: boolean) => void;

  private pedirEliminar(info: InfoEliminar): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      this.resolverEliminar = resolve;
      this.eliminarInfo.set(info);
    });
  }

  responderEliminar(ok: boolean): void {
    this.eliminarInfo.set(null);
    this.resolverEliminar?.(ok);
    this.resolverEliminar = undefined;
  }

  async abrirModalEliminarPalet(palet: Palet): Promise<void> {
    if (!this.exigirInternet()) return;
    this.loading.show('Cargando detalle del palet...');
    let activos: DPalet[] | null = null;
    try {
      activos = await this.pedirDetallePalet(palet.idPalet ?? '');
    } catch (err) {
      console.error('Error obteniendo el detalle del palet', err);
      this.alertService.showAlert('Error', 'Error al obtener el detalle del palet', 'error');
    } finally {
      await this.loading.hideAfterMinimum();
    }
    if (!activos) return;

    const ok1 = await this.pedirEliminar({
      titulo: `¿Desea eliminar el palet #${palet.numeroPalet == 0 ? palet.id : palet.numeroPalet}?`,
      resumen: [
        { etiqueta: 'Palet', valor: `#${palet.numeroPalet == 0 ? palet.id : palet.numeroPalet}` },
        { etiqueta: 'Estado', valor: this.getEstadoLabel(palet.estado) },
        { etiqueta: 'Cajas', valor: String(palet.cantidadCajas || 0) },
        { etiqueta: 'Peso total', valor: `${this.formatPeso(palet.pesoTotal || 0)} kg` },
      ],
      listaTitulo: 'Composiciones',
      lista: activos.map((d: any) => ({
        titulo: `${d.consignatarioNombre || '-'} — ${d.destinoNombre || '-'}`,
        detalle: `Cajas: ${d.cantidadCajas || 0} · Peso: ${this.formatPeso(d.pesoTotal || 0)} kg · Variedad: ${d.variedadNombre || '-'}`,
      })),
      listaVacia: 'Sin composiciones',
    });
    if (!ok1) return;

    const ok2 = await this.alertService.showConfirm(
      'Acción irreversible',
      '¿Está seguro? Esta acción no se podrá recuperar.',
      'warning'
    );
    if (!ok2) return;

    this.eliminarPalet(palet);
  }

  async eliminarPalet(palet: Palet): Promise<void> {
    if (!this.exigirInternet()) return;
    this.loading.show('Eliminando palet...');

    const paletEliminado: Palet = {
      ...palet,
      eliminado: true,
      estado: 'ELIMINADO',
      modo: 'editado',
    };

    try {
      await firstValueFrom(this.paletService.sincronizar(paletEliminado));
      this.paletSeleccionado.set(null);
      this.composiciones.set([]);
      this.alertService.showAlert('Éxito', 'Palet eliminado correctamente', 'success');
      const proceso = this.procesoSeleccionado();
      if (proceso) await this.listarPaletsForProceso(proceso.idProceso, { showLoading: false });
      else await this.loading.hideAfterMinimum();
    } catch (err) {
      console.error('Error eliminando palet:', err);
      await this.loading.hideAfterMinimum();
      const msg = (err as any)?.error?.message ?? 'Error al eliminar el palet';
      this.alertService.showAlertAcept('Error', String(msg), 'error');
    }
  }

  async reabrirPalet(palet: Palet): Promise<void> {
    const ok = await this.alertService.showConfirm('Confirmación', `¿Está seguro que desea reabrir el palet #${palet.numeroPalet}?`, 'warning');
    if (!ok) return;
    if (!this.exigirInternet()) return;

    this.loading.show('Reabriendo palet...');

    const paletReabierto: Palet = {
      ...palet,
      estado: 'ABIERTO',
      fechaCierre: '',
      modo: 'editado',
    };

    try {
      const resp = await firstValueFrom(this.paletService.sincronizar(paletReabierto));
      const first = resp?.[0] as any;
      const resultData = first?.data?.[0];

      if (resultData && !resultData.success) {
        // Se vuelve a pedir la lista para que la pantalla refleje el estado real del servidor
        await this.listarPaletsForProceso(palet.idProceso);
        this.alertService.showAlertAcept('Error', resultData.mensaje || 'No se pudo reabrir el palet', 'error');
        return;
      }

      await this.listarPaletsForProceso(palet.idProceso);
      this.alertService.showAlert('Éxito', 'Palet reabierto correctamente', 'success');

      const actualizado = this.palets().find(p => String(p.idPalet).trim() === String(palet.idPalet).trim());
      if (actualizado) await this.verDetalle(actualizado);
    } catch (err) {
      console.error('Error reabriendo palet:', err);
      await this.loading.hideAfterMinimum();
      const msg = (err as any)?.error?.message ?? 'Error al reabrir el palet';
      this.alertService.showAlertAcept('Error', String(msg), 'error');
    }
  }

  async eliminarComposicion(dpalet: DPalet): Promise<void> {
    const palet = this.paletSeleccionado();
    if (!palet) return;

    // Confirmación 1: detalle de lo que se eliminará
    const ok1 = await this.pedirEliminar({
      titulo: '¿Desea eliminar esta composición?',
      resumen: [
        { etiqueta: 'Consignatario', valor: dpalet.consignatarioNombre || '-' },
        { etiqueta: 'Destino', valor: dpalet.destinoNombre || '-' },
        { etiqueta: 'Formato', valor: dpalet.formatoNombre || '-' },
        { etiqueta: 'Variedad', valor: dpalet.variedadNombre || '-' },
        { etiqueta: 'Cajas', valor: String(dpalet.cantidadCajas ?? 0) },
        { etiqueta: 'Peso total', valor: `${this.formatPeso(dpalet.pesoTotal)} kg` },
      ],
    });
    if (!ok1) return;

    // Confirmación 2: irreversible
    const ok2 = await this.alertService.showConfirm(
      'Acción irreversible',
      '¿Está seguro? Esta acción no se podrá recuperar.',
      'warning'
    );
    if (!ok2) return;

    if (!this.exigirInternet()) return;
    try {
      this.loading.show('Eliminando composición...');

      const dpaletEliminado: DPalet = {
        ...dpalet,
        eliminado: true,
        idProceso: palet.idProceso,
      };
      await firstValueFrom(this.paletService.sincronizarDPalets([dpaletEliminado]));

      // Totales del palet con las composiciones que quedan
      const clave = (d: any) => String(d?.idDPalet ?? d?.id ?? '');
      const activos = this.composiciones().filter((d: any) => clave(d) !== clave(dpalet) && !d?.eliminado);
      const totalCajas = activos.reduce((sum: number, d: any) => sum + (d?.cantidadCajas || 0), 0);
      const totalPeso = activos.reduce((sum: number, d: any) => sum + (d?.pesoTotal || 0), 0);
      const limite = palet?.limiteCajasPorPalet ?? 0;
      const porcentaje = limite > 0 ? Math.round((totalCajas / limite) * 100) : 0;
      const formatoId = activos.length > 0 ? (palet.formatoId ?? 0) : 0;

      const paletActualizado: Palet = {
        ...palet,
        cantidadCajas: totalCajas,
        pesoTotal: totalPeso,
        porcentajeAvance: porcentaje,
        formatoId,
        modo: 'editado',
      };
      await firstValueFrom(this.paletService.sincronizar(paletActualizado));

      this.reemplazarPalet(paletActualizado);
      this.composiciones.set(activos);

      await this.loading.hideAfterMinimum();
      this.alertService.showAlert('Éxito', 'Composición eliminada correctamente', 'success');
    } catch (err) {
      console.error('Error eliminando composición:', err);
      await this.loading.hideAfterMinimum();
      this.alertService.showAlertAcept('Error', 'Error al eliminar la composición', 'error');
    }
  }

  updateFormCajas(field: string, value: unknown): void {
    this.formCajas.update(f => ({ ...f, [field]: value }));
  }

  async onConsignatarioChange(value: string): Promise<void> {
    const consignatarioDocumento = value;
    this.updateFormCajas('consignatarioId', consignatarioDocumento);

    this.filteredDestinos.set([]);
    this.filteredFormatos.set([]);
    this.filteredTiposEmpaqueGuia.set([]);
    this.filteredPresentaciones.set([]);
    this.filteredTiposCaja.set([]);
    this.filteredTiposClamshell.set([]);
    this.updateFormCajas('destinoId', 0);
    this.updateFormCajas('formatoId', 0);
    this.updateFormCajas('tipoEmpaqueGuiaId', 0);
    this.updateFormCajas('presentacionId', 0);
    this.updateFormCajas('tipoCajaId', 0);
    this.updateFormCajas('tipoClamshellId', 0);
    this.updateFormCajas('calibreId', 0);
    this.updateFormCajas('categoriaId', 0);
    this.updateFormCajas('tipoEmpaqueId', 0);
    this.updateFormCajas('codigoRanchoId', 0);
    this.codigoRanchoDisabled.set(true);

    if (!consignatarioDocumento) return;
    const consignatario = this.consignatarios().find(c => c.documento === consignatarioDocumento);
    const documentoConsignatario = String(consignatario?.documento ?? '').trim();

    if (!documentoConsignatario) {
      this.alertService.showAlert('Validación', 'No se pudo determinar el documento del consignatario.', 'warning');
      return;
    }

    const codigosRanchoRaw = consignatario?.codigosRancho;
    if (Array.isArray(codigosRanchoRaw) && codigosRanchoRaw.length > 0) {
      const ranchosActivos = codigosRanchoRaw.filter((r: any) => r?.activo === true);
      this.filteredCodigosRancho.set(ranchosActivos);
      if (ranchosActivos.length === 1) {
        this.updateFormCajas('codigoRanchoId', ranchosActivos[0].id);
      } else if (ranchosActivos.length > 1) {
        this.codigoRanchoDisabled.set(false);
      }
    }

    this.alertService.mostrarModalCarga();

    try {
      let destinosIds: string[] = [];

      if (this.online) {
        const idproyecto = String(this.savedConfig()?.idProyecto ?? '').trim();
        const resp: any = await firstValueFrom(this.paletService.getDestinosPorMatrizCompatibilidad(idproyecto, consignatarioDocumento.toString()));
        const items = Array.isArray(resp) ? resp : (resp?.data ?? []);

        if (items[0].data.length === 0) {
          this.alertService.cerrarModalCarga();
          this.alertService.showAlert('Información', 'No existe matriz de compatibilidad para este consignatario.', 'warning');
          return;
        }

        destinosIds = items[0].data.map((x: any) => String(x?.destinoId ?? x?.destinoId ?? '')).filter((id: string) => id);

        const paisesResp: any = await firstValueFrom(this.catalogoService.listarPaises());
        if (paisesResp.length > 0) {
          const dexiedb = await this.catalogosRepo.destinosRepo.getAll();
          if (dexiedb.length > 0) {
            await this.catalogosRepo.destinosRepo.clear();
          }
          for (const p of (paisesResp ?? [])) {
            await this.catalogosRepo.destinosRepo.save(p);
          }
        }
      } else {
        const matrices = await this.administracionRepo.matricesCompatibilidadRepository.getAll();
        const matricesFiltradas = (matrices ?? []).filter((m: any) =>
          String(m?.documentoConsignatario ?? '').trim() === consignatarioDocumento.toString()
        );
        destinosIds = [...new Set(matricesFiltradas.map((m: any) => String(m?.destinoId ?? '')).filter((id: string) => id))];

        if (destinosIds.length === 0) {
          this.alertService.cerrarModalCarga();
          this.alertService.showAlert('Información', 'No existe matriz de compatibilidad para este consignatario.', 'warning');
          return;
        }
      }
      const todosDestinos = await this.catalogosRepo.destinosRepo.getAll();
      const destinosFiltrados = (todosDestinos ?? []).filter((d: any) => destinosIds.includes(String(d?.id ?? '')));
      this.filteredDestinos.set(destinosFiltrados);
      this.alertService.cerrarModalCarga();

    } catch (err) {
      console.error('Error cargando destinos por matriz compatibilidad:', err);
      this.filteredDestinos.set([]);
      this.alertService.cerrarModalCarga();
      this.alertService.showAlert('Información', 'No existe matriz de compatibilidad para este consignatario.', 'warning');
    }

  }

  async onDestinoChange(value: string): Promise<void> {
    const destinoId = value || '';
    this.updateFormCajas('destinoId', destinoId);
    this.filteredFormatos.set([]);
    this.filteredTiposEmpaqueGuia.set([]);
    this.filteredPresentaciones.set([]);
    this.filteredTiposCaja.set([]);
    this.filteredTiposClamshell.set([]);
    this.updateFormCajas('formatoId', 0);
    this.updateFormCajas('tipoEmpaqueGuiaId', 0);
    this.updateFormCajas('presentacionId', 0);
    this.updateFormCajas('tipoCajaId', 0);
    this.updateFormCajas('tipoClamshellId', 0);
    this.updateFormCajas('calibreId', 0);
    this.updateFormCajas('tipoEmpaqueId', 0);

    if (!destinoId) return;

    const consignatarioDocumento = this.formCajas().consignatarioId;
    const consignatario = this.consignatarios().find(c => c.documento === consignatarioDocumento);
    const documentoConsignatario = String(consignatario?.documento ?? '').trim();

    if (!documentoConsignatario) {
      this.alertService.showAlert('Validación', 'No se pudo determinar el documento del consignatario.', 'warning');
      return;
    }

    this.alertService.mostrarModalCarga();

    try {
      let formatosIds: string[] = [];
      if (this.online) {
        const codigoCultivo = String(this.savedConfig()?.codigoCultivo ?? '').trim();
        const resp: any = await firstValueFrom(this.paletService.getFormatosPorMatriz(codigoCultivo, consignatarioDocumento.toString(), String(destinoId)));
        const items = Array.isArray(resp) ? resp : (resp?.data ?? []);

        if (items[0].data.length === 0) {
          this.alertService.cerrarModalCarga();
          this.alertService.showAlert('Información', 'No existe matriz de compatibilidad para este destino.', 'warning');
          return;
        }

        formatosIds = items[0].data.map((x: any) => String(x?.id ?? x?.Id ?? '')).filter((id: string) => id);

        const formatosResp: any = await firstValueFrom(this.catalogoService.listarFormatos(codigoCultivo));
        if (!formatosResp.error) {
          const dexiedb = await this.catalogosRepo.formatosRepo.getAll();
          if (dexiedb.length > 0) {
            await this.catalogosRepo.formatosRepo.clear();
          }
          for (const f of (formatosResp.data ?? [])) {
            f.bd = 1;
            await this.catalogosRepo.formatosRepo.save(f);
          }
        }
      } else {
        const matrices = await this.administracionRepo.matricesCompatibilidadRepository.getAll();
        const matricesFiltradas = (matrices ?? []).filter((m: any) =>
          String(m?.documentoConsignatario ?? '').trim() === consignatarioDocumento.toString() &&
          String(m?.destinoId ?? '').trim() === String(destinoId)
        );
        formatosIds = [...new Set(matricesFiltradas.map((m: any) => String(m?.formatoId ?? '')).filter((id: string) => id))];

        if (formatosIds.length === 0) {
          this.alertService.cerrarModalCarga();
          this.alertService.showAlert('Información', 'No existe matriz de compatibilidad para este destino.', 'warning');
          return;
        }
      }

      const todosFormatos = await this.catalogosRepo.formatosRepo.getAll();
      const formatosFiltrados = (todosFormatos ?? []).filter((f: any) => formatosIds.includes(String(f?.id ?? '')));
      this.filteredFormatos.set(formatosFiltrados);
      this.alertService.cerrarModalCarga();

    } catch (err) {
      console.error('Error cargando formatos por matriz compatibilidad:', err);
      this.filteredFormatos.set([]);
      this.alertService.cerrarModalCarga();
      this.alertService.showAlert('Información', 'No existe matriz de compatibilidad para este destino.', 'warning');
    }
  }

  async onFormatoChange(value: string): Promise<void> {
    const formatoId = parseInt(value) || 0;
    this.updateFormCajas('formatoId', formatoId);
    this.filteredTiposEmpaqueGuia.set([]);
    this.filteredPresentaciones.set([]);
    this.filteredTiposCaja.set([]);
    this.filteredTiposClamshell.set([]);
    this.updateFormCajas('tipoEmpaqueGuiaId', 0);
    this.updateFormCajas('presentacionId', 0);
    this.updateFormCajas('tipoCajaId', 0);
    this.updateFormCajas('tipoClamshellId', 0);
    this.updateFormCajas('calibreId', 0);
    this.updateFormCajas('tipoEmpaqueId', 0);

    if (!formatoId) return;

    const f = this.formCajas();
    const consignatario = this.consignatarios().find(c => c.documento === f.consignatarioId);
    const documentoConsignatario = String(consignatario?.documento ?? '').trim();

    if (!documentoConsignatario) {
      this.alertService.showAlert('Validación', 'No se pudo determinar el documento del consignatario.', 'warning');
      return;
    }

    this.alertService.mostrarModalCarga();

    try {
      let tiposEmpaqueGuiaIds: string[] = [];

      if (this.online) {
        const codigoCultivo = String(this.savedConfig()?.codigoCultivo ?? '').trim();
        const resp: any = await firstValueFrom(this.paletService.getTiposEmpaqueGuiaPorMatriz(codigoCultivo, f.consignatarioId.toString(), String(f.destinoId), formatoId));
        const items = Array.isArray(resp) ? resp : (resp?.data ?? []);

        if (items[0].data.length === 0) {
          this.alertService.cerrarModalCarga();
          this.alertService.showAlert('Información', 'No existe matriz de compatibilidad para este formato.', 'warning');
          return;
        }

        tiposEmpaqueGuiaIds = items[0].data.map((x: any) => String(x?.id ?? x?.Id ?? '')).filter((id: string) => id);

        const tegResp: any = await firstValueFrom(this.catalogoService.listarTiposEmpaqueGuia(codigoCultivo));
        if (!tegResp.error) {
          const dexiedb = await this.catalogosRepo.tiposEmpaqueGuiaRepo.getAll();
          if (dexiedb.length > 0) {
            await this.catalogosRepo.tiposEmpaqueGuiaRepo.clear();
          }
          for (const t of (tegResp.data ?? [])) {
            t.bd = 1;
            await this.catalogosRepo.tiposEmpaqueGuiaRepo.save(t);
          }
        }
      } else {
        const matrices = await this.administracionRepo.matricesCompatibilidadRepository.getAll();
        const matricesFiltradas = (matrices ?? []).filter((m: any) =>
          String(m?.documentoConsignatario ?? '').trim() === f.consignatarioId.toString() &&
          String(m?.destinoId ?? '').trim() === String(f.destinoId) &&
          String(m?.formatoId ?? '') === String(formatoId)
        );
        tiposEmpaqueGuiaIds = [...new Set(matricesFiltradas.map((m: any) => String(m?.tipoEmpaqueGuiaId ?? '')).filter((id: string) => id))];

        if (tiposEmpaqueGuiaIds.length === 0) {
          this.alertService.cerrarModalCarga();
          this.alertService.showAlert('Información', 'No existe matriz de compatibilidad para este formato.', 'warning');
          return;
        }
      }

      const todosTeg = await this.catalogosRepo.tiposEmpaqueGuiaRepo.getAll();
      const tegFiltrados = (todosTeg ?? []).filter((t: any) => tiposEmpaqueGuiaIds.includes(String(t?.id ?? '')));
      this.filteredTiposEmpaqueGuia.set(tegFiltrados);
      this.alertService.cerrarModalCarga();

    } catch (err) {
      console.error('Error cargando tipos empaque guía por matriz compatibilidad:', err);
      this.filteredTiposEmpaqueGuia.set([]);
      this.alertService.cerrarModalCarga();
      this.alertService.showAlert('Información', 'No existe matriz de compatibilidad para este formato.', 'warning');
    }
  }


  async onTipoEmpaqueGuiaChange(value: string): Promise<void> {
    const tipoEmpaqueGuiaId = parseInt(value) || 0;
    this.updateFormCajas('tipoEmpaqueGuiaId', tipoEmpaqueGuiaId);
    this.filteredPresentaciones.set([]);
    this.filteredTiposCaja.set([]);
    this.filteredTiposClamshell.set([]);
    this.updateFormCajas('presentacionId', 0);
    this.updateFormCajas('tipoCajaId', 0);
    this.updateFormCajas('tipoClamshellId', 0);
    this.updateFormCajas('calibreId', 0);
    this.updateFormCajas('tipoEmpaqueId', 0);

    if (!tipoEmpaqueGuiaId) return;

    const f = this.formCajas();
    const consignatario = this.consignatarios().find(c => c.documento === f.consignatarioId);
    const documentoConsignatario = String(consignatario?.documento ?? '').trim();

    if (!documentoConsignatario) {
      this.alertService.showAlert('Validación', 'No se pudo determinar el documento del consignatario.', 'warning');
      return;
    }

    this.alertService.mostrarModalCarga();

    try {
      let presentacionesIds: string[] = [];
      let tiposCajaIds: string[] = [];

      if (this.online) {
        const codigoCultivo = String(this.savedConfig()?.codigoCultivo ?? '').trim();
        const resp: any = await firstValueFrom(this.paletService.getPresentacionesPorMatriz(codigoCultivo, f.consignatarioId.toString(), String(f.destinoId), f.formatoId, tipoEmpaqueGuiaId));
        const items = Array.isArray(resp) ? resp : (resp?.data ?? []);

        if (items[0]?.data?.length > 0) {
          presentacionesIds = items[0].data.map((x: any) => String(x?.id ?? x?.Id ?? '')).filter((id: string) => id);
        }

        const presResp: any = await firstValueFrom(this.catalogoService.listarPresentaciones(codigoCultivo));
        if (!presResp.error) {
          const dexiedb = await this.catalogosRepo.presentacionesRepo.getAll();
          if (dexiedb.length > 0) {
            await this.catalogosRepo.presentacionesRepo.clear();
          }
          for (const p of (presResp.data ?? [])) {
            p.bd = 1;
            await this.catalogosRepo.presentacionesRepo.save(p);
          }
        }

        const tcResp: any = await firstValueFrom(this.paletService.getTiposCajaPorMatriz(codigoCultivo, f.consignatarioId.toString(), String(f.destinoId), f.formatoId, tipoEmpaqueGuiaId));
        const tcItems = Array.isArray(tcResp) ? tcResp : (tcResp?.data ?? []);

        if (tcItems[0].data.length === 0) {
          this.alertService.cerrarModalCarga();
          this.alertService.showAlert('Información', 'No existe matriz de compatibilidad para este tipo de empaque guía.', 'warning');
          return;
        }

        tiposCajaIds = tcItems[0].data.map((x: any) => String(x?.id ?? x?.Id ?? '')).filter((id: string) => id);

        const tcDexieResp: any = await firstValueFrom(this.catalogoService.listarTiposCaja(codigoCultivo));
        if (!tcDexieResp.error) {
          const dexiedb = await this.catalogosRepo.tiposCajaRepo.getAll();
          if (dexiedb.length > 0) {
            await this.catalogosRepo.tiposCajaRepo.clear();
          }
          for (const t of (tcDexieResp.data ?? [])) {
            t.bd = 1;
            await this.catalogosRepo.tiposCajaRepo.save(t);
          }
        }
      } else {
        const matrices = await this.administracionRepo.matricesCompatibilidadRepository.getAll();
        const matricesFiltradas = (matrices ?? []).filter((m: any) =>
          String(m?.documentoConsignatario ?? '').trim() === f.consignatarioId.toString() &&
          String(m?.destinoId ?? '').trim() === String(f.destinoId) &&
          String(m?.formatoId ?? '') === String(f.formatoId) &&
          String(m?.tipoEmpaqueGuiaId ?? '') === String(tipoEmpaqueGuiaId)
        );
        presentacionesIds = [...new Set(matricesFiltradas.map((m: any) => String(m?.presentacionId ?? '')).filter((id: string) => id))];

        tiposCajaIds = [...new Set(matricesFiltradas.map((m: any) => String(m?.tipoCajaId ?? '')).filter((id: string) => id))];

        if (tiposCajaIds.length === 0) {
          this.alertService.cerrarModalCarga();
          this.alertService.showAlert('Información', 'No existe matriz de compatibilidad para este tipo de empaque guía.', 'warning');
          return;
        }
      }

      const todosPres = await this.catalogosRepo.presentacionesRepo.getAll();
      const presFiltrados = (todosPres ?? []).filter((p: any) => presentacionesIds.includes(String(p?.id ?? '')));
      this.filteredPresentaciones.set(presFiltrados);

      let presentacionAutoSeleccionada: number | null = null;
      if (presFiltrados.length === 1) {
        presentacionAutoSeleccionada = presFiltrados[0].id ?? 0;
        this.updateFormCajas('presentacionId', presentacionAutoSeleccionada);
      } else if (presFiltrados.length === 0) {
        this.updateFormCajas('presentacionId', 0);
      }

      if (presentacionAutoSeleccionada != null && presentacionAutoSeleccionada > 0) {
        if (this.online) {
          await this.cargarTiposCajaPorMatriz(presentacionAutoSeleccionada);
        } else {
          await this.filtrarTiposCajaDesdeDexie(presentacionAutoSeleccionada);
        }
      } else {
        const todosTc = await this.catalogosRepo.tiposCajaRepo.getAll();
        const tcFiltrados = (todosTc ?? []).filter((t: any) => tiposCajaIds.includes(String(t?.id ?? '')));
        this.filteredTiposCaja.set(tcFiltrados);
      }

      await this.cargarMatrizResults();
      this.alertService.cerrarModalCarga();

    } catch (err) {
      console.error('Error cargando presentaciones/tiposCaja por matriz compatibilidad:', err);
      this.filteredPresentaciones.set([]);
      this.filteredTiposCaja.set([]);
      this.alertService.cerrarModalCarga();
      this.alertService.showAlert('Información', 'No existe matriz de compatibilidad para este tipo de empaque guía.', 'warning');
    }
  }

  async onPresentacionChange(value: string): Promise<void> {
    const presentacionId = (!value || value === 'NA' || value === '0') ? null : parseInt(value);
    this.updateFormCajas('presentacionId', presentacionId ?? 0);
    this.filteredTiposClamshell.set([]);
    this.updateFormCajas('tipoCajaId', 0);
    this.updateFormCajas('tipoClamshellId', 0);
    this.updateFormCajas('calibreId', 0);
    this.updateFormCajas('tipoEmpaqueId', 0);

    this.alertService.mostrarModalCarga();
    try {
      if (this.online) {
        await this.cargarTiposCajaPorMatriz(presentacionId);
      } else {
        await this.filtrarTiposCajaDesdeDexie(presentacionId);
      }
    } finally {
      this.alertService.cerrarModalCarga();
    }
  }

  private async cargarTiposCajaPorMatriz(presentacionId: number | null): Promise<void> {
    const f = this.formCajas();
    const codigoCultivo = String(this.savedConfig()?.codigoCultivo ?? '').trim();

    try {
      const resp: any = await firstValueFrom(
        this.paletService.getTiposCajaPorMatriz(
          codigoCultivo,
          f.consignatarioId.toString(),
          String(f.destinoId),
          f.formatoId,
          f.tipoEmpaqueGuiaId,
          presentacionId ?? undefined
        )
      );
      const items = Array.isArray(resp) ? resp : (resp?.data ?? []);
      const tiposCajaIds = (items[0]?.data ?? []).map((x: any) => String(x?.id ?? x?.Id ?? '')).filter((id: string) => id);

      const todosTc = await this.catalogosRepo.tiposCajaRepo.getAll();
      const tcFiltrados = (todosTc ?? []).filter((t: any) => tiposCajaIds.includes(String(t?.id ?? '')));
      this.filteredTiposCaja.set(tcFiltrados);
    } catch (err) {
      console.error('Error cargando tipos de caja por matriz:', err);
      this.filteredTiposCaja.set([]);
    }
  }

  private async filtrarTiposCajaDesdeDexie(presentacionId: number | null): Promise<void> {
    const f = this.formCajas();
    const matrices = await this.administracionRepo.matricesCompatibilidadRepository.getAll();
    const matricesFiltradas = (matrices ?? []).filter((m: any) =>
      String(m?.documentoConsignatario ?? '').trim() === f.consignatarioId.toString() &&
      String(m?.destinoId ?? '').trim() === String(f.destinoId) &&
      String(m?.formatoId ?? '') === String(f.formatoId) &&
      String(m?.tipoEmpaqueGuiaId ?? '') === String(f.tipoEmpaqueGuiaId) &&
      (presentacionId == null || String(m?.presentacionId ?? '') === String(presentacionId))
    );
    const tiposCajaIds = [...new Set(matricesFiltradas.map((m: any) => String(m?.tipoCajaId ?? '')).filter((id: string) => id))];

    const todosTc = await this.catalogosRepo.tiposCajaRepo.getAll();
    const tcFiltrados = (todosTc ?? []).filter((t: any) => tiposCajaIds.includes(String(t?.id ?? '')));
    this.filteredTiposCaja.set(tcFiltrados);
  }

  private _matrizResults: any[] = [];

  private async cargarMatrizResults(): Promise<void> {
    const f = this.formCajas();
    const matrices = await this.administracionRepo.matricesCompatibilidadRepository.getAll();
    const matricesFiltradas = (matrices ?? []).filter((m: any) =>
      String(m?.documentoConsignatario ?? '').trim() === f.consignatarioId.toString() &&
      String(m?.destinoId ?? '').trim() === String(f.destinoId) &&
      String(m?.formatoId ?? '') === String(f.formatoId) &&
      String(m?.tipoEmpaqueGuiaId ?? '') === String(f.tipoEmpaqueGuiaId)
    );
    this._matrizResults = matricesFiltradas.map((m: any) => ({
      TipoCajaId: m.tipoCajaId,
      TipoClamshellId: m.tipoClamshellId,
      CalibreId: m.calibreId,
      TipoEmpaqueId: m.tiposEmpaqueId ?? m.tipoEmpaqueId
    }));
  }

  async onTipoCajaChange(value: string): Promise<void> {
    const tipoCajaId = parseInt(value) || 0;
    this.updateFormCajas('tipoCajaId', tipoCajaId);
    this.filteredTiposClamshell.set([]);
    this.updateFormCajas('tipoClamshellId', 0);
    this.updateFormCajas('calibreId', 0);
    this.updateFormCajas('tipoEmpaqueId', 0);

    if (!tipoCajaId) return;

    const f = this.formCajas();
    const consignatario = this.consignatarios().find(c => c.documento === f.consignatarioId);
    const documentoConsignatario = String(consignatario?.documento ?? '').trim();

    if (!documentoConsignatario) {
      this.alertService.showAlert('Validación', 'No se pudo determinar el documento del consignatario.', 'warning');
      return;
    }

    this.alertService.mostrarModalCarga();

    try {
      let tiposClamshellIds: string[] = [];

      const presentacionId = f.presentacionId > 0 ? f.presentacionId : undefined;

      if (this.online) {
        const codigoCultivo = String(this.savedConfig()?.codigoCultivo ?? '').trim();
        const resp: any = await firstValueFrom(this.paletService.getTiposClamshellPorMatriz(codigoCultivo, f.consignatarioId.toString(), String(f.destinoId), f.formatoId, f.tipoEmpaqueGuiaId || 0, f.tipoCajaId, presentacionId));
        const items = Array.isArray(resp) ? resp : (resp?.data ?? []);

        if (items[0].data.length === 0) {
          this.alertService.cerrarModalCarga();
          this.alertService.showAlert('Información', 'No existe matriz de compatibilidad para este tipo de caja.', 'warning');
          return;
        }

        tiposClamshellIds = items[0].data.map((x: any) => String(x?.id ?? x?.Id ?? '')).filter((id: string) => id);

        const tcResp: any = await firstValueFrom(this.catalogoService.listarTiposClamshell(codigoCultivo));
        if (!tcResp.error) {
          const dexiedb = await this.catalogosRepo.tiposClamshellRepo.getAll();
          if (dexiedb.length > 0) {
            await this.catalogosRepo.tiposClamshellRepo.clear();
          }
          for (const t of (tcResp.data ?? [])) {
            t.bd = 1;
            await this.catalogosRepo.tiposClamshellRepo.save(t);
          }
        }
      } else {
        const matrices = await this.administracionRepo.matricesCompatibilidadRepository.getAll();
        const matricesFiltradas = (matrices ?? []).filter((m: any) =>
          String(m?.documentoConsignatario ?? '').trim() === f.consignatarioId.toString() &&
          String(m?.destinoId ?? '').trim() === String(f.destinoId) &&
          String(m?.formatoId ?? '') === String(f.formatoId) &&
          String(m?.tipoEmpaqueGuiaId ?? '') === String(f.tipoEmpaqueGuiaId) &&
          String(m?.tipoCajaId ?? '') === String(f.tipoCajaId) &&
          (presentacionId == null || String(m?.presentacionId ?? '') === String(presentacionId))
        );
        tiposClamshellIds = [...new Set(matricesFiltradas.map((m: any) => String(m?.tipoClamshellId ?? '')).filter((id: string) => id))];

        if (tiposClamshellIds.length === 0) {
          this.alertService.cerrarModalCarga();
          this.alertService.showAlert('Información', 'No existe matriz de compatibilidad para este tipo de caja.', 'warning');
          return;
        }
      }

      const todosTc = await this.catalogosRepo.tiposClamshellRepo.getAll();
      const tcFiltrados = (todosTc ?? []).filter((t: any) => tiposClamshellIds.includes(String(t?.id ?? '')));
      this.filteredTiposClamshell.set(tcFiltrados);
      this.alertService.cerrarModalCarga();

    } catch (err) {
      console.error('Error cargando tipos clamshell por matriz compatibilidad:', err);
      this.filteredTiposClamshell.set([]);
      this.alertService.cerrarModalCarga();
      this.alertService.showAlert('Información', 'No existe matriz de compatibilidad para este tipo de caja.', 'warning');
    }
  }

  onTipoClamshellChange(value: string): void {
    const tipoClamshellId = parseInt(value) || 0;
    this.updateFormCajas('tipoClamshellId', tipoClamshellId);

    if (!tipoClamshellId) {
      this.updateFormCajas('calibreId', 0);
      this.updateFormCajas('categoriaId', 0);
      this.updateFormCajas('tipoEmpaqueId', 0);
      return;
    }
    const tipoCajaId = this.formCajas().tipoCajaId;
    const match = this._matrizResults.find((i: any) => i.TipoCajaId === tipoCajaId && i.TipoClamshellId === tipoClamshellId);
    if (match) {
      this.updateFormCajas('calibreId', match.CalibreId || 0);
      this.updateFormCajas('tipoEmpaqueId', match.TipoEmpaqueId || 0);
    }
  }

  onVariedadChange(value: string): void {
    this.updateFormCajas('variedadId', value || 0);
  }

  onEsEnsayoChange(checked: boolean): void {
    this.updateFormCajas('esEnsayo', checked);
    if (checked) {
      this.updateFormCajas('esReposicion', false);
    }
    this.updateFormCajas('variedadId', '');
    this.updateFormCajas('variedadGuiaId', '');
    this._filtrarVariedadesPorEnsayo();
  }

  onEsReposicionChange(checked: boolean): void {
    this.updateFormCajas('esReposicion', checked);
    if (checked) {
      this.updateFormCajas('esEnsayo', false);
      this.updateFormCajas('variedadId', '');
      this.updateFormCajas('variedadGuiaId', '');
      this._filtrarVariedadesPorEnsayo();
    }
  }

  async onLugarProduccionChange(value: string): Promise<void> {
    const lugarProduccionId = parseInt(value) || 0;
    this.updateFormCajas('lugarProduccionId', lugarProduccionId);
  }

  async loadCodigosRancho(): Promise<void> {
    this.filteredCodigosRancho.set([]);
    // this.updateFormCajas('codigoRanchoId', 0);

    try {
      let codigosRancho: any[] = [];

      if (this.online) {
        const idproyecto = String(this.savedConfig()?.idProyecto ?? '').trim();
        const resp: any = await firstValueFrom(this.catalogoService.listarCodigosRanchoCatalogo(idproyecto));
        let data: any[] = [];
        if (Array.isArray(resp)) {
          data = resp;
        } else if (resp?.data !== undefined) {
          data = resp.data ?? [];
        } else {
          data = resp ?? [];
        }
        codigosRancho = data
          .map((c: any) => ({
            id: c?.id ?? c?.Id ?? 0,
            codigo: c?.codigo ?? c?.Codigo ?? '',
            activo: c?.activo ?? c?.Activo ?? true,
            fechaCreacion: c?.fechaCreacion ?? c?.FechaCreacion ?? '',
          }))
          .filter((c: any) => c.activo === true);
      } else {
        const todosCodigos = await this.catalogosRepo.codigosRanchoRepo.getAll();
        codigosRancho = (todosCodigos ?? []).filter((c: any) => c.activo === true);
      }

      this.filteredCodigosRancho.set(codigosRancho);
    } catch (err) {
      console.error('Error cargando códigos rancho:', err);
      this.filteredCodigosRancho.set([]);
      this.updateFormCajas('codigoRanchoId', 0);
    }
  }

  // Computed properties for form validation
  readonly formatoDisabled = computed(() => !this.formCajas().destinoId);
  readonly tipoEmpaqueGuiaDisabled = computed(() => !this.formCajas().formatoId);
  readonly presentacionDisabled = computed(() => !this.formCajas().tipoEmpaqueGuiaId);
  readonly tipoCajaDisabled = computed(() => this.filteredTiposCaja().length === 0);
  readonly tipoClamshellDisabled = computed(() => this.filteredTiposClamshell().length === 0);

  // UI helpers
  toggleSeccionActivos(): void {
    this.seccionActivosAbierta.update(abierta => !abierta);
  }

  toggleSeccionDespachados(): void {
    this.seccionDespachadosAbierta.update(abierta => !abierta);
  }

  toggleSeccionComposicion(): void {
    this.seccionComposicionAbierta.update(abierta => !abierta);
  }

  toggleSeccionObservaciones(): void {
    this.seccionObservacionesAbierta.update(abierta => !abierta);
  }

  formatearFechaLarga(fecha: string): string {
    if (!fecha) return '';
    try {
      const date = new Date(fecha);
      return date.toLocaleDateString('es-ES', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return fecha;
    }
  }

  esSeleccionado(p: Palet): boolean {
    const sel = this.paletSeleccionado();
    return !!sel && this.paletKey(sel) === this.paletKey(p);
  }

  /** Color de la tarjeta del palet segun su estado; el palet abierto en el detalle resalta con anillo y fondo verde. */
  paletEstilo(estado: string, seleccionado: boolean): string {
    if (seleccionado) return 'border-emerald-300 border-l-emerald-500 from-emerald-50 to-white ring-1 ring-emerald-300 shadow-md dark:border-emerald-500/50 dark:from-emerald-500/20 dark:to-transparent dark:ring-emerald-500/40';
    switch (estado) {
      case 'ABIERTO':
        return 'border-l-sky-500 from-sky-50 to-white dark:from-sky-500/15 dark:to-transparent';
      case 'CERRADO_COMPLETO':
        return 'border-l-emerald-500 from-emerald-50 to-white dark:from-emerald-500/15 dark:to-transparent';
      case 'CERRADO_SALDO':
        return 'border-l-amber-500 from-amber-50 to-white dark:from-amber-500/15 dark:to-transparent';
      default:
        return 'border-l-slate-500 from-slate-200/70 to-white dark:from-slate-500/20 dark:to-transparent';
    }
  }

  getEstadoBadgeClass(estado: string): string {
    switch (estado) {
      case 'ABIERTO':
        return 'badge-info';
      case 'CERRADO_COMPLETO':
        return 'badge-success';
      case 'CERRADO_SALDO':
        return 'badge-warning';
      case 'DESPACHADO':
        return 'badge-neutral';
      default:
        return 'badge-ghost';
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
