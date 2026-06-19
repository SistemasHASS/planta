import { Component, ChangeDetectionStrategy, inject, signal, computed, OnInit } from '@angular/core';
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
import { formatDateTime, toLocalISOString } from '../../shared/utils/datetime.utils';

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
        const nombreProces = fechaProceso && turno ? `${fechaProceso} - ${turno}` : (fechaProceso || turno || codigoProceso);

        const documentoDest = String(g?.documentoDestinatario ?? '').trim();
        const destinatario = destinatarios.find((d: any) => {
          const dDoc = String(d?.documentoFiscal ?? '').trim();
          return dDoc === documentoDest;
        });
        const nombreDestinatario = String((destinatario as any)?.nombre ?? '').trim();

        return {
          ...g,
          nombreProces,
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
          const nombreProceso = String(detalleData?.nombreProceso ?? detalleData?.nombreProces ?? '').trim();

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
        transportistaId: String(detalleData?.idTransportista ?? ''),
        conductorId: String(detalleData?.idConductor ?? ''),
        vehiculoId: String(detalleData?.idVehiculo ?? ''),
        motivoTraslado: detalleData?.motivoTraslado ?? 'OTROS',
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

  async abrirModalVerDetalle(g: GuiaRemision): Promise<void> {
    const idProyecto = String(this.savedConfig()?.idProyecto ?? '').trim();
    const codigoGuiaRemision = String(g?.codigoGuiaRemision ?? '').trim();
    if (!idProyecto || !codigoGuiaRemision) {
      this.alertService.showAlert('Error', 'No se pudo obtener la información de la guía.', 'error');
      return;
    }
    this.alertService.mostrarModalCarga();
    try {
      const detalleData = await this.guiaRemisionFacade.getGuiaRemisionDetalle(idProyecto, codigoGuiaRemision);
      console.log('detalleData',detalleData)
      if (!detalleData) {
        this.alertService.showAlert('Error', 'Error al obtener detalle de la guía.', 'error');
        return;
      }

      await this.cargarTransportistas();
      await this.cargarConductores();
      await this.cargarVehiculos();
      await this.cargarProcesosCatalogo();
      await this.cargarDestinatarios();
      await this.cargarTipoProcesoEmpacadosCatalogo();
      await this.cargarConsignatariosCatalogo();
      await this.cargarDestinosCatalogo();
      await this.cargarPresentacionesCatalogo();
      await this.cargarFormatosCatalogo();
      await this.cargarVariedadesCatalogo();
      await this.cargarTiposEmpaqueGuiaCatalogo();
      await this.cargarCodigosRanchoCatalogo();
      await this.cargarLugaresProduccionCatalogo();
      await this.cargarTransportesCatalogo();
      await this.cargarCampaniasCatalogo();

      const campania = this.campaniasCatalogo().find((c: any) => String(c?.idproyecto ?? '') === idProyecto);
      const fruta = String((campania as any)?.fruta ?? '').trim();

      const idTrans = Number(detalleData?.idTransportista);
      const idCond = Number(detalleData?.idConductor);
      const idVehi = Number(detalleData?.idVehiculo);

      const transportista = idTrans ? this.transportistas().find((t: any) => Number(t?.id) === idTrans) : undefined;
      const conductor = idCond ? this.conductores().find((c: any) => Number(c?.id) === idCond) : undefined;
      const vehiculo = idVehi ? this.vehiculos().find((v: any) => Number(v?.id) === idVehi) : undefined;

      detalleData.razonSocialTransportista = String((transportista as any)?.razonSocial ?? '').trim() || undefined;
      detalleData.nombreConductor = String((conductor as any)?.nombreCompleto ?? '').trim() || undefined;
      detalleData.placaPrincipalVehiculo = String((vehiculo as any)?.placaPrincipal ?? '').trim() || undefined;

      const codigoProceso = String(detalleData?.codigoProceso ?? '').trim();
      const proceso = this.procesosCatalogo().find((p: any) => {
        const pId = String(p?.idProceso ?? p?.codigoProceso ?? p?.id ?? '').trim();
        return pId === codigoProceso;
      });
      const fechaProceso = String((proceso as any)?.fechaProceso ?? '').trim();
      const turno = String((proceso as any)?.turno ?? '').trim();
      detalleData.nombreProces = fechaProceso && turno ? `${fechaProceso} - ${turno}` : (fechaProceso || turno || codigoProceso);

      const documentoDest = String(detalleData?.documentoDestinatario ?? '').trim();
      const destinatario = this.destinatarios().find((d: any) => {
        const dDoc = String(d?.documentoFiscal ?? '').trim();
        return dDoc === documentoDest;
      });
      detalleData.nombreDestinatario = String((destinatario as any)?.nombre ?? '').trim() || undefined;

      // Enriquecer detalle de palets
      const palets = Array.isArray(detalleData?.detalle) ? detalleData.detalle : [];
      console.log('1----1',palets)
      for (const p of palets) {
        const codTpe = String(p?.codigoTipoProcesoEmpacado ?? '').trim();
        const tpe = codTpe ? this.tipoProcesoEmpacadosCatalogo().find((x: any) => String(x?.codigo ?? '') === codTpe || String(x?.id ?? '') === codTpe) : undefined;
        p.nombreTipoProcesoEmpacado = String((tpe as any)?.codigo ?? '').trim() || undefined;

        const docCons = String(p?.documentoConsignatario ?? '').trim();
        const cons = docCons ? this.consignatariosCatalogo().find((x: any) => String(x?.documento ?? '') === docCons || String(x?.documentoFiscal ?? '') === docCons) : undefined;
        p.nombreConsignatario = String((cons as any)?.nombre ?? '').trim() || undefined;

        const idDest = String(p?.idDestino ?? '').trim();
        const dest = idDest ? this.destinosCatalogo().find((x: any) => String(x?.id ?? '') === idDest) : undefined;
        p.nombreDestino = String((dest as any)?.pais ?? (dest as any)?.nacionalidad ?? '').trim() || undefined;

        const idPres = Number(p?.idPresentacion ?? NaN);
        const pres = !isNaN(idPres) ? this.presentacionesCatalogo().find((x: any) => Number(x?.id ?? NaN) === idPres || String(x?.codigo ?? '') === String(idPres)) : undefined;
        p.nombrePresentacion = String((pres as any)?.nombre ?? '').trim() || undefined;

        const idForm = Number(p?.codigoFormato ?? NaN);
        const form = !isNaN(idForm) ? this.formatosCatalogo().find((x: any) => Number(x?.id ?? NaN) === idForm || String(x?.id ?? '') === String(idForm)) : undefined;
        p.nombreFormato = String((form as any)?.descripcion ?? '').trim() || undefined;

        const codVar = String(p?.codigoVariedad ?? '').trim();
        const vari = codVar ? this.variedadesCatalogo().find((x: any) => String(x?.codigo ?? '') === codVar) : undefined;
        p.nombreVariedad = String((vari as any)?.variedad ?? '').trim() || undefined;

        const idTeg = Number(p?.idTipoEmpaqueGuia ?? NaN);
        const teg = !isNaN(idTeg) ? this.tiposEmpaqueGuiaCatalogo().find((x: any) => Number(x?.id ?? NaN) === idTeg || String(x?.codigo ?? '') === String(idTeg)) : undefined;
        p.nombreTipoEmpaqueGuia = String((teg as any)?.nombre ?? '').trim() || undefined;

        const codRan = String(p?.codigoRancho ?? '').trim();
        let ran: any;
        if (codRan) {
          ran = this.codigosRanchoCatalogo().find((x: any) => String(x?.codigo ?? '') === codRan);
          if (!ran) ran = this.codigosRanchoCatalogo().find((x: any) => Number(x?.id ?? NaN) === Number(codRan));
        }
        p.codigoRancho = String((ran as any)?.codigo ?? '').trim() || undefined;

        const idLp = Number(p?.idLugarProduccion ?? NaN);
        const lp = !isNaN(idLp) ? this.lugaresProduccionCatalogo().find((x: any) => Number(x?.id ?? NaN) === idLp) : undefined;
        p.codigoLugarProduccion = String((lp as any)?.codigo ?? '').trim() || undefined;

        const idTran = String(p?.idTransporte ?? '').trim();
        const tran = idTran ? this.transportesCatalogo().find((x: any) => String(x?.id ?? '') === idTran) : undefined;
        p.nombreTransporte = String((tran as any)?.transporte ?? '').trim() || undefined;

        p.detalleDescripcion = this.buildDetalleDescripcion(p, fruta);
      }

      this.guiaDetalle.set(detalleData);
      this.modalVerDetalleAbierto.set(true);
    } catch (error: any) {
      console.error('Error obteniendo detalle guía:', error);
      this.alertService.showAlert('Error', error?.error?.message ?? 'Error al obtener detalle de la guía.', 'error');
    } finally {
      this.alertService.cerrarModalCarga();
    }
  }

  cerrarModalVerDetalle(): void {
    this.modalVerDetalleAbierto.set(false);
    this.guiaDetalle.set(null);
  }

  private buildDetalleDescripcion(p: any, fruta: string): string {
    console.log('Hola mundo',p)
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
      idTransportista: Number(payload.transportistaId) || null,
      idConductor: Number(payload.conductorId) || null,
      idVehiculo: Number(payload.vehiculoId) || null,
      motivoTraslado: String(payload.motivoTraslado ?? 'OTROS').trim(),
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
      idTransportista: Number(guia.transportistaId) || null,
      idConductor: Number(guia.conductorId) || null,
      idVehiculo: Number(guia.vehiculoId) || null,
      motivoTraslado: String(guia.motivoTraslado ?? 'OTROS').trim(),
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

















