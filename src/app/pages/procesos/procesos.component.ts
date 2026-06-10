import { Component, ChangeDetectionStrategy, inject, signal, OnInit, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ProcesoService } from '../../shared/services/proceso.service';
import { CatalogoService } from '../../shared/services/catalogo.service';
import { AuthService } from '../../shared/services/auth.service';
import { AlertService } from '../../shared/services/alert.service';
import { PermissionService } from '../../shared/services/permission.service';
import { DProcesoLogistico, DProcesoSupervisor, Proceso } from '../../shared/interfaces/proceso.interface';
import moment from 'moment';
import 'moment/locale/es';
import { formatDate, formatDateStandar, formatDateTime } from '../../shared/utils/datetime.utils';
import { CatalogosRepository } from '../../shared/dexiedb/repository/catalogos.repository';
import { Configuracion } from '../../shared/interfaces/administracion.interface';
import { ConnectivityService } from '../../shared/services/connectivity.service';
import { CatalogosOperativosRepository } from '../../shared/dexiedb/repository/catalogos-operacionales.repository';
import { firstValueFrom } from 'rxjs';
import { PersonalLogistico, Supervisor } from '../../shared/interfaces/catalogo.interface';
import { ProcesoRepository } from '../../shared/dexiedb/repository/proceso.repository';
import { ProcesosHistorialTablaComponent } from './components/procesos-historial-tabla/procesos-historial-tabla.component';

@Component({
  selector: 'app-procesos',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, ProcesosHistorialTablaComponent],
  templateUrl: './procesos.component.html',
  styleUrl: './procesos.component.scss'
})
export class ProcesosComponent implements OnInit {
  private readonly procesoService = inject(ProcesoService);
  private readonly catalogoService = inject(CatalogoService);
  private readonly auth = inject(AuthService);
  private readonly alertService = inject(AlertService);
  readonly permissions = inject(PermissionService);
  private readonly catalogosRepo = inject(CatalogosRepository);
  private readonly catalogosOperariosRepo = inject(CatalogosOperativosRepository);
  private readonly procesoRepo = inject(ProcesoRepository);
  private readonly connectivity = inject(ConnectivityService);
  readonly savedConfig = signal<Configuracion | null>(null);

  procesos = signal<Proceso[]>([]);
  procesosActivos = signal<Proceso[]>([]);
  acopios = signal<any[]>([]);
  campania = signal<any>({});
  isLoading = signal(true);
  isCreating = signal(false);

  sincronizadoLabel(db?: number): string {
    return db === 1 ? 'Sincronizado' : 'No sincronizado';
  }

  sincronizadoClass(db?: number): string {
    return db === 1 ? 'sp-badge sp-badge-success' : 'sp-badge sp-badge-danger';
  }
  filterFecha = signal('');
  acopioSeleccionado = signal<string | null>(null);

  supNombresByProceso = signal<Record<string, string>>({});
  logNombresByProceso = signal<Record<string, string>>({});
  supPersonalByProceso = signal<Record<string, Supervisor[]>>({});
  logPersonalByProceso = signal<Record<string, PersonalLogistico[]>>({});

  // Personal disponible signals
  supervisoresDisponibles = signal<Supervisor[]>([]);
  logisticosDisponibles = signal<PersonalLogistico[]>([]);
  cargandoPersonal = signal(false);

  readonly perfil = this.auth.perfil;
  readonly usuario = this.auth.usuario;
  readonly activeCampaniaId = signal<string | null>(null);

  get online(): boolean {
    return this.connectivity.isOnline();
  }
  readonly activeLabel = computed(() => {
    const c = this.campania();
    console.log('c', c)
    if (!c) return '—';
    const left = String(c.idproyecto ?? '').trim();
    const right = String(c.descripcion ?? '').trim();
    if (left && right && left !== right) return `${left} — ${right}`;
    return left || right || '—';
  });

  readonly campaniaActiva = computed(() => {
    const lista = this.campania();
    const activa = lista.find((c: any) => c.Activa) ?? lista[0] ?? null;
    return activa;
  });

  readonly historial = computed(() => {
    const fecha = this.filterFecha();
    const lista = this.procesos();
    if (!fecha) return lista;
    return lista.filter((p: any) => {
      if (!p.fechaProceso) return false;
      const fechaProceso = p.fechaProceso.split('T')[0];
      return fechaProceso === fecha;
    });
  });

