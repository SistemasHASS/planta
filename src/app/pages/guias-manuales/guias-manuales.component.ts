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
import { ModalNuevaGuiaManualComponent } from './components/modal-nueva-guia-manual/modal-nueva-guia-manual.component';
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
  selector: 'app-guias-manuales',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModalNuevaGuiaManualComponent, ModalVerDetalleGuiaComponent, FormsModule],
  templateUrl: './guias-manuales.component.html',
  styleUrl: './guias-manuales.component.scss'
})
export class GuiasManualesComponent implements OnInit {
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
  readonly esAdmin = computed(() => this.auth.perfil() === 'ADMINISTRADOR');
  readonly modalNuevaGuiaManualVisible = signal(false);

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

      const resp = await firstValueFrom(this.guiaService.listarGuiasRemisionManual(idProyectoFinal, estado, fechaDesde, fechaHasta, texto));
      const { error, mensaje, data } = this.normalizeBackendResp(resp);
      if (error) {
        this.alertService.showAlert('Error', mensaje, 'error');
        return;
      }
      const guiasRaw = data ?? [];

      await this.cargarDestinatarios();
      const destinatarios = this.destinatarios();

      const guiasEnriquecidas = guiasRaw.map((g: any) => {
        const documentoDest = String(g?.documentoDestinatario ?? '').trim();
        const destinatario = destinatarios.find((d: any) => {
          const dDoc = String(d?.documentoFiscal ?? '').trim();
          return dDoc === documentoDest;
        });
        const nombreDestinatario = String((destinatario as any)?.nombre ?? '').trim();

        return {
          ...g,
          nombreDestinatario,
        };
      });

