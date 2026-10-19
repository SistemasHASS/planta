import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  LucideCircleCheck,
  LucideCloudUpload,
  LucideEye,
  LucideFileSpreadsheet,
  LucideFileText,
  LucideFlaskConical,
  LucideLayers,
  LucidePencil,
  LucidePlus,
  LucideRefreshCw,
  LucideSearch,
  LucideTrash2,
  LucideTruck,
  LucideWifiOff,
  LucideX,
  LucideOctagonX,
} from '@lucide/angular';
import { SearchSelectComponent, SearchSelectOption } from '../../shared/components/search-select/search-select.component';
import { PaginatorComponent } from '../../shared/components/paginator/paginator.component';
import { CatalogosRepository } from '../../shared/dexiedb/repository/catalogos.repository';
import { GuiasRemisionRepository } from '../../shared/dexiedb/repository/guias-remision.repository';
import { ProcesoRepository } from '../../shared/dexiedb/repository/proceso.repository';
import { ROLES } from '../../shared/guards/role.guard';
import { Configuracion } from '../../shared/interfaces/administracion.interface';
import { Usuario } from '../../shared/interfaces/auth.interface';
import { Conductor, Transportista, Vehiculo } from '../../shared/interfaces/catalogo.interface';
import { GuiaRemision } from '../../shared/interfaces/guia.interface';
import { Proceso } from '../../shared/interfaces/proceso.interface';
import { ConfirmModalService } from '../../shared/services/confirm-modal.service';
import { AlertaService } from '../../shared/services/alerta.service';
import { AuthService } from '../../shared/services/auth.service';
import { CatalogosGuiaService } from '../../shared/services/catalogos-guia.service';
import { ConnectivityService } from '../../shared/services/connectivity.service';
import { FeedbackModalService } from '../../shared/services/feedback-modal.service';
import { GuiaRemisionService } from '../../shared/services/guia-remision.service';
import { LoadingService } from '../../shared/services/loading.service';
import { GuiasApiService } from '../../shared/services/guias-api.service';
import { abrirOCompartirArchivo, descargarArchivo, esDispositivoMovil } from '../../shared/utils/archivo';
import { formatDateTime, nowPeruDate, toLocalISOString } from '../../shared/utils/date-time.util';
import { estadoGuiaClass, estadoSunatClass, estadoSunatLabel, esAceptadaSunat } from '../../shared/utils/estado-sunat';
import { crearPaginacion } from '../../shared/utils/paginacion';
import { newUuid } from '../../shared/utils/uuid';
import { ModalPdfSunatComponent } from './components/modal-pdf-sunat/modal-pdf-sunat.component';
import { ModalInspeccionComponent } from './components/modal-inspeccion/modal-inspeccion.component';
import { ModalNuevaGuiaComponent } from './components/modal-nueva-guia/modal-nueva-guia.component';
import { ModalVerDetalleGuiaComponent } from './components/modal-ver-detalle-guia/modal-ver-detalle-guia.component';

const texto = (v: unknown): string => String(v ?? '').trim();

/**
 * Guias de remision: listar, crear (con inspeccion), editar, emitir ante SUNAT, consultar estado, anular, eliminar y exportar a Excel.
 * La logica es la de la aplicacion anterior; solo cambian la forma de llamar a la API (api/guias), las alertas y la pantalla.
 * La pantalla solo funciona con internet (igual que antes); la lectura/guardado en Dexie vive en GuiaRemisionService.
 */
@Component({
  selector: 'app-guias',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    PaginatorComponent,
    SearchSelectComponent,
    ModalPdfSunatComponent,
    ModalNuevaGuiaComponent,
    ModalInspeccionComponent,
    ModalVerDetalleGuiaComponent,
    LucideCircleCheck,
    LucideCloudUpload,
    LucideEye,
    LucideFileSpreadsheet,
    LucideFileText,
    LucideFlaskConical,
    LucideLayers,
    LucidePencil,
    LucidePlus,
    LucideRefreshCw,
    LucideSearch,
    LucideTrash2,
    LucideTruck,
    LucideWifiOff,
    LucideX,
    LucideOctagonX,
  ],
  templateUrl: './guias.component.html',
  styleUrl: './guias.component.scss',
})
export class GuiasComponent implements OnInit {
  private readonly api = inject(GuiasApiService);
  private readonly guiaRemision = inject(GuiaRemisionService);
  private readonly catalogosGuia = inject(CatalogosGuiaService);
  private readonly alertService = inject(AlertaService);
  private readonly confirmModal = inject(ConfirmModalService);
  private readonly feedback = inject(FeedbackModalService);
  private readonly connectivity = inject(ConnectivityService);
  private readonly auth = inject(AuthService);
  private readonly catalogosRepo = inject(CatalogosRepository);
  private readonly guiasRemisionRepo = inject(GuiasRemisionRepository);
  private readonly procesoRepo = inject(ProcesoRepository);
  private readonly loading = inject(LoadingService);

  readonly estadoSunatClass = estadoSunatClass;
  readonly estadoSunatLabel = estadoSunatLabel;
  readonly estadoGuiaClass = estadoGuiaClass;
  readonly esAceptadaSunat = esAceptadaSunat;

  get online(): boolean {
    return this.connectivity.isOnline();
  }

  readonly onlineSignal = computed(() => this.connectivity.isOnline());

  readonly usuario = signal<Usuario | null>(null);
  /** Administrador y monitor solo consultan (Excel y, el administrador, anular); logistica crea y opera. */
  readonly esAdmin = computed(() => [ROLES.admin, ROLES.monitor].some((r) => r === texto(this.usuario()?.idRol).toUpperCase()));
  readonly esAdministrador = computed(() => texto(this.usuario()?.idRol).toUpperCase() === ROLES.admin);

  get tieneGuiasNoSincronizadas(): boolean {
    return this.guias().some((g: any) => g?.sincroniza === 'no_sincronizado');
  }

  procesos = signal<Proceso[]>([]);
  guias = signal<GuiaRemision[]>([]);

  readonly guiasAgrupadas = computed(() => {
    const raw = this.guias();
    const map = new Map<string, any>();
    const result: any[] = [];
    for (const g of raw) {
      if (Number(g.multiple) === 1 && g.transactionId_uuid) {
        const key = g.transactionId_uuid;
        const existing = map.get(key);
        if (!existing) {
          const grupo = {
            ...g,
            _esGrupo: true,
            _guiasDelGrupo: [g],
            cantidadPalets: g.cantidadPalets || 0,
            totalCajas: g.totalCajas || 0,
            pesoTotal: g.pesoTotal || 0,
          };
          map.set(key, grupo);
          result.push(grupo);
        } else {
          existing._guiasDelGrupo.push(g);
          existing.cantidadPalets += (g.cantidadPalets || 0);
          existing.totalCajas += (g.totalCajas || 0);
          existing.pesoTotal += (g.pesoTotal || 0);
        }
      } else {
        result.push(g);
      }
    }
    return result;
  });

  readonly paginacion = crearPaginacion(() => this.guiasAgrupadas(), 25);

  isLoading = signal(false);
  modalNuevaGuiaAbierto = signal(false);
  modoEdicionGuia = signal(false);
  guiaParaEditar = signal<any>(null);
  modalInspeccionAbierto = signal(false);
  modalVerDetalleAbierto = signal(false);
  guiaDetalle = signal<any>(null);
  isLoadingModalProcesos = signal(false);
  guardandoGuia = signal(false);

  pendingGuiaPayload = signal<any>(null);

