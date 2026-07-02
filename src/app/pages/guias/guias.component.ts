import { Component, ChangeDetectionStrategy, inject, signal, computed, OnInit } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { firstValueFrom } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { GuiaService } from '../../shared/services/guia.service';
import { ProcesoService } from '../../shared/services/proceso.service';
import { PermissionService } from '../../shared/services/permission.service';
import { AlertService } from '../../shared/services/alert.service';
import { ConnectivityService } from '../../shared/services/connectivity.service';
import { AuthService } from '../../shared/services/auth.service';
import { CatalogoService } from '../../shared/services/catalogo.service';
import { GuiaRemision, GuiaRemisionPalet } from '../../shared/interfaces/guia.interface';
import { Proceso } from '../../shared/interfaces/proceso.interface';
import { Configuracion } from '../../shared/interfaces/administracion.interface';
import { Transportista, Conductor, Vehiculo } from '../../shared/interfaces/catalogo.interface';
import { ModalNuevaGuiaComponent } from './components/modal-nueva-guia/modal-nueva-guia.component';
import { ModalInspeccionComponent } from './components/modal-inspeccion/modal-inspeccion.component';
import { ModalVerDetalleGuiaComponent } from './components/modal-ver-detalle-guia/modal-ver-detalle-guia.component';
import { ProcesoRepository } from '../../shared/dexiedb/repository/proceso.repository';
import { CatalogosRepository } from '../../shared/dexiedb/repository/catalogos.repository';
import { CatalogosOperativosRepository } from '../../shared/dexiedb/repository/catalogos-operacionales.repository';
import { GuiasRemisionRepository } from '../../shared/dexiedb/repository/guias-remision.repository';
import { GuiaRemisionFacade } from '../../shared/facades/guia-remision.facade';
import { CatalogosFacade } from '../../shared/facades/catalogos.facade';
import { ProcesosFacade } from '../../shared/facades/procesos.facade';
import { formatDateTime, toLocalISOString, formatDate } from '../../shared/utils/datetime.utils';

type ViewPage = 'procesos' | 'guias' | 'detalle';

@Component({
  selector: 'app-guias',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModalNuevaGuiaComponent, ModalInspeccionComponent, ModalVerDetalleGuiaComponent, FormsModule],
  templateUrl: './guias.component.html',
  styleUrl: './guias.component.scss'
})
export class GuiasComponent implements OnInit {
  private readonly guiaService = inject(GuiaService);
  private readonly procesoService = inject(ProcesoService);
  readonly permissions = inject(PermissionService);
  private readonly alertService = inject(AlertService);
  private readonly connectivity = inject(ConnectivityService);
  private readonly procesoRepo = inject(ProcesoRepository);
  private readonly catalogoService = inject(CatalogoService);
  private readonly catalogosRepo = inject(CatalogosRepository);
  private readonly catalogosOperativosRepo = inject(CatalogosOperativosRepository);
  private readonly guiasRemisionRepo = inject(GuiasRemisionRepository);
  private readonly guiaRemisionFacade = inject(GuiaRemisionFacade);
  private readonly catalogosFacade = inject(CatalogosFacade);
  private readonly procesosFacade = inject(ProcesosFacade);
  private readonly auth = inject(AuthService);
  private readonly sanitizer = inject(DomSanitizer);

  get online(): boolean {
    return this.connectivity.isOnline();
  }

  readonly onlineSignal = computed(() => this.connectivity.isOnline());

  get tieneGuiasNoSincronizadas(): boolean {
    return this.guias().some((g: any) => g?.sincroniza === 'no_sincronizado');
  }

  currentView = signal<ViewPage>('procesos');
  procesos = signal<Proceso[]>([]);
  procesoSeleccionado = signal<Proceso | null>(null);
  guias = signal<GuiaRemision[]>([]);

  guiasAgrupadas = computed(() => {
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

  guiaSeleccionada = signal<GuiaRemision | null>(null);
  isLoading = signal(false);
  modalNuevaGuiaAbierto = signal(false);
  modoEdicionGuia = signal(false);
  guiaParaEditar = signal<any>(null);
  modalInspeccionAbierto = signal(false);
  modalVerDetalleAbierto = signal(false);
  guiaDetalle = signal<any>(null);
  isLoadingModalProcesos = signal(false);

  pendingGuiaPayload = signal<any>(null);

  readonly savedConfig = signal<Configuracion | null>(null);
  readonly transportistas = signal<Transportista[]>([]);
  readonly conductores = signal<Conductor[]>([]);
  readonly vehiculos = signal<Vehiculo[]>([]);
  readonly destinatarios = signal<any[]>([]);
  readonly procesosCatalogo = signal<any[]>([]);
  readonly tipoProcesoEmpacadosCatalogo = signal<any[]>([]);
  readonly consignatariosCatalogo = signal<any[]>([]);
  readonly destinosCatalogo = signal<any[]>([]);
  readonly presentacionesCatalogo = signal<any[]>([]);
  readonly formatosCatalogo = signal<any[]>([]);
  readonly variedadesCatalogo = signal<any[]>([]);
  readonly tiposEmpaqueGuiaCatalogo = signal<any[]>([]);
  readonly codigosRanchoCatalogo = signal<any[]>([]);
  readonly lugaresProduccionCatalogo = signal<any[]>([]);
  readonly transportesCatalogo = signal<any[]>([]);
  readonly campaniasCatalogo = signal<any[]>([]);
  readonly codigosCajaCatalogo = signal<any[]>([]);
  readonly motivosTraslado = signal<any[]>([]);

  readonly filtroEstado = signal<string>('');
  readonly filtroTexto = signal<string>('');
  readonly filtroFechaDesde = signal<string>('');
  readonly filtroFechaHasta = signal<string>('');

  private todayDate(): string {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  limpiarFiltros(): void {
    const hoy = this.todayDate();
    this.filtroEstado.set('');
    this.filtroTexto.set('');
    this.filtroFechaDesde.set(hoy);
    this.filtroFechaHasta.set(hoy);
    void this.onBuscarGuias();
  }

  ngOnInit(): void {
    const hoy = this.todayDate();
    this.filtroFechaDesde.set(hoy);
    this.filtroFechaHasta.set(hoy);
    void this.cargarConfiguracion();
    void this.cargarCodigosCajaCatalogo();
    void this.cargarMotivosTraslado();
    void this.onBuscarGuias();
  }

  async onBuscarGuias(): Promise<void> {
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
    this.alertService.mostrarModalCarga();
    try {
      this.isLoading.set(true);
      const estado = this.filtroEstado().trim() || null;
      const texto = this.filtroTexto().trim() || null;
      const fechaDesde = this.filtroFechaDesde().trim() || null;
      const fechaHasta = this.filtroFechaHasta().trim() || null;

      const resultado = await this.guiaRemisionFacade.listarGuiasRemision(idProyectoFinal, estado, fechaDesde, fechaHasta, texto);
      if (resultado.error) {
        this.alertService.showAlert('Error', resultado.error, 'error');
        return;
      }
      const guiasRaw = resultado.data;

      await this.cargarProcesosCatalogo();
      await this.cargarDestinatarios();

      const procesos = this.procesosCatalogo();
      const destinatarios = this.destinatarios();

      const guiasEnriquecidas = guiasRaw.map((g: any) => {
        const codigoProceso = String(g?.codigoProceso ?? '').trim();
        const proceso = procesos.find((p: any) => {
          const pId = String(p?.idProceso ?? p?.codigoProceso ?? p?.id ?? '').trim();
          return pId === codigoProceso;
        });
        const fechaProceso = String((proceso as any)?.fechaProceso ?? '').trim();
        const turno = String((proceso as any)?.turno ?? '').trim();
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
      this.alertService.cerrarModalCarga();
    } catch (error: any) {
      console.error('Error listando guías:', error);
      this.alertService.showAlert('Error', error?.error?.message ?? 'Error al listar guías.', 'error');
    } finally {
      this.isLoading.set(false);
    }
  }

  private getNroDocumentoFromUsuario(): string {
    const u: any = this.auth.usuario();
    const v = u?.nrodocumento ?? u?.documentoidentidad ?? u?.documentoIdentidad ?? u?.documento ?? '';
    return String(v ?? '').trim();
  }

  fmtDateTime(value: unknown): string {
    return formatDateTime(value) ?? '—';
  }

  sincronizadoLabel(sincroniza: string | undefined): string {
    return sincroniza === 'no_sincronizado' ? 'No sincronizado' : 'Sincronizado';
  }

  sincronizadoClass(sincroniza: string | undefined): string {
    return sincroniza === 'no_sincronizado' ? 'sp-badge sp-badge-danger' : 'sp-badge sp-badge-success';
  }

  estadoSunatLabel(estado?: string): string {
    const key = this.normalizarEstadoSunat(estado);
    const map: Record<string, string> = {
      PENDIENTE: 'Pendiente',
      PENDIENTE_DE_ENVIO: 'Pendiente de Envío',
      ENVIANDO: 'Enviando',
      ENVIADO: 'Enviado',
      ENVIADO_A_DECLARAR: 'Enviado a Declarar',
      ACEPTADO: 'Aceptado',
      ACEPTADO_CON_OBSERVACIONES: 'Aceptado c/obs.',
      RECHAZADO: 'Rechazado',
      ERROR: 'Error',
      ERROR_ENVIO: 'Error envío',
      ANULADO: 'Anulado',
      NO_ENVIADO: 'No Enviado',
    };
    return map[key] ?? (estado || '—');
  }

  estadoSunatClass(estado?: string): string {
    const key = this.normalizarEstadoSunat(estado);
    switch (key) {
      case 'PENDIENTE':
      case 'PENDIENTE_DE_ENVIO':
        return 'badge-sunat badge-sunat-pendiente';
      case 'ENVIANDO': return 'badge-sunat badge-sunat-enviando';
      case 'ENVIADO':
      case 'ENVIADO_A_DECLARAR':
        return 'badge-sunat badge-sunat-enviado';
      case 'ACEPTADO': return 'badge-sunat badge-sunat-aceptado';
      case 'ACEPTADO_CON_OBSERVACIONES': return 'badge-sunat badge-sunat-aceptado-obs';
      case 'RECHAZADO': return 'badge-sunat badge-sunat-rechazado';
      case 'ERROR':
      case 'ERROR_ENVIO':
        return 'badge-sunat badge-sunat-error';
      case 'ANULADO': return 'badge-sunat badge-sunat-anulado';
      case 'NO_ENVIADO': return 'badge-sunat badge-sunat-no-enviado';
      default: return 'badge-sunat badge-sunat-pendiente';
    }
  }

  private normalizarEstadoSunat(estado?: string): string {
    return (estado ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/\s+/g, '_')
      .replace(/[^A-Z0-9_]/g, '');
  }

  esAceptadaSunat(estado?: string): boolean {
    return this.normalizarEstadoSunat(estado) === 'ACEPTADO';
  }

  pdfModalAbierto = signal(false);
  pdfUrlRaw = signal<string | null>(null);
  pdfUrlSegura = computed<SafeResourceUrl | null>(() => {
    const url = this.pdfUrlRaw();
    if (!url) return null;
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  });

  abrirPdfModal(url: string | null | undefined): void {
    if (!url) return;
    this.pdfUrlRaw.set(url);
    this.pdfModalAbierto.set(true);
  }

  cerrarPdfModal(): void {
    this.pdfModalAbierto.set(false);
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
    this.alertService.mostrarModalCarga();
    try {
      const detalleData: any = await this.guiaRemisionFacade.getGuiaRemisionDetalle(idProyecto, codigoGuiaRemision);
      
      if (!detalleData) {
        this.alertService.showAlert('Error', this.online ? 'Error al obtener detalle.' : 'No se encontró la guía en almacenamiento local.', 'error');
        return;
      }

      await this.cargarTransportistas();
      await this.cargarConductores();
      await this.cargarVehiculos();
      await this.cargarDestinatarios();

      const [procesosResp] = await Promise.all([this.guiaRemisionFacade.cargarProcesosParaGuia(codigoGuiaRemision)]);
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
          const resultado = await this.guiaRemisionFacade.obtenerPaletsParaEdicion(idProyecto, codigoProceso, codigoGuiaRemision, detalleCajas);
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

      this.guiaParaEditar.set({
        procesoId,
        destinatarioId,
        puntoPartida: detalleData?.puntoPartida ?? '',
        puntoLlegada: detalleData?.puntoLlegada ?? '',
        ubigeoPartida: detalleData?.ubigeoPartida ?? '131202',
        ubigeoLlegada: detalleData?.ubigeoLlegada ?? '131202',
        transportistaId: String(detalleData?.idTransportista ?? ''),
        conductorId: String(detalleData?.idConductor ?? ''),
        vehiculoId: String(detalleData?.idVehiculo ?? ''),
        motivoTraslado: detalleData?.motivoTraslado ?? '13',
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
      this.alertService.cerrarModalCarga();
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

    this.alertService.mostrarModalCarga();
    try {
      let resp: any = await firstValueFrom(this.guiaService.emitirGuiaRemision(idProyecto, codigoGuiaRemision));
      if (Array.isArray(resp) && resp.length > 0) {
        resp = resp[0];
      }
      if (resp?.error) {
        this.alertService.showAlertAcept('Error', resp?.mensaje ?? 'Error al emitir la guía.', 'error');
        return;
      }
      this.alertService.showAlert('Éxito', 'Guía emitida y numerada correctamente.', 'success');
      await this.onBuscarGuias();
    } catch (error: any) {
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

    this.alertService.mostrarModalCarga();
    try {
      const resp = await this.guiaRemisionFacade.consultarEstadoSunat(idProyecto, codigoGuiaRemision);
      if (resp?.error) {
        this.alertService.showAlertAcept('Error', resp?.mensaje ?? 'Error al consultar el estado SUNAT.', 'error');
        return;
      }
      const mensaje = resp?.data?.mensajeSunat ?? resp?.mensaje ?? 'Estado actualizado correctamente.';
      this.alertService.showAlertAcept('Estado SUNAT', mensaje, 'success');
      await this.onBuscarGuias();
    } catch (error: any) {
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

    const idProyecto = String(this.savedConfig()?.idProyecto ?? '').trim();
    const codigoGuiaRemision = String(g?.codigoGuiaRemision ?? '').trim();
    if (!idProyecto || !codigoGuiaRemision) {
      this.alertService.showAlert('Error', 'No se pudo obtener la información de la guía.', 'error');
      return;
    }

    this.alertService.mostrarModalCarga();
    try {
      let resp: any = await firstValueFrom(this.guiaService.anularGuiaRemision(idProyecto, codigoGuiaRemision));
      if (Array.isArray(resp) && resp.length > 0) {
        resp = resp[0];
      }
      if (resp?.error) {
        this.alertService.showAlert('Error', resp?.mensaje ?? 'Error al anular la guía.', 'error');
        return;
      }
      this.alertService.showAlertAcept('Éxito', 'Guía anulada correctamente.', 'success');
      await this.onBuscarGuias();
    } catch (error: any) {
      console.error('Error anulando guía:', error);
      this.alertService.showAlert('Error', error?.error?.message ?? 'Error al anular la guía.', 'error');
    }
  }

  async eliminarGuia(g: GuiaRemision): Promise<void> {
    const paletsList = (g.detallePalets ?? [])
      .map((p: any) => `<span style="background:#f1f5f9;padding:2px 8px;border-radius:12px;font-size:12px;font-weight:600;color:#0f172a;">${p.codigoPalet}</span>`)
      .join(' ');

    const msg = `
      <div style="text-align:left;font-size:14px;color:#334155;line-height:1.6;">
        <p style="margin-bottom:12px;">¿Está seguro de eliminar esta guía?</p>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px;margin-bottom:12px;">
          <div style="font-size:18px;font-weight:700;color:#0f172a;margin-bottom:10px;">
            ${g.serie ?? ''}-${g.numero ?? ''}
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px 16px;">
            <div><span style="color:#64748b;font-size:12px;">Palets</span><br><strong>${g.cantidadPalets ?? 0}</strong></div>
            <div><span style="color:#64748b;font-size:12px;">Cajas</span><br><strong>${g.totalCajas ?? 0}</strong></div>
            <div><span style="color:#64748b;font-size:12px;">Peso</span><br><strong>${g.pesoTotal ?? 0} kg</strong></div>
            <div><span style="color:#64748b;font-size:12px;">Precinto</span><br><strong>${g.precinto ?? '—'}</strong></div>
            <div><span style="color:#64748b;font-size:12px;">Viaje</span><br><strong>${g.numeroViaje ?? '—'}</strong></div>
          </div>
          ${paletsList ? `<div style="margin-top:10px;"><span style="color:#64748b;font-size:12px;">Id Palets</span><br><div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px;">${paletsList}</div></div>` : ''}
        </div>
        <p style="color:#dc2626;font-size:13px;font-weight:600;margin:0;">Esta acción no se puede deshacer.</p>
      </div>
    `;

    const confirmado = await this.alertService.showConfirm('Confirmar eliminación', msg, 'warning');
    if (!confirmado) return;

    const idProyecto = String(this.savedConfig()?.idProyecto ?? '').trim();
    const codigoGuiaRemision = String(g?.codigoGuiaRemision ?? '').trim();
    if (!idProyecto || !codigoGuiaRemision) {
      this.alertService.showAlert('Error', 'No se pudo obtener la información de la guía.', 'error');
      return;
    }

    this.alertService.mostrarModalCarga();
    try {
      let resp: any = await firstValueFrom(this.guiaService.eliminarGuiaRemision(idProyecto, codigoGuiaRemision));
      if (Array.isArray(resp) && resp.length > 0) {
        resp = resp[0];
      }
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
      this.alertService.cerrarModalCarga();
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
    this.alertService.mostrarModalCarga();
    try {
      let resp: any = await firstValueFrom(this.guiaService.emitirGuiaRemision(idProyecto, codigo));
      if (Array.isArray(resp) && resp.length > 0) resp = resp[0];
      this.alertService.cerrarModalCarga();
      if (resp?.error) {
        this.alertService.showAlertAcept('Error', resp?.mensaje ?? 'Error al emitir las guías.', 'error');
        return;
      }
      this.alertService.showAlertAcept('Éxito', resp?.mensaje ?? 'Guías emitidas correctamente.', 'success');
      await this.onBuscarGuias();
    } catch (error: any) {
      this.alertService.cerrarModalCarga();
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
    this.alertService.mostrarModalCarga();
    try {
      let resp: any = await firstValueFrom(this.guiaService.eliminarGuiaRemision(idProyecto, codigo));
      if (Array.isArray(resp) && resp.length > 0) resp = resp[0];
      this.alertService.cerrarModalCarga();
      if (resp?.error) {
        this.alertService.showAlertAcept('Error', resp?.mensaje ?? 'Error al eliminar las guías.', 'error');
        return;
      }
      this.alertService.showAlertAcept('Éxito', resp?.mensaje ?? 'Guías eliminadas correctamente.', 'success');
      await this.onBuscarGuias();
    } catch (error: any) {
      this.alertService.cerrarModalCarga();
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
    this.alertService.mostrarModalCarga();
    try {
      let resp: any = await firstValueFrom(this.guiaService.anularGuiaRemision(idProyecto, codigo));
      if (Array.isArray(resp) && resp.length > 0) resp = resp[0];
      this.alertService.cerrarModalCarga();
      if (resp?.error) {
        this.alertService.showAlertAcept('Error', resp?.mensaje ?? 'Error al anular las guías.', 'error');
        return;
      }
      this.alertService.showAlertAcept('Éxito', resp?.mensaje ?? 'Guías anuladas correctamente.', 'success');
      await this.onBuscarGuias();
    } catch (error: any) {
      this.alertService.cerrarModalCarga();
      console.error('Error anulando grupo:', error);
      this.alertService.showAlertAcept('Error', error?.error?.message ?? 'Error al anular las guías del grupo.', 'error');
    }
  }

  volverAProcesos(): void {
    this.currentView.set('procesos');
    this.procesoSeleccionado.set(null);
  }

  volverAGuias(): void {
    this.currentView.set('guias');
    this.guiaSeleccionada.set(null);
  }

  async cargarProcesosParaGuia(): Promise<any> {
    return this.guiaRemisionFacade.cargarProcesosParaGuia();
  }

  async cargarTransportistas(): Promise<void> {
    const idProyecto = String(this.savedConfig()?.idProyecto ?? '').trim();
    const lista = await this.catalogosFacade.cargarTransportistas(idProyecto);
    this.transportistas.set(lista ?? []);
  }

  async cargarConductores(): Promise<void> {
    const idProyecto = String(this.savedConfig()?.idProyecto ?? '').trim();
    const lista = await this.catalogosFacade.cargarConductores(idProyecto);
    this.conductores.set(lista ?? []);
  }

  async cargarVehiculos(): Promise<void> {
    const idProyecto = String(this.savedConfig()?.idProyecto ?? '').trim();
    const lista = await this.catalogosFacade.cargarVehiculos(idProyecto);
    this.vehiculos.set(lista ?? []);
  }

  async cargarDestinatarios(): Promise<void> {
    const lista = await this.catalogosFacade.cargarDestinatarios();
    this.destinatarios.set(lista ?? []);
  }

  async cargarProcesosCatalogo(): Promise<void> {
    const idProyecto = String(this.savedConfig()?.idProyecto ?? '').trim();
    const codigoCultivo = String(this.savedConfig()?.codigoCultivo ?? '').trim();
    if (!codigoCultivo || !idProyecto) return;
    const lista = await this.procesosFacade.cargarProcesosCatalogo(codigoCultivo, idProyecto);
    this.procesosCatalogo.set(lista ?? []);
  }

  async cargarTipoProcesoEmpacadosCatalogo(): Promise<void> {
    const idProyecto = String(this.savedConfig()?.idProyecto ?? '').trim();
    const lista = await this.catalogosFacade.cargarTipoProcesoEmpacadosCatalogo(idProyecto);
    this.tipoProcesoEmpacadosCatalogo.set(lista ?? []);
  }

  async cargarConsignatariosCatalogo(): Promise<void> {
    const lista = await this.catalogosFacade.cargarConsignatariosCatalogo();
    this.consignatariosCatalogo.set(lista ?? []);
  }

  async cargarDestinosCatalogo(): Promise<void> {
    const lista = await this.catalogosFacade.cargarDestinosCatalogo();
    this.destinosCatalogo.set(lista ?? []);
  }

  async cargarPresentacionesCatalogo(): Promise<void> {
    const codigoCultivo = String(this.savedConfig()?.codigoCultivo ?? '').trim();
    const lista = await this.catalogosFacade.cargarPresentacionesCatalogo(codigoCultivo);
    this.presentacionesCatalogo.set(lista ?? []);
  }

  async cargarFormatosCatalogo(): Promise<void> {
    const codigoCultivo = String(this.savedConfig()?.codigoCultivo ?? '').trim();
    const lista = await this.catalogosFacade.cargarFormatosCatalogo(codigoCultivo);
    this.formatosCatalogo.set(lista ?? []);
  }

  async cargarVariedadesCatalogo(): Promise<void> {
    const lista = await this.catalogosFacade.cargarVariedadesCatalogo();
    this.variedadesCatalogo.set(lista ?? []);
  }

  async cargarTiposEmpaqueGuiaCatalogo(): Promise<void> {
    const codigoCultivo = String(this.savedConfig()?.codigoCultivo ?? '').trim();
    const lista = await this.catalogosFacade.cargarTiposEmpaqueGuiaCatalogo(codigoCultivo);
    this.tiposEmpaqueGuiaCatalogo.set(lista ?? []);
  }

  async cargarCodigosRanchoCatalogo(): Promise<void> {
    const idProyecto = String(this.savedConfig()?.idProyecto ?? '').trim();
    const lista = await this.catalogosFacade.cargarCodigosRanchoCatalogo(idProyecto);
    this.codigosRanchoCatalogo.set(lista ?? []);
  }

  async cargarLugaresProduccionCatalogo(): Promise<void> {
    const idProyecto = String(this.savedConfig()?.idProyecto ?? '').trim();
    const lista = await this.catalogosFacade.cargarLugaresProduccionCatalogo(idProyecto);
    this.lugaresProduccionCatalogo.set(lista ?? []);
  }

  async cargarTransportesCatalogo(): Promise<void> {
    const lista = await this.catalogosFacade.cargarTransportesCatalogo();
    this.transportesCatalogo.set(lista ?? []);
  }

  async cargarCampaniasCatalogo(): Promise<void> {
    const lista = await this.catalogosFacade.cargarCampaniasCatalogo();
    this.campaniasCatalogo.set(lista ?? []);
  }

  async cargarCodigosCajaCatalogo(): Promise<void> {
    const lista = await this.catalogosFacade.cargarCodigosCajaCatalogo();
    this.codigosCajaCatalogo.set(lista ?? []);
  }

  async cargarMotivosTraslado(): Promise<void> {
    const lista = await this.catalogosFacade.cargarMotivosTraslado();
    this.motivosTraslado.set(lista ?? []);
  }

  async abrirModalVerDetalle(g: GuiaRemision): Promise<void> {
    const idProyecto = String(this.savedConfig()?.idProyecto ?? '').trim();
    const codigoGuiaRemision = String(g?.codigoGuiaRemision ?? '').trim();
    if (!idProyecto || !codigoGuiaRemision) {
      this.alertService.cerrarModalCarga();
      this.alertService.showAlert('Error', 'No se pudo obtener la información de la guía.', 'error');
      return;
    }
    this.alertService.mostrarModalCarga();
    try {
      const detalleData = await this.guiaRemisionFacade.getGuiaRemisionDetalle(idProyecto, codigoGuiaRemision);

      if (!detalleData) {
        this.alertService.cerrarModalCarga();
        this.alertService.showAlert('Error', 'Error al obtener el detalle de la guía. Comuníquese con el administrador del sistema.', 'error');
        return;
      }

      if(detalleData?.error){
        this.alertService.cerrarModalCarga();
        this.alertService.showAlert('Error', detalleData?.mensaje ?? 'Error al obtener el detalle de la guía.', 'error');
        return;
      }
      this.alertService.cerrarModalCarga();
      this.guiaDetalle.set(detalleData);
      this.modalVerDetalleAbierto.set(true);
    } catch (error: any) {
      console.error('Error obteniendo detalle guía:', error);
      this.alertService.cerrarModalCarga();
      this.alertService.showAlert('Error', error?.message ?? error?.error?.message ?? 'Error al obtener detalle de la guía.', 'error');
    } 
   
  }

  private buildDetalleDescripcion(p: any, fruta: string): string {

    const s = (v: any) => String(v ?? '').trim();
    const part = (arr: (string | undefined | null)[]) => arr.map(s).filter(Boolean).join(' ');

    const bloque1 = part([p.nombreTipoProcesoEmpacado]);
    const bloque2 = part([p.nombreConsignatario, p.nombreDestino, p.nombrePresentacion, p.nombreFormato]);
    const bloque3 = part([fruta, 'var.', p.nombreVariedad, p.pesoPorCaja ? `${p.pesoPorCaja} kg` : '']);
    const bloque4 = part([p.nombreTipoEmpaqueGuia, '/', p.codigoRancho]);
    const bloque5 = part(['LDP', p.codigoLugarProduccion]);
    const bloque6 = s(p.nombreTransporte);

    const secciones = [
      bloque1,
      bloque2,
      bloque3,
      bloque4,
      bloque5,
      bloque6 ? `(${bloque6})` : undefined,
    ].filter(Boolean);

    return secciones.join(' - ');
  }

  cerrarModalVerDetalle(): void {
    this.modalVerDetalleAbierto.set(false);
    this.guiaDetalle.set(null);
  }

  async abrirModalNuevaGuia(): Promise<void> {
    this.alertService.mostrarModalCarga();
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
      this.alertService.cerrarModalCarga();
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

    const guiaPayload: GuiaRemision = {
      codigoGuiaRemision: guiaOriginal?.codigoGuiaRemision,
      codigoProceso: codigoProceso,
      transactionId_uuid: guiaOriginal?.transactionId_uuid ?? this.generateUUID(),
      documentoDestinatario: documentoFiscal || '',
      puntoPartida: String(payload.puntoPartida ?? '').trim(),
      puntoLlegada: String(payload.puntoLlegada ?? '').trim() || undefined,
      ubigeoPartida: String(payload.ubigeoPartida ?? '131202').trim(),
      ubigeoLlegada: String(payload.ubigeoLlegada ?? '131202').trim(),
      idTransportista: Number(payload.transportistaId) || null,
      idConductor: Number(payload.conductorId) || null,
      idVehiculo: Number(payload.vehiculoId) || null,
      motivoTraslado: String(payload.motivoTraslado ?? '13').trim(),
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
      this.alertService.mostrarModalCarga();
      const rawResp: any = await this.guiaRemisionFacade.editarGuiaRemision({idProyecto:idProyecto,guias:syncPayload});
      const { error, mensaje } = this.normalizeBackendResp(rawResp);
      this.alertService.cerrarModalCarga();

      if (error) {
        this.alertService.showAlertAcept('Error', mensaje || 'Error al editar la guía.', 'error');
        return;
      }
      if (mensaje) {
        this.alertService.showAlert('Info', mensaje, 'info');
      }

      this.alertService.showAlert('Éxito', 'Guía editada correctamente.', 'success');
      await this.onBuscarGuias();
    } catch (error: any) {
      this.alertService.cerrarModalCarga();
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
    this.modalInspeccionAbierto.set(false);
    this.pendingGuiaPayload.set(null);

    const guia = ev.guia;
    const inspeccion = ev.inspeccion;
    const paletsDetalle: any[] = guia.paletsDetalle ?? [];

    const cantidadPalets = paletsDetalle.length;

    const proceso = this.procesos().find(p => String((p as any)?.id ?? '').trim() === String(guia.procesoId ?? '').trim() || String((p as any)?.idProceso ?? '').trim() === String(guia.procesoId ?? '').trim());
    const codigoProceso = (proceso as any)?.idProceso ?? String(guia.procesoId ?? '').trim();

    const destinatario = this.destinatarios().find(d => String((d as any)?.id ?? '').trim() === String(guia.destinatarioId ?? '').trim());
    const documentoFiscal = String((destinatario as any)?.documentoFiscal ?? '').trim();

    const transactionId = this.generateUUID();

    const guiaPayload: GuiaRemision = {
      codigoProceso: codigoProceso,
      transactionId_uuid: transactionId,
      documentoDestinatario: documentoFiscal || '',
      puntoPartida: String(guia.puntoPartida ?? '').trim(),
      puntoLlegada: String(guia.puntoLlegada ?? '').trim() || undefined,
      ubigeoPartida: String(guia.ubigeoPartida ?? '131202').trim(),
      ubigeoLlegada: String(guia.ubigeoLlegada ?? '131202').trim(),
      idTransportista: Number(guia.transportistaId) || null,
      idConductor: Number(guia.conductorId) || null,
      idVehiculo: Number(guia.vehiculoId) || null,
      motivoTraslado: String(guia.motivoTraslado ?? '13').trim(),
      fechaEntregaBienes: String(guia.fechaEntregaBienes ?? '').trim() || formatDate(new Date()),
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

      this.alertService.showAlert('Éxito', 'Guía guardada localmente (sin sincronizar).', 'success');
      await this.cargarProcesosParaGuia();
      await this.onBuscarGuias();
      return;
    }

    try {
      this.alertService.mostrarModalCarga();
      const rawResp: any = await firstValueFrom(this.guiaService.sincronizarGuiasRemision(syncPayload));
      const { error, mensaje } = this.normalizeBackendResp(rawResp);
      this.alertService.cerrarModalCarga();

      if (error) {
        this.alertService.showAlertAcept('Error', mensaje || 'Error al sincronizar guía.', 'error');
        return;
      }
      if (mensaje) {
        this.alertService.showAlert('Info', mensaje, 'info');
      }

      this.alertService.showAlert('Éxito', 'Guía sincronizada correctamente.', 'success');
      await this.cargarProcesosParaGuia();
      await this.onBuscarGuias();
    } catch (error: any) {
      console.error('Error sincronizando guía:', error);
      this.alertService.cerrarModalCarga();
      this.alertService.showAlertAcept('Error', error?.error?.message ?? 'Error al sincronizar guía.', 'error');
    }
  }

  cerrarModalInspeccion(): void {
    this.modalInspeccionAbierto.set(false);
    this.pendingGuiaPayload.set(null);
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

    this.alertService.mostrarModalCarga();
    try {
      const resultado = await this.guiaRemisionFacade.sincronizarGuiasOffline(idProyecto);
      this.alertService.cerrarModalCarga();
      if (resultado.success) {
        this.alertService.showAlert('Éxito', resultado.mensaje, 'success');
        await this.onBuscarGuias();
      } else {
        this.alertService.showAlert('Error', resultado.mensaje, 'error');
      }
    } catch (error: any) {
      this.alertService.cerrarModalCarga();
      this.alertService.showAlert('Error', error?.message ?? 'Error al sincronizar guías.', 'error');
    }
  }

  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}

















