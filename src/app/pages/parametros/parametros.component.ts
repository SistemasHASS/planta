import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { AuthService } from "../../shared/services/auth.service";
import { CatalogoService } from "../../shared/services/catalogo.service";
import { firstValueFrom } from "rxjs";
import { CatalogosOperativosRepository } from "../../shared/dexiedb/repository/catalogos-operacionales.repository";
import { CatalogosRepository } from "../../shared/dexiedb/repository/catalogos.repository";
import { AlertService } from "../../shared/services/alert.service";
import { ConnectivityService } from "../../shared/services/connectivity.service";
import { Configuracion, MatrizCompatibilidad, Usuario } from "../../shared/interfaces/administracion.interface";
import { AdvancedSelectComponent } from "../../shared/components/advanced-select/advanced-select.component";
import { Fundo, Cultivo, Campania, AcopioDetalle } from "../../shared/interfaces/catalogo.interface";
import { AdministracionRepository } from "../../shared/dexiedb/repository/administracion.repository";
import { AdministracionService } from "../../shared/services/administracion.service";
import { ProcesoService } from "../../shared/services/proceso.service";
import { PaletService } from "../../shared/services/palet.service";
import { DPalet } from "../../shared/interfaces/palet.interface";
import { DProcesoLogistico, DProcesoSupervisor, Proceso } from "../../shared/interfaces/proceso.interface";
import { ProcesoRepository } from "../../shared/dexiedb/repository/proceso.repository";


@Component({
    selector: 'app-parametros',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [FormsModule, AdvancedSelectComponent],
    templateUrl: './parametros.component.html',
    styleUrls: ['./parametros.component.scss']
})
export class ParametrosComponent implements OnInit {
    private readonly auth = inject(AuthService);
    private readonly catalogoService = inject(CatalogoService);
    private readonly catalogosOperativosRepo = inject(CatalogosOperativosRepository);
    private readonly catalogosRepo = inject(CatalogosRepository);
    private readonly adminRepo = inject(AdministracionRepository)
    private readonly alertService = inject(AlertService);
    private readonly connectivity = inject(ConnectivityService);
    private readonly administracionService = inject(AdministracionService);
    private readonly procesoService = inject(ProcesoService)
    private readonly paletService = inject(PaletService);
    private readonly procesoRepo = inject(ProcesoRepository);
    

    readonly nombreCompleto = this.auth.nombreCompleto;
    readonly inicialUsuario = this.auth.inicialUsuario;
    readonly usuario = this.auth.usuario;
    readonly configuracion = signal<Configuracion>({
        nrodocumento: '',
        idFundo: '',
        idProyecto: '',
        codigoCultivo: '',
    });

    readonly fundos = signal<Fundo[]>([]);
    readonly cultivos = signal<Cultivo[]>([]);
    readonly campanias = signal<Campania[]>([]);

    readonly selectedFundoId = signal<string | number | null>(null);
    readonly selectedCultivoId = signal<string | number | null>(null);
    readonly selectedCampaniaId = signal<string | number | null>(null);

    readonly selectedFundoCodigo = computed(() => {
        const id = this.selectedFundoId();
        if (id === null || id === undefined || id === '') return '';
        const it = this.fundos().find(x => String((x as any)?.id) === String(id));
        return String((it as any)?.codigoFundo ?? '').trim();
    });

    readonly selectedCultivoCodigo = computed(() => {
        const id = this.selectedCultivoId();
        if (id === null || id === undefined || id === '') return '';
        const it = this.cultivos().find(x => String((x as any)?.id) === String(id));
        return String((it as any)?.codigo ?? '').trim();
    });

    readonly selectedCampania = computed(() => {
        const id = String(this.selectedCampaniaId() ?? '').trim();
        if (!id) return null;
        return (this.campanias() as any[]).find(x => String((x as any)?.idproyecto ?? '').trim() === id) ?? null;
    });

    readonly filteredCampanias = computed(() => {
        const codigoFundo = this.selectedFundoCodigo();
        const codigoCultivo = this.selectedCultivoCodigo();
        if (!codigoFundo || !codigoCultivo) return [];
        const list: any[] = this.campanias() as any;
        return (list ?? []).filter(c => String(c?.idfundo ?? '').trim() === codigoFundo && String(c?.codcultivo ?? '').trim() === codigoCultivo);
    });

    readonly savedConfig = signal<Configuracion | null>(null);

    readonly currentFundoLabel = computed(() => {
        const id = this.selectedFundoId();
        if (id === null || id === undefined || id === '') return '—';
        const it = this.fundos().find(x => String((x as any)?.id) === String(id));
        return it ? `${(it as any).codigoFundo ?? (it as any).fundo ?? it.id} — ${it.nombreFundo ?? ''}`.trim() : String(id);
    });

    readonly currentCultivoLabel = computed(() => {
        const id = this.selectedCultivoId();
        if (id === null || id === undefined || id === '') return '—';
        const it = this.cultivos().find(x => String((x as any)?.id) === String(id));
        return it ? `${(it as any).codigo ?? it.id} — ${(it as any).descripcion ?? ''}`.trim() : String(id);
    });

    readonly savedFundoLabel = computed(() => {
        const cfg = this.savedConfig();
        if (!cfg?.idFundo) return '—';
        const it = this.fundos().find(x => String((x as any)?.id) === String(cfg.idFundo));
        return it ? `${(it as any).codigoFundo ?? (it as any).fundo ?? it.id} — ${it.nombreFundo ?? ''}`.trim() : cfg.idFundo;
    });
    readonly savedCultivoLabel = computed(() => {
        const cfg = this.savedConfig();
        if (!cfg?.codigoCultivo) return '—';
        const it = this.cultivos().find(x => String((x as any)?.codigo ?? '').trim() === String(cfg.codigoCultivo).trim());
        return it ? `${(it as any).codigo ?? it.id} — ${(it as any).descripcion ?? ''}`.trim() : cfg.codigoCultivo;
    });
    readonly savedCampaniaLabel = computed(() => {
        const cfg = this.savedConfig();
        if (!cfg?.idProyecto) return '—';
        const it = this.campanias().find(x => String((x as any)?.idproyecto) === String(cfg.idProyecto));
        return it ? `${(it as any).idproyecto} — ${(it as any).descripcion ?? ''}`.trim() : cfg.idProyecto;
    });

    get online(): boolean {
        return this.connectivity.isOnline();
    }

    async ngOnInit(): Promise<void> {
        try {
            await this.cargarDatosDesdeDexie();
            await this.cargarConfiguracionGuardada();
        } catch (error) {
            console.log('Error en ngOnInit Parametros', error);
        }
    }