  readonly savedConfig = signal<Configuracion | null>(null);
  readonly transportistas = signal<Transportista[]>([]);
  readonly conductores = signal<Conductor[]>([]);
  readonly vehiculos = signal<Vehiculo[]>([]);
  readonly destinatarios = signal<any[]>([]);
  readonly procesosCatalogo = signal<any[]>([]);
  readonly motivosTraslado = signal<any[]>([]);
  readonly establecimientoEmisor = signal<any | null>(null);
  readonly establecimientos = signal<any[]>([]);

  readonly estadoOpciones: SearchSelectOption[] = [
    { value: '', label: 'Todos los estados' },
    { value: 'ABIERTA', label: 'Abierta' },
    { value: 'CERRADA', label: 'Cerrada' },
    { value: 'ANULADO', label: 'Anulado' },
  ];
  readonly filtroEstado = signal<string>('');
  readonly filtroTexto = signal<string>('');
  readonly filtroFechaDesde = signal<string>('');
  readonly filtroFechaHasta = signal<string>('');

  limpiarFiltros(): void {
    const hoy = nowPeruDate();
    this.filtroEstado.set('');
    this.filtroTexto.set('');
    this.filtroFechaDesde.set(hoy);
    this.filtroFechaHasta.set(hoy);
    void this.onBuscarGuias();
  }

  async ngOnInit(): Promise<void> {
    const session = await this.auth.getSession();
    this.usuario.set(session?.user ?? null);
    const hoy = nowPeruDate();
    this.filtroFechaDesde.set(hoy);
    this.filtroFechaHasta.set(hoy);
    await this.cargarConfiguracion();
    void this.onBuscarGuias();
  }

  async onBuscarGuias(options: { mostrarCarga?: boolean } = {}): Promise<void> {
    const mostrarCarga = options.mostrarCarga ?? true;
    this.paginacion.page.set(1);
    const idProyecto = String(this.savedConfig()?.idProyecto ?? '').trim();
    if (!idProyecto) {
      await this.cargarConfiguracion();
      const idProyecto2 = String(this.savedConfig()?.idProyecto ?? '').trim();
      if (!idProyecto2) {
        this.alertService.showAlert('Error', 'No se encontró la configuración del proyecto.', 'error');
        return;
      }
    }
    const idProyectoFinal = String(this.savedConfig()?.idProyecto ?? '').trim();
    if (mostrarCarga) {
      this.loading.show('Buscando guías...');
    }
    try {
      this.isLoading.set(true);
      const estado = this.filtroEstado().trim() || null;
      const texto = this.filtroTexto().trim() || null;
      const fechaDesde = this.filtroFechaDesde().trim() || null;
      const fechaHasta = this.filtroFechaHasta().trim() || null;

      const resultado = await this.guiaRemision.listarGuiasEnLinea(idProyectoFinal, estado, fechaDesde, fechaHasta, texto);
      if (resultado.error) {
        if (mostrarCarga) {
          this.loading.hide();
        }
        this.alertService.showAlert('Error', resultado.error, 'error');
        return;
      }
      const guiasRaw = resultado.data;

      // Solo se piden los destinatarios (para el nombre); no se guardan en el equipo.
      const destinatarios = (await this.catalogosGuia.destinatariosEnLinea()) ?? [];
      this.destinatarios.set(destinatarios);

      const guiasEnriquecidas = guiasRaw.map((g: any) => {
        const codigoProceso = String(g?.codigoProceso ?? '').trim();
        // El nombre del proceso ya no se pide al servidor: se muestra el código (o lo que traiga la guía).
        const fechaProceso = String(g?.fechaProceso ?? '').trim();
        const turno = String(g?.turno ?? '').trim();
        const nombreProceso = fechaProceso && turno ? `${fechaProceso} - ${turno}` : (fechaProceso || turno || codigoProceso);

        const documentoDest = String(g?.documentoDestinatario ?? '').trim();
        const destinatario = destinatarios.find((d: any) => {
          const dDoc = String(d?.documentoFiscal ?? '').trim();
          return dDoc === documentoDest;
        });
        const nombreDestinatario = String((destinatario as any)?.nombre ?? '').trim();

        return {
          ...g,
          nombreProceso,
          nombreDestinatario,
        };
      });

      this.guias.set(guiasEnriquecidas);
      if (mostrarCarga) {
        await this.loading.hideAfterMinimum();
      }
    } catch (error: any) {
      console.error('Error listando guías:', error);
      if (mostrarCarga) {
        this.loading.hide();
      }
      this.alertService.showAlert('Error', error?.error?.message ?? 'Error al listar guías.', 'error');
    } finally {
      this.isLoading.set(false);
    }
  }

  async exportarExcel(): Promise<void> {
    const idProyecto = texto(this.savedConfig()?.idProyecto);
    const codigoCultivo = texto(this.savedConfig()?.codigoCultivo) || null;
    if (!idProyecto) {
      this.alertService.showAlert('Error', 'No se encontró la configuración del proyecto.', 'error');
      return;
    }
    this.loading.show('Generando Excel...');
    try {
      const blob = await this.api.exportarExcel({
        idProyecto,
        estado: this.filtroEstado().trim() || null,
        texto: this.filtroTexto().trim() || null,
        fechaDesde: this.filtroFechaDesde().trim() || null,
        fechaHasta: this.filtroFechaHasta().trim() || null,
        codigoCultivo,
      });
      this.loading.hide();
      const nombre = `guias-remision-${new Date().toISOString().slice(0, 10)}.xlsx`;

      if (esDispositivoMovil()) {
        // Android / iOS: el archivo llego despues de esperar a la API, asi que solo se puede abrir desde un toque de la persona.
        this.feedback.open('success', {
          title: 'Excel listo',
          message: 'El Excel de guías está listo. Toque "Abrir Excel" para verlo o compartirlo.',
          actionText: 'Cerrar',
          secondaryAction: { text: 'Abrir Excel', handler: () => abrirOCompartirArchivo(blob, nombre) },
        });
      } else {
        descargarArchivo(blob, nombre);
      }
    } catch (error: any) {
      console.error('Error exportando Excel:', error);
      this.loading.hide();
      // Con responseType blob, el cuerpo del error llega como Blob: se lee para mostrar el mensaje del servidor.
      const mensaje = await this.mensajeDeError(error, 'Error al exportar el Excel.');
      this.alertService.showAlert('Información', mensaje, 'warning');
    }
  }

  /** Mensaje del servidor ({ message }) aunque la respuesta llegue como Blob. */
  private async mensajeDeError(error: any, defecto: string): Promise<string> {
    const cuerpo = error?.error;
    if (cuerpo instanceof Blob) {
      try {
        return JSON.parse(await cuerpo.text())?.message ?? defecto;
      } catch {
        return defecto;
      }
    }
    return cuerpo?.message ?? defecto;
  }

  private getNroDocumentoFromUsuario(): string {
    return texto(this.usuario()?.documentoIdentidad);
  }

  fmtDateTime(value: unknown): string {
    return formatDateTime(value) || '—';
  }

  sincronizadoLabel(sincroniza: string | undefined): string {
    return sincroniza === 'no_sincronizado' ? 'No sincronizado' : 'Sincronizado';
  }

  sincronizadoClass(sincroniza: string | undefined): string {
    return sincroniza === 'no_sincronizado' ? 'badge badge-soft badge-error' : 'badge badge-soft badge-success';
  }

  /** Dirección del PDF que se está viendo (null = ventana cerrada). */
  pdfUrlRaw = signal<string | null>(null);
  /** PDF de SUNAT: se ve dentro de una ventana (también en celular) y desde ahí la persona puede descargarlo. */
  abrirPdfModal(url: string | null | undefined): void {
    if (!url) {
      this.alertService.showAlertAcept(
        'PDF no disponible',
        'Aún no se ha generado el archivo PDF de SUNAT. Consulte el estado SUNAT con el botón de actualizar para obtener el PDF.',
        'warning'
      );
      return;
    }
    this.pdfUrlRaw.set(url);
  }

  cerrarPdfModal(): void {
    this.pdfUrlRaw.set(null);
  }

  private async cargarConfiguracion(): Promise<void> {
    try {
      const nro = this.getNroDocumentoFromUsuario();
      if (!nro) {
        this.savedConfig.set(null);
        return;
      }
      const cfg = await this.catalogosRepo.configuracionRepo.getByField('nrodocumento', nro);
      this.savedConfig.set(cfg ?? null);
    } catch (error) {
      console.log('Error cargando configuracion en guias', error);
      this.savedConfig.set(null);
    }
  }

  async editarGuia(g: GuiaRemision): Promise<void> {
    const idProyecto = String(this.savedConfig()?.idProyecto ?? '').trim();
    const codigoGuiaRemision = String(g?.codigoGuiaRemision ?? '').trim();
    if (!idProyecto || !codigoGuiaRemision) {
      this.alertService.showAlert('Error', 'No se pudo obtener la información de la guía.', 'error');
      return;
    }
    this.loading.show('Procesando...');
    try {
      const detalleData: any = await this.guiaRemision.getGuiaRemisionDetalle(idProyecto, codigoGuiaRemision);
      
      if (!detalleData) {
        this.alertService.showAlert('Error', this.online ? 'Error al obtener detalle.' : 'No se encontró la guía en almacenamiento local.', 'error');
        return;
      }

      await this.cargarTransportistas();
      await this.cargarConductores();
      await this.cargarVehiculos();
      await this.cargarDestinatarios();
      await this.cargarMotivosTraslado();
      await this.cargarEstablecimientoEmisor();
      await this.cargarEstablecimientos();

      const [procesosResp] = await Promise.all([this.guiaRemision.cargarProcesosParaGuia(codigoGuiaRemision)]);
      if (!procesosResp || procesosResp.length === 0) {
        this.alertService.showAlert('Error', 'No se encontraron procesos.', 'error');
        return;
      }
      const first = procesosResp[0];
      if (first?.error) {
        this.alertService.showAlert('Error', first?.mensaje ?? 'Error al obtener procesos', 'error');
        return;
      }
      const procesosData = (Array.isArray(first?.data) ? first.data : []).map((p: any) => {
        const nro = p.nroPalets ?? 0;
        return { ...p, 
                 paletsCerradosDisponibles: nro, 
                 label: `${p.codigoAcopio} - ${p.turno} - ${p.fechaProceso} (${nro} ${nro === 1 ? 'Palet' : 'Palets'})` 
                };
      });
       const codigoProceso = String(detalleData?.codigoProceso ?? '').trim();

      let paletsSeleccionados: string[] = [];

      // Reemplazar palets del proceso con filtrado: libres + los de la guía actual marcados
      if (codigoProceso) {
        let procesoIdx = procesosData.findIndex((p: any) => {
          const pId = String(p?.idProceso ?? p?.id ?? '').trim();
          return pId === codigoProceso;
        });

        // Si el proceso no está en la lista (API lo excluyó porque todos sus palets están en esta guía),
        // lo buscamos en Dexie y lo agregamos manualmente
        if (procesoIdx < 0) {
          const allProcesos = await this.procesoRepo.procesosRepo.getAll();
          const procesoInfo = (allProcesos ?? []).find((p: any) => String(p?.idProceso ?? '').trim() === codigoProceso);
          const nombreProceso = String(detalleData?.nombreProceso ?? '').trim();

          const procesoEntry: any = {
            ...(procesoInfo || {}),
            idProceso: codigoProceso,
            id: codigoProceso,
            codigoProceso,
            codigoAcopio: procesoInfo?.codigoAcopio ?? '',
            turno: procesoInfo?.turno ?? '',
            fechaProceso: procesoInfo?.fechaProceso ?? '',
            nombreProceso,
            paletsCerradosDisponibles: 0,
            palets: [],
          };
          const nro = procesoEntry.paletsCerradosDisponibles ?? 0;
          procesoEntry.label = procesoEntry.codigoAcopio && procesoEntry.turno && procesoEntry.fechaProceso
            ? `${procesoEntry.codigoAcopio} - ${procesoEntry.turno} - ${procesoEntry.fechaProceso} (${nro} ${nro === 1 ? 'Palet' : 'Palets'})`
            : (nombreProceso || codigoProceso);
          procesosData.push(procesoEntry);
          procesoIdx = procesosData.length - 1;
        }
        if (procesoIdx >= 0) {
          const proceso = procesosData[procesoIdx];
          const detalleCajas = Array.isArray(detalleData?.detalle) ? detalleData.detalle : [];
          const resultado = await this.guiaRemision.obtenerPaletsParaEdicion(idProyecto, codigoProceso, codigoGuiaRemision, detalleCajas);
          proceso.palets = (resultado?.palets ?? []).map((p: any) => ({
            ...p,
            idPalet: String(p?.idPalet ?? '').trim(),
            numeroPalet: p?.numeroPalet ?? null,
            cantidadCajas: Number(p?.cantidadCajas ?? 0),
            pesoTotal: Number(p?.pesoTotal ?? 0),
            estado: String(p?.estado ?? 'CERRADO_COMPLETO'),
          }));
          proceso.nroPalets = proceso.palets.length;
          const nro = proceso.nroPalets;
          proceso.paletsCerradosDisponibles = nro;
          proceso.label = `${proceso.codigoAcopio} - ${proceso.turno} - ${proceso.fechaProceso} (${nro} ${nro === 1 ? 'Palet' : 'Palets'})`;

          paletsSeleccionados = resultado?.paletsSeleccionados ?? [];
        }
      }

      this.procesos.set(procesosData);

      const procesoEncontrado = procesosData.find((p: any) => {
        const pId = String(p?.idProceso ?? p?.id ?? '').trim();
        return pId === codigoProceso;
      });
      const procesoId = String((procesoEncontrado as any)?.id ?? (procesoEncontrado as any)?.idProceso ?? '').trim();

      const documentoDest = String(detalleData?.documentoDestinatario ?? '').trim();
      const destinatarioEncontrado = this.destinatarios().find((d: any) => {
        const dDoc = String(d?.documentoFiscal ?? '').trim();
        return dDoc === documentoDest;
      });
      const destinatarioId = String((destinatarioEncontrado as any)?.id ?? '').trim();

      const motivoTraslado = String(
        detalleData?.codigoSunatMotivoTraslado ??
        detalleData?.motivoTraslado ??
        '13'
      ).trim();

      this.guiaParaEditar.set({
        procesoId,
        destinatarioId,
        puntoPartida: detalleData?.puntoPartida ?? '',
        puntoLlegada: detalleData?.puntoLlegada ?? '',
        ubigeoPartida: detalleData?.ubigeoPartida ?? '131202',
        ubigeoLlegada: detalleData?.ubigeoLlegada ?? '131202',
        idEstablecimientoPartida: String(detalleData?.idEstablecimientoPartida ?? '').trim(),
        idEstablecimientoLlegada: String(detalleData?.idEstablecimientoLlegada ?? '').trim(),
        transportistaId: String(detalleData?.idTransportista ?? ''),
        conductorId: String(detalleData?.idConductor ?? ''),
        vehiculoId: String(detalleData?.idVehiculo ?? ''),
        motivoTraslado,
        descripcionMotivoTraslado: detalleData?.descripcionMotivoTraslado ?? '',
        fechaEntregaBienes: detalleData?.fechaEntregaBienes ?? '',
        precinto: detalleData?.precinto ?? '',
        parihuelas: Number(detalleData?.parihuelas) || 0,
        observacionesUsuario: detalleData?.observacionesUsuario ?? '',
        paletsSeleccionados,
        codigoGuiaRemision: detalleData?.codigoGuiaRemision,
        transactionId_uuid: detalleData?.transactionId_uuid,
        fechaCreacionWeb: detalleData?.fechaCreacionWeb,
        estado: detalleData?.estado,
        inspeccionTemperatura: detalleData?.inspeccionTemperatura ?? null,
        inspeccionLibreOlores: detalleData?.inspeccionLibreOlores ?? null,
        inspeccionLibreInsectos: detalleData?.inspeccionLibreInsectos ?? null,
        inspeccionLibreMateriasExtranas: detalleData?.inspeccionLibreMateriasExtranas ?? null,
        inspeccionUnidadLimpia: detalleData?.inspeccionUnidadLimpia ?? null,
        inspeccionObservaciones: detalleData?.inspeccionObservaciones ?? undefined,
        inspeccionMedidaCorrectiva: detalleData?.inspeccionMedidaCorrectiva ?? undefined,
        numeroViaje: detalleData?.numeroViaje ?? null,
        paletsDetalleOriginal: detalleData?.detalle ?? [],
      });

      this.modoEdicionGuia.set(true);
      this.modalNuevaGuiaAbierto.set(true);
    } catch (error: any) {
      console.error('Error preparando edición:', error);
      this.alertService.showAlert('Error', 'Error al preparar la edición de la guía.', 'error');
    } finally {
      this.loading.hide();
    }
  }

  async cerrarGuia(g: GuiaRemision): Promise<void> {
    const confirmado = await this.alertService.showConfirm(
      'Confirmar emisión',
      `¿Está seguro de emitir y numerar la guía <strong>${g.serie ?? ''}-${g.numero ?? ''}</strong> (${g.codigoGuiaRemision})?`,
      'question'
    );
    if (!confirmado) return;

    const idProyecto = String(this.savedConfig()?.idProyecto ?? '').trim();
    const codigoGuiaRemision = String(g?.codigoGuiaRemision ?? '').trim();
    if (!idProyecto || !codigoGuiaRemision) {
      this.alertService.showAlert('Error', 'No se pudo obtener la información de la guía.', 'error');
      return;
    }

    this.loading.show('Procesando...');
    try {
      const resp: any = await this.api.emitir(idProyecto, codigoGuiaRemision);
      this.loading.hide();
      if (resp?.error) {
        this.alertService.showAlertAcept('Error', resp?.mensaje ?? 'Error al emitir la guía.', 'error');
        return;
      }
      await this.onBuscarGuias({ mostrarCarga: false });
      this.alertService.showAlert('Éxito', 'Guía emitida y numerada correctamente.', 'success');
    } catch (error: any) {
      this.loading.hide();
      console.error('Error emitiendo guía:', error);
      this.alertService.showAlert('Error', error?.error?.message ?? 'Error al emitir la guía.', 'error');
    }
  }

  async consultarEstadoSunat(g: GuiaRemision): Promise<void> {
    const idProyecto = String(this.savedConfig()?.idProyecto ?? '').trim();
    const codigoGuiaRemision = String(g?.codigoGuiaRemision ?? '').trim();
    if (!idProyecto || !codigoGuiaRemision) {
      this.alertService.showAlert('Error', 'No se pudo obtener la información de la guía.', 'error');
      return;
    }

    this.loading.show('Procesando...');
    try {
      const resp = await this.guiaRemision.consultarEstadoSunat(idProyecto, codigoGuiaRemision);
      this.loading.hide();
      if (resp?.error) {
        this.alertService.showAlertAcept('Error', resp?.mensaje ?? 'Error al consultar el estado SUNAT.', 'error');
        return;
      }
      const mensaje = resp?.data?.mensajeSunat ?? resp?.mensaje ?? 'Estado actualizado correctamente.';
      await this.onBuscarGuias({ mostrarCarga: false });
      this.alertService.showAlertAcept('Estado SUNAT', mensaje, 'success');
    } catch (error: any) {
      this.loading.hide();
      console.error('Error consultando estado SUNAT:', error);
      this.alertService.showAlert('Error', error?.error?.message ?? 'Error al consultar el estado SUNAT.', 'error');
    }
  }

  async anularGuia(g: GuiaRemision): Promise<void> {
    const confirmado = await this.alertService.showConfirm(
      'Confirmar anulación',
      `¿Está seguro de anular la guía <strong>${g.serie ?? ''}-${g.numero ?? ''}</strong> (${g.codigoGuiaRemision})?`,
      'warning'
    );
    if (!confirmado) return;

    // Segunda confirmación (modal estándar de la app): la anulación no se puede revertir.
    const segura = await this.confirmModal.confirm({
      title: 'Advertencia de anulación',
      eyebrow: 'Acción irreversible',
      message: 'Una vez anulada la guía no se podrá revertir. Verifique que ya esté anulada en SUNAT antes de continuar.',
      detail: `Guía ${g.serie ?? ''}-${g.numero ?? ''}\n${g.nombreDestinatario ?? '—'}\nSUNAT: ${estadoSunatLabel(g.estadoSunat)} · ${g.totalCajas} cajas — ${g.pesoTotal} kg`,
      confirmText: 'Sí, anular guía',
      cancelText: 'Cancelar',
      tone: 'danger',
    });
    if (!segura) return;

    await this.ejecutarAnulacion(g);
  }

  /** Anula la guía ya confirmada por la persona. */
  private async ejecutarAnulacion(g: GuiaRemision): Promise<void> {

    const idProyecto = String(this.savedConfig()?.idProyecto ?? '').trim();
    const codigoGuiaRemision = String(g?.codigoGuiaRemision ?? '').trim();
    const codigoAcopio = String(g?.codigoAcopio ?? '').trim();
    if (!idProyecto || !codigoGuiaRemision ) {
      this.alertService.showAlert('Error', 'No se pudo obtener la información de la guía.', 'error');
      return;
    }

    this.loading.show('Procesando...');
    try {
      const resp: any = await this.api.anular(idProyecto, codigoGuiaRemision, codigoAcopio);
      this.loading.hide();
      if (resp?.error) {
        this.alertService.showAlert('Error', resp?.mensaje ?? 'Error al anular la guía.', 'error');
        return;
      }
      this.alertService.showAlertAcept('Éxito', 'Guía anulada correctamente.', 'success');
      await this.onBuscarGuias();
    } catch (error: any) {
      this.loading.hide();
      console.error('Error anulando guía:', error);
      this.alertService.showAlert('Error', error?.error?.message ?? 'Error al anular la guía.', 'error');
    }
  }

  async eliminarGuia(g: GuiaRemision): Promise<void> {
    const palets = (g.detallePalets ?? []).map((p: any) => p.codigoPalet).join(', ');
    const msg = [
      '¿Está seguro de eliminar esta guía?',
      '',
      `Guía: ${g.serie ?? ''}-${g.numero ?? ''}`,
      `Palets: ${g.cantidadPalets ?? 0}   Cajas: ${g.totalCajas ?? 0}   Peso: ${g.pesoTotal ?? 0} kg`,
      `Precinto: ${g.precinto ?? '—'}   Viaje: ${g.numeroViaje ?? '—'}`,
      palets ? `Id palets: ${palets}` : '',
      '',
      'Esta acción no se puede deshacer.',
    ].filter((l, i, a) => l !== '' || (i > 0 && a[i - 1] !== '')).join('\n');

    const confirmado = await this.alertService.showConfirm('Confirmar eliminación', msg, 'warning');
    if (!confirmado) return;

    const idProyecto = String(this.savedConfig()?.idProyecto ?? '').trim();
    const codigoGuiaRemision = String(g?.codigoGuiaRemision ?? '').trim();
    if (!idProyecto || !codigoGuiaRemision) {
      this.alertService.showAlert('Error', 'No se pudo obtener la información de la guía.', 'error');
      return;
    }

    this.loading.show('Procesando...');
    try {
      const resp: any = await this.api.eliminar(idProyecto, codigoGuiaRemision);
      if (resp?.error) {
        this.alertService.showAlert('Error', resp?.mensaje ?? 'Error al eliminar la guía.', 'error');
        return;
      }
      this.alertService.showAlert('Éxito', 'Guía eliminada correctamente.', 'success');
      await this.onBuscarGuias();
    } catch (error: any) {
      console.error('Error eliminando guía:', error);
      this.alertService.showAlert('Error', error?.error?.message ?? 'Error al eliminar la guía.', 'error');
    } finally {
      this.loading.hide();
    }
  }

  async cerrarGrupo(guias: GuiaRemision[]): Promise<void> {
    const confirmado = await this.alertService.showConfirm(
      'Confirmar emisión múltiple',
      `¿Está seguro de emitir y numerar <strong>${guias.length}</strong> guías agrupadas?`,
      'question'
    );
    if (!confirmado) return;
    const idProyecto = String(this.savedConfig()?.idProyecto ?? '').trim();
    if (!idProyecto) {
      this.alertService.showAlert('Error', 'No se pudo obtener el proyecto.', 'error');
      return;
    }
    // Solo se necesita una guía del grupo; el SP V2 emite todas
    const primeraGuia = guias[0];
    const codigo = String(primeraGuia?.codigoGuiaRemision ?? '').trim();
    if (!codigo) {
      this.alertService.showAlert('Error', 'No se pudo obtener el código de guía.', 'error');
      return;
    }
    this.loading.show('Procesando...');
    try {
      const resp: any = await this.api.emitir(idProyecto, codigo);
      this.loading.hide();
      if (resp?.error) {
        this.alertService.showAlertAcept('Error', resp?.mensaje ?? 'Error al emitir las guías.', 'error');
        return;
      }
      this.alertService.showAlertAcept('Éxito', resp?.mensaje ?? 'Guías emitidas correctamente.', 'success');
      await this.onBuscarGuias();
    } catch (error: any) {
      this.loading.hide();
      console.error('Error emitiendo grupo:', error);
      this.alertService.showAlertAcept('Error', error?.error?.message ?? 'Error al emitir las guías del grupo.', 'error');
    }
  }

  async eliminarGrupo(guias: GuiaRemision[]): Promise<void> {
    const confirmado = await this.alertService.showConfirm(
      'Confirmar eliminación múltiple',
      `¿Está seguro de eliminar <strong>${guias.length}</strong> guías agrupadas?`,
      'warning'
    );
    if (!confirmado) return;
    const idProyecto = String(this.savedConfig()?.idProyecto ?? '').trim();
    if (!idProyecto) {
      this.alertService.showAlert('Error', 'No se pudo obtener el proyecto.', 'error');
      return;
    }
    const primeraGuia = guias[0];
    const codigo = String(primeraGuia?.codigoGuiaRemision ?? '').trim();
    if (!codigo) {
      this.alertService.showAlert('Error', 'No se pudo obtener el código de guía.', 'error');
      return;
    }
    this.loading.show('Procesando...');
    try {
      const resp: any = await this.api.eliminar(idProyecto, codigo);
      this.loading.hide();
      if (resp?.error) {
        this.alertService.showAlertAcept('Error', resp?.mensaje ?? 'Error al eliminar las guías.', 'error');
        return;
      }
      this.alertService.showAlertAcept('Éxito', resp?.mensaje ?? 'Guías eliminadas correctamente.', 'success');
      await this.onBuscarGuias();
    } catch (error: any) {
      this.loading.hide();
      console.error('Error eliminando grupo:', error);
      this.alertService.showAlertAcept('Error', error?.error?.message ?? 'Error al eliminar las guías del grupo.', 'error');
    }
  }

  async anularGrupo(guias: GuiaRemision[]): Promise<void> {
    const confirmado = await this.alertService.showConfirm(
      'Confirmar anulación múltiple',
      `¿Está seguro de anular <strong>${guias.length}</strong> guías agrupadas?`,
      'warning'
    );
    if (!confirmado) return;
    const idProyecto = String(this.savedConfig()?.idProyecto ?? '').trim();
    if (!idProyecto) {
      this.alertService.showAlert('Error', 'No se pudo obtener el proyecto.', 'error');
      return;
    }
    const primeraGuia = guias[0];
    const codigo = String(primeraGuia?.codigoGuiaRemision ?? '').trim();
    if (!codigo) {
      this.alertService.showAlert('Error', 'No se pudo obtener el código de guía.', 'error');
      return;
    }
    const codigoAcopio = String(primeraGuia?.codigoAcopio ?? '').trim();
    this.loading.show('Procesando...');
    try {
      const resp: any = await this.api.anular(idProyecto, codigo, codigoAcopio);
      this.loading.hide();
      if (resp?.error) {
        this.alertService.showAlertAcept('Error', resp?.mensaje ?? 'Error al anular las guías.', 'error');
        return;
      }
      this.alertService.showAlertAcept('Éxito', resp?.mensaje ?? 'Guías anuladas correctamente.', 'success');
      await this.onBuscarGuias();
    } catch (error: any) {
      this.loading.hide();
      console.error('Error anulando grupo:', error);
      this.alertService.showAlertAcept('Error', error?.error?.message ?? 'Error al anular las guías del grupo.', 'error');
    }
  }

  async cargarProcesosParaGuia(): Promise<any> {
    return this.guiaRemision.cargarProcesosParaGuia();
  }

  async cargarTransportistas(): Promise<void> {
    this.transportistas.set((await this.catalogosGuia.transportistas(texto(this.savedConfig()?.idProyecto))) ?? []);
  }

  async cargarConductores(): Promise<void> {
    this.conductores.set((await this.catalogosGuia.conductores(texto(this.savedConfig()?.idProyecto))) ?? []);
  }

  async cargarVehiculos(): Promise<void> {
    this.vehiculos.set((await this.catalogosGuia.vehiculos(texto(this.savedConfig()?.idProyecto))) ?? []);
  }

  async cargarDestinatarios(): Promise<void> {
    this.destinatarios.set((await this.catalogosGuia.destinatarios()) ?? []);
  }

  async cargarProcesosCatalogo(): Promise<void> {
    const idProyecto = texto(this.savedConfig()?.idProyecto);
    const codigoCultivo = texto(this.savedConfig()?.codigoCultivo);
    if (!codigoCultivo || !idProyecto) return;
    this.procesosCatalogo.set((await this.catalogosGuia.procesos(codigoCultivo, idProyecto)) ?? []);
  }

  /** Baja los codigos de caja a Dexie (los usa el detalle de una guia sin internet). */
  async cargarCodigosCajaCatalogo(): Promise<void> {
    await this.catalogosGuia.codigosCaja();
  }

  async cargarMotivosTraslado(): Promise<void> {
    const lista = await this.catalogosGuia.motivosTraslado();
    this.motivosTraslado.set((lista ?? []).filter((m: any) => ['13', '04'].includes(texto(m?.codigo))));
  }

  async cargarEstablecimientoEmisor(): Promise<void> {
    this.establecimientoEmisor.set(await this.catalogosGuia.establecimientoEmisor());
  }

  async cargarEstablecimientos(): Promise<void> {
    this.establecimientos.set(await this.catalogosGuia.establecimientos());
  }

  /** Celular o tablet: un toque sobre la fila abre el detalle de la guía. */
  alTocarFila(guia: GuiaRemision): void {
    if (esDispositivoMovil()) void this.abrirModalVerDetalle(guia);
  }

  /** Computador: doble clic sobre la fila abre el detalle de la guía. */
  alHacerDobleClicFila(guia: GuiaRemision): void {
    if (!esDispositivoMovil()) void this.abrirModalVerDetalle(guia);
  }

  async abrirModalVerDetalle(g: GuiaRemision): Promise<void> {
    const idProyecto = String(this.savedConfig()?.idProyecto ?? '').trim();
    const codigoGuiaRemision = String(g?.codigoGuiaRemision ?? '').trim();
    if (!idProyecto || !codigoGuiaRemision) {
      this.loading.hide();
      this.alertService.showAlert('Error', 'No se pudo obtener la información de la guía.', 'error');
      return;
    }
    this.loading.show('Procesando...');
    try {
      const detalleData = await this.guiaRemision.getGuiaRemisionDetalle(idProyecto, codigoGuiaRemision);

      if (!detalleData) {
        this.loading.hide();
        this.alertService.showAlert('Error', 'Error al obtener el detalle de la guía. Comuníquese con el administrador del sistema.', 'error');
        return;
      }

      if(detalleData?.error){
        this.loading.hide();
        this.alertService.showAlert('Error', detalleData?.mensaje ?? 'Error al obtener el detalle de la guía.', 'error');
        return;
      }
      this.loading.hide();
      this.guiaDetalle.set(detalleData);
      this.modalVerDetalleAbierto.set(true);
    } catch (error: any) {
      console.error('Error obteniendo detalle guía:', error);
      this.loading.hide();
      this.alertService.showAlert('Error', error?.message ?? error?.error?.message ?? 'Error al obtener detalle de la guía.', 'error');
    } 
   
  }

  cerrarModalVerDetalle(): void {
    this.modalVerDetalleAbierto.set(false);
    this.guiaDetalle.set(null);
  }

  async abrirModalNuevaGuia(): Promise<void> {
    this.loading.show('Procesando...');
    this.isLoadingModalProcesos.set(true);
    try {
      if (!this.savedConfig()) {
        await this.cargarConfiguracion();
      }
      const [resp] = await Promise.all([
        this.cargarProcesosParaGuia(),
        this.cargarTransportistas(),
        this.cargarConductores(),
        this.cargarVehiculos(),
        this.cargarDestinatarios(),
        this.cargarMotivosTraslado(),
        this.cargarEstablecimientoEmisor(),
        this.cargarEstablecimientos(),
      ]);

      if (!resp || resp.length === 0) {
        this.alertService.showAlert('Error', 'No se encontraron procesos.', 'error');
        return;
      }
      const first = resp[0];
      if (first?.error) {
        this.alertService.showAlert('Error', first?.mensaje ?? 'Error al obtener procesos', 'error');
        return;
      }
      const data = (Array.isArray(first?.data) ? first.data : []).map((p: any) => {
        const nro = p.nroPalets ?? 0;
        return {
          ...p,
          paletsCerradosDisponibles: nro,
          label: `${p.codigoAcopio} - ${p.turno} - ${p.fechaProceso} (${nro} ${nro === 1 ? 'Palet' : 'Palets'})`,
        };
      });
      if (data.length === 0) {
        this.alertService.showAlert('Información', 'No hay procesos abiertos con palets cerrados disponibles.', 'warning');
        return;
      }
      this.procesos.set(data);
      this.modalNuevaGuiaAbierto.set(true);
      this.loading.hide();
    } catch (err: any) {
      console.error('Error cargando procesos guía:', err);
      this.alertService.showAlert('Error', err?.error?.message ?? 'Error al cargar procesos', 'error');
    } finally {
      this.isLoadingModalProcesos.set(false);
    }
  }

  cerrarModalNuevaGuia(): void {
    this.modalNuevaGuiaAbierto.set(false);
    this.modoEdicionGuia.set(false);
    this.guiaParaEditar.set(null);
    this.pendingGuiaPayload.set(null);
    this.guardandoGuia.set(false);
  }

  onCrearGuia(payload: any): void {
    this.pendingGuiaPayload.set(payload);
    this.modalNuevaGuiaAbierto.set(false);
    this.modalInspeccionAbierto.set(true);
  }

  async onEditarGuia(payload: any): Promise<void> {
    this.modalNuevaGuiaAbierto.set(false);
    const guiaOriginal = this.guiaParaEditar();
    const paletsDetalle: any[] = payload.paletsDetalle ?? [];
    const cantidadPalets = paletsDetalle.length;

    const proceso = this.procesos().find(p => {
      const pid = String((p as any)?.id ?? '').trim();
      const pIdProceso = String((p as any)?.idProceso ?? '').trim();
      return pid === String(payload.procesoId ?? '').trim() || pIdProceso === String(payload.procesoId ?? '').trim();
    });
    const codigoProceso = (proceso as any)?.idProceso ?? String(payload.procesoId ?? '').trim();

    const destinatario = this.destinatarios().find(d => String((d as any)?.id ?? '').trim() === String(payload.destinatarioId ?? '').trim());
    const documentoFiscal = String((destinatario as any)?.documentoFiscal ?? '').trim();
    const motivoTraslado = String(payload.motivoTraslado ?? '13').trim();
    const documentoEmpresa = String(this.savedConfig()?.nrodocumento ?? '').trim();

    const guiaPayload: GuiaRemision = {
      codigoGuiaRemision: guiaOriginal?.codigoGuiaRemision,
      codigoProceso: codigoProceso,
      transactionId_uuid: guiaOriginal?.transactionId_uuid ?? newUuid(),
      documentoDestinatario: motivoTraslado === '04' ? documentoEmpresa : (documentoFiscal || ''),
      puntoPartida: String(payload.puntoPartida ?? '').trim(),
      puntoLlegada: String(payload.puntoLlegada ?? '').trim() || undefined,
      ubigeoPartida: String(payload.ubigeoPartida ?? '131202').trim(),
      ubigeoLlegada: String(payload.ubigeoLlegada ?? '131202').trim(),
      idEstablecimientoPartida: String(payload.idEstablecimientoPartida ?? '').trim() || null,
      idEstablecimientoLlegada: String(payload.idEstablecimientoLlegada ?? '').trim() || null,
      idTransportista: Number(payload.transportistaId) || null,
      idConductor: Number(payload.conductorId) || null,
      idVehiculo: Number(payload.vehiculoId) || null,
      motivoTraslado,
      descripcionMotivoTraslado: motivoTraslado === '13' ? (String(payload.descripcionMotivoTraslado ?? '').trim() || undefined) : undefined,
      fechaEntregaBienes: payload.fechaEntregaBienes || guiaOriginal?.fechaEntregaBienes || null,
      precinto: String(payload.precinto ?? '').trim() || null,
      estado: guiaOriginal?.estado ?? 'ABIERTA',
      pesoTotal: guiaOriginal?.pesoTotal ?? (null as any),
      totalCajas: guiaOriginal?.totalCajas ?? (null as any),
      cantidadPalets: cantidadPalets,
      usuarioEmision: guiaOriginal?.usuarioEmision ?? (null as any),
      fechaCreacionWeb: guiaOriginal?.fechaCreacionWeb ?? toLocalISOString(),
      parihuelas: Number(payload.parihuelas) || 0,
      observacionesUsuario: String(payload.observacionesUsuario ?? '').trim() || undefined,
      esReposicion: guiaOriginal?.esReposicion ?? (null as any),
      esEnsayo: guiaOriginal?.esEnsayo ?? (null as any),
      eliminado: false,
      inspeccionTemperatura: payload?.inspeccionTemperatura ?? guiaOriginal?.inspeccionTemperatura ?? null,
      inspeccionLibreOlores: payload?.inspeccionLibreOlores === 'si' ? true : (payload?.inspeccionLibreOlores === 'no' ? false : guiaOriginal?.inspeccionLibreOlores ?? null),
      inspeccionLibreInsectos: payload?.inspeccionLibreInsectos === 'si' ? true : (payload?.inspeccionLibreInsectos === 'no' ? false : guiaOriginal?.inspeccionLibreInsectos ?? null),
      inspeccionLibreMateriasExtranas: payload?.inspeccionLibreMateriasExtranas === 'si' ? true : (payload?.inspeccionLibreMateriasExtranas === 'no' ? false : guiaOriginal?.inspeccionLibreMateriasExtranas ?? null),
      inspeccionUnidadLimpia: payload?.inspeccionUnidadLimpia === 'si' ? true : (payload?.inspeccionUnidadLimpia === 'no' ? false : guiaOriginal?.inspeccionUnidadLimpia ?? null),
      inspeccionObservaciones:  payload?.inspeccionObservaciones?.trim() === '' ? null : payload?.inspeccionObservaciones?.trim(),
      inspeccionMedidaCorrectiva: payload?.inspeccionMedidaCorrectiva?.trim() === '' ? null : payload?.inspeccionMedidaCorrectiva?.trim(),
      numeroViaje: payload?.numeroViaje ?? guiaOriginal?.numeroViaje ?? null,
      snapshotDetalle: guiaOriginal?.snapshotDetalle ?? null,
      detallePalets: (() => {
        const paletsOriginal: any[] = guiaOriginal?.paletsDetalleOriginal ?? [];
        const codigosNuevos = new Set(paletsDetalle.map((p: any) => String(p.idPalet ?? p.codigoPalet ?? p.id ?? '').trim()));
        const detalle: any[] = [];

        // Palets seleccionados ahora (mantenidos + nuevos) -> eliminado: 0
        for (const p of paletsDetalle) {
          detalle.push({
            codigoGuiaRemision: guiaOriginal?.codigoGuiaRemision ?? '',
            transactionId_uuid: guiaOriginal?.transactionId_uuid ?? '',
            codigoPalet: String(p.idPalet ?? p.codigoPalet ?? p.id ?? '').trim(),
            codigoItem: String(p.codigoItem ?? '').trim(),
            cantidadCajas: Number(p.cantidadCajas ?? 0),
            eliminado: 0,
          });
        }

        // Palets que estaban antes pero ya no estan seleccionados -> eliminado: 1
        for (const p of paletsOriginal) {
          const codigo = String(p.codigoPalet ?? p.idPalet ?? p.id ?? '').trim();
          if (!codigosNuevos.has(codigo)) {
            detalle.push({
              codigoGuiaRemision: guiaOriginal?.codigoGuiaRemision ?? '',
              transactionId_uuid: guiaOriginal?.transactionId_uuid ?? '',
              codigoPalet: codigo,
              codigoItem: String(p.codigoItem ?? '').trim(),
              cantidadCajas: Number(p.cantidadCajas ?? 0),
              eliminado: 1,
            });
          }
        }

        return detalle;
      })(),
    };

    const idProyecto = String(this.savedConfig()?.idProyecto ?? '').trim();
    if (!idProyecto) {
      this.alertService.showAlert('Error', 'No se encontró la configuración del proyecto.', 'error');
      this.modoEdicionGuia.set(false);
      this.guiaParaEditar.set(null);
      return;
    }

    // const syncPayload = { idProyecto, guias: [guiaPayload] };
    const syncPayload = [guiaPayload];
    
    if (!this.online) {
      this.alertService.showAlert('Error', 'No hay conexión a internet. La edición requiere conexión.', 'error');
      this.modoEdicionGuia.set(false);
      this.guiaParaEditar.set(null);
      return;
    }

    try {
      this.loading.show('Procesando...');
      const rawResp: any = await this.guiaRemision.editarGuiaRemision({idProyecto:idProyecto,guias:syncPayload});
      const { error, mensaje } = this.normalizeBackendResp(rawResp);
      this.loading.hide();

      if (error) {
        this.alertService.showAlertAcept('Error', mensaje || 'Error al editar la guía.', 'error');
        return;
      }
      await this.onBuscarGuias({ mostrarCarga: false });
      this.alertService.showAlert('Éxito', mensaje || 'Guía editada correctamente.', 'success');
    } catch (error: any) {
      this.loading.hide();
      this.alertService.showAlertAcept('Error', error?.error?.message ?? 'Error al editar la guía.', 'error');
    } finally {
      this.modoEdicionGuia.set(false);
      this.guiaParaEditar.set(null);
    }
  }

  private normalizeBackendResp(resp: any): { error: boolean; mensaje: string; data?: any } {
    let r = resp;
    if (Array.isArray(r) && r.length > 0) {
      r = r[0];
    }
    const errorVal = r?.error;
    const error = errorVal === true || errorVal === 1 || errorVal === '1' || errorVal === 'true';
    const mensaje = r?.mensaje ?? '';
    return { error, mensaje, data: r?.data };
  }

  async onConfirmarInspeccion(ev: { guia: any; inspeccion: any }): Promise<void> {
    if (this.guardandoGuia()) return;
    this.guardandoGuia.set(true);

    const guia = ev.guia;
    const inspeccion = ev.inspeccion;
    const paletsDetalle: any[] = guia.paletsDetalle ?? [];

    const cantidadPalets = paletsDetalle.length;

    const proceso = this.procesos().find(p => String((p as any)?.id ?? '').trim() === String(guia.procesoId ?? '').trim() || String((p as any)?.idProceso ?? '').trim() === String(guia.procesoId ?? '').trim());
    const codigoProceso = (proceso as any)?.idProceso ?? String(guia.procesoId ?? '').trim();

    const destinatario = this.destinatarios().find(d => String((d as any)?.id ?? '').trim() === String(guia.destinatarioId ?? '').trim());
    const documentoFiscal = String((destinatario as any)?.documentoFiscal ?? '').trim();
    const motivoTraslado = String(guia.motivoTraslado ?? '13').trim();
    const documentoEmpresa = String(this.savedConfig()?.nrodocumento ?? '').trim();

    const transactionId = String(guia?.transactionId_uuid ?? '').trim() || newUuid();

    const guiaPayload: GuiaRemision = {
      codigoProceso: codigoProceso,
      transactionId_uuid: transactionId,
      documentoDestinatario: motivoTraslado === '04' ? documentoEmpresa : (documentoFiscal || ''),
      puntoPartida: String(guia.puntoPartida ?? '').trim(),
      puntoLlegada: String(guia.puntoLlegada ?? '').trim() || undefined,
      ubigeoPartida: String(guia.ubigeoPartida ?? '131202').trim(),
      ubigeoLlegada: String(guia.ubigeoLlegada ?? '131202').trim(),
      idEstablecimientoPartida: String(guia.idEstablecimientoPartida ?? '').trim() || null,
      idEstablecimientoLlegada: String(guia.idEstablecimientoLlegada ?? '').trim() || null,
      idTransportista: Number(guia.transportistaId) || null,
      idConductor: Number(guia.conductorId) || null,
      idVehiculo: Number(guia.vehiculoId) || null,
      motivoTraslado,
      descripcionMotivoTraslado: motivoTraslado === '13' ? (String(guia.descripcionMotivoTraslado ?? '').trim() || undefined) : undefined,
      fechaEntregaBienes: String(guia.fechaEntregaBienes ?? '').trim() || nowPeruDate(),
      precinto: String(guia.precinto ?? '').trim() || null,
      estado: 'ABIERTA',
      pesoTotal: null as any,
      totalCajas: null as any,
      cantidadPalets: cantidadPalets,
      usuarioEmision: null as any,
      fechaCreacionWeb: toLocalISOString(),
      parihuelas: Number(guia.parihuelas) || 0,
      observacionesUsuario: String(guia.observacionesUsuario ?? '').trim() || undefined,
      esReposicion: null as any,
      esEnsayo: null as any,
      eliminado: false,
      inspeccionTemperatura: inspeccion?.temperatura ?? null,
      inspeccionLibreOlores: inspeccion?.libreOlores === 'si' ? true : (inspeccion?.libreOlores === 'no' ? false : null),
      inspeccionLibreInsectos: inspeccion?.libreInsectos === 'si' ? true : (inspeccion?.libreInsectos === 'no' ? false : null),
      inspeccionLibreMateriasExtranas: inspeccion?.libreMateriasExtranas === 'si' ? true : (inspeccion?.libreMateriasExtranas === 'no' ? false : null),
      inspeccionUnidadLimpia: inspeccion?.unidadLimpia === 'si' ? true : (inspeccion?.unidadLimpia === 'no' ? false : null),
      inspeccionObservaciones: inspeccion?.observaciones?.trim() || undefined,
      inspeccionMedidaCorrectiva: inspeccion?.medidaCorrectiva?.trim() || undefined,
      numeroViaje: inspeccion?.numeroViaje ?? null,
      snapshotDetalle: null,
      detallePalets: paletsDetalle.map((p: any) => ({
        codigoGuiaRemision: '',
        transactionId_uuid: transactionId,
        codigoPalet: String(p.idPalet ?? p.codigoPalet ?? p.id ?? '').trim(),
      })),
    };

    const idProyecto = String(this.savedConfig()?.idProyecto ?? '').trim();
    if (!idProyecto) {
      this.alertService.showAlert('Error', 'No se encontró la configuración del proyecto.', 'error');
      this.guardandoGuia.set(false);
      return;
    }

    const syncPayload = {
      idProyecto: idProyecto,
      guias: [guiaPayload],
    };

    if (!this.online) {
      // Offline: guardar en Dexie como no sincronizado
      const codigoGuiaOffline = `OFF_${transactionId}`;
      const guiaDexie = {
        ...guiaPayload,
        codigoGuiaRemision: codigoGuiaOffline,
        idProyecto,
        sincroniza: 'no_sincronizado',
        fechaCreacion: toLocalISOString(),
        bd: 0,
      };
      await this.guiasRemisionRepo.guiasRepo.saveByCodigoGuiaRemision(guiaDexie);

      for (const p of paletsDetalle) {
        await this.guiasRemisionRepo.paletsRepo.saveByCodigoGuiaRemision({
          codigoGuiaRemision: codigoGuiaOffline,
          transactionId_uuid: transactionId,
          codigoPalet: String(p.idPalet ?? p.codigoPalet ?? p.id ?? '').trim(),
          codigoItem: String(p.codigoItem ?? '').trim(),
          cantidadCajas: Number(p.cantidadCajas ?? 0),
          fechaCreacion: toLocalISOString(),
          bd: 0,
        });
      }

      this.modalInspeccionAbierto.set(false);
      this.pendingGuiaPayload.set(null);
      await this.cargarProcesosParaGuia();
      await this.onBuscarGuias({ mostrarCarga: false });
      this.alertService.showAlert('Éxito', 'Guía guardada localmente (sin sincronizar).', 'success');
      this.guardandoGuia.set(false);
      return;
    }

    try {
      this.loading.show('Procesando...');
      const rawResp: any = await this.api.sincronizar(syncPayload.idProyecto, syncPayload.guias);
      const { error, mensaje } = this.normalizeBackendResp(rawResp);
      this.loading.hide();

      if (error) {
        this.alertService.showAlertAcept('Error', mensaje || 'Error al sincronizar guía.', 'error');
        this.guardandoGuia.set(false);
        return;
      }
      this.modalInspeccionAbierto.set(false);
      this.pendingGuiaPayload.set(null);
      await this.cargarProcesosParaGuia();
      await this.onBuscarGuias({ mostrarCarga: false });
      this.alertService.showAlert('Éxito', mensaje || 'Guía sincronizada correctamente.', 'success');
    } catch (error: any) {
      console.error('Error sincronizando guía:', error);
      this.loading.hide();
      this.alertService.showAlertAcept('Error', error?.error?.message ?? 'Error al sincronizar guía.', 'error');
      this.guardandoGuia.set(false);
    } finally {
      if (!this.modalInspeccionAbierto()) {
        this.guardandoGuia.set(false);
      }
    }
  }

  cerrarModalInspeccion(): void {
    if (this.guardandoGuia()) return;
    this.modalInspeccionAbierto.set(false);
    this.pendingGuiaPayload.set(null);
    this.guardandoGuia.set(false);
  }

  volverAFormularioGuia(): void {
    if (this.guardandoGuia()) return;
    this.modalInspeccionAbierto.set(false);
    this.modalNuevaGuiaAbierto.set(true);
  }

  async onSincronizar(): Promise<void> {
    const idProyecto = String(this.savedConfig()?.idProyecto ?? '').trim();
    if (!idProyecto) {
      this.alertService.showAlert('Error', 'No se encontró el proyecto.', 'error');
      return;
    }
    if (!this.online) {
      this.alertService.showAlert('Error', 'No hay conexión a internet.', 'error');
      return;
    }

    const confirmado = await this.alertService.showConfirm(
      'Sincronizar guías',
      'Se enviarán las guías pendientes al servidor. ¿Continuar?',
      'question'
    );
    if (!confirmado) return;

    this.loading.show('Procesando...');
    try {
      const resultado = await this.guiaRemision.sincronizarGuiasOffline(idProyecto);
      this.loading.hide();
      if (resultado.success) {
        this.alertService.showAlert('Éxito', resultado.mensaje, 'success');
        await this.onBuscarGuias();
      } else {
        this.alertService.showAlert('Error', resultado.mensaje, 'error');
      }
    } catch (error: any) {
      this.loading.hide();
      this.alertService.showAlert('Error', error?.message ?? 'Error al sincronizar guías.', 'error');
    }
  }
}
