import { Component, ChangeDetectionStrategy, inject, signal, OnInit } from '@angular/core';
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
import { ProcesoRepository } from '../../shared/dexiedb/repository/proceso.repository';
import { CatalogosRepository } from '../../shared/dexiedb/repository/catalogos.repository';
import { CatalogosOperativosRepository } from '../../shared/dexiedb/repository/catalogos-operacionales.repository';
import { formatDateTime } from '../../shared/utils/datetime.utils';

type ViewPage = 'procesos' | 'guias' | 'detalle';

@Component({
  selector: 'app-guias',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModalNuevaGuiaComponent, ModalInspeccionComponent, FormsModule],
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
  private readonly auth = inject(AuthService);

  get online(): boolean {
    return this.connectivity.isOnline();
  }

  currentView = signal<ViewPage>('procesos');
  procesos = signal<Proceso[]>([]);
  procesoSeleccionado = signal<Proceso | null>(null);
  guias = signal<GuiaRemision[]>([]);
  guiaSeleccionada = signal<GuiaRemision | null>(null);
  isLoading = signal(false);
  modalNuevaGuiaAbierto = signal(false);
  modalInspeccionAbierto = signal(false);
  isLoadingModalProcesos = signal(false);

  pendingGuiaPayload = signal<any>(null);

  readonly savedConfig = signal<Configuracion | null>(null);
  readonly transportistas = signal<Transportista[]>([]);
  readonly conductores = signal<Conductor[]>([]);
  readonly vehiculos = signal<Vehiculo[]>([]);
  readonly destinatarios = signal<any[]>([]);
  readonly procesosCatalogo = signal<any[]>([]);

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
    void this.onBuscarGuias();
  }

  async onBuscarGuias(): Promise<void> {
    if (!this.online) {
      this.alertService.showAlert('Error', 'No tiene conexión a internet', 'error');
      return;
    }
    const idProyecto = String(this.savedConfig()?.idProyecto ?? '').trim();
    if (!idProyecto) {
      await this.cargarConfiguracion();
      const idProyecto2 = String(this.savedConfig()?.idProyecto ?? '').trim();
      if (!idProyecto2) {
        this.alertService.showAlert('Error', 'No se encontró la configuración del proyecto.', 'error');
        return;
      }
    }
    this.alertService.mostrarModalCarga();
    try {
      this.isLoading.set(true);
      const estado = this.filtroEstado().trim() || null;
      const texto = this.filtroTexto().trim() || null;
      const fechaDesde = this.filtroFechaDesde().trim() || null;
      const fechaHasta = this.filtroFechaHasta().trim() || null;
      const idProyectoFinal = String(this.savedConfig()?.idProyecto ?? '').trim();
      let resp: any = await firstValueFrom(this.guiaService.listarGuiasRemision(idProyectoFinal, estado, fechaDesde, fechaHasta, texto));
      if (Array.isArray(resp) && resp.length > 0) {
        resp = resp[0];
      }
      if (resp?.error) {
        this.alertService.showAlert('Error', resp?.mensaje ?? 'Error al listar guías.', 'error');
        return;
      }
      const data = resp?.data ?? [];
      const guiasRaw = Array.isArray(data) ? data : [];

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
    } catch (error: any) {
      console.error('Error listando guías:', error);
      this.alertService.showAlert('Error', error?.error?.message ?? 'Error al listar guías.', 'error');
    } finally {
      this.isLoading.set(false);
      this.alertService.cerrarModalCarga();
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

  seleccionarProceso(p: Proceso): void {
    // this.procesoSeleccionado.set(p);
    // this.currentView.set('guias');
    // this.cargarGuias(p.id);
  }

  cargarGuias(procesoId: number): void {
    this.isLoading.set(true);
    // this.guiaService.listarPorProceso(procesoId).subscribe({
    //   next: (res) => { this.guias.set(res.data ?? []); this.isLoading.set(false); },
    //   error: () => this.isLoading.set(false)
    // });
  }

  verDetalle(g: GuiaRemision): void {
    // this.guiaService.obtenerPorId(g.codigoGuiaRemision).subscribe({
    //   next: (res) => {
    //     this.guiaSeleccionada.set(res.data);
    //     this.currentView.set('detalle');
    //   }
    // });
  }

  cerrarGuia(g: GuiaRemision): void {
    // this.guiaService.cerrar(g.codigoGuiaRemision).subscribe({
    //   next: () => { const p = this.procesoSeleccionado(); if (p) this.cargarGuias(p.id); }
    // });
  }

  anularGuia(g: GuiaRemision): void {
    // this.guiaService.anular(g.codigoGuiaRemision).subscribe({
    //   next: () => { const p = this.procesoSeleccionado(); if (p) this.cargarGuias(p.id); }
    // });
  }

  eliminarGuia(g: GuiaRemision): void {
    // this.guiaService.eliminar(g.codigoGuiaRemision).subscribe({
    //   next: () => { const p = this.procesoSeleccionado(); if (p) this.cargarGuias(p.id); }
    // });
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
    if (this.online) {
      return await firstValueFrom(this.guiaService.listarProcesosGuia());
    }

    const procesos = await this.procesoRepo.procesosRepo.getAll();
    const abiertos = (procesos ?? []).filter((p: any) => String(p?.estado ?? '').trim().toUpperCase() === 'ABIERTO');

    const resultado: any[] = [];
    for (const pro of abiertos) {
      const idProceso = String((pro as any)?.idProceso ?? '').trim();
      if (!idProceso) continue;

      const palets = await this.procesoRepo.paletsRepo.getByIdProceso(idProceso);
      const paletsCerrados = (palets ?? []).filter((p: any) => {
        const estado = String(p?.estado ?? '').trim().toUpperCase();
        const eliminado = !!(p as any)?.eliminado;
        return (estado === 'CERRADO_COMPLETO' || estado === 'CERRADO_SALDO') && !eliminado;
      });

      if (paletsCerrados.length > 0) {
        resultado.push({
          ...pro,
          nroPalets: paletsCerrados.length,
          palets: paletsCerrados,
        });
      }
    }

    return [
      {
        error: false,
        mensaje: 'Procesos obtenidos correctamente.',
        data: resultado,
      },
    ];
  }

  async cargarTransportistas(): Promise<void> {
    const idProyecto = String(this.savedConfig()?.idProyecto ?? '').trim();
    if (this.online) {
      try {
        const resp: any = await firstValueFrom(this.catalogoService.listarTransportistas(idProyecto));
        if (!resp.error) {
          if (resp.data?.length > 0) {
            const dexiedb = await this.catalogosOperativosRepo.transportistasRepo.getAll();
            if (dexiedb.length > 0) await this.catalogosOperativosRepo.transportistasRepo.clear();
            for (const t of resp.data) {
              (t as any).bd = 1;
              await this.catalogosOperativosRepo.transportistasRepo.save(t);
            }
            this.transportistas.set(resp.data);
          } else {
            const dexiedb = await this.catalogosOperativosRepo.transportistasRepo.getAll();
            if (dexiedb.length > 0) await this.catalogosOperativosRepo.transportistasRepo.clear();
            this.transportistas.set([]);
          }
        }
      } catch (error) {
        console.log('Error obteniendo transportistas', error);
      }
    } else {
      const lista = await this.catalogosOperativosRepo.transportistasRepo.getAll();
      this.transportistas.set(lista ?? []);
    }
  }

  async cargarConductores(): Promise<void> {
    const idProyecto = String(this.savedConfig()?.idProyecto ?? '').trim();
    if (this.online) {
      try {
        const resp: any = await firstValueFrom(this.catalogoService.listarConductores(idProyecto));
        if (!resp.error) {
          if (resp.data?.length > 0) {
            const dexiedb = await this.catalogosOperativosRepo.conductoresRepo.getAll();
            if (dexiedb.length > 0) await this.catalogosOperativosRepo.conductoresRepo.clear();
            for (const c of resp.data) {
              (c as any).bd = 1;
              await this.catalogosOperativosRepo.conductoresRepo.save(c);
            }
            this.conductores.set(resp.data);
          } else {
            const dexiedb = await this.catalogosOperativosRepo.conductoresRepo.getAll();
            if (dexiedb.length > 0) await this.catalogosOperativosRepo.conductoresRepo.clear();
            this.conductores.set([]);
          }
        }
      } catch (error) {
        console.log('Error obteniendo conductores', error);
      }
    } else {
      const lista = await this.catalogosOperativosRepo.conductoresRepo.getAll();
      this.conductores.set(lista ?? []);
    }
  }

  async cargarVehiculos(): Promise<void> {
    const idProyecto = String(this.savedConfig()?.idProyecto ?? '').trim();
    if (this.online) {
      try {
        const resp: any = await firstValueFrom(this.catalogoService.listarVehiculos(idProyecto));
        if (!resp.error) {
          if (resp.data?.length > 0) {
            const dexiedb = await this.catalogosOperativosRepo.vehiculosRepo.getAll();
            if (dexiedb.length > 0) await this.catalogosOperativosRepo.vehiculosRepo.clear();
            for (const v of resp.data) {
              (v as any).bd = 1;
              await this.catalogosOperativosRepo.vehiculosRepo.save(v);
            }
            this.vehiculos.set(resp.data);
          } else {
            const dexiedb = await this.catalogosOperativosRepo.vehiculosRepo.getAll();
            if (dexiedb.length > 0) await this.catalogosOperativosRepo.vehiculosRepo.clear();
            this.vehiculos.set([]);
          }
        }
      } catch (error) {
        console.log('Error obteniendo vehiculos', error);
      }
    } else {
      const lista = await this.catalogosOperativosRepo.vehiculosRepo.getAll();
      this.vehiculos.set(lista ?? []);
    }
  }

  async cargarDestinatarios(): Promise<void> {
    if (this.online) {
      try {
        const resp: any = await firstValueFrom(this.catalogoService.listarDestinatarios());
        if (!resp.error) {
          if (resp.data?.length > 0) {
            const dexiedb = await this.catalogosRepo.destinatariosRepo.getAll();
            if (dexiedb.length > 0) await this.catalogosRepo.destinatariosRepo.clear();
            for (const d of resp.data) {
              (d as any).bd = 1;
              await this.catalogosRepo.destinatariosRepo.save(d);
            }
            this.destinatarios.set(resp.data);
          } else {
            const dexiedb = await this.catalogosRepo.destinatariosRepo.getAll();
            if (dexiedb.length > 0) await this.catalogosRepo.destinatariosRepo.clear();
            this.destinatarios.set([]);
          }
        }
      } catch (error) {
        console.log('Error obteniendo destinatarios', error);
      }
    } else {
      const lista = await this.catalogosRepo.destinatariosRepo.getAll();
      const activos = (lista ?? []).filter((d: any) => {
        const a = d?.activo;
        return a === true || a === 1 || (typeof a === 'string' && (a === '1' || a.toLowerCase() === 'true'));
      });
      this.destinatarios.set(activos);
    }
  }

  async cargarProcesosCatalogo(): Promise<void> {
    const idProyecto = String(this.savedConfig()?.idProyecto ?? '').trim();
    const codigoCultivo = String(this.savedConfig()?.codigoCultivo ?? '').trim();
    if (!codigoCultivo || !idProyecto) return;
    if (this.online) {
      try {
        const resp: any = await firstValueFrom(this.procesoService.listarProcesoForAcopio(codigoCultivo, idProyecto));
        if (!resp[0].error) {
          if (resp[0].data?.length > 0) {
            const dexiedb = await this.procesoRepo.procesosRepo.getAll();
            if (dexiedb.length > 0) await this.procesoRepo.procesosRepo.clear();
            for (const p of resp[0].data) {
              (p as any).bd = 1;
              await this.procesoRepo.procesosRepo.save(p as any);
            }
            this.procesosCatalogo.set(resp[0].data);
          } else {
            const dexiedb = await this.procesoRepo.procesosRepo.getAll();
            if (dexiedb.length > 0) await this.procesoRepo.procesosRepo.clear();
            this.procesosCatalogo.set([]);
          }
        }
      } catch (error) {
        console.log('Error obteniendo procesos catalogo', error);
      }
    } else {
      const lista = await this.procesoRepo.procesosRepo.getAll();
      this.procesosCatalogo.set(lista ?? []);
    }
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
  }

  onCrearGuia(payload: any): void {
    this.pendingGuiaPayload.set(payload);
    this.modalNuevaGuiaAbierto.set(false);
    this.modalInspeccionAbierto.set(true);
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
      fechaCreacionWeb: new Date().toISOString(),
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

    try {
      this.alertService.mostrarModalCarga();
      const resp: any = await firstValueFrom(this.guiaService.sincronizarGuiasRemision(syncPayload));
      this.alertService.cerrarModalCarga();

      if (resp?.error) {
        this.alertService.showAlert('Error', resp?.mensaje ?? 'Error al sincronizar guía.', 'error');
        return;
      }

      this.alertService.showAlert('Éxito', 'Guía sincronizada correctamente.', 'success');
      await this.cargarProcesosParaGuia();
      await this.onBuscarGuias();
    } catch (error: any) {
      console.error('Error sincronizando guía:', error);
      this.alertService.cerrarModalCarga();
      this.alertService.showAlert('Error', error?.error?.message ?? 'Error al sincronizar guía.', 'error');
    }
  }

  cerrarModalInspeccion(): void {
    this.modalInspeccionAbierto.set(false);
    this.pendingGuiaPayload.set(null);
  }

  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}

