    async eliminarConfiguracion(): Promise<void> {
        const nro = this.getNroDocumentoFromUsuario();
        if (!nro) {
            this.alertService.showAlertAcept('Error', 'No se encontró el nro de documento del usuario.', 'error');
            return;
        }

        const ok = await this.alertService.showConfirm('Confirmación', '¿Eliminar la configuración guardada?', 'warning');
        if (!ok) return;

        try {
            const existing: any = await this.catalogosRepo.configuracionRepo.getByField('nrodocumento', nro);
            if (!existing) {
                this.savedConfig.set(null);
                this.alertService.showAlert('Listo', 'No hay configuración para eliminar', 'success');
                return;
            }

            const pk = existing?._pk;
            if (pk === undefined || pk === null) {
                this.alertService.showAlertAcept('Error', 'No se pudo identificar la clave del registro para eliminar.', 'error');
                return;
            }

            await this.catalogosRepo.configuracionRepo.delete(pk);
            this.savedConfig.set(null);
            this.selectedFundoId.set(null);
            this.selectedCultivoId.set(null);
            this.selectedCampaniaId.set(null);
            this.alertService.showAlert('Eliminado', 'Configuración eliminada correctamente', 'success');
        } catch (error) {
            console.log('Error eliminando configuración', error);
            this.alertService.showAlertAcept('Error', 'No se pudo eliminar la configuración', 'error');
        }
    }

    private getNroDocumentoFromUsuario(): string {
        const u: any = this.usuario();
        const v = u?.nrodocumento ?? u?.documentoidentidad ?? u?.documentoIdentidad ?? u?.documento ?? '';
        return String(v ?? '').trim();
    }

    private async cargarDatosDesdeDexie(): Promise<void> {
        const [fundos, cultivos, campanias] = await Promise.all([
            this.catalogosRepo.fundoRepo.getAll(),
            this.catalogosRepo.cultivoRepo.getAll(),
            this.catalogosRepo.campaniaRepo.getAll(),
        ]);
        this.fundos.set(fundos ?? []);
        this.cultivos.set(cultivos ?? []);
        this.campanias.set(campanias ?? []);
    }

    private async cargarConfiguracionGuardada(): Promise<void> {
        const nro = this.getNroDocumentoFromUsuario();
        if (!nro) {
            this.savedConfig.set(null);
            return;
        }

        const cfg = await this.catalogosRepo.configuracionRepo.getByField('nrodocumento', nro);
        this.savedConfig.set(cfg ?? null);

        if (cfg) {
            this.selectedCampaniaId.set(cfg.idProyecto ?? null);
            this.applyCampaniaSelection(cfg.idProyecto ?? null);
        }
    }

    private applyCampaniaSelection(campaniaId: string | number | null): void {
        const id = String(campaniaId ?? '').trim();
        if (!id) {
            this.selectedFundoId.set(null);
            this.selectedCultivoId.set(null);
            return;
        }

        const camp: any = this.campanias().find(x => String((x as any)?.idproyecto ?? '').trim() === id);
        if (!camp) {
            this.selectedFundoId.set(null);
            this.selectedCultivoId.set(null);
            return;
        }

        const codigoFundo = String(camp?.idfundo ?? '').trim();
        const codigoCultivo = String(camp?.codcultivo ?? '').trim();

        const fundo: any = this.fundos().find(f => String((f as any)?.codigoFundo ?? '').trim() === codigoFundo);
        const cultivo: any = this.cultivos().find(c => String((c as any)?.codigo ?? '').trim() === codigoCultivo);

        this.selectedFundoId.set(fundo?.id ?? null);
        this.selectedCultivoId.set(cultivo?.id ?? null);
    }

    onCampaniaChange(v: string | number | null): void {
        this.selectedCampaniaId.set(v);
        this.applyCampaniaSelection(v);
    }