  nuevoProceso = signal<{ fechaProceso: string; turno: string; supervisores: Supervisor[]; logisticos: PersonalLogistico[] }>({
    fechaProceso: new Date().toISOString().split('T')[0],
    turno: '',
    supervisores: [],
    logisticos: []
  });

  private syncProcesosActivosFromLista(lista: Proceso[]): void {
    // Para ADMIN/COORDINACION la pantalla muestra procesos abiertos en una grilla
    // usando la data del listado completo.
    if (this.perfil() === 'ADMINISTRADOR' || this.perfil() === 'COORDINACION') {
      const abiertos = (lista ?? []).filter(p => p.estado === 'ABIERTO');
      this.procesosActivos.set(abiertos);
    }
  }

  async ngOnInit(): Promise<void> {
    console.log('aa',this.auth.usuario())
    await this.cargarConfiguracion();
    await this.cargarDesdeDexieCampania();
    await this.cargarPersonalDisponible();
    await this.cargarProcesos()
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

  private async cargarDesdeDexieCampania(): Promise<void> {
    try {
      const campania = await this.catalogosRepo.campaniaRepo.getByField('idproyecto', this.savedConfig()?.idProyecto || '');
      this.campania.set(campania);
    } catch (error) {
      console.log('Error cargando campanias desde Dexie', error);
      this.campania.set([]);
    }
  }

  fmtDateRange(inicio: unknown, fin: unknown): string {
    const a = formatDate(inicio);
    const b = formatDate(fin);
    if (a && b) return `${a} — ${b}`;
    return a ?? b ?? '—';
  }

  normalizarProceso(proceso: any): {
    proceso: Proceso;
    dProcesoLogisticos: DProcesoLogistico[];
    dProcesoSupervisores: DProcesoSupervisor[];
  } {
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

    const dProcesoLogisticos: DProcesoLogistico[] = (Array.isArray(proceso?.logisticos) ? proceso.logisticos : []).map((it: any) => ({
      id: it?.id ?? undefined,
      idProceso: String(it?.idProceso ?? p.idProceso ?? '').trim(),
      idLogistico: Number(it?.idLogistico ?? 0),
      fechaCreacion: it?.fechaCreacion ?? undefined,
      db: 1
    }));

    const dProcesoSupervisores: DProcesoSupervisor[] = (Array.isArray(proceso?.supervisores) ? proceso.supervisores : []).map((it: any) => ({
      id: it?.id ?? undefined,
      idProceso: String(it?.idProceso ?? p.idProceso ?? '').trim(),
      idSupervisor: Number(it?.idSupervisor ?? 0),
      fechaCreacion: it?.fechaCreacion ?? undefined,
      db: 1
    }));

    return { proceso: p, dProcesoLogisticos, dProcesoSupervisores };
  }

  private async cargarNombresPersonalParaProcesos(lista: Proceso[]): Promise<void> {
    const supervisores = await this.catalogosOperariosRepo.supervisoresRepo.getAll();
    const logisticos = await this.catalogosOperariosRepo.personalLogisticoRepo.getAll();

    const supById = new Map<number, Supervisor>((supervisores ?? []).map((s) => [Number((s as any).id), s as Supervisor]));
    const logById = new Map<number, PersonalLogistico>((logisticos ?? []).map((l) => [Number((l as any).id), l as PersonalLogistico]));

    const supNombres: Record<string, string> = {};
    const logNombres: Record<string, string> = {};
    const supPersonal: Record<string, Supervisor[]> = {};
    const logPersonal: Record<string, PersonalLogistico[]> = {};

    for (const p of lista ?? []) {
      const idProceso = String(p?.idProceso ?? '').trim();
      if (!idProceso) continue;

      const relSup = await this.procesoRepo.dProcesoSupervisoresRepo.getByFields({ idProceso });
      const relLog = await this.procesoRepo.dProcesoLogisticosRepo.getByFields({ idProceso });

      const supList = (relSup ?? [])
        .map((r) => supById.get(Number((r as any).idSupervisor)))
        .filter((x): x is Supervisor => !!x);
      const logList = (relLog ?? [])
        .map((r) => logById.get(Number((r as any).idLogistico)))
        .filter((x): x is PersonalLogistico => !!x);

      const supUnique = Array.from(new Map(supList.map(s => [Number((s as any).id), s])).values());
      const logUnique = Array.from(new Map(logList.map(l => [Number((l as any).id), l])).values());

      supPersonal[idProceso] = supUnique;
      logPersonal[idProceso] = logUnique;

      supNombres[idProceso] = supUnique.map(s => String((s as any).nombreCompleto ?? '').trim()).filter(x => x.length > 0).join(', ');
      logNombres[idProceso] = logUnique.map(l => String((l as any).nombreCompleto ?? '').trim()).filter(x => x.length > 0).join(', ');
    }

    this.supNombresByProceso.set(supNombres);
    this.logNombresByProceso.set(logNombres);
    this.supPersonalByProceso.set(supPersonal);
    this.logPersonalByProceso.set(logPersonal);
  }

  getSupervisoresTexto(idProceso: string): string {
    return this.supNombresByProceso()[String(idProceso ?? '').trim()] ?? '';
  }

  getLogisticosTexto(idProceso: string): string {
    return this.logNombresByProceso()[String(idProceso ?? '').trim()] ?? '';
  }

  getSupervisoresLista(idProceso: string): Supervisor[] {
    return this.supPersonalByProceso()[String(idProceso ?? '').trim()] ?? [];
  }

  getLogisticosLista(idProceso: string): PersonalLogistico[] {
    return this.logPersonalByProceso()[String(idProceso ?? '').trim()] ?? [];
  }

  async listarProcesosApi(): Promise<void> {
    console.log('Listar Procesos...')
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
          dProcesoLogisticos: DProcesoLogistico[];
          dProcesoSupervisores: DProcesoSupervisor[];
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
          for (const d of n.dProcesoLogisticos) {
            await this.procesoRepo.dProcesoLogisticosRepo.saveByCompoundId(d as any);
          }
          for (const d of n.dProcesoSupervisores) {
            await this.procesoRepo.dProcesoSupervisoresRepo.saveByCompoundId(d as any);
          }
        }
        const listaProcesos = await this.procesoRepo.procesosRepo.getAll();
        this.procesos.set(listaProcesos);
        this.procesosActivos.set((listaProcesos ?? []).filter((p: Proceso) => p.estado === 'ABIERTO'));
        await this.cargarNombresPersonalParaProcesos(listaProcesos);
        this.isLoading.set(false);
        return;
      }
    }
  }

  updateNuevoProceso(field: string, value: unknown): void {
    this.nuevoProceso.update(prev => ({ ...prev, [field]: value }));
    if (field === 'fechaProceso' || field === 'turno') {
      if (field === 'turno') {
        this.nuevoProceso.update(prev => ({ ...prev, supervisores: [], logisticos: [] }));
      }
      this.cargarPersonalDisponible();
    }
    if (field === 'acopioId') {
      this.acopioSeleccionado.set(value as string);
      this.cargarProcesosPorAcopio(value as string);
    }
  }

  cargarProcesosPorAcopio(codigoAcopio: string): void {
    // if (!codigoAcopio) {
    //   this.procesos.set([]);
    //   return;
    // }
    // this.isLoading.set(true);
    // this.procesoService.listarPorAcopio(codigoAcopio).subscribe({
    //   next: (res: any) => {
    //     const raw = res?.data ?? res;
    //     const data = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : Array.isArray(raw?.items) ? raw.items : [];
    //     this.procesosActivos.set(data);
    //     this.isLoading.set(false);
    //   },
    //   error: (err: any) => {
    //     this.procesosActivos.set([]);
    //     this.isLoading.set(false);
    //     this.alertService.showAlert('Error', 'Error al cargar procesos por acopio', 'error');
    //   }
    // });
  }

  async sincronizarSupervisores(): Promise<void> {
    console.log('Sincronizar supervisores...')
    // Sincronizar Supervisores
    let respDisponiblesSuper: any = await firstValueFrom(this.catalogoService.listarSupervisoresDisponibles(this.savedConfig()?.idProyecto, this.nuevoProceso().fechaProceso))
    if (respDisponiblesSuper.length > 0) {
      let respSuper = respDisponiblesSuper[0]
      if (!respSuper.error) {
        if (respSuper.data.length > 0) {
          let dexiedb = await this.catalogosOperariosRepo.supervisoresRepo.getAll()
          if (dexiedb.length > 0) {
            await this.catalogosOperariosRepo.supervisoresRepo.clear()
          }
          for (const supervisor of respSuper.data) {
            supervisor.bd = 1
            await this.catalogosOperariosRepo.supervisoresRepo.save(supervisor);
          }
          let supervisores: any = await this.catalogosOperariosRepo.supervisoresRepo.getActivos();
          this.supervisoresDisponibles.set(Array.isArray(supervisores) ? supervisores : []);
        }
      }
    }
  }
  async sincronizarPersonalLogistica(): Promise<void> {
    console.log('sincronizar Personal Logistico')
    let respDisponibles = await firstValueFrom(this.catalogoService.listarPersonaLogisticoDisponibles(this.savedConfig()?.idProyecto, this.nuevoProceso().fechaProceso))
    if (respDisponibles.length > 0) {
      let resp = respDisponibles[0]
      if (!resp.error) {
        if (resp.data.length > 0) {
          let dexiedb = await this.catalogosOperariosRepo.personalLogisticoRepo.getAll()
          if (dexiedb.length > 0) {
            await this.catalogosOperariosRepo.personalLogisticoRepo.clear()
          }
          for (const personalLogistico of resp.data) {
            personalLogistico.bd = 1
            await this.catalogosOperariosRepo.personalLogisticoRepo.save(personalLogistico);
          }
          let logisticos: any = await this.catalogosOperariosRepo.personalLogisticoRepo.getActivos();
          this.logisticosDisponibles.set(Array.isArray(logisticos) ? logisticos : []);
        }
      }
    }
  }

  async cargarProcesos(): Promise<void> {
    this.isLoading.set(true);
    this.procesos.set([]);
    this.procesosActivos.set([])
    if (this.online) {
      await this.listarProcesosApi()
    } else {
      const listaProcesos = await this.procesoRepo.procesosRepo.getAll();
      this.procesos.set(listaProcesos);
      this.procesosActivos.set((listaProcesos ?? []).filter((p: Proceso) => p.estado === 'ABIERTO'));
      await this.cargarNombresPersonalParaProcesos(listaProcesos);
      this.isLoading.set(false);
      return
    }
  }

  async cargarPersonalDisponible(): Promise<void> {
    this.supervisoresDisponibles.set([]);
    this.logisticosDisponibles.set([]);
    if (this.online) {
      await this.sincronizarSupervisores()
      await this.sincronizarPersonalLogistica()
    } else {
      let supervisores: any = await this.catalogosOperariosRepo.supervisoresRepo.getActivos();
      let logisticos: any = await this.catalogosOperariosRepo.personalLogisticoRepo.getActivos();
      this.supervisoresDisponibles.set(Array.isArray(supervisores) ? supervisores : []);
      this.logisticosDisponibles.set(Array.isArray(logisticos) ? logisticos : []);
      return;
    }
  }

  toggleSupervisor(sup: any, checked: boolean, event?: Event): void {
    const current = this.nuevoProceso().supervisores;
    const next = checked
      ? Array.from(new Set([...current, sup]))
      : current.filter(x => x !== sup);
    if (next.length > 2) {
      this.alertService.showAlert('Validación', 'Máximo 2 supervisores permitidos', 'warning');
      const input = event?.target as HTMLInputElement | undefined;
      if (input) input.checked = false;
      this.nuevoProceso.update(prev => ({ ...prev }));
      return;
    }
    this.nuevoProceso.update(prev => ({ ...prev, supervisores: next }));
  }

  isSupervisorSeleccionado(sup: Supervisor): boolean {
    return this.nuevoProceso().supervisores.includes(sup);
  }

  async sincronizar() {
    console.log('Sincronizar...')
    try {
      if (!this.online) {
        this.alertService.showAlert('Sin conexión', 'Necesitas internet para sincronizar.', 'warning')
        return;
      }

      const idProyecto = String(this.savedConfig()?.idProyecto ?? '').trim();
      const codigoCultivo = String(this.savedConfig()?.codigoCultivo ?? '').trim();
      if (!idProyecto || !codigoCultivo) {
        this.alertService.cerrarModalCarga();
        this.alertService.showAlertAcept('Error', 'No hay campaña/configuración activa para sincronizar.', 'error');
        return;
      }

      const pendientes = (await this.procesoRepo.procesosRepo.getNoSincronizados())
        .filter((p: any) => String(p?.idProyecto ?? '').trim() === idProyecto);

      if (pendientes.length > 0) {
        const confirmar = await this.alertService.showConfirm(
          'Confirmar sincronización',
          `Se sincronizarán ${pendientes.length} proceso(s) pendientes. ¿Deseas continuar?`,
          'question'
        );
        if (!confirmar) {
          return;
        }
      }

      this.alertService.mostrarModalCarga();

      let mensajeFinal: { title: string; message: string; type: 'success' | 'warning' | 'error' } | null = null;

      if (pendientes.length > 0) {
        for (const p of pendientes) {
          const idProceso = String((p as any)?.idProceso ?? '').trim();
          if (!idProceso) continue;

          const proceso: Proceso = {
            ...(p as any),
            db: 0,
          } as any;

          const dLog = await this.procesoRepo.dProcesoLogisticosRepo.getNoSincronizadosByIdProceso(idProceso);
          const dSup = await this.procesoRepo.dProcesoSupervisoresRepo.getNoSincronizadosByIdProceso(idProceso);

          if (!dSup.length || dSup.length > 2) {
            this.alertService.cerrarModalCarga();
            this.alertService.showAlertAcept('Validación', `El proceso ${idProceso} tiene supervisores inválidos (debe tener 1 a 2).`, 'warning');
            return;
          }
          if (!dLog.length || dLog.length > 5) {
            this.alertService.cerrarModalCarga();
            this.alertService.showAlertAcept('Validación', `El proceso ${idProceso} tiene logística inválida (debe tener 1 a 5).`, 'warning');
            return;
          }

          const resp = await firstValueFrom(this.procesoService.sincronizar(
            proceso,
            dLog as any,
            dSup as any,
            codigoCultivo,
            idProyecto
          )
          );

          if (!Array.isArray(resp) || resp.length === 0) {
            this.alertService.cerrarModalCarga();
            this.alertService.showAlertAcept('Error', `No se pudo sincronizar el proceso ${idProceso}.`, 'error');
            return;
          }

          if (resp[0]?.error) {
            this.alertService.cerrarModalCarga();
            this.alertService.showAlertAcept('Error', resp[0]?.mensaje ?? `Error al sincronizar el proceso ${idProceso}.`, 'error');
            return;
          }

          (proceso as any).db = 1;
          await this.procesoRepo.procesosRepo.saveByIdProceso(proceso as any);

          for (const d of dLog) {
            (d as any).db = 1;
            await this.procesoRepo.dProcesoLogisticosRepo.saveByCompoundId(d as any);
          }
          for (const d of dSup) {
            (d as any).db = 1;
            await this.procesoRepo.dProcesoSupervisoresRepo.saveByCompoundId(d as any);
          }
        }

        mensajeFinal = {
          title: 'Éxito',
          message: `Sincronización completada (${pendientes.length} proceso(s)).`,
          type: 'success'
        };
      } else {
        mensajeFinal = {
          title: 'Info',
          message: 'No hay procesos pendientes de sincronización.',
          type: 'success'
        };
      }

      await this.sincronizarSupervisores();
      await this.sincronizarPersonalLogistica();
      await this.listarProcesosApi();

      this.alertService.cerrarModalCarga();

      if (mensajeFinal) {
        this.alertService.showAlert(mensajeFinal.title, mensajeFinal.message, mensajeFinal.type);
      }
      return;
    } catch (e: any) {
      this.alertService.cerrarModalCarga();
      this.alertService.showAlertAcept('Error', `Error al sincronizar: ${e?.message ?? e}`, 'error');
      return;
    }
  }

  toggleLogistico(log: PersonalLogistico, checked: boolean, event?: Event): void {
    const current = this.nuevoProceso().logisticos;
    const next = checked
      ? Array.from(new Set([...current, log]))
      : current.filter(x => x !== log);
    if (next.length > 5) {
      this.alertService.showAlert('Validación', 'Máximo 5 personal de logística permitidos', 'warning');
      const input = event?.target as HTMLInputElement | undefined;
      if (input) input.checked = false;
      this.nuevoProceso.update(prev => ({ ...prev }));
      return;
    }
    this.nuevoProceso.update(prev => ({ ...prev, logisticos: next }));
  }

  isLogisticoSeleccionado(log: PersonalLogistico): boolean {
    return this.nuevoProceso().logisticos.includes(log);
  }

  limpiarNewProceso() {
    this.nuevoProceso.set({
      fechaProceso: new Date().toISOString().split('T')[0],
      turno: '',
      supervisores: [],
      logisticos: []
    });

  }

  async crearProceso(): Promise<void> {
    const newProceso = this.nuevoProceso();
    const usr = this.usuario();
    const codigoAcopio = usr?.codigoAcopio ?? '';
    if (!codigoAcopio || codigoAcopio === '0') {
      this.alertService.showAlertAcept('Validación', 'Su usuario no tiene un acopio asignado. Por favor, comuníquese con el administrador del sistema para solicitar la configuración correspondiente.', 'warning');
      return;
    }
    if (!newProceso.fechaProceso) {
      this.alertService.showAlert('Validación', 'Complete la fecha.', 'warning');
      return;
    }
    if (!newProceso.turno) {
      this.alertService.showAlert('Validación', 'Complete el turno.', 'warning');
      return;
    }
    if (!newProceso.supervisores || newProceso.supervisores.length < 1 || newProceso.supervisores.length > 2) {
      this.alertService.showAlert('Validación', 'Seleccione entre 1 y 2 supervisores.', 'warning');
      return;
    }
    if (!newProceso.logisticos || newProceso.logisticos.length < 1 || newProceso.logisticos.length > 5) {
      this.alertService.showAlert('Validación', 'Seleccione entre 1 y 5 personal de logística.', 'warning');
      return;
    }
    this.isCreating.set(true);
    this.alertService.mostrarModalCarga();
    try {
      if (this.online) {
        let respValidacion = await firstValueFrom(this.procesoService.buscar(this.savedConfig()?.codigoCultivo || '', newProceso.turno, this.savedConfig()?.idProyecto || '', newProceso.fechaProceso || ''))
        if (respValidacion.length > 0) {
          if (respValidacion[0].error) {
            this.alertService.showAlertAcept('Error', respValidacion[0].mensaje, 'error');
            this.limpiarNewProceso()
            return;
          } else {
            if (respValidacion[0].data.length > 0) {
              this.alertService.showAlertAcept('Error', `Este acopio ya tiene un proceso para la fecha ${newProceso.fechaProceso} en el turno ${newProceso.turno} y ${this.campania().descripcion}.`, 'error');
              this.limpiarNewProceso()
              return;
            }
          }
        }

        const idProceso = this.crearIdProceso(newProceso.fechaProceso, newProceso.turno)

        const existente = await this.procesoRepo.procesosRepo.getByField('idProceso', idProceso);
        console.log('existente', existente)
        if (existente && (existente as any)?.db !== 1) {
          if (existente.db == 1) {
            this.alertService.cerrarModalCarga();
            this.alertService.showAlertAcept(
              'Conflicto',
              `Este acopio ya tiene un proceso para la fecha ${newProceso.fechaProceso} en el turno ${newProceso.turno} y ${this.campania().descripcion}.`,
              'warning'
            );
            this.limpiarNewProceso()
            this.isCreating.set(false);
            return;
          } else {
            this.alertService.cerrarModalCarga();
            this.alertService.showAlertAcept(
              'Conflicto',
              `Ya existe un proceso creado para el turno ${newProceso.turno} y fecha ${newProceso.fechaProceso}, POR FAVOR SINCRONICE.`,
              'warning'
            );
            this.limpiarNewProceso()
            this.isCreating.set(false);
            return;
          }
        }

        let fecha = new Date();
        let fechaApertura = formatDateTime(fecha);
        const proceso: Proceso = {
          idProceso: idProceso,
          idProyecto: this.savedConfig()?.idProyecto || '',
          codigoAcopio: this.usuario()?.codigoAcopio || '',
          acopioNombre: this.usuario()?.acopioNombre || '',
          fechaProceso: newProceso.fechaProceso,
          estado: 'ABIERTO',
          fechaApertura: fechaApertura ? fechaApertura : '',
          turno: newProceso.turno
        }

        const procesoLogistico: DProcesoLogistico[] = newProceso.logisticos.map((logistico, index) => ({
          // id: index + 1,
          idProceso: idProceso,
          idLogistico: logistico.id,
        }))

        const procesoSupervisor: DProcesoSupervisor[] = newProceso.supervisores.map((supervisor, index) => ({
          // id: index + 1,
          idProceso: idProceso,
          idSupervisor: supervisor.id,
        }))

        let resp = await firstValueFrom(this.procesoService.sincronizar(proceso, procesoLogistico, procesoSupervisor, this.savedConfig()?.codigoCultivo || '', this.savedConfig()?.idProyecto || ''))
        if (resp.length > 0) {
          if (resp[0].error) {
            this.alertService.showAlertAcept('Error', resp[0].mensaje, 'error');
            this.limpiarNewProceso()
            this.isCreating.set(false);
            this.alertService.cerrarModalCarga();
            return
          } else {
            this.alertService.showAlert('Éxito', `${resp[0].mensaje} - Sincronizado`, 'success');
            this.listarProcesosApi()
            this.limpiarNewProceso()
            this.isCreating.set(false);
            this.alertService.cerrarModalCarga();
            return
          }
        } else {
          this.alertService.showAlertAcept('Error', 'Error al sincronizar', 'error');
          this.limpiarNewProceso()
          this.isCreating.set(false);
          this.alertService.cerrarModalCarga();
          return
        }
      } else {
        const idProceso = this.crearIdProceso(newProceso.fechaProceso, newProceso.turno);

        const existente = await this.procesoRepo.procesosRepo.getByField('idProceso', idProceso);
        if (existente && (existente as any)?.db !== 1) {
          this.alertService.cerrarModalCarga();
          this.alertService.showAlertAcept(
            'Conflicto',
            `Este acopio ya tiene un proceso para la fecha ${newProceso.fechaProceso} en el turno ${newProceso.turno} y ${this.campania().descripcion}.`,
            'warning'
          );
          this.isCreating.set(false);
          return;
        }

        const fecha = new Date();
        const fechaApertura = formatDateTime(fecha) ?? '';

        const proceso: Proceso = {
          idProceso,
          idProyecto: this.savedConfig()?.idProyecto || '',
          codigoAcopio: this.usuario()?.codigoAcopio || '',
          acopioNombre: this.usuario()?.acopioNombre || '',
          fechaProceso: newProceso.fechaProceso,
          estado: 'ABIERTO',
          fechaApertura,
          turno: newProceso.turno,
          db: 0
        } as any;

        const procesoLogistico: DProcesoLogistico[] = newProceso.logisticos.map((logistico) => ({
          id: logistico.id,
          idProceso,
          idLogistico: logistico.id,
          fechaCreacion: fechaApertura,
          db: 0
        } as any));

        const procesoSupervisor: DProcesoSupervisor[] = newProceso.supervisores.map((supervisor) => ({
          id: supervisor.id,
          idProceso,
          idSupervisor: supervisor.id,
          fechaCreacion: fechaApertura,
          db: 0
        } as any));

        await this.procesoRepo.procesosRepo.saveByIdProceso(proceso as any);

        await this.procesoRepo.dProcesoLogisticosRepo.deleteByIdProceso(idProceso);
        await this.procesoRepo.dProcesoSupervisoresRepo.deleteByIdProceso(idProceso);

        for (const d of procesoLogistico) {
          await this.procesoRepo.dProcesoLogisticosRepo.saveByCompoundId(d as any);
        }
        for (const d of procesoSupervisor) {
          await this.procesoRepo.dProcesoSupervisoresRepo.saveByCompoundId(d as any);
        }

        const listaProcesos = await this.procesoRepo.procesosRepo.getAll();
        this.procesos.set(listaProcesos);
        this.procesosActivos.set((listaProcesos ?? []).filter((p: Proceso) => p.estado === 'ABIERTO'));
        await this.cargarNombresPersonalParaProcesos(listaProcesos);

        this.alertService.cerrarModalCarga();
        this.alertService.showAlert('Guardado', 'Proceso guardado localmente (pendiente de sincronización).', 'success');
        this.limpiarNewProceso();
        this.isCreating.set(false);
        return;
      }
    } catch (error) {
      console.error('Error al crear proceso', error)
      this.isCreating.set(false);
      this.alertService.cerrarModalCarga();
      this.alertService.showAlertAcept('Error', `Error: ${error}, vuelva a iniciar sesión`, 'error');
      return;
    }
  }

  crearIdProceso(fechaProceso: string, turno: string) {
    const idProyecto = this.savedConfig()?.idProyecto?.trim();
    const idEmpresa = this.usuario()?.idempresa?.trim();
    const codigoCultivo = this.savedConfig()?.codigoCultivo?.trim();
    const codigoAcopio = this.usuario()?.codigoAcopio?.trim();
    const fecha = formatDateStandar(fechaProceso)?.trim();
    const turnoValue = turno?.trim();

    const campos = [
      { nombre: 'idProyecto', valor: idProyecto },
      { nombre: 'idEmpresa', valor: idEmpresa },
      { nombre: 'codigoCultivo', valor: codigoCultivo },
      { nombre: 'codigoAcopio', valor: codigoAcopio },
      { nombre: 'fecha', valor: fecha },
      { nombre: 'turno', valor: turnoValue }
    ];

    const faltantes = campos
      .filter(c => !c.valor)
      .map(c => c.nombre);

    if (faltantes.length > 0) {
      this.alertService.showAlertAcept('Error', `Faltan datos para generar el idProceso: ${faltantes.join(', ')}, vuelva a iniciar sesión`, 'error');
      throw new Error(`Faltan datos para generar el idProceso: ${faltantes.join(', ')}`);

    }

    return [
      idProyecto,
      idEmpresa,
      codigoCultivo,
      codigoAcopio,
      fecha,
      turnoValue
    ].join('');
  }

  async cerrarProceso(p: Proceso): Promise<void> {
    console.log(p)
    const confirmar = await this.alertService.showConfirm(
      'Confirmar',
      `Esta seguro de cerrar el proceso. ¿Deseas continuar?`,
      'question'
    );
    if (!confirmar) {
      return;
    }
    const idProceso = String((p as any)?.idProceso ?? '').trim();
    const proceso: Proceso = {
      ...(p as any),
      db: 0,
    } as any;

    const dLog = await this.procesoRepo.dProcesoLogisticosRepo.getSincronizadosByIdProceso(idProceso);
    const dSup = await this.procesoRepo.dProcesoSupervisoresRepo.getSincronizadosByIdProceso(idProceso);

    const resp = await firstValueFrom(this.procesoService.sincronizar(proceso,dLog as any,dSup as any,this.savedConfig()?.codigoCultivo ?? '',this.savedConfig()?.idProyecto ?? '',"cerrar"));

    if (!Array.isArray(resp) || resp.length === 0) {
      this.alertService.cerrarModalCarga();
      this.alertService.showAlertAcept('Error', `No se pudo sincronizar el proceso ${idProceso}.`, 'error');
      return;
    }

    if (resp[0]?.error) {
      this.alertService.cerrarModalCarga();
      this.alertService.showAlertAcept('Error', resp[0]?.mensaje ?? `Error al sincronizar el proceso ${idProceso}.`, 'error');
      return;
    }else{
      await this.sincronizarSupervisores();
      await this.sincronizarPersonalLogistica();
      await this.listarProcesosApi();
      this.alertService.cerrarModalCarga();
      this.alertService.showAlert('Éxito', resp[0].mensaje, 'success');
    }
    console.log(resp)
  }

  async reabrirProceso(p: Proceso): Promise<void> {
    // const ok = await this.alertService.showConfirm('Confirmación', '¿Reabrir este proceso? Se volverá a estado ABIERTO.', 'warning');
    // if (!ok) return;

    // this.alertService.mostrarModalCarga();
    // this.procesoService.reabrir(p.id).subscribe({
    //   next: () => {
    //     this.alertService.cerrarModalCarga();
    //     this.alertService.showAlert('Éxito', 'Proceso reabierto exitosamente', 'success');
    //     this.cargarDatos();
    //   },
    //   error: () => {
    //     this.alertService.cerrarModalCarga();
    //     this.alertService.showAlertAcept('Error', 'Error al reabrir proceso', 'error');
    //   }
    // });
  }

  formatearFechaLarga(fecha: string): string {
    if (!fecha) return '';
    const d = moment(fecha);
    return d.format('dddd, D [de] MMMM [de] YYYY');
  }

  formatearFechaCorta(fecha: string): string {
    if (!fecha) return '';
    const d = moment(fecha);
    return d.format('DD/MM/YYYY');
  }

  formatearFechaHora(fecha: string | null): string {
    if (!fecha) return '—';
    const d = moment(fecha);
    return d.format('DD/MM/YYYY, HH:mm');
  }

  limpiarFiltroFecha(): void {
    this.filterFecha.set('');
  }
}