      this.guias.set(guiasEnriquecidas);
      this.alertService.cerrarModalCarga();
    } catch (error: any) {
      console.error('Error listando guías manuales:', error);
      this.alertService.showAlert('Error', error?.error?.message ?? 'Error al listar guías manuales.', 'error');
    } finally {
      this.isLoading.set(false);
    }
  }

  async exportarExcel(): Promise<void> {
    const idProyecto = String(this.savedConfig()?.idProyecto ?? '').trim();
    if (!idProyecto) {
      this.alertService.showAlert('Error', 'No se encontró la configuración del proyecto.', 'error');
      return;
    }
    this.alertService.mostrarModalCarga();
    try {
      const estado = this.filtroEstado().trim() || null;
      const texto = this.filtroTexto().trim() || null;
      const fechaDesde = this.filtroFechaDesde().trim() || null;
      const fechaHasta = this.filtroFechaHasta().trim() || null;

      const blob = await firstValueFrom(this.guiaService.exportarGuiasRemisionExcel(idProyecto, estado, fechaDesde, fechaHasta, texto));
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `guias-remision-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      this.alertService.cerrarModalCarga();
    } catch (error: any) {
      console.error('Error exportando Excel:', error);
      this.alertService.showAlert('Error', error?.error?.message ?? 'Error al exportar el Excel.', 'error');
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
  pdfCargando = signal(true);
  modalAdvertenciaAnulacionAbierto = signal(false);
  guiaAnularPendiente = signal<GuiaRemision | null>(null);
  pdfUrlSegura = computed<SafeResourceUrl | null>(() => {
    const url = this.pdfUrlRaw();
    if (!url) return null;
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  });

  abrirPdfModal(url: string | null | undefined): void {
    if (!url) {
      this.alertService.showAlertAcept(
        'PDF no disponible',
        'Aún no se ha generado el archivo PDF de SUNAT. Consulte el estado SUNAT con el botón <i class="bi bi-arrow-clockwise"></i> para actualizar la guía y obtener el PDF.',
        'warning'
      );
      return;
    }
    this.pdfCargando.set(true);
    this.pdfUrlRaw.set(url);
    this.pdfModalAbierto.set(true);
  }

  cerrarPdfModal(): void {
    this.pdfModalAbierto.set(false);
    this.pdfUrlRaw.set(null);
  }

  onPdfCargado(): void {
    this.pdfCargando.set(false);
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
      const resp = await firstValueFrom(this.guiaService.getGuiaRemisionManual(idProyecto, codigoGuiaRemision));
      const { error, mensaje, data } = this.normalizeBackendResp(resp);

      if (error) {
        this.alertService.cerrarModalCarga();
        this.alertService.showAlert('Error', mensaje, 'error');
        return;
      }

      const detalleData = Array.isArray(data) ? data[0] : data;

      if (!detalleData) {
        this.alertService.cerrarModalCarga();
        this.alertService.showAlert('Error', 'No se encontró el detalle de la guía manual.', 'error');
        return;
      }

      await this.cargarTransportistas();
      await this.cargarConductores();
      await this.cargarVehiculos();
      await this.cargarDestinatarios();
      await this.cargarMotivosTraslado();

      const documentoDest = String(detalleData?.documentoDestinatario ?? '').trim();
      const destinatarioEncontrado = this.destinatarios().find((d: any) => {
        const dDoc = String(d?.documentoFiscal ?? '').trim();
        return dDoc === documentoDest;
      });
      const destinatarioId = String((destinatarioEncontrado as any)?.id ?? '').trim();

      const detalleItems = Array.isArray(detalleData?.detalle) ? detalleData.detalle : [];

      this.guiaParaEditar.set({
        destinatarioId,
        puntoPartida: detalleData?.puntoPartida ?? '',
        puntoLlegada: detalleData?.puntoLlegada ?? '',
        ubigeoPartida: detalleData?.ubigeoPartida ?? '131202',
        ubigeoLlegada: detalleData?.ubigeoLlegada ?? '131202',
        transportistaId: String(detalleData?.idTransportista ?? ''),
        conductorId: String(detalleData?.idConductor ?? ''),
        vehiculoId: String(detalleData?.idVehiculo ?? ''),
        motivoTraslado: detalleData?.motivoTraslado ?? '13',
        descripcionMotivoTraslado: detalleData?.descripcionMotivoTraslado ?? '',
        fechaEntregaBienes: detalleData?.fechaEntregaBienes ?? '',
        precinto: detalleData?.precinto ?? '',
        observacionesUsuario: detalleData?.observacionesUsuario ?? '',
        codigoGuiaRemision: detalleData?.codigoGuiaRemision,
        transactionId_uuid: detalleData?.transactionId_uuid,
        fechaCreacionWeb: detalleData?.fechaCreacionWeb,
        estado: detalleData?.estado,
        detalleManual: detalleItems.map((d: any) => ({
          id: d.id,
          descripcion: d.descripcion ?? '',
          codigoUnidadMedida: d.codigoUnidadMedida ?? 'NIU',
          cantidad: d.cantidad ?? 0,
          pesoEstimado: d.pesoEstimado ?? 0,
          codigoItem: d.codigoItem ?? '',
        })),
      });

      this.modoEdicionGuia.set(true);
      this.modalNuevaGuiaManualVisible.set(true);
    } catch (error: any) {
      console.error('Error preparando edición guía manual:', error);
      this.alertService.cerrarModalCarga();
      this.alertService.showAlert('Error', error?.error?.message ?? 'Error al preparar la edición de la guía manual.', 'error');
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
      let resp: any = await firstValueFrom(this.guiaService.emitirGuiaRemisionManual(idProyecto, codigoGuiaRemision));
      if (Array.isArray(resp) && resp.length > 0) {
        resp = resp[0];
      }
      await this.onBuscarGuias();
      if (resp?.error) {
        this.alertService.showAlertAcept('Error', resp?.mensaje ?? 'Error al emitir la guía.', 'error');
      } else {
        this.alertService.showAlert('Éxito', 'Guía emitida y numerada correctamente.', 'success');
      }
    } catch (error: any) {
      console.error('Error emitiendo guía:', error);
      this.alertService.showAlert('Error', error?.error?.message ?? 'Error al emitir la guía.', 'error');
    } finally {
      // this.alertService.cerrarModalCarga();
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
      let resp: any = await firstValueFrom(this.guiaService.consultarEstadoSunatGuiaRemisionManual(idProyecto, codigoGuiaRemision));
      if (Array.isArray(resp) && resp.length > 0) {
        resp = resp[0];
      }
      await this.onBuscarGuias();
      if (resp?.error) {
        this.alertService.showAlertAcept('Error', resp?.mensaje ?? 'Error al consultar el estado SUNAT.', 'error');
      } else {
        const mensaje = resp?.data?.mensajeSunat ?? resp?.mensaje ?? 'Estado actualizado correctamente.';
        this.alertService.showAlertAcept('Estado SUNAT', mensaje, 'success');
      }
    } catch (error: any) {
      console.error('Error consultando estado SUNAT:', error);
      this.alertService.showAlert('Error', error?.error?.message ?? 'Error al consultar el estado SUNAT.', 'error');
    }
  }

  async reenviarGuia(g: GuiaRemision): Promise<void> {
    const confirmado = await this.alertService.showConfirm(
      'Confirmar reenvío',
      `¿Está seguro de reenviar la guía <strong>${g.serie ?? ''}-${g.numero ?? ''}</strong> (${g.codigoGuiaRemision}) a SUNAT?`,
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
      let resp: any = await firstValueFrom(this.guiaService.reenviarGuiaRemisionManual(idProyecto, codigoGuiaRemision));
      if (Array.isArray(resp) && resp.length > 0) {
        resp = resp[0];
      }
      await this.onBuscarGuias();
      if (resp?.error) {
        this.alertService.showAlertAcept('Error', resp?.mensaje ?? 'Error al reenviar la guía.', 'error');
      } else {
        this.alertService.showAlert('Éxito', 'Guía reenviada correctamente.', 'success');
      }
    } catch (error: any) {
      console.error('Error reenviando guía:', error);
      this.alertService.showAlert('Error', error?.error?.message ?? 'Error al reenviar la guía.', 'error');
    } finally {
      // this.alertService.cerrarModalCarga();
    }
  }

  async anularGuia(g: GuiaRemision): Promise<void> {
    const confirmado = await this.alertService.showConfirm(
      'Confirmar anulación',
      `¿Está seguro de anular la guía <strong>${g.serie ?? ''}-${g.numero ?? ''}</strong> (${g.codigoGuiaRemision})?`,
      'warning'
    );
    if (!confirmado) return;

    this.guiaAnularPendiente.set(g);
    this.modalAdvertenciaAnulacionAbierto.set(true);
  }

  cerrarAdvertenciaAnulacion(): void {
    this.modalAdvertenciaAnulacionAbierto.set(false);
    this.guiaAnularPendiente.set(null);
  }

  async ejecutarAnulacion(): Promise<void> {
    const g = this.guiaAnularPendiente();
    if (!g) return;

    this.modalAdvertenciaAnulacionAbierto.set(false);
    this.guiaAnularPendiente.set(null);

    const idProyecto = String(this.savedConfig()?.idProyecto ?? '').trim();
    const codigoGuiaRemision = String(g?.codigoGuiaRemision ?? '').trim();
    if (!idProyecto || !codigoGuiaRemision) {
      this.alertService.showAlert('Error', 'No se pudo obtener la información de la guía.', 'error');
      return;
    }

    this.alertService.mostrarModalCarga();
    try {
      let resp: any = await firstValueFrom(this.guiaService.anularGuiaRemisionManual(idProyecto, codigoGuiaRemision));
      if (Array.isArray(resp) && resp.length > 0) {
        resp = resp[0];
      }
      this.alertService.cerrarModalCarga();
      if (resp?.error) {
        this.alertService.showAlert('Error', resp?.mensaje ?? 'Error al anular la guía.', 'error');
        return;
      }
      this.alertService.showAlertAcept('Éxito', 'Guía anulada correctamente.', 'success');
      await this.onBuscarGuias();
    } catch (error: any) {
      this.alertService.cerrarModalCarga();
      console.error('Error anulando guía:', error);
      this.alertService.showAlert('Error', error?.error?.message ?? 'Error al anular la guía.', 'error');
    }
  }

  async eliminarGuia(g: GuiaRemision): Promise<void> {
    const msg = `
      <div style="text-align:left;font-size:14px;color:#334155;line-height:1.6;">
        <p style="margin-bottom:12px;">¿Está seguro de eliminar esta guía manual?</p>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px;margin-bottom:12px;">
          <div style="font-size:18px;font-weight:700;color:#0f172a;margin-bottom:10px;">
            ${g.codigoGuiaRemision ?? ''}
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px 16px;">
            <div><span style="color:#64748b;font-size:12px;">Cantidad</span><br><strong>${g.cantidad ?? 0}</strong></div>
            <div><span style="color:#64748b;font-size:12px;">Peso</span><br><strong>${g.pesoTotal ?? 0} kg</strong></div>
            <div><span style="color:#64748b;font-size:12px;">Precinto</span><br><strong>${g.precinto ?? '—'}</strong></div>
            <div><span style="color:#64748b;font-size:12px;">Estado</span><br><strong>${g.estado ?? '—'}</strong></div>
          </div>
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
      let resp: any = await firstValueFrom(this.guiaService.eliminarGuiaRemisionManual(idProyecto, codigoGuiaRemision));
      if (Array.isArray(resp) && resp.length > 0) {
        resp = resp[0];
      }
      if (resp?.error) {
        this.alertService.showAlert('Error', resp?.mensaje ?? 'Error al eliminar la guía manual.', 'error');
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
      let resp: any = await firstValueFrom(this.guiaService.anularGuiaRemisionManual(idProyecto, codigo));
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
      const resp = await firstValueFrom(this.guiaService.getGuiaRemisionManual(idProyecto, codigoGuiaRemision));
      const { error, mensaje, data } = this.normalizeBackendResp(resp);
      if (error) {
        this.alertService.cerrarModalCarga();
        this.alertService.showAlert('Error', mensaje, 'error');
        return;
      }

      this.alertService.cerrarModalCarga();
      const guiaData = Array.isArray(data) && data.length > 0 ? data[0] : data;
      if (!guiaData || typeof guiaData !== 'object') {
        this.alertService.showAlert('Error', 'No se encontró el detalle de la guía.', 'error');
        return;
      }
      this.guiaDetalle.set(guiaData);
      this.modalVerDetalleAbierto.set(true);
    } catch (error: any) {
      console.error('Error obteniendo detalle guía manual:', error);
      this.alertService.cerrarModalCarga();
      this.alertService.showAlert('Error', error?.error?.message ?? 'Error al obtener detalle de la guía.', 'error');
    }

  }

  cerrarModalVerDetalle(): void {
    this.modalVerDetalleAbierto.set(false);
    this.guiaDetalle.set(null);
  }

  async abrirModalNuevaGuiaManual(): Promise<void> {
    this.alertService.mostrarModalCarga();
    try {
      if (!this.savedConfig()) {
        await this.cargarConfiguracion();
      }
      await Promise.all([
        this.cargarTransportistas(),
        this.cargarConductores(),
        this.cargarVehiculos(),
        this.cargarDestinatarios(),
        this.cargarMotivosTraslado(),
      ]);
      this.modalNuevaGuiaManualVisible.set(true);
      this.alertService.cerrarModalCarga();
    } catch (err: any) {
      console.error('Error cargando catálogos guía manual:', err);
      this.alertService.showAlert('Error', err?.error?.message ?? 'Error al cargar catálogos', 'error');
    }
  }

  cerrarModalNuevaGuiaManual(): void {
    this.modalNuevaGuiaManualVisible.set(false);
    this.modoEdicionGuia.set(false);
    this.guiaParaEditar.set(null);
  }

  async onCrearGuiaManual(payload: any): Promise<void> {
    const idProyecto = String(this.savedConfig()?.idProyecto ?? '').trim();
    if (!idProyecto) {
      this.alertService.showAlert('Error', 'No se encontró el proyecto.', 'error');
      return;
    }
    if (!this.online) {
      this.alertService.showAlert('Error', 'No hay conexión a internet.', 'error');
      return;
    }

    const destinatario = this.destinatarios().find(d => String((d as any)?.id ?? '').trim() === String(payload.destinatarioId ?? '').trim());
    const documentoDestinatario = String((destinatario as any)?.documentoFiscal ?? '').trim();

    const guiaPayload = {
      ...payload,
      documentoDestinatario,
      estado: 'ABIERTA'
    };
    delete (guiaPayload as any).destinatarioId;

    this.alertService.mostrarModalCarga();
    try {
      const resp = await firstValueFrom(this.guiaService.sincronizarGuiaRemisionManual({ idProyecto, guias: [guiaPayload] }));
      const { error, mensaje, data } = this.normalizeBackendResp(resp);
      this.alertService.cerrarModalCarga();
      if (error) {
        this.alertService.showAlert('Error', mensaje, 'error');
        return;
      }
      this.alertService.showAlert('Éxito', mensaje || 'Guía manual registrada correctamente.', 'success');
      this.modalNuevaGuiaManualVisible.set(false);
      await this.onBuscarGuias();
    } catch (err: any) {
      this.alertService.cerrarModalCarga();
      console.error('Error guardando guía manual:', err);
      this.alertService.showAlert('Error', err?.error?.mensaje ?? err?.message ?? 'Error al guardar la guía manual.', 'error');
    }
  }

  async onEditarGuiaManual(payload: any): Promise<void> {
    this.alertService.mostrarModalCarga();
    try {
      const idProyecto = String(this.savedConfig()?.idProyecto ?? '').trim();
      if (!idProyecto) {
        this.alertService.cerrarModalCarga();
        this.alertService.showAlert('Error', 'No se encontró la configuración del proyecto.', 'error');
        return;
      }
      const resp = await firstValueFrom(this.guiaService.editarGuiaRemisionManual(idProyecto, payload));
      const { error, mensaje } = this.normalizeBackendResp(resp);

      this.alertService.cerrarModalCarga();

      if (error) {
        this.alertService.showAlert('Error', mensaje, 'error');
        return;
      }

      this.alertService.showAlert('Éxito', mensaje || 'Guía manual editada correctamente.', 'success');
      this.modalNuevaGuiaManualVisible.set(false);
      this.modoEdicionGuia.set(false);
      this.guiaParaEditar.set(null);
      await this.onBuscarGuias();
    } catch (err: any) {
      this.alertService.cerrarModalCarga();
      console.error('Error editando guía manual:', err);
      this.alertService.showAlert('Error', err?.error?.mensaje ?? err?.message ?? 'Error al editar la guía manual.', 'error');
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
      descripcionMotivoTraslado: String(guia.descripcionMotivoTraslado ?? '').trim() || undefined,
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

