    formatDate(value: string | null | undefined): string {
        const raw = String(value ?? '').trim();
        if (!raw) return '—';
        const d = new Date(raw);
        if (Number.isNaN(d.getTime())) return raw;
        return new Intl.DateTimeFormat('es-PE', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        }).format(d);
    }

    async sincronizarAsync(): Promise<void> {
        try {
            if (!this.online) {
                this.alertService.showAlert('Error', 'No hay conexión a internet', 'error');
                return;
            }
            this.alertService.mostrarModalCarga();

            const tareas = [
                this.getFundosMaestros(),
                this.getCampaniasMaestros(),
                this.getCultivosMaestros()
            ];

            const resultados = await Promise.allSettled(tareas);

            resultados.forEach((r, index) => {
                if (r.status === 'rejected') {
                    console.error(`Error sincronizando tarea ${index + 1}`, r.reason);
                }
            });

            await this.cargarDatosDesdeDexie();
            await this.cargarConfiguracionGuardada();

            this.alertService.showAlert('Listo', 'Sincronización completada', 'success');
            this.alertService.cerrarModalCarga();
        } catch (error) {
            console.log('Error sincronizando parámetros', error);
            this.alertService.cerrarModalCarga();
            this.alertService.showAlertAcept('Error', 'Error sincronizando parámetros', 'error');
        }
    }

    async guardarConfiguracion(): Promise<void> {
        const nro = this.getNroDocumentoFromUsuario();
        if (!nro) {
            this.alertService.showAlertAcept('Error', 'No se encontró el nro de documento del usuario.', 'error');
            return;
        }

        const idCampania = this.selectedCampaniaId();

        const campaniaOk = String(idCampania ?? '').trim();
        if (!campaniaOk) {
            this.alertService.showAlert('Validación', 'Seleccione una Campaña.', 'warning');
            return;
        }

        const idFundo = this.selectedFundoId();
        const cultivoCodigo = this.selectedCultivoCodigo();

        const fundoOk = String(idFundo ?? '').trim();
        const cultivoOk = String(cultivoCodigo ?? '').trim();
        if (!fundoOk || !cultivoOk) {
            this.alertService.showAlert('Validación', 'No se pudo obtener Fundo/Cultivo desde la Campaña seleccionada.', 'warning');
            return;
        }

        const cfg: Configuracion = {
            nrodocumento: nro,
            idFundo: fundoOk,
            codigoCultivo: cultivoOk,
            idProyecto: campaniaOk,
        };

        try {
            const existing: any = await this.catalogosRepo.configuracionRepo.getByField('nrodocumento', nro);
            const pk = existing?._pk;
            if (pk !== undefined && pk !== null) {
                await this.catalogosRepo.configuracionRepo.delete(pk);
            }
            await this.catalogosRepo.configuracionRepo.save(cfg as any);
            this.savedConfig.set(cfg);
            await this.getListarCatalogosUsuarios();
            // this.alertService.showAlert('Guardado', 'Configuración guardada correctamente', 'success');
        } catch (error) {
            console.log('Error guardando configuración', error);
            this.alertService.showAlertAcept('Error', 'No se pudo guardar la configuración', 'error');
        }
    }

    private async apiListarReglasSobrePeso(): Promise<void> {
        const resp: any = await firstValueFrom(this.administracionService.listarReglasSobrePeso({ idProyecto: this.savedConfig()?.idProyecto, codigoCultivo: this.savedConfig()?.codigoCultivo }));
        if (resp[0]?.error) {
            this.alertService.showAlert('Error', resp?.mensaje ?? 'Error al listar reglas de sobrepeso', 'error');
            return;
        }
        let apiItems = resp[0].data
        const normalizados = await this.normalizarReglasSobrePeso(apiItems);
        if (normalizados.length > 0) {
            for (const item of normalizados) {
                await this.adminRepo.reglasSobrePesoRepository.saveFordec(item as any);
            }
        }
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

    async normalizarReglasSobrePeso(data: any[]): Promise<any[]> {
        const list = Array.isArray(data) && data.length > 0 ? data : [];
        const cfg = this.savedConfig();
        const idProyectoCfg = String(cfg?.idProyecto ?? '').trim();
        const idCultivoCfg = String(cfg?.codigoCultivo ?? '').trim();

        const normalized = list.map((r: any) => ({
            ...r,
            idProyecto: String(r?.idProyecto ?? idProyectoCfg ?? '').trim(),
            codigoCultivo: String(r?.codigoCultivo ?? idCultivoCfg ?? '').trim(),
            documentoConsignatario: String(r?.documentoConsignatario ?? r?.documento_consignatario ?? r?.consignatarioDocumento ?? r?.consignatarioId ?? '').trim(),
            formatoId: r?.formatoId === null || r?.formatoId === undefined ? null : Number(r?.formatoId),
            destinoId: String(r?.destinoId ?? '').trim(),
            transporteId: String(r?.transporteId ?? '').trim(),
            porcentaje: r?.porcentaje === null || r?.porcentaje === undefined ? null : Number(r?.porcentaje),
            vigenciaDesde: String(r?.vigenciaDesde ?? '').trim(),
            vigenciaHasta: String(r?.vigenciaHasta ?? '').trim(),
            descripcion: r?.descripcion ?? '',
            activo: r?.activo === false ? false : true,
            bd: 1,
            modo: r?.modo ?? 'editado',
        }));

        return normalized
    }

    async apiListarMatricesCompatibilidad() {
        const resp: any = await firstValueFrom(this.administracionService.listarMatricesCompatibilidad({ idProyecto: this.savedConfig()?.idProyecto, idCultivo: this.savedConfig()?.codigoCultivo }));
        if (resp[0]?.error) {
            this.alertService.showAlert('Error', 'Error al listar las matrices de compatibilidad', 'error');
            return
        }
        let apiItems = resp[0].data
        const normalizados = await this.normalizarMatricesCompatibilidadDixie(apiItems);
        if (normalizados.length > 0) {
            for (const item of normalizados) {
                await this.adminRepo.matricesCompatibilidadRepository.saveFordec(item as any);
            }
        }
    }

    async normalizarMatricesCompatibilidadDixie(data: any[]): Promise<any[]> {
        const normalizar: MatrizCompatibilidad[] = [];
        for (const item of (Array.isArray(data) ? data : [])) {
            const cliente = item?.documentoCliente ? await this.catalogosRepo.clientesRepo.getByField('id', Number(item.documentoCliente)) : undefined;
            const consignatario = item?.documentoConsignatario ? await this.catalogosRepo.consignatariosRepo.getByField('id', Number(item.documentoConsignatario)) : undefined;
            const destino = item?.destinoId ? await this.catalogosRepo.destinosRepo.getByField('id', item.destinoId) : undefined;
            const formato = item?.formatoId ? await this.catalogosRepo.formatosRepo.getByField('id', item.formatoId) : undefined;
            const tipoEmpaque = item?.tiposEmpaqueId ? await this.catalogosRepo.tiposEmpaqueRepo.getByField('id', item.tiposEmpaqueId) : undefined;
            const tipoEmpaqueGuia = item?.tipoEmpaqueGuiaId ? await this.catalogosRepo.tiposEmpaqueGuiaRepo.getByField('id', item.tipoEmpaqueGuiaId) : undefined;
            const calibre = item?.calibreId ? await this.catalogosRepo.calibresRepo.getByField('id', item.calibreId) : undefined;
            const tipoCaja = item?.tipoCajaId ? await this.catalogosRepo.tiposCajaRepo.getByField('id', item.tipoCajaId) : undefined;
            const tipoClamshell = item?.tipoClamshellId ? await this.catalogosRepo.tiposClamshellRepo.getByField('id', item.tipoClamshellId) : undefined;
            const presentacion = item?.presentacionId ? await this.catalogosRepo.presentacionesRepo.getByField('id', item.presentacionId) : undefined;
            const categoria = item?.categoriaId ? await this.catalogosRepo.categoriasRepo.getByField('id', item.categoriaId) : undefined;
            const row: MatrizCompatibilidad = {
                id: Number(item?.id ?? 0),
                idProyecto: item?.idProyecto ?? this.savedConfig()?.idProyecto,
                codigoCultivo: item?.codigoCultivo ?? this.savedConfig()?.codigoCultivo,
                documentoCliente: (item?.documentoCliente ?? ''),
                clienteNombre: (cliente as any)?.razonSocial ?? (cliente as any)?.nombre ?? (cliente as any)?.descripcion,

                documentoConsignatario: (item?.documentoConsignatario ?? ''),
                consignatarioNombre: (consignatario as any)?.razonSocial ?? (consignatario as any)?.nombre ?? (consignatario as any)?.descripcion,

                destinoId: (item?.destinoId ?? ''),
                destinoNombre: (destino as any)?.pais ?? (destino as any)?.nacionalidad,

                formatoId: Number(item?.formatoId ?? 0),
                formatoNombre: (formato as any)?.descripcion ?? (formato as any)?.descripcion2,
                formatoCodigo: (formato as any)?.descripcion2,

                tiposEmpaqueId: Number(item?.tiposEmpaqueId ?? 0),
                tipoEmpaqueNombre: (tipoEmpaque as any)?.descripcion ?? (tipoEmpaque as any)?.codigo,

                tipoEmpaqueGuiaId: Number(item?.tipoEmpaqueGuiaId ?? 0),
                tipoEmpaqueGuiaNombre: (tipoEmpaqueGuia as any)?.nombre ?? (tipoEmpaqueGuia as any)?.descripcion,

                calibreId: item?.calibreId ?? '',
                calibreNombre: (calibre as any)?.calibre ?? (calibre as any)?.calibreId,

                tipoCajaId: Number(item?.tipoCajaId ?? 0),
                tipoCajaNombre: (tipoCaja as any)?.nombre ?? (tipoCaja as any)?.descripcion,

                tipoClamshellId: Number(item?.tipoClamshellId ?? 0),
                tipoClamshellNombre: (tipoClamshell as any)?.nombre ?? (tipoClamshell as any)?.descripcion,

                presentacionId: Number(item?.presentacionId ?? 0),
                presentacionNombre: (presentacion as any)?.nombre ?? (presentacion as any)?.descripcion,

                categoriaId: Number(item?.categoriaId ?? 0),
                categoriaNombre: (categoria as any)?.nombre ?? (categoria as any)?.descripcion,

                activo: !!item?.activo,
                fechaCreacion: item?.fechaCreacion,
                modo: item?.modo ?? 'editado',
                bd: 1,
            };

            normalizar.push(row);
        }

        return normalizar;
    }

    async getListarCatalogosUsuarios(): Promise<void> {
        const parametros = await this.catalogosRepo.configuracionRepo.getAll()
        try {
            if (!this.online) {
                this.alertService.showAlert('Error', 'No hay conexión a internet', 'error');
                return;
            }
            this.alertService.mostrarModalCarga();
            let tareas: any = [];
            switch (this.usuario()?.idRol) {
                case 'ADPLA': //admin
                    tareas = [
                        this.getAcopiosMaestros(),
                        this.getTipoProcesoEmpacado(parametros[0].idProyecto),
                        this.getFormatosMaestros(parametros[0].codigoCultivo),
                        this.getVariedadesMaestros(parametros[0].codigoCultivo),
                        this.getClientesMaestros(),
                        this.getPaisesMaestros(),
                        this.getCalibresMaestros(parametros[0].codigoCultivo),
                        this.getTransportesMaestros(),
                        this.getCodigosRanchoMaestros(parametros[0].idProyecto),
                        this.getLugaresProduccionConfigMaestros(parametros[0].idProyecto),
                        this.getTiposClamshellMaestros(parametros[0].codigoCultivo),
                        this.getCategoriaMaestros(parametros[0].codigoCultivo),
                        this.getTiposEmpaquesMaestros(parametros[0].codigoCultivo),
                        this.getTiposEmpaqueGuiaMaestros(parametros[0].codigoCultivo),
                        this.getPresentacionesMaestros(parametros[0].codigoCultivo),
                        this.getTiposCajaMaestros(parametros[0].codigoCultivo),
                        this.getLugaresProduccionMaestros(parametros[0].idProyecto),
                        this.getConductoresMaestros(parametros[0].idProyecto),
                        this.getVehiculosMaestros(parametros[0].idProyecto),
                        this.getTransportistasMaestros(parametros[0].idProyecto),
                        this.getDestinatariosMaestros(),
                        this.getSupervisoresMaestros(parametros[0].idProyecto),
                        this.getPersonalLogisticoMaestros(parametros[0].idProyecto),
                        this.getListarUsuariosAcopio(),
                        this.getProcesosForAcopioMaestros(parametros[0].idProyecto, parametros[0].codigoCultivo)
                    ];
                    break;
                case 'LOPLA':
                    tareas = [
                        this.getAcopiosMaestros(),
                        this.getTipoProcesoEmpacado(parametros[0].idProyecto),
                        this.getFormatosMaestros(parametros[0].codigoCultivo),
                        this.getVariedadesMaestros(parametros[0].codigoCultivo),
                        this.getClientesMaestros(),
                        this.getPaisesMaestros(),
                        this.getCalibresMaestros(parametros[0].codigoCultivo),
                        this.getTransportesMaestros(),
                        this.getCodigosRanchoMaestros(parametros[0].idProyecto),
                        this.getLugaresProduccionConfigMaestros(parametros[0].idProyecto),
                        this.getTiposClamshellMaestros(parametros[0].codigoCultivo),
                        this.getCategoriaMaestros(parametros[0].codigoCultivo),
                        this.getTiposEmpaquesMaestros(parametros[0].codigoCultivo),
                        this.getTiposEmpaqueGuiaMaestros(parametros[0].codigoCultivo),
                        this.getPresentacionesMaestros(parametros[0].codigoCultivo),
                        this.getTiposCajaMaestros(parametros[0].codigoCultivo),
                        this.getLugaresProduccionMaestros(parametros[0].idProyecto),
                        this.getConductoresMaestros(parametros[0].idProyecto),
                        this.getVehiculosMaestros(parametros[0].idProyecto),
                        this.getTransportistasMaestros(parametros[0].idProyecto),
                        this.getDestinatariosMaestros(),
                        this.getSupervisoresMaestros(parametros[0].idProyecto, true),
                        this.getPersonalLogisticoMaestros(parametros[0].idProyecto, true),
                        this.getProcesosForAcopioMaestros(parametros[0].idProyecto, parametros[0].codigoCultivo)

                    ];
                    break;

                default:
                    tareas = [];
                    break;

            };
            if (tareas.length > 0) {

                const resultados = await Promise.allSettled(tareas);

                resultados.forEach((r, index) => {
                    if (r.status === 'rejected') {
                        console.error(`Error sincronizando tarea ${index + 1}`, r.reason);
                    }
                });

                await this.apiListarMatricesCompatibilidad()
                await this.apiListarReglasSobrePeso()
                await this.sincronizarDPaletsPorAcopio()
                this.alertService.cerrarModalCarga();
                this.alertService.showAlert('Listo', 'Sincronización completada', 'success');
            } else {
                this.alertService.cerrarModalCarga();
                this.alertService.showAlert('Error', `No tiene Permisos para esta acción: ${this.usuario()?.idRol}`, 'error');
            }
        } catch (error) {
            console.log('Error sincronizando parámetros', error);
            this.alertService.cerrarModalCarga();
            this.alertService.showAlert('Error', 'Error sincronizando parámetros', 'error');
        }
    }

    async getProcesosForAcopioMaestros(idproyecto:string, codigoCultivo:string): Promise<void>{
        try{    
            const resp: any =await firstValueFrom(this.procesoService.listarProcesoForAcopio(codigoCultivo, idproyecto))
            console.log('resp', resp)
            if(resp.length > 0){
                if(!resp[0].error){
                    if(resp[0].data.length >0){
                        const data = Array.isArray(resp?.[0]?.data) ? resp[0].data : [];
                        const normalizados: {
                                  proceso: Proceso;
                                  dProcesoLogisticos: DProcesoLogistico[];
                                  dProcesoSupervisores: DProcesoSupervisor[];
                                }[] = data.map((x: any) => this.normalizarProceso(x));
                        for (const n of normalizados) {
                            await this.procesoRepo.procesosRepo.saveFordec(n.proceso as any);

                            for (const d of n.dProcesoLogisticos) {
                                await this.procesoRepo.dProcesoLogisticosRepo.saveByCompoundId(d as any);
                            }
                            for (const d of n.dProcesoSupervisores) {
                                await this.procesoRepo.dProcesoSupervisoresRepo.saveByCompoundId(d as any);
                            }
                        }

                        // Obtener palets de cada proceso
                        for (const n of normalizados) {
                            const idProceso = String(n.proceso.idProceso ?? '').trim();
                            if (!idProceso) continue;
                            try {
                                const respPalets: any = await firstValueFrom(this.paletService.listarPaletPorProceso(idProceso));
                                if (!respPalets?.length) continue;
                                const firstPalet = respPalets[0] as any;
                                if (firstPalet?.error) continue;
                                const apiPalets = (Array.isArray(firstPalet) ? firstPalet : (firstPalet?.data ?? [])) as any;
                                await this.procesoRepo.paletsRepo.clearSincronizadosByIdProceso(idProceso);
                                for (const p of (apiPalets ?? [])) {
                                    const row: any = { ...(p as any), bd: 1 };
                                    await this.procesoRepo.paletsRepo.saveByIdPalet(row);
                                }
                            } catch (err) {
                                console.error('Error obteniendo palets para proceso', idProceso, err);
                            }
                        }
                    }
                }
            }
        }catch(error){
            console.log('Error listando Procesos acopios', error);
        }
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

        const consigMap = new Map(consignatarios.map(c => [String(c.documentoFiscal ?? '').trim(), c.nombre]));
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

    async sincronizarDPaletsPorAcopio(): Promise<void> {
        try {
            const resp: any = await firstValueFrom(this.paletService.getDPaletsPorAcopio());
            const first = Array.isArray(resp) ? resp[0] : resp;
            if (first?.error) {
                console.error('Error obteniendo DPalets por acopio:', first?.mensaje);
                return;
            }
            const items: any[] = first?.data ?? [];

            // Siempre limpiar DPalets sincronizados previos (bd=1)
            const dpaletsLocales = await this.procesoRepo.dPaletsRepo.getAll();
            const sincronizados = (dpaletsLocales ?? []).filter((d: any) => (d.bd ?? 0) === 1);
            for (const d of sincronizados) {
                if ((d as any)._pk != null) {
                    await this.procesoRepo.dPaletsRepo.delete((d as any)._pk);
                }
            }

            if (!items.length) {
                console.log('No hay DPalets remotos — locales bd=1 eliminados');
                return;
            }

            const enriquecidos = await this.resolverNombresDPalets(items);
            for (const d of enriquecidos) {
                const row: DPalet = {
                    ...d,
                    bd: 1,
                };
                await this.procesoRepo.dPaletsRepo.saveByIdDPalet(row);
            }
            console.log('DPalets sincronizados:', enriquecidos.length);
        } catch (err) {
            console.error('Error sincronizando DPalets por acopio:', err);
        }
    }

    async getListarUsuariosAcopio(): Promise<void> {
        try {
            const resp: any = await firstValueFrom(this.catalogoService.listarUsuariosAcopios())
            if (!resp.error) {
                if (resp.data.length > 0) {
                    let dexiedb = await this.adminRepo.usuariosRepository.getAll()
                    if (dexiedb.length > 0) {
                        await this.adminRepo.usuariosRepository.clear()
                    }
                    for (const usuarioAcopio of resp.data) {
                        usuarioAcopio.bd = 1
                        await this.adminRepo.usuariosRepository.save(usuarioAcopio as any)
                    }
                } else {
                    let dexiedb = await this.adminRepo.usuariosRepository.getAll()
                    if (dexiedb.length > 0) {
                        await this.adminRepo.usuariosRepository.clear()
                    }
                }
            }
        } catch (error) {
            console.log('Error listando usuarios acopios', error);
        }
    }

    async getTipoProcesoEmpacado(idproyecto:string): Promise<void>{
        try{
            const resp: any = await firstValueFrom(this.catalogoService.listarTipoProcesoEmpacado(idproyecto))
            if (!resp.error) {
                if (resp.data.length > 0) {
                    let dexiedb = await this.catalogosRepo.tipoProcesoEmpacadoRepo.getAll()
                    if (dexiedb.length > 0) {
                        await this.catalogosRepo.tipoProcesoEmpacadoRepo.clear()
                    }
                    for (const tipoProcesoEmpacado of resp.data) {
                        tipoProcesoEmpacado.bd = 1
                        await this.catalogosRepo.tipoProcesoEmpacadoRepo.save(tipoProcesoEmpacado as any)
                    }
                } else {
                    let dexiedb = await this.catalogosRepo.tipoProcesoEmpacadoRepo.getAll()
                    if (dexiedb.length > 0) {
                        await this.catalogosRepo.tipoProcesoEmpacadoRepo.clear()
                    }
                }
            }
        }catch (error){
            console.log('Error listando TipoProcesoEmpacado', error)
        }
    }

    async getPersonalLogisticoMaestros(idProyecto: string, disponibles: boolean = false): Promise<void> {
        try {
            let resp: any
            if (!disponibles) {
                resp = await firstValueFrom(this.catalogoService.listarPersonalLogistico(idProyecto))
            } else {
                let respDisponibles = await firstValueFrom(this.catalogoService.listarPersonaLogisticoDisponibles(idProyecto, new Date().toISOString().split('T')[0]))
                resp = respDisponibles[0]
            }
            if (!resp.error) {
                if (resp.data.length > 0) {
                    let dexiedb = await this.catalogosOperativosRepo.personalLogisticoRepo.getAll()
                    if (dexiedb.length > 0) {
                        await this.catalogosOperativosRepo.personalLogisticoRepo.clear()
                    }
                    for (const personalLogistico of resp.data) {
                        personalLogistico.bd = 1
                        await this.catalogosOperativosRepo.personalLogisticoRepo.save(personalLogistico);
                    }
                } else {
                    let dexiedb = await this.catalogosOperativosRepo.personalLogisticoRepo.getAll()
                    if (dexiedb.length > 0) {
                        await this.catalogosOperativosRepo.personalLogisticoRepo.clear()
                    }
                }
            }
        } catch (error) {
            console.log('Error obteniendo personal logistico', error);
        }
    }

    async getSupervisoresMaestros(idProyecto: string, disponibles: boolean = false): Promise<void> {
        try {
            let resp: any
            if (!disponibles) {
                resp = await firstValueFrom(this.catalogoService.listarSupervisores(idProyecto))
            } else {
                let respDisponibles = await firstValueFrom(this.catalogoService.listarSupervisoresDisponibles(idProyecto, new Date().toISOString().split('T')[0]))
                if (respDisponibles.length == 0) {
                    return
                }
                resp = respDisponibles[0]
            }
            if (!resp.error) {
                if (resp.data.length > 0) {
                    let dexiedb = await this.catalogosOperativosRepo.supervisoresRepo.getAll()
                    if (dexiedb.length > 0) {
                        await this.catalogosOperativosRepo.supervisoresRepo.clear()
                    }
                    for (const supervisor of resp.data) {
                        supervisor.bd = 1
                        await this.catalogosOperativosRepo.supervisoresRepo.save(supervisor);
                    }
                } else {
                    let dexiedb = await this.catalogosOperativosRepo.supervisoresRepo.getAll()
                    if (dexiedb.length > 0) {
                        await this.catalogosOperativosRepo.supervisoresRepo.clear()
                    }
                }
            }
        } catch (error) {
            console.log('Error obteniendo supervisores', error);
        }
    }

    async getTransportistasMaestros(idProyecto: string): Promise<void> {
        try {
            const resp: any = await firstValueFrom(this.catalogoService.listarTransportistas(idProyecto))
            if (!resp.error) {
                if (resp.data.length > 0) {
                    let dexiedb = await this.catalogosOperativosRepo.transportistasRepo.getAll()
                    if (dexiedb.length > 0) {
                        await this.catalogosOperativosRepo.transportistasRepo.clear()
                    }
                    for (const transportista of resp.data) {
                        transportista.bd = 1
                        await this.catalogosOperativosRepo.transportistasRepo.save(transportista);
                    }
                } else {
                    let dexiedb = await this.catalogosOperativosRepo.transportistasRepo.getAll()
                    if (dexiedb.length > 0) {
                        await this.catalogosOperativosRepo.transportistasRepo.clear()
                    }
                }
            }
        } catch (error) {
            console.log('Error obteniendo transportistas', error);
        }
    }

    async getVehiculosMaestros(idProyecto: string): Promise<void> {
        try {
            const resp: any = await firstValueFrom(this.catalogoService.listarVehiculos(idProyecto))
            if (!resp.error) {
                if (resp.data.length > 0) {
                    let dexiedb = await this.catalogosOperativosRepo.vehiculosRepo.getAll()
                    if (dexiedb.length > 0) {
                        await this.catalogosOperativosRepo.vehiculosRepo.clear()
                    }
                    for (const vehiculo of resp.data) {
                        vehiculo.bd = 1
                        await this.catalogosOperativosRepo.vehiculosRepo.save(vehiculo);
                    }
                } else {
                    let dexiedb = await this.catalogosOperativosRepo.vehiculosRepo.getAll()
                    if (dexiedb.length > 0) {
                        await this.catalogosOperativosRepo.vehiculosRepo.clear()
                    }
                }
            }
        } catch (error) {
            console.log('Error obteniendo vehiculos', error);
        }
    }

    async getConductoresMaestros(idProyecto: string): Promise<void> {
        try {
            const resp: any = await firstValueFrom(this.catalogoService.listarConductores(idProyecto))
            if (!resp.error) {
                if (resp.data.length > 0) {
                    let dexiedb = await this.catalogosOperativosRepo.conductoresRepo.getAll()
                    if (dexiedb.length > 0) {
                        await this.catalogosOperativosRepo.conductoresRepo.clear()
                    }
                    for (const conductor of resp.data) {
                        conductor.bd = 1
                        await this.catalogosOperativosRepo.conductoresRepo.save(conductor);
                    }
                } else {
                    let dexiedb = await this.catalogosOperativosRepo.conductoresRepo.getAll()
                    if (dexiedb.length > 0) {
                        await this.catalogosOperativosRepo.conductoresRepo.clear()
                    }
                }
            }
        } catch (error) {
            console.log('Error obteniendo conductores', error);
        }
    }

    async getDestinatariosMaestros(): Promise<void> {
        try {
            const resp: any = await firstValueFrom(this.catalogoService.listarDestinatarios())
            if (!resp.error) {
                if (resp.data.length > 0) {
                    let dexiedb = await this.catalogosRepo.destinatariosRepo.getAll()
                    if (dexiedb.length > 0) {
                        await this.catalogosRepo.destinatariosRepo.clear()
                    }
                    for (const destinatario of resp.data) {
                        destinatario.bd = 1
                        await this.catalogosRepo.destinatariosRepo.save(destinatario);
                    }
                } else {
                    let dexiedb = await this.catalogosRepo.destinatariosRepo.getAll()
                    if (dexiedb.length > 0) {
                        await this.catalogosRepo.destinatariosRepo.clear()
                    }
                }
            }
        } catch (error) {
            console.log('Error obteniendo destinatarios', error);
        }
    }

    async getLugaresProduccionMaestros(idProyecto: string): Promise<void> {
        try {
            const resp: any = await firstValueFrom(this.catalogoService.listarLugaresProduccion(idProyecto))
            if (!resp.error) {
                if (resp.data.length > 0) {
                    let dexiedb = await this.catalogosRepo.lugaresProduccionRepo.getAll()
                    if (dexiedb.length > 0) {
                        await this.catalogosRepo.lugaresProduccionRepo.clear()
                    }
                    for (const lugarProduccion of resp.data) {
                        lugarProduccion.bd = 1
                        await this.catalogosRepo.lugaresProduccionRepo.save(lugarProduccion);
                    }
                } else {
                    let dexiedb = await this.catalogosRepo.lugaresProduccionRepo.getAll()
                    if (dexiedb.length > 0) {
                        await this.catalogosRepo.lugaresProduccionRepo.clear()
                    }
                }
            }
        } catch (error) {
            console.log('Error obteniendo lugares de produccion', error);
        }
    }

    async getTiposCajaMaestros(codigoCultivo: string): Promise<void> {
        try {
            const resp: any = await firstValueFrom(this.catalogoService.listarTiposCaja(codigoCultivo))
            if (!resp.error) {
                if (resp.data.length > 0) {
                    let dexiedb = await this.catalogosRepo.tiposCajaRepo.getAll()
                    if (dexiedb.length > 0) {
                        await this.catalogosRepo.tiposCajaRepo.clear()
                    }
                    for (const tipoCaja of resp.data) {
                        tipoCaja.bd = 1
                        await this.catalogosRepo.tiposCajaRepo.save(tipoCaja);
                    }
                } else {
                    let dexiedb = await this.catalogosRepo.tiposCajaRepo.getAll()
                    if (dexiedb.length > 0) {
                        await this.catalogosRepo.tiposCajaRepo.clear()
                    }
                }
            }
        } catch (error) {
            console.log('Error obteniendo tipos de caja', error);
        }
    }

    async getPresentacionesMaestros(codigoCultivo: string): Promise<void> {
        try {
            const resp: any = await firstValueFrom(this.catalogoService.listarPresentaciones(codigoCultivo))
            if (!resp.error) {
                if (resp.data.length > 0) {
                    let dexiedb = await this.catalogosRepo.presentacionesRepo.getAll()
                    if (dexiedb.length > 0) {
                        await this.catalogosRepo.presentacionesRepo.clear()
                    }
                    for (const presentacion of resp.data) {
                        presentacion.bd = 1
                        await this.catalogosRepo.presentacionesRepo.save(presentacion);
                    }
                } else {
                    let dexiedb = await this.catalogosRepo.presentacionesRepo.getAll()
                    if (dexiedb.length > 0) {
                        await this.catalogosRepo.presentacionesRepo.clear()
                    }
                }
            }
        } catch (error) {
            console.log('Error obteniendo presentaciones', error);
        }
    }

    async getTiposEmpaqueGuiaMaestros(codigoCultivo: string): Promise<void> {
        try {
            const resp: any = await firstValueFrom(this.catalogoService.listarTiposEmpaqueGuia(codigoCultivo))
            if (!resp.error) {
                if (resp.data.length > 0) {
                    let dexiedb = await this.catalogosRepo.tiposEmpaqueGuiaRepo.getAll()
                    if (dexiedb.length > 0) {
                        await this.catalogosRepo.tiposEmpaqueGuiaRepo.clear()
                    }
                    for (const tipoEmpaque of resp.data) {
                        tipoEmpaque.bd = 1
                        await this.catalogosRepo.tiposEmpaqueGuiaRepo.save(tipoEmpaque);
                    }
                } else {
                    let dexiedb = await this.catalogosRepo.tiposEmpaqueGuiaRepo.getAll()
                    if (dexiedb.length > 0) {
                        await this.catalogosRepo.tiposEmpaqueGuiaRepo.clear()
                    }
                }
            }
        } catch (error) {
            console.log('Error obteniendo tipos de empaques', error);
        }
    }

    async getTiposEmpaquesMaestros(codigoCultivo: string): Promise<void> {
        try {
            const resp: any = await firstValueFrom(this.catalogoService.listarTiposEmpaques(codigoCultivo))
            if (!resp.error) {
                if (resp.data.length > 0) {
                    let dexiedb = await this.catalogosRepo.tiposEmpaqueRepo.getAll()
                    if (dexiedb.length > 0) {
                        await this.catalogosRepo.tiposEmpaqueRepo.clear()
                    }
                    for (const tipoEmpaque of resp.data) {
                        tipoEmpaque.bd = 1
                        await this.catalogosRepo.tiposEmpaqueRepo.save(tipoEmpaque);
                    }
                } else {
                    let dexiedb = await this.catalogosRepo.tiposEmpaqueRepo.getAll()
                    if (dexiedb.length > 0) {
                        await this.catalogosRepo.tiposEmpaqueRepo.clear()
                    }
                }
            }
        } catch (error) {
            console.log('Error obteniendo tipos de empaques', error);
        }
    }

    async getCategoriaMaestros(codigoCultivo: string): Promise<void> {
        try {
            const resp: any = await firstValueFrom(this.catalogoService.listarCategoria(codigoCultivo))
            if (!resp.error) {
                if (resp.data.length > 0) {
                    let dexiedb = await this.catalogosRepo.categoriasRepo.getAll()
                    if (dexiedb.length > 0) {
                        await this.catalogosRepo.categoriasRepo.clear()
                    }
                    for (const categoria of resp.data) {
                        categoria.bd = 1
                        await this.catalogosRepo.categoriasRepo.save(categoria);
                    }
                } else {
                    let dexiedb = await this.catalogosRepo.categoriasRepo.getAll()
                    if (dexiedb.length > 0) {
                        await this.catalogosRepo.categoriasRepo.clear()
                    }
                }
            }
        } catch (error) {
            console.log('Error obteniendo categorias', error);
        }
    }

    async getTiposClamshellMaestros(codigoCultivo: string): Promise<void> {
        try {
            const resp: any = await firstValueFrom(this.catalogoService.listarTiposClamshell(codigoCultivo))
            if (!resp.error) {
                let dexiedb = await this.catalogosRepo.tiposClamshellRepo.getAll()
                if (dexiedb.length > 0) {
                    await this.catalogosRepo.tiposClamshellRepo.clear()
                }
                for (const tc of (resp.data ?? [])) {
                    tc.bd = 1
                    this.catalogosRepo.tiposClamshellRepo.save(tc);
                }
            } else {
                let dexiedb = await this.catalogosRepo.tiposClamshellRepo.getAll()
                if (dexiedb.length > 0) {
                    await this.catalogosRepo.tiposClamshellRepo.clear()
                }
            }
        } catch (error) {
            console.log("Error sincronizando TiposClamshell", error);
        }
    }

    async getTransportesMaestros(): Promise<void> {
        try {
            const resp: any = await firstValueFrom(this.catalogoService.listarTransporte())
            if (resp.length > 0) {
                let dexiedb = await this.catalogosRepo.transportesRepo.getAll()
                if (dexiedb.length > 0) {
                    await this.catalogosRepo.transportesRepo.clear()
                }
                for (const t of (resp ?? [])) {
                    this.catalogosRepo.transportesRepo.save(t);
                }
            } else {
                let dexiedb = await this.catalogosRepo.transportesRepo.getAll()
                if (dexiedb.length > 0) {
                    await this.catalogosRepo.transportesRepo.clear()
                }
            }
        } catch (error) {
            console.log("Error sincronizando Transportes", error);
        }
    }

    async getCodigosRanchoMaestros(idProyecto: string): Promise<void> {
        try {
            const resp: any = await firstValueFrom(this.catalogoService.listarCodigosRanchoCatalogo(idProyecto));
            const data = Array.isArray(resp) ? resp : (resp?.data ?? []);
            if (data.length > 0) {
                let dexiedb = await this.catalogosRepo.codigosRanchoRepo.getAll();
                if (dexiedb.length > 0) {
                    await this.catalogosRepo.codigosRanchoRepo.clear();
                }
                for (const c of data) {
                    c.bd = 1;
                    await this.catalogosRepo.codigosRanchoRepo.save(c);
                }
            } else {
                let dexiedb = await this.catalogosRepo.codigosRanchoRepo.getAll();
                if (dexiedb.length > 0) {
                    await this.catalogosRepo.codigosRanchoRepo.clear();
                }
            }
        } catch (error) {
            console.log("Error sincronizando Códigos Rancho", error);
        }
    }

    async getLugaresProduccionConfigMaestros(idProyecto: string): Promise<void> {
        try {
            const resp: any = await firstValueFrom(this.catalogoService.listarLugaresProduccionConfig(idProyecto));
            const data = Array.isArray(resp) ? resp : (resp?.data ?? []);
            if (data.length > 0) {
                let dexiedb = await this.catalogosRepo.lugaresProduccionConfigRepo.getAll();
                if (dexiedb.length > 0) {
                    await this.catalogosRepo.lugaresProduccionConfigRepo.clear();
                }
                for (const c of data) {
                    c.bd = 1;
                    await this.catalogosRepo.lugaresProduccionConfigRepo.save(c);
                }
            }else{
                let dexiedb = await this.catalogosRepo.lugaresProduccionConfigRepo.getAll();
                if (dexiedb.length > 0) {
                    await this.catalogosRepo.lugaresProduccionConfigRepo.clear();
                }
            }
        } catch (error) {
            console.log("Error sincronizando Lugares Producción Config", error);
        }
    }

    async getCalibresMaestros(codigoCultivo: string): Promise<void> {
        try {
            const resp: any = await firstValueFrom(this.catalogoService.listarCalibres())
            if (resp.length > 0) {
                let dexiedb = await this.catalogosRepo.calibresRepo.getAll()
                if (dexiedb.length > 0) {
                    await this.catalogosRepo.calibresRepo.clear()
                }
                let calibresCultivos = resp.filter((p: any) => p.idCultivo == codigoCultivo)
                for (const c of (calibresCultivos ?? [])) {
                    this.catalogosRepo.calibresRepo.save(c);
                }
            } else {
                let dexiedb = await this.catalogosRepo.calibresRepo.getAll()
                if (dexiedb.length > 0) {
                    await this.catalogosRepo.calibresRepo.clear()
                }
            }
        } catch (error) {
            console.log("Error sincronizando Calibres", error);
        }
    }

    async getPaisesMaestros(): Promise<void> {
        try {
            const resp: any = await firstValueFrom(this.catalogoService.listarPaises())
            if (resp.length > 0) {
                let dexiedb = await this.catalogosRepo.destinosRepo.getAll()
                if (dexiedb.length > 0) {
                    await this.catalogosRepo.destinosRepo.clear()
                }
                for (const p of (resp ?? [])) {
                    this.catalogosRepo.destinosRepo.save(p);
                }
            } else {
                let dexiedb = await this.catalogosRepo.destinosRepo.getAll()
                if (dexiedb.length > 0) {
                    await this.catalogosRepo.destinosRepo.clear()
                }
            }
        } catch (error) {
            console.log("Error sincronizando Paises", error);
        }
    }

    async getVariedadesMaestros(codigoCultivo: string): Promise<void> {
        try {
            const resp: any = await firstValueFrom(this.catalogoService.listarVariedades())
            if (!resp?.error) {
                if (resp.data.length > 0) {
                    let dexiedb = await this.catalogosRepo.variedadesRepo.getAll()
                    if (dexiedb.length > 0) {
                        await this.catalogosRepo.variedadesRepo.clear()
                    }
                    let variedadesCultivos = resp.data.filter((p: any) => p.idcultivo == codigoCultivo)
                    for (const v of (variedadesCultivos ?? [])) {
                        v.bd = 1
                        this.catalogosRepo.variedadesRepo.save(v)
                    }
                } else {
                    let dexiedb = await this.catalogosRepo.variedadesRepo.getAll()
                    if (dexiedb.length > 0) {
                        await this.catalogosRepo.variedadesRepo.clear()
                    }
                }
            }
        } catch (error) {
            console.log("Error sincronizando Variedades", error);
        }
    }

    async getClientesMaestros(): Promise<void> {
        try {
            const resp: any = await firstValueFrom(this.catalogoService.listarClientes())
            if (resp.length > 0) {
                this.catalogosRepo.clientesRepo.clear()
                for (const c of (resp ?? [])) {
                    this.catalogosRepo.clientesRepo.save(c)
                }
                this.catalogosRepo.consignatariosRepo.clear()
                for (const c of (resp ?? [])) {
                    this.catalogosRepo.consignatariosRepo.save(c)
                }
            } else {
                let dexiedbClientes = await this.catalogosRepo.clientesRepo.getAll()
                if (dexiedbClientes.length > 0) {
                    await this.catalogosRepo.clientesRepo.clear()
                }
                let dexiedbConsig = await this.catalogosRepo.consignatariosRepo.getAll()
                if (dexiedbConsig.length > 0) {
                    await this.catalogosRepo.consignatariosRepo.clear()
                }
            }
        } catch (error) {
            console.log("Error sincronizando Clientes", error);
        }
    }

    async getFormatosMaestros(codigoCultivo: string): Promise<void> {
        try {
            const resp: any = await firstValueFrom(this.catalogoService.listarFormatos(codigoCultivo))
            if (!resp.error) {
                let dexiedb = await this.catalogosRepo.formatosRepo.getAll()
                if (dexiedb.length > 0) {
                    await this.catalogosRepo.formatosRepo.clear()
                }
                for (const f of (resp.data ?? [])) {
                    f.bd = 1
                    this.catalogosRepo.formatosRepo.save(f)
                }
            } else {
                let dexiedb = await this.catalogosRepo.formatosRepo.getAll()
                if (dexiedb.length > 0) {
                    await this.catalogosRepo.formatosRepo.clear()
                }
            }
        } catch (error) {
            console.log("Error sincronizando Formatos", error);
        }
    }

    async getAcopiosMaestros(): Promise<void> {
        try {
            const resp: any = await firstValueFrom(this.catalogoService.listarAcopios())
            console.log(resp)
            if (!resp.error) {
                let dexiedb = await this.catalogosOperativosRepo.acopiosRepo.getAll()
                if (dexiedb.length > 0) {
                    await this.catalogosOperativosRepo.acopiosRepo.clear()
                    await this.catalogosOperativosRepo.acopiosDetallesRepo.clear()
                }
                for (const a of (resp.data ?? [])) {
                    a.bd = 1
                    this.catalogosOperativosRepo.acopiosRepo.save(a)
                    if(a.tiposProcesoEmpacado.length >0){
                        for(const ad of (a.tiposProcesoEmpacado?? [])){
                                const detalle:AcopioDetalle = {
                                    id:ad.id,
                                    codigoAcopio: a.codigoAcopio,
                                    codigoTipoProcesoEmpacado: ad.codigo,
                                    nombreTipoProcesoEmpacado: ad.nombre,
                                    fechaCreacion: ad.fechaCreacion,
                                    activo:ad.activo,
                                    bd: 1,
                                };
                            this.catalogosOperativosRepo.acopiosDetallesRepo.save(detalle)
                        }
                    }
                }
            } else {
                let dexiedb = await this.catalogosOperativosRepo.acopiosRepo.getAll()
                if (dexiedb.length > 0) {
                    await this.catalogosOperativosRepo.acopiosRepo.clear()
                    await this.catalogosOperativosRepo.acopiosDetallesRepo.clear()
                }
            }
        } catch (error) {
            console.log("Error sincronizando Acopios", error);
        }
    }

    async getCampaniasMaestros(): Promise<void> {
        try {
            const resp: any = await firstValueFrom(this.catalogoService.listarCampanias())
            if (resp.length > 0) {
                let dexiedb = await this.catalogosRepo.campaniaRepo.getAll()
                if (dexiedb.length > 0) {
                    await this.catalogosRepo.campaniaRepo.clear()
                }
                for (const c of (resp ?? [])) {
                    this.catalogosRepo.campaniaRepo.save(c)
                }
            } else {
                let dexiedb = await this.catalogosRepo.campaniaRepo.getAll()
                if (dexiedb.length > 0) {
                    await this.catalogosRepo.campaniaRepo.clear()
                }
            }
        } catch (error) {
            console.log("Error sincronizando Campanias", error);
        }
    }

    async getCultivosMaestros(): Promise<void> {
        try {
            const resp: any = await firstValueFrom(this.catalogoService.listarCultivos())
            if (resp.length > 0) {
                let dexiedb = await this.catalogosRepo.cultivoRepo.getAll()
                if (dexiedb.length > 0) {
                    await this.catalogosRepo.cultivoRepo.clear()
                }
                for (const c of (resp ?? [])) {
                    this.catalogosRepo.cultivoRepo.save(c)
                }
            } else {
                let dexiedb = await this.catalogosRepo.cultivoRepo.getAll()
                if (dexiedb.length > 0) {
                    await this.catalogosRepo.cultivoRepo.clear()
                }
            }
        } catch (error) {
            console.log("Error sincronizando Cultivos", error);
        }
    }

    async getFundosMaestros(): Promise<void> {
        try {
            const resp: any = await firstValueFrom(this.catalogoService.listarFundos())
            if (resp.length > 0) {
                let dexiedb = await this.catalogosRepo.fundoRepo.getAll()
                if (dexiedb.length > 0) {
                    await this.catalogosRepo.fundoRepo.clear()
                }
                for (const f of (resp ?? [])) {
                    this.catalogosRepo.fundoRepo.save(f)
                }
            } else {
                let dexiedb = await this.catalogosRepo.fundoRepo.getAll()
                if (dexiedb.length > 0) {
                    await this.catalogosRepo.fundoRepo.clear()
                }
            }
        } catch (error) {
            console.log("Error sincronizando Fundos", error);
        }
    }

}