import { Component, ChangeDetectionStrategy, inject, signal, OnInit, computed, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PaletService } from '../../shared/services/palet.service';
import { ProcesoService } from '../../shared/services/proceso.service';
import { CatalogoService } from '../../shared/services/catalogo.service';
import { AuthService } from '../../shared/services/auth.service';
import { AlertService } from '../../shared/services/alert.service';
import { PermissionService } from '../../shared/services/permission.service';
import { Palet, DPalet } from '../../shared/interfaces/palet.interface';
import { Proceso } from '../../shared/interfaces/proceso.interface';
import { Consignatario, Destino, Formato, Variedad, TipoEmpaque, TipoEmpaqueGuia, Presentacion, TipoCaja, TipoClamshell, LugarProduccion, CodigoRancho, Transporte, TipoProcesoEmpacado, Calibre, Categoria } from '../../shared/interfaces/catalogo.interface';
import { ConnectivityService } from '../../shared/services/connectivity.service';
import { ProcesoRepository } from '../../shared/dexiedb/repository/proceso.repository';
import { firstValueFrom } from 'rxjs';
import { Configuracion } from '../../shared/interfaces/administracion.interface';
import { CatalogosRepository } from '../../shared/dexiedb/repository/catalogos.repository';
import { CatalogosOperativosRepository } from '../../shared/dexiedb/repository/catalogos-operacionales.repository';
import { AdministracionRepository } from '../../shared/dexiedb/repository/administracion.repository';
import { formatDateTime, formatTimeClave } from '../../shared/utils/datetime.utils';
import { ModalCajasComponent } from './components/modal-cajas/modal-cajas.component';
@Component({
  selector: 'app-palets',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, ModalCajasComponent],
  templateUrl: './palets.component.html',
  styleUrl: './palets.component.scss'
})
export class PaletsComponent implements OnInit, OnDestroy {
  private readonly paletService = inject(PaletService);
  private readonly procesoRepo = inject(ProcesoRepository);
  private readonly procesoService = inject(ProcesoService);
  private readonly catalogoService = inject(CatalogoService);
  private readonly catalogosRepo = inject(CatalogosRepository);
  private readonly catalogosOperativosRepo = inject(CatalogosOperativosRepository);
  private readonly administracionRepo = inject(AdministracionRepository);
  private readonly auth = inject(AuthService);
  private readonly alertService = inject(AlertService);
  readonly permissions = inject(PermissionService);
  private readonly connectivity = inject(ConnectivityService);
  readonly savedConfig = signal<Configuracion | null>(null);
  readonly activeCampaniaId = signal<string | null>(null);

  private _cargandoCascada = false;
  private timerInterval: ReturnType<typeof setInterval> | null = null;
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
  formCajas = signal<{
    consignatarioId: string | number;
    destinoId: number | string;
    formatoId: number;
    tipoEmpaqueId: number;
    calibreId: number;
    categoriaId: number;
    tipoEmpaqueGuiaId: number;
    tipoCajaId: number;
    tipoClamshellId: number;
    presentacionId: number;
    tipoProcesoEmpacadoId: number;
    variedadId: number | string;
    variedadGuiaId: string;
    lugarProduccionId: number;
    codigoRanchoId: number;
    transporteId: string;
    cantidadCajas: number;
    esReposicion: boolean;
    esEnsayo: boolean;
  }>({
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
    return db === 1 ? 'sp-badge sp-badge-success' : 'sp-badge sp-badge-danger';
  }

  formatPeso(valor: number | undefined | null): string {
    const n = Number(valor ?? 0);
    return String(Math.ceil(n * 1000) / 1000);
  }

  private async resolverNombresDPalets(dpalets: any[]): Promise<DPalet[]> {
    const [
      consignatarios, destinos, formatos, presentaciones, variedades,
      lugares, codigosRancho, tiposEmpaqueGuia, transportes, tiposProceso
    ] = await Promise.all([
      this.catalogosRepo.consignatariosRepo.getAll(),
      this.catalogosRepo.destinosRepo.getAll(),
      this.catalogosRepo.formatosRepo.getAll(),
      this.catalogosRepo.presentacionesRepo.getAll(),
      this.catalogosRepo.variedadesRepo.getAll(),
      this.catalogosRepo.lugaresProduccionRepo.getAll(),
      this.catalogosRepo.codigosRanchoRepo.getAll(),
      this.catalogosRepo.tiposEmpaqueGuiaRepo.getAll(),
      this.catalogosRepo.transportesRepo.getAll(),
      this.catalogosRepo.tipoProcesoEmpacadoRepo.getAll(),
    ]);

    const consigMap = new Map(consignatarios.map(c => [String(c.documento ?? '').trim(), c.nombre]));
    const destMap = new Map(destinos.map(d => [String(d.id ?? '').trim(), d.pais]));
    const fmtMap = new Map(formatos.map(f => [String(f.id ?? '').trim(), f.descripcion]));
    const presMap = new Map(presentaciones.map(p => [String(p.id ?? '').trim(), p.nombre ?? '']));
    const varMap = new Map(variedades.map(v => [String(v.codigo ?? '').trim(), v.variedad]));
    const lugMap = new Map(lugares.map(l => [String(l.id ?? '').trim(), l.descripcion]));
    const ranMap = new Map(codigosRancho.map(r => [String(r.id ?? '').trim(), r.codigo]));
    const tegMap = new Map(tiposEmpaqueGuia.map(t => [String(t.id ?? '').trim(), t.nombre]));
    const transMap = new Map(transportes.map(t => [String(t.id ?? '').trim(), t.transporte]));
    const tpeMap = new Map(tiposProceso.map(t => [String(t.id ?? '').trim(), t.nombre]));

    return dpalets.map((d: any) => {
      const docCons = String(d.documentoConsignatario ?? '').trim();
      const destId = String(d.destinoId ?? '').trim();
      const fmtId = String(d.formatoId ?? '').trim();
      const presId = String(d.presentacionId ?? '').trim();
      const varId = String(d.variedadId ?? '').trim();
      const lugId = String(d.lugarProduccionId ?? '').trim();
      const ranId = String(d.codigoRanchoId ?? '').trim();
      const tegId = String(d.tipoEmpaqueGuiaId ?? '').trim();
      const transId = String(d.transporteId ?? '').trim();
      const tpeId = String(d.tipoProcesoEmpacadoId ?? '').trim();

      return {
        ...d,
        consignatarioNombre: consigMap.get(docCons) ?? d.consignatarioNombre ?? '',
        destinoNombre: destMap.get(destId) ?? d.destinoNombre ?? '',
        formatoNombre: fmtMap.get(fmtId) ?? d.formatoNombre ?? '',
        presentacionNombre: presMap.get(presId) ?? d.presentacionNombre ?? '',
        variedadNombre: varMap.get(varId) ?? d.variedadNombre ?? '',
        lugarProduccionNombre: lugMap.get(lugId) ?? d.lugarProduccionNombre ?? '',
        codigoRanchoNombre: ranMap.get(ranId) ?? d.codigoRanchoNombre ?? '',
        tipoEmpaqueGuiaNombre: tegMap.get(tegId) ?? d.tipoEmpaqueGuiaNombre ?? '',
        transporteNombre: transMap.get(transId) ?? d.transporteNombre ?? '',
        tipoProcesoEmpacadoNombre: tpeMap.get(tpeId) ?? d.tipoProcesoEmpacadoNombre ?? '',
      } as DPalet;
    });
  }

  private get userId(): number {
    return this.auth.usuario()?.id ?? 0;
  }

  async ngOnInit(): Promise<void> {
    await this.cargarConfiguracion();
    await this.cargarDesdeDexieCampania();
    await this.cargarProcesos();
    if (this.online) {
      await this.sincronizarDPaletsPorAcopio();
    }
  }

  ngOnDestroy(): void {
    if (this.timerInterval) clearInterval(this.timerInterval);
  }

  private async cargarDesdeDexieCampania(): Promise<void> {
    try {
      const campania = await this.catalogosRepo.campaniaRepo.getByField('idproyecto', this.savedConfig()?.idProyecto || '');
      this.campania.set(campania);
    } catch (error) {
      console.log('Error cargando campanias desde Dexie', error);
      this.campania.set([]);
    }
  }


  private async cargarConfiguracion(): Promise<void> {
    try {
      const nro = this.getNroDocumentoFromUsuario();
      const cfg = await this.catalogosRepo.configuracionRepo.getByField('nrodocumento', nro);
      this.savedConfig.set(cfg ?? null);
    } catch (error) {
      console.log('Error cargando configuracion desde Dexie', error);
      this.activeCampaniaId.set(null);
    }
  }

  private getNroDocumentoFromUsuario(): string {
    const u: any = this.auth.usuario();
    const v = u?.nrodocumento ?? u?.documentoidentidad ?? u?.documentoIdentidad ?? u?.documento ?? '';
    return String(v ?? '').trim();
  }

  async cargarProcesos(): Promise<void> {
    this.procesosAbiertos.set([])
    if (this.online) {
      await this.listarProcesosApi()
    } else {
      const listaProcesos = await this.procesoRepo.procesosRepo.getAll();
      let procesosAbiertos = listaProcesos.filter((p: Proceso) => p.estado === 'ABIERTO');
      this.procesosAbiertos.set(procesosAbiertos);
    }
  }


  async listarProcesosApi(): Promise<void> {
    this.isLoading.set(true);
    let resp = await firstValueFrom(this.procesoService.listarProcesoForAcopio(this.savedConfig()?.codigoCultivo || '', this.savedConfig()?.idProyecto || ''));
    if (resp.length == 0) {
      this.alertService.showAlert('Error', 'No se encontraron procesos para la campaña activa.', 'error');
      this.isLoading.set(false);
      return;
    } else {
      if (resp[0].error) {
        this.alertService.showAlert('Error', resp[0].mensaje, 'error');
        this.isLoading.set(false);
        return;
      } else {
        const data = Array.isArray(resp?.[0]?.data) ? resp[0].data : [];
        const normalizados: {
          proceso: Proceso;
        }[] = data.map((x: any) => this.normalizarProceso(x));

        const idProyecto = String(this.savedConfig()?.idProyecto ?? '').trim();

        const localesNoSync = await this.procesoRepo.procesosRepo.getNoSincronizados();
        const localNoSyncById = new Map<string, Proceso>(
          (localesNoSync ?? []).map((p) => [String((p as any)?.idProceso ?? '').trim(), p])
        );

        const conflictos = Array.from(
          new Set(
            normalizados
              .map((n) => String((n.proceso as any)?.idProceso ?? '').trim())
              .filter((id) => id.length > 0 && localNoSyncById.has(id))
          )
        );

        let normalizadosFiltrados = normalizados;
        if (conflictos.length > 0) {
          const msg =
            `Se encontraron procesos locales NO sincronizados con el mismo idProceso que viene del servidor (ej: ${conflictos.slice(0, 3).join(', ')}${conflictos.length > 3 ? '...' : ''}).\n\n` +
            '¿Deseas reemplazar el/los procesos locales por los del servidor?\n' +
            '- Aceptar: elimina los locales NO sincronizados en conflicto y guarda los del servidor.\n' +
            '- Cancelar: mantiene los locales y omite los del servidor con ese idProceso.';

          const reemplazar = await this.alertService.showConfirm('Conflicto de procesos', msg, 'warning');

          if (reemplazar) {
            for (const idProceso of conflictos) {
              await this.procesoRepo.procesosRepo.deleteByIdProceso(idProceso);
              await this.procesoRepo.dProcesoLogisticosRepo.deleteByIdProceso(idProceso);
              await this.procesoRepo.dProcesoSupervisoresRepo.deleteByIdProceso(idProceso);
            }
          } else {
            normalizadosFiltrados = normalizados.filter(
              (n) => !conflictos.includes(String((n.proceso as any)?.idProceso ?? '').trim())
            );
          }
        }

        if (idProyecto) {
          const idsEliminados = await this.procesoRepo.procesosRepo.clearSincronizadosByProyecto(idProyecto);
          await this.procesoRepo.dProcesoLogisticosRepo.clearSincronizadosByIdProcesos(idsEliminados);
          await this.procesoRepo.dProcesoSupervisoresRepo.clearSincronizadosByIdProcesos(idsEliminados);
        }

        for (const n of normalizadosFiltrados) {
          await this.procesoRepo.procesosRepo.saveFordec(n.proceso as any);
        }
        const listaProcesos = await this.procesoRepo.procesosRepo.getAll();
        let procesosAbiertos = listaProcesos.filter((p: Proceso) => p.estado === 'ABIERTO');
        this.procesosAbiertos.set(procesosAbiertos);

        this.isLoading.set(false);
        return;
      }
    }
  }


  normalizarProceso(proceso: any): { proceso: Proceso } {
    const p: Proceso = {
      id: proceso?.id ?? undefined,
      idProceso: String(proceso?.idProceso ?? '').trim(),
      idProyecto: String(proceso?.idProyecto ?? '').trim(),
      codigoAcopio: String(proceso?.codigoAcopio ?? '').trim(),
      acopioNombre: String(proceso?.acopioNombre ?? '').trim(),
      fechaProceso: String(proceso?.fechaProceso ?? '').trim(),
      estado: String(proceso?.estado ?? '').trim(),
      fechaApertura: String(proceso?.fechaApertura ?? '').trim(),
      fechaCierre: proceso?.fechaCierre ?? null,
      turno: String(proceso?.turno ?? '').trim(),
      idUsuarioApertura: proceso?.idUsuarioApertura ?? undefined,
      idRolApertura: proceso?.idRolApertura ?? undefined,
      idUsuarioCierre: proceso?.idUsuarioCierre ?? undefined,
      idRolCierre: proceso?.idRolCierre ?? undefined,
      db: 1
    };

    return { proceso: p };
  }

  async listarPaletsForProceso(idproceso: string, options?: { showLoading?: boolean }): Promise<void> {
    const idProceso = String(idproceso ?? '').trim();
    if (!idProceso) {
      this.palets.set([]);
      return;
    }
    const showLoading = options?.showLoading ?? true;
    if (showLoading) this.alertService.mostrarModalCarga();
    try {
      if (this.online) {
        const resp = await firstValueFrom(this.paletService.listarPaletPorProceso(idProceso));
        if (!resp?.length) {
          this.alertService.showAlert('Error', 'Error al obtener los palets del proceso', 'error');
          return;
        }

        const first = resp[0] as any;
        if (first?.error) {
          this.alertService.showAlert('Error', first?.mensaje ?? 'Error al obtener los palets del proceso', 'error');
          return;
        }

        const apiPalets: Palet[] = (Array.isArray(first) ? first : (first?.data ?? [])) as any;

        await this.procesoRepo.paletsRepo.clearSincronizadosByIdProceso(idProceso);

        for (const p of (apiPalets ?? [])) {
          const row: Palet = {
            ...(p as any),
            bd: 1,
          };
          await this.procesoRepo.paletsRepo.saveByIdPalet(row);
        }
      } else {
        console.log('Obteniendo palets del proceso desde Dexie...');
      }

      const paletsDb = await this.procesoRepo.paletsRepo.getByIdProceso(idProceso);
      const activos = (paletsDb ?? []).filter((p: any) => !(p as any)?.eliminado);
      const ordenados = activos.slice().sort((a: any, b: any) => {
        const ak = String(a?.idPalet ?? '').trim();
        const bk = String(b?.idPalet ?? '').trim();
        if (ak && bk) return bk.localeCompare(ak);
        if (ak) return 1;
        if (bk) return -1;
        return Number(a?.id ?? 0) - Number(b?.id ?? 0);
      });
      this.palets.set(ordenados);
    } catch (error: any) {
      console.log(error);
      this.alertService.showAlert('Error', `${error?.error?.message ?? 'Error al obtener los palets del proceso'}`, 'error');
    } finally {
      if (showLoading) this.alertService.cerrarModalCarga();
    }
  }

  async sincronizarDPaletsPorAcopio(): Promise<void> {
    try {
      const resp: any = await firstValueFrom(this.paletService.getDPaletsPorAcopio());
      const first = Array.isArray(resp) ? resp[0] : resp;
      if (first?.error) {
        console.error('Error obteniendo DPalets por acopio:', first?.mensaje);
        return;
      }
      const items: any[] = first?.data ?? [];
      if (!items.length) {
        console.log('No hay DPalets remotos para sincronizar');
        return;
      }

      // Limpiar DPalets sincronizados previos
      const dpaletsLocales = await this.procesoRepo.dPaletsRepo.getAll();
      const sincronizados = (dpaletsLocales ?? []).filter((d: any) => (d.bd ?? 0) === 1);
      for (const d of sincronizados) {
        if ((d as any)._pk != null) {
          await this.procesoRepo.dPaletsRepo.delete((d as any)._pk);
        }
      }

      const enriquecidos = await this.resolverNombresDPalets(items);
      for (const d of enriquecidos) {
        const row: DPalet = {
          ...d,
          bd: 1,
        };
        await this.procesoRepo.dPaletsRepo.saveByIdDPalet(row);
      }

    } catch (err) {
      console.error('Error sincronizando DPalets por acopio:', err);
    }
  }

  async onSincronizar(): Promise<void> {
    try {
      if (!this.online) {
        this.alertService.showAlert('Error', 'No tiene conexión a internet', 'error');
        return;
      }

      const confirmar = await this.alertService.showConfirm(
        'Confirmar sincronización',
        'Se subirán a BD los palets pendientes. ¿Desea continuar?',
        'question',
      );

      if (!confirmar) return;
      this.alertService.mostrarModalCarga();

      const paletsNoSync = await this.procesoRepo.paletsRepo.getNoSincronizados();
      const dpaletsNoSync = await this.procesoRepo.dPaletsRepo.getNoSincronizados();
      const hayPalets = (paletsNoSync ?? []).length > 0;
      const hayDPalets = (dpaletsNoSync ?? []).length > 0;

      if (!hayPalets && !hayDPalets) {
        for (const p of (this.procesosAbiertos() ?? [])) {
          await this.listarPaletsForProceso(p.idProceso, { showLoading: false });
        }
        await this.listarPaletsForProceso(this.procesoSeleccionado()!.idProceso, { showLoading: false });
        await this.sincronizarDPaletsPorAcopio();
        const paletSel = this.paletSeleccionado();
        if (paletSel) await this.verDetalle(paletSel);
        this.alertService.cerrarModalCarga();
        this.alertService.showAlert('Éxito', 'No hay palets pendientes de sincronización', 'success');
        return;
      }

      const resultadosPalet: { idPalet: string; success: boolean; mensaje: string }[] = [];
      const resultadosDPalet: { idDPalet: string; success: boolean; mensaje: string }[] = [];

      // Sincronizar Palets
      if (hayPalets) {
        const payloads = structuredClone(paletsNoSync) as any[];
        payloads.forEach((item: any) => {
          delete item.bd;
          delete item._pk;
          item.modo = item.id == 0 ? 'nuevo' : 'editado';
        });
        const resp = await firstValueFrom(this.paletService.sincronizar(payloads));
        console.log('respPalets', resp);
        const first = resp?.[0] as any;
        if (first?.error) {
          this.alertService.cerrarModalCarga();
          this.alertService.showAlert('Error', first?.mensaje ?? 'Error al sincronizar palets', 'error');
          return;
        }
        const dataResults: any[] = Array.isArray(first?.data) ? first.data : [];
        const localMap = new Map<string, number>();
        for (const local of paletsNoSync as any[]) {
          const key = String(local?.idPalet ?? '').trim();
          if (key && local?._pk != null) localMap.set(key, local._pk);
        }
        for (const r of dataResults) {
          const idPalet = String(r?.idPalet ?? '').trim();
          const success = !!r?.success;
          resultadosPalet.push({ idPalet, success, mensaje: r?.mensaje ?? '-' });
          if (success && idPalet && localMap.has(idPalet)) {
            const pk = localMap.get(idPalet)!;
            const reg = await this.procesoRepo.paletsRepo.getByKey(pk);
            if (reg) {
              (reg as any).bd = 1;
              await this.procesoRepo.paletsRepo.saveByIdPalet(reg as any);
            }
          }
        }
      }

      // Sincronizar DPalets
      if (hayDPalets) {
        const payloads = structuredClone(dpaletsNoSync) as any[];
        payloads.forEach((item: any) => {
          delete item.bd;
          delete item._pk;
        });
        const resp = await firstValueFrom(this.paletService.sincronizarDPalets(payloads));
        console.log('respDPalets', resp);
        const dataResults: any[] = Array.isArray(resp) ? resp : [];
        const localMap = new Map<string, number>();
        for (const local of dpaletsNoSync as any[]) {
          const key = String(local?.idDPalet ?? '').trim();
          if (key && local?._pk != null) localMap.set(key, local._pk);
        }
        for (const r of dataResults) {
          const idDPalet = String(r?.idDPalet ?? '').trim();
          const success = !!r?.success;
          resultadosDPalet.push({ idDPalet, success, mensaje: r?.mensaje ?? '-' });
          if (success && idDPalet && localMap.has(idDPalet)) {
            const pk = localMap.get(idDPalet)!;
            const reg = await this.procesoRepo.dPaletsRepo.getByKey(pk);
            if (reg) {
              (reg as any).bd = 1;
              await this.procesoRepo.dPaletsRepo.saveByIdDPalet(reg as any);
            }
          }
        }
      }

      this.alertService.cerrarModalCarga();

      const paletsOk = resultadosPalet.filter(r => r.success).length;
      const paletsErr = resultadosPalet.filter(r => !r.success).length;
      const dpaletsOk = resultadosDPalet.filter(r => r.success).length;
      const dpaletsErr = resultadosDPalet.filter(r => !r.success).length;

      let mensajeFinal = '';
      if (paletsOk > 0 || dpaletsOk > 0) {
        mensajeFinal = `Sincronización completada. Palets: ${paletsOk} OK${paletsErr > 0 ? ', ' + paletsErr + ' error' : ''}. Detalles: ${dpaletsOk} OK${dpaletsErr > 0 ? ', ' + dpaletsErr + ' error' : ''}.`;
      } else {
        mensajeFinal = `Sincronización completada con errores. Palets: ${paletsErr} error. Detalles: ${dpaletsErr} error.`;
      }
      this.alertService.showAlert('Listo', mensajeFinal, paletsErr > 0 || dpaletsErr > 0 ? 'warning' : 'success');

      // Recargar desde servidor para ambos roles
      this.alertService.mostrarModalCarga();
      for (const proc of (this.procesosAbiertos() ?? [])) {
        const idProceso = String(proc.idProceso ?? '').trim();
        if (!idProceso) continue;
        try {
          const respPalets: any = await firstValueFrom(this.paletService.listarPaletPorProceso(idProceso));
          if (!respPalets?.length) continue;
          const firstPalet = respPalets[0] as any;
          if (firstPalet?.error) continue;
          const apiPalets = (Array.isArray(firstPalet) ? firstPalet : (firstPalet?.data ?? [])) as any[];
          await this.procesoRepo.paletsRepo.clearSincronizadosByIdProceso(idProceso);
          for (const p of (apiPalets ?? [])) {
            const row: any = { ...(p as any), bd: 1 };
            await this.procesoRepo.paletsRepo.saveByIdPalet(row);
          }
        } catch (err) {
          console.error('Error obteniendo palets para proceso', idProceso, err);
        }
      }
      await this.sincronizarDPaletsPorAcopio();

      // Actualizar UI
      for (const proc of (this.procesosAbiertos() ?? [])) {
        await this.listarPaletsForProceso(proc.idProceso, { showLoading: false });
      }
      await this.listarPaletsForProceso(this.procesoSeleccionado()!.idProceso, { showLoading: false });
      const paletSel = this.paletSeleccionado();
      if (paletSel) await this.verDetalle(paletSel);

      this.alertService.cerrarModalCarga();
    } catch (error: any) {
      console.error('Error en sincronización palets:', error);
      this.alertService.cerrarModalCarga();
      this.alertService.showAlert('Error', `${error?.error?.message ?? 'Error en sincronización'}`, 'error');
    }
  }

  async seleccionarProceso(p: Proceso): Promise<void> {
    this.alertService.mostrarModalCarga()
    this.procesoSeleccionado.set(p);
    this.paletSeleccionado.set(null);
    this.composiciones.set([]);
    this.isLoading.set(true);

    await this.listarPaletsForProceso(p.idProceso, { showLoading: false })

    //======================================
    this.isLoading.set(false);
    this.alertService.cerrarModalCarga();
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

  async verDetalle(p: Palet): Promise<void> {
    this.paletSeleccionado.set(p);

    // SIEMPRE cargar composiciones desde Dexie
    try {
      const dpalets = await this.procesoRepo.dPaletsRepo.getByIdPalet(p.idPalet ?? '');
      const activos = (dpalets ?? []).filter((d: any) => !(d as any)?.eliminado);
      this.composiciones.set(activos);

      // Recalcular totales del palet solo con dpalets no eliminados
      const totalCajas = activos.reduce((sum: number, d: any) => sum + (d?.cantidadCajas || 0), 0);
      const totalPeso = activos.reduce((sum: number, d: any) => sum + (d?.pesoTotal || 0), 0);
      const limite = p?.limiteCajasPorPalet ?? 0;
      const porcentaje = limite > 0 ? Math.round((totalCajas / limite) * 100) : 0;

      const paletActualizado: Palet = {
        ...p,
        cantidadCajas: totalCajas,
        pesoTotal: totalPeso,
        porcentajeAvance: porcentaje
      };

      this.paletSeleccionado.set(paletActualizado);
      this.palets.update(palets =>
        palets.map(item => {
          const pk = String(item?.idPalet ?? '').trim();
          const uk = String(paletActualizado?.idPalet ?? '').trim();
          return pk && uk && pk === uk ? paletActualizado : item;
        })
      );
    } catch (err) {
      console.error('Error cargando detalle desde Dexie:', err);
      this.composiciones.set([]);
    }
  }

  async crearPalet(): Promise<void> {
    const proceso = this.procesoSeleccionado();
    if (!proceso) {
      this.alertService.showAlert('Validación', 'Debe seleccionar un proceso primero', 'warning');
      return;
    }
    try {
      this.alertService.mostrarModalCarga();
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
      if (this.online) {
        let resp = await firstValueFrom(this.paletService.sincronizar(newPalets))
        if (resp.length > 0) {
          if (resp[0].error) {
            this.alertService.showAlertAcept('Error', resp[0].mensaje, 'error');
          } else {
            await this.listarPaletsForProceso(proceso.idProceso, { showLoading: false })
            this.alertService.showAlertAcept('Éxito', 'Palet creado exitosamente.', 'success');
          }
        } else {
          this.alertService.showAlertAcept('Error', 'Error al crear el Palet, por favor vuelva a Iniciar Sesión.', 'error');
        }
      } else {
        newPalets.bd = 0
        await this.procesoRepo.paletsRepo.saveByIdPalet(newPalets);
        await this.listarPaletsForProceso(proceso.idProceso, { showLoading: false })
        this.alertService.showAlertAcept('Éxito', 'Palet creado exitosamente. - No Sincronizado', 'success');
      }
    } catch (error) {
      console.error('Error creando palet:', error);
      this.alertService.cerrarModalCarga();
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
    this.alertService.mostrarModalCarga();

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
      this.alertService.cerrarModalCarga();
    }

    if (tipos.length === 0) {
      this.alertService.showAlert('Información', 'El acopio no tiene configurado ese tipo proceso empacado.', 'warning');
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
        const origMostrar = this.alertService.mostrarModalCarga.bind(this.alertService);
        const origCerrar = this.alertService.cerrarModalCarga.bind(this.alertService);
        (this.alertService as any).mostrarModalCarga = () => { };
        (this.alertService as any).cerrarModalCarga = () => { };
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
          (this.alertService as any).mostrarModalCarga = origMostrar;
          (this.alertService as any).cerrarModalCarga = origCerrar;
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
    console.log('cajassssssssss',this.formCajas())
    const codigoAcopio = String(palet?.codigoAcopio ?? this.procesoSeleccionado()?.codigoAcopio ?? '').trim();
    this.alertService.mostrarModalCarga();
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
      this.alertService.cerrarModalCarga(); 
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
    console.log('formCajas1111',this.formCajas())
    const valoresPrevios = { ...this.formCajas() };
    
    this._cargandoCascada = true;
    const origMostrar = this.alertService.mostrarModalCarga.bind(this.alertService);
    const origCerrar = this.alertService.cerrarModalCarga.bind(this.alertService);
    (this.alertService as any).mostrarModalCarga = () => { };
    (this.alertService as any).cerrarModalCarga = () => { };
    try {
      console.log('valoresss',valoresPrevios)
      if (consignatarioIdReal) {
        await this.onConsignatarioChange(String(consignatarioIdReal));
        this.updateFormCajas('destinoId', valoresPrevios.destinoId);
        if (valoresPrevios.destinoId) await this.onDestinoChange(String(valoresPrevios.destinoId));
        this.updateFormCajas('formatoId', valoresPrevios.formatoId);
        if (valoresPrevios.formatoId) await this.onFormatoChange(String(valoresPrevios.formatoId));
        this.updateFormCajas('tipoEmpaqueGuiaId', valoresPrevios.tipoEmpaqueGuiaId);
        if (valoresPrevios.tipoEmpaqueGuiaId) await this.onTipoEmpaqueGuiaChange(String(valoresPrevios.tipoEmpaqueGuiaId));
        this.updateFormCajas('presentacionId', valoresPrevios.presentacionId);
        if (valoresPrevios.presentacionId) this.onPresentacionChange(String(valoresPrevios.presentacionId));
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
      (this.alertService as any).mostrarModalCarga = origMostrar;
      (this.alertService as any).cerrarModalCarga = origCerrar;
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
      case 'presentacionId': this.onPresentacionChange(String(valor)); break;
      case 'tipoCajaId': await this.onTipoCajaChange(String(valor)); break;
      case 'tipoClamshellId': this.onTipoClamshellChange(String(valor)); break;
      case 'variedadId': this.onVariedadChange(String(valor)); break;
      case 'esEnsayo': this.onEsEnsayoChange(valor); break;
    }
  }

  async submitEditarCajas(): Promise<void> {
    const palet = this.paletSeleccionado();
    const dpaletOriginal = this.dpaletEditando();
    if (!palet || !dpaletOriginal) return;

    const f = this.formCajas();
    if (!f.consignatarioId || !f.destinoId || !f.formatoId || !f.variedadId || !f.cantidadCajas) {
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
      variedadGuiaId: f.esEnsayo ? (f.variedadGuiaId || null) : null,
      esEnsayo: f.esEnsayo ?? false,
      eliminado: false,
      fechaCreacion: dpaletOriginal.fechaCreacion ?? new Date().toISOString(),
      bd:0
    };

    if (this.online) {
      try {
        this.alertService.mostrarModalCarga();
        await firstValueFrom(this.paletService.sincronizarDPalets([dpaletEditado]));
        await this.procesoRepo.dPaletsRepo.saveByIdDPalet(dpaletEditado);

        // Recalcular totales del palet
        const dpalets = await this.procesoRepo.dPaletsRepo.getByIdPalet(palet.idPalet ?? '');
        const activos = (dpalets ?? []).filter((d: any) => !(d as any)?.eliminado);
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
          bd: palet.bd ?? 0,
          modo: 'editado'
        };
        await firstValueFrom(this.paletService.sincronizar(paletActualizado));
        this.paletSeleccionado.set(paletActualizado);
        this.palets.update(palets => palets.map(p => {
          const pk = String(p?.idPalet ?? '').trim();
          const uk = String(paletActualizado?.idPalet ?? '').trim();
          return pk && uk && pk === uk ? paletActualizado : p;
        }));
        await this.sincronizarDPaletsPorAcopio();
        await this.verDetalle(paletActualizado);
        this.alertService.cerrarModalCarga();
        this.alertService.showAlert('Exito', 'Cajas actualizadas correctamente', 'success');
        this.cerrarModalAgregarCajas();
      } catch (err) {
        console.error('Error editando online:', err);
        this.alertService.cerrarModalCarga();
        this.alertService.showAlertAcept('Error', 'Error al actualizar cajas en modo online', 'error');
      }
      return;
    } else {
      try {
        this.alertService.mostrarModalCarga();
        await this.procesoRepo.dPaletsRepo.saveByIdDPalet(dpaletEditado);
        const dpalets = await this.procesoRepo.dPaletsRepo.getByIdPalet(palet.idPalet ?? '');
        const activos = (dpalets ?? []).filter((d: any) => !(d as any)?.eliminado);
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
          bd: 0
        };
        await this.procesoRepo.paletsRepo.saveByIdPalet(paletActualizado);
        this.paletSeleccionado.set(paletActualizado);
        this.palets.update(palets => palets.map(p => {
          const pk = String(p?.idPalet ?? '').trim();
          const uk = String(paletActualizado?.idPalet ?? '').trim();
          return pk && uk && pk === uk ? paletActualizado : p;
        }));
        this.composiciones.set(activos);
        this.alertService.cerrarModalCarga();
        this.alertService.showAlert('Exito', 'Cajas actualizadas correctamente (offline)', 'success');
        this.cerrarModalAgregarCajas();
      } catch (err) {
        console.error('Error editando offline:', err);
        this.alertService.cerrarModalCarga();
        this.alertService.showAlertAcept('Error', 'Error al actualizar cajas en modo offline', 'error');
      }
      return;
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
    if (!f.consignatarioId || !f.destinoId || !f.formatoId || !f.variedadId || !f.cantidadCajas) {
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
      variedadGuiaId: f.esEnsayo ? (f.variedadGuiaId || null) : null,
      esEnsayo: f.esEnsayo ?? false,
      eliminado: false,
      bd:0,
      fechaCreacion: new Date().toISOString()
    };

    if (this.online) {
      try {
        this.alertService.mostrarModalCarga();
        await firstValueFrom(this.paletService.sincronizarDPalets([nuevoDPalet]));

        await this.procesoRepo.dPaletsRepo.saveByIdDPalet(nuevoDPalet);

        const nuevaCantidad = (palet.cantidadCajas || 0) + f.cantidadCajas;
        const nuevoPeso = (palet.pesoTotal || 0) + (f.cantidadCajas * pesoPorCaja);
        const nuevoPorcentaje = limiteCajasPorPalet > 0
          ? Math.round((nuevaCantidad / limiteCajasPorPalet) * 100)
          : 0;
        const paletActualizado: Palet = {
          ...palet,
          cantidadCajas: nuevaCantidad,
          pesoTotal: nuevoPeso,
          limiteCajasPorPalet: limiteCajasPorPalet > 0 ? limiteCajasPorPalet : (palet.limiteCajasPorPalet ?? 0),
          porcentajeAvance: nuevoPorcentaje,
          formatoId: nuevoDPalet.formatoId ?? 0,
          bd: palet.bd ?? 0,
          modo: 'editado'
        };

        let respPalet = await firstValueFrom(this.paletService.sincronizar(paletActualizado));
        this.paletSeleccionado.set(paletActualizado);
        this.palets.update(palets =>
          palets.map(p => {
            const pk = String(p?.idPalet ?? '').trim();
            const uk = String(paletActualizado?.idPalet ?? '').trim();
            return pk && uk && pk === uk ? paletActualizado : p;
          })
        );

        await this.sincronizarDPaletsPorAcopio();
        await this.verDetalle(paletActualizado);

        this.alertService.cerrarModalCarga();
        this.alertService.showAlert('Éxito', 'Cajas agregadas correctamente', 'success');
        this.cerrarModalAgregarCajas();
        if (limiteCajasPorPalet > 0 && nuevaCantidad >= limiteCajasPorPalet) {
          this.abrirModalCerrarPalet(paletActualizado);
        }
      } catch (err) {
        console.error('Error guardando online:', err);
        this.alertService.cerrarModalCarga();
        this.alertService.showAlertAcept('Error', 'Error al guardar cajas en modo online', 'error');
      }
      return;
    } else {
      try {
        this.alertService.mostrarModalCarga();

        await this.procesoRepo.dPaletsRepo.saveByIdDPalet(nuevoDPalet);

        const nuevaCantidad = (palet.cantidadCajas || 0) + f.cantidadCajas;
        const nuevoPeso = (palet.pesoTotal || 0) + (f.cantidadCajas * pesoPorCaja);
        const nuevoPorcentaje = limiteCajasPorPalet > 0
          ? Math.round((nuevaCantidad / limiteCajasPorPalet) * 100)
          : 0;

        const paletActualizado: Palet = {
          ...palet,
          cantidadCajas: nuevaCantidad,
          pesoTotal: nuevoPeso,
          limiteCajasPorPalet: limiteCajasPorPalet > 0 ? limiteCajasPorPalet : (palet.limiteCajasPorPalet ?? 0),
          porcentajeAvance: nuevoPorcentaje,
          formatoId: nuevoDPalet.formatoId ?? 0,
          bd: 0
        };

        await this.procesoRepo.paletsRepo.saveByIdPalet(paletActualizado);

        this.paletSeleccionado.set(paletActualizado);
        this.palets.update(palets =>
          palets.map(p => {
            const pk = String(p?.idPalet ?? '').trim();
            const uk = String(paletActualizado?.idPalet ?? '').trim();
            return pk && uk && pk === uk ? paletActualizado : p;
          })
        );

        const dpalets = await this.procesoRepo.dPaletsRepo.getByIdPalet(palet.idPalet ?? '');
        const activos = (dpalets ?? []).filter((d: any) => !(d as any)?.eliminado);
        this.composiciones.set(activos);

        this.alertService.cerrarModalCarga();
        this.alertService.showAlert('Éxito', 'Cajas agregadas correctamente (offline)', 'success');
        this.cerrarModalAgregarCajas();
        if (limiteCajasPorPalet > 0 && nuevaCantidad >= limiteCajasPorPalet) {
          this.abrirModalCerrarPalet(paletActualizado);
        }
      } catch (err) {
        console.error('Error guardando offline:', err);
        this.alertService.cerrarModalCarga();
        this.alertService.showAlertAcept('Error', 'Error al guardar cajas en modo offline', 'error');
      }
      return;

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

    const tieneObs = this.cerrarPaletTieneObs();
    const obs = this.cerrarPaletObservaciones();
    const medida = this.cerrarPaletMedida();
    this.alertService.mostrarModalCarga();

    const estadoCerrado = (palet.cantidadCajas || 0) >= (palet.limiteCajasPorPalet || 0) ? 'CERRADO_COMPLETO' : 'CERRADO_SALDO';

    const paletCerrado: Palet = {
      ...palet,
      estado: estadoCerrado,
      observaciones: tieneObs ? obs : palet.observaciones,
      medidaCorrectiva: medida || palet.medidaCorrectiva,
      bd: this.online ? 1 : 0,
      modo: 'editado'
    };

    if (this.online) {
      try {
        await firstValueFrom(this.paletService.sincronizar(paletCerrado));
        await this.procesoRepo.paletsRepo.saveByIdPalet(paletCerrado);

        this.paletSeleccionado.set(paletCerrado);
        this.palets.update(palets =>
          palets.map(p => {
            const pk = String(p?.idPalet ?? '').trim();
            const uk = String(paletCerrado?.idPalet ?? '').trim();
            return pk && uk && pk === uk ? paletCerrado : p;
          })
        );

        this.alertService.cerrarModalCarga();
        this.alertService.showAlert('Éxito', 'Palet cerrado correctamente', 'success');
        this.cerrarModalCerrarPalet();
      } catch (err) {
        console.error('Error cerrando palet online:', err);
        this.alertService.cerrarModalCarga();
        const msg = (err as any)?.error?.message ?? 'Error al cerrar el palet';
        this.alertService.showAlertAcept('Error', String(msg), 'error');
      }
    } else {
      try {
        await this.procesoRepo.paletsRepo.saveByIdPalet(paletCerrado);

        this.paletSeleccionado.set(paletCerrado);
        this.palets.update(palets =>
          palets.map(p => {
            const pk = String(p?.idPalet ?? '').trim();
            const uk = String(paletCerrado?.idPalet ?? '').trim();
            return pk && uk && pk === uk ? paletCerrado : p;
          })
        );

        this.alertService.cerrarModalCarga();
        this.alertService.showAlert('Éxito', 'Palet cerrado correctamente (offline)', 'success');
        this.cerrarModalCerrarPalet();
      } catch (err) {
        console.error('Error cerrando palet offline:', err);
        this.alertService.cerrarModalCarga();
        this.alertService.showAlertAcept('Error', 'Error al cerrar el palet en modo offline', 'error');
      }
    }
  }

  async abrirModalEliminarPalet(palet: Palet): Promise<void> {
    const dpalets = await this.procesoRepo.dPaletsRepo.getByIdPalet(palet.idPalet ?? '');
    const activos = (dpalets ?? []).filter((d: any) => !(d as any)?.eliminado);

    const cajasHtml = activos.length
      ? activos.map((d: any) => `
        <div style="border-bottom:1px solid #eee;padding:4px 0;font-size:13px;">
          <strong>${d.consignatarioNombre || '-'}</strong> — ${d.destinoNombre || '-'}<br>
          <span style="color:#666">Cajas: ${d.cantidadCajas || 0} | Peso: ${this.formatPeso(d.pesoTotal || 0)} kg | Variedad: ${d.variedadNombre || '-'}</span>
        </div>
      `).join('')
      : '<div style="color:#999;font-size:13px;padding:4px 0;">Sin composiciones</div>';

    const detalleHtml = `
      <div style="text-align:left;font-size:14px;line-height:1.6">
        <strong>Palet #${palet.numeroPalet}</strong><br>
        <strong>Estado:</strong> ${palet.estado || '-'}<br>
        <strong>Cajas:</strong> ${palet.cantidadCajas || 0}<br>
        <strong>Peso total:</strong> ${this.formatPeso(palet.pesoTotal || 0)} kg<br>
        <hr style="margin:8px 0;border:none;border-top:1px solid #ddd;">
        <strong>Composiciones:</strong>
        <div style="max-height:120px;overflow-y:auto;margin-top:4px;">
          ${cajasHtml}
        </div>
      </div>
    `;

    const ok1 = await this.alertService.showOptions(
      `¿Desea eliminar el palet #${palet.numeroPalet}?`,
      detalleHtml,
      'warning',
      'Eliminar',
      'Cancelar'
    );
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
    this.alertService.mostrarModalCarga();

    const paletEliminado: Palet = {
      ...palet,
      eliminado: true,
      estado: 'ELIMINADO',
      bd: this.online ? 1 : 0,
      modo: 'editado'
    };

    if (this.online) {
      try {
        await firstValueFrom(this.paletService.sincronizar(paletEliminado));
        await this.procesoRepo.paletsRepo.saveByIdPalet(paletEliminado);

        this.paletSeleccionado.set(null);
        this.palets.update(palets =>
          palets.filter(p => String(p?.idPalet ?? '').trim() !== String(paletEliminado?.idPalet ?? '').trim())
        );

        this.alertService.cerrarModalCarga();
        this.alertService.showAlert('Éxito', 'Palet eliminado correctamente', 'success');
        const proceso = this.procesoSeleccionado();
        if (proceso) await this.listarPaletsForProceso(proceso.idProceso, { showLoading: false });
      } catch (err) {
        console.error('Error eliminando palet online:', err);
        this.alertService.cerrarModalCarga();
        const msg = (err as any)?.error?.message ?? 'Error al eliminar el palet';
        this.alertService.showAlertAcept('Error', String(msg), 'error');
      }
    } else {
      try {
        await this.procesoRepo.paletsRepo.saveByIdPalet(paletEliminado);

        this.paletSeleccionado.set(null);
        this.palets.update(palets =>
          palets.filter(p => String(p?.idPalet ?? '').trim() !== String(paletEliminado?.idPalet ?? '').trim())
        );

        this.alertService.cerrarModalCarga();
        this.alertService.showAlert('Éxito', 'Palet eliminado correctamente (offline)', 'success');
        const proceso = this.procesoSeleccionado();
        if (proceso) await this.listarPaletsForProceso(proceso.idProceso, { showLoading: false });
      } catch (err) {
        console.error('Error eliminando palet offline:', err);
        this.alertService.cerrarModalCarga();
        this.alertService.showAlertAcept('Error', 'Error al eliminar el palet en modo offline', 'error');
      }
    }
  }

  async reabrirPalet(palet: Palet): Promise<void> {
    const ok = await this.alertService.showConfirm('Confirmación', `¿Está seguro que desea reabrir el palet #${palet.numeroPalet}?`, 'warning');
    if (!ok) return;

    this.alertService.mostrarModalCarga();

    const paletReabierto: Palet = {
      ...palet,
      estado: 'ABIERTO',
      fechaCierre: '',
      bd: this.online ? 1 : 0,
      modo: 'editado'
    };

    if (this.online) {
      try {
        await firstValueFrom(this.paletService.sincronizar(paletReabierto));
        await this.procesoRepo.paletsRepo.saveByIdPalet(paletReabierto);

        this.paletSeleccionado.set(paletReabierto);
        this.palets.update(palets =>
          palets.map(p => {
            const pk = String(p?.idPalet ?? '').trim();
            const uk = String(paletReabierto?.idPalet ?? '').trim();
            return pk && uk && pk === uk ? paletReabierto : p;
          })
        );

        this.alertService.cerrarModalCarga();
        this.alertService.showAlert('Éxito', 'Palet reabierto correctamente', 'success');
        await this.verDetalle(paletReabierto);
      } catch (err) {
        console.error('Error reabriendo palet online:', err);
        this.alertService.cerrarModalCarga();
        const msg = (err as any)?.error?.message ?? 'Error al reabrir el palet';
        this.alertService.showAlertAcept('Error', String(msg), 'error');
      }
    } else {
      try {
        await this.procesoRepo.paletsRepo.saveByIdPalet(paletReabierto);

        this.paletSeleccionado.set(paletReabierto);
        this.palets.update(palets =>
          palets.map(p => {
            const pk = String(p?.idPalet ?? '').trim();
            const uk = String(paletReabierto?.idPalet ?? '').trim();
            return pk && uk && pk === uk ? paletReabierto : p;
          })
        );

        this.alertService.cerrarModalCarga();
        this.alertService.showAlert('Éxito', 'Palet reabierto correctamente (offline)', 'success');
        await this.verDetalle(paletReabierto);
      } catch (err) {
        console.error('Error reabriendo palet offline:', err);
        this.alertService.cerrarModalCarga();
        this.alertService.showAlertAcept('Error', 'Error al reabrir el palet en modo offline', 'error');
      }
    }
  }

  async eliminarComposicion(dpalet: DPalet): Promise<void> {
    const palet = this.paletSeleccionado();
    if (!palet) return;

    // Confirmación 1: mostrar detalle de lo que se eliminará
    const detalleHtml = `
      <div style="text-align:left;font-size:14px;line-height:1.6">
        <strong>Consignatario:</strong> ${dpalet.consignatarioNombre || '-'}<br>
        <strong>Destino:</strong> ${dpalet.destinoNombre || '-'}<br>
        <strong>Formato:</strong> ${dpalet.formatoNombre || '-'}<br>
        <strong>Variedad:</strong> ${dpalet.variedadNombre || '-'}<br>
        <strong>Cajas:</strong> ${dpalet.cantidadCajas}<br>
        <strong>Peso total:</strong> ${this.formatPeso(dpalet.pesoTotal)} kg
      </div>
    `;
    const ok1 = await this.alertService.showOptions(
      '¿Desea eliminar esta composición?',
      detalleHtml,
      'warning',
      'Eliminar',
      'Cancelar'
    );
    if (!ok1) return;

    // Confirmación 2: irreversible
    const ok2 = await this.alertService.showConfirm(
      'Acción irreversible',
      '¿Está seguro? Esta acción no se podrá recuperar.',
      'warning'
    );
    if (!ok2) return;

    try {
      this.alertService.mostrarModalCarga();

      // Marcar DPalet como eliminado (tanto online como offline)
      const dpaletEliminado: DPalet = {
        ...dpalet,
        eliminado: true,
        bd: this.online ? 1 : 0,
        idProceso: palet.idProceso
      };

      if (this.online) {
        // MODO ONLINE: sincronizar DPalet eliminado al servidor
        await firstValueFrom(this.paletService.sincronizarDPalets([dpaletEliminado]));
      }

      // Guardar en Dexie
      await this.procesoRepo.dPaletsRepo.saveByIdDPalet(dpaletEliminado);

      // Recalcular totales del palet desde DPalets no eliminados
      const dpalets = await this.procesoRepo.dPaletsRepo.getByIdPalet(palet.idPalet ?? '');
      const activos = (dpalets ?? []).filter((d: any) => !(d as any)?.eliminado);
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
        bd: this.online ? (palet.bd ?? 0) : 0
      };

      if (this.online) {
        // Sincronizar palet actualizado al servidor
        await firstValueFrom(this.paletService.sincronizar(paletActualizado));
        // Refrescar DPalets desde el servidor
        await this.sincronizarDPaletsPorAcopio();
      }

      // Guardar palet actualizado en Dexie y actualizar UI
      await this.procesoRepo.paletsRepo.saveByIdPalet(paletActualizado);
      this.paletSeleccionado.set(paletActualizado);
      this.palets.update(palets =>
        palets.map(item => {
          const pk = String(item?.idPalet ?? '').trim();
          const uk = String(paletActualizado?.idPalet ?? '').trim();
          return pk && uk && pk === uk ? paletActualizado : item;
        })
      );
      this.composiciones.set(activos);

      this.alertService.cerrarModalCarga();
      this.alertService.showAlert('Éxito', 'Composición eliminada correctamente', 'success');
    } catch (err) {
      console.error('Error eliminando composición:', err);
      this.alertService.cerrarModalCarga();
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

      if (presFiltrados.length === 1) {
        const autoVal = presFiltrados[0].id ?? 0;
        this.updateFormCajas('presentacionId', autoVal);
      } else if (presFiltrados.length === 0) {
        this.updateFormCajas('presentacionId', 0);
      }

      const todosTc = await this.catalogosRepo.tiposCajaRepo.getAll();
      const tcFiltrados = (todosTc ?? []).filter((t: any) => tiposCajaIds.includes(String(t?.id ?? '')));
      this.filteredTiposCaja.set(tcFiltrados);

      this.alertService.cerrarModalCarga();

    } catch (err) {
      console.error('Error cargando presentaciones/tiposCaja por matriz compatibilidad:', err);
      this.filteredPresentaciones.set([]);
      this.filteredTiposCaja.set([]);
      this.alertService.cerrarModalCarga();
      this.alertService.showAlert('Información', 'No existe matriz de compatibilidad para este tipo de empaque guía.', 'warning');
    }
  }

  onPresentacionChange(value: string): void {
    const presentacionId = (!value || value === 'NA' || value === '0') ? null : parseInt(value);
    this.updateFormCajas('presentacionId', presentacionId ?? 0);
    this.filteredTiposClamshell.set([]);
    this.updateFormCajas('tipoCajaId', 0);
    this.updateFormCajas('tipoClamshellId', 0);
    this.updateFormCajas('calibreId', 0);
    this.updateFormCajas('tipoEmpaqueId', 0);
    this.loadTiposCajaDinamicos(presentacionId, false);
  }

  private loadTiposCajaDinamicos(presentacionId: number | null, setFilteredTiposCaja: boolean = true): void {
    const f = this.formCajas();
    this.catalogoService.listarTiposDesdeMatriz({
      consignatarioId: f.consignatarioId, destinoId: f.destinoId,
      formatoId: f.formatoId, tipoEmpaqueGuiaId: f.tipoEmpaqueGuiaId,
      presentacionId: presentacionId
    }).subscribe({
      next: (r: any) => {
        const items = Array.isArray(r) ? r : r?.data ?? [];
        if (setFilteredTiposCaja) {
          const cajaMap = new Map<number, any>();
          items.forEach((i: any) => { if (i.TipoCajaId) cajaMap.set(i.TipoCajaId, { id: i.TipoCajaId, nombre: i.TipoCajaNombre }); });
          this.filteredTiposCaja.set(Array.from(cajaMap.values()));
        }
        this._matrizResults = items;
      },
      error: () => { if (setFilteredTiposCaja) this.filteredTiposCaja.set([]); }
    });
  }

  private _matrizResults: any[] = [];

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

      if (this.online) {
        const codigoCultivo = String(this.savedConfig()?.codigoCultivo ?? '').trim();
        const resp: any = await firstValueFrom(this.paletService.getTiposClamshellPorMatriz(codigoCultivo, f.consignatarioId.toString(), String(f.destinoId), f.formatoId, f.tipoEmpaqueGuiaId || 0));
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
          String(m?.tipoEmpaqueGuiaId ?? '') === String(f.tipoEmpaqueGuiaId)
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
    this.updateFormCajas('variedadId', '');
    this.updateFormCajas('variedadGuiaId', '');
    this._filtrarVariedadesPorEnsayo();
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
        console.log(data)
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

  getEstadoBadgeClass(estado: string): string {
    switch (estado) {
      case 'ABIERTO':
        return 'badge-abierto';
      case 'CERRADO_COMPLETO':
        return 'badge-cerrado-completo';
      case 'CERRADO_SALDO':
        return 'badge-cerrado-saldo';
      case 'DESPACHADO':
        return 'badge-despachado';
      default:
        return 'bg-secondary';
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
