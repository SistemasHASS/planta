import { Component, ChangeDetectionStrategy, inject, signal, OnInit, computed, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CatalogoService } from '../../shared/services/catalogo.service';
import { PermissionService } from '../../shared/services/permission.service';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { finalize, firstValueFrom, map } from 'rxjs';
import { isCatalogoKey } from './catalogos.utils';
import { CatalogoKey } from './catalogos.type';
import { CATALOGOS_CONFIG } from './catalogos.config';
import { CatalogoTablaComponent, EstadoFiltro } from './components/tabla/catalogo-tabla.component';
import { CatalogoModalComponent } from './components/modal/catalogo-modal.component';
import { CatalogosRepository } from '../../shared/dexiedb/repository/catalogos.repository';
import { CatalogosOperativosRepository } from '../../shared/dexiedb/repository/catalogos-operacionales.repository';
import { ConnectivityService } from '../../shared/services/connectivity.service';
import { AlertService } from '../../shared/services/alert.service';
import { Configuracion } from '../../shared/interfaces/administracion.interface';
import { AuthService } from '../../shared/services/auth.service';

const OPERARIOS_KEYS = new Set<CatalogoKey>([
  'conductores',
  'vehiculos',
  'transportistas',
  'supervisores',
  'personalLogistica',
  'acopios',
]);

const CATALOGO_DATA_KEY_MAP: Record<CatalogoKey, string> = {
  acopios: 'acopios',
  formatos: 'formatos',
  clientes: 'clientes',
  destinos: 'destinos',
  consignatarios: 'consignatarios',
  variedades: 'variedades',
  tiposEmpaque: 'tiposEmpaque',
  tiposEmpaqueGuia: 'tiposEmpaqueGuia',
  presentaciones: 'presentaciones',
  tiposCaja: 'tiposCaja',
  tiposClamshell: 'tiposClamshell',
  lugaresProduccion: 'lugaresProduccion',
  transportes: 'transportes',
  calibres: 'calibres',
  categorias: 'categorias',
  conductores: 'conductores',
  vehiculos: 'vehiculos',
  transportistas: 'transportistas',
  supervisores: 'supervisores',
  personalLogistica: 'personalLogistica',
};

@Component({
  selector: 'app-catalogos',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, CatalogoTablaComponent, CatalogoModalComponent],
  templateUrl: './catalogos.component.html',
  styleUrl: './catalogos.component.scss'
})



export class CatalogosComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly catalogoService = inject(CatalogoService);
  private readonly route = inject(ActivatedRoute);
  readonly permissions = inject(PermissionService);
  private readonly connectivity = inject(ConnectivityService);
  private readonly alertService = inject(AlertService);
  readonly savedConfig = signal<Configuracion | null>(null);

  readonly tipo = toSignal(
    this.route.paramMap.pipe(
      map(params => params.get('tipo')),
      map(tipo => isCatalogoKey(tipo) ? tipo : 'clientes')
    ),
    { initialValue: 'clientes' as CatalogoKey }
  );
  readonly config = computed(() => CATALOGOS_CONFIG[this.tipo()]);

  readonly hasActivoColumn = computed(() => {
    const cols = this.config()?.columnas ?? [];
    return cols.some(c => String(c?.campo ?? '').trim().toLowerCase() === 'activo');
  });

  readonly isEditable = computed(() => {
    const cfg: any = this.config();
    return cfg?.editable !== false;
  });

  isLoading = signal(false);

  readonly searchTerm = signal('');
  readonly estadoFiltro = signal<EstadoFiltro>('todos');

  readonly modalAbierto = signal(false);
  readonly modalModo = signal<'nuevo' | 'editar'>('nuevo');
  readonly modalValue = signal<any>(null);
  readonly usuario = this.auth.usuario;
  get online(): boolean {
    return this.connectivity.isOnline();
  }
  private readonly data = signal<Record<string, any[]>>({});

  readonly items = computed(() => {
    const t = this.tipo();
    const d = this.data();

    const mapKey: Partial<Record<CatalogoKey, string>> = {
      acopios: 'acopios',
      formatos: 'formatos',
      clientes: 'clientes',
      destinos: 'destinos',
      consignatarios: 'consignatarios',
      variedades: 'variedades',
      tiposEmpaque: 'tiposEmpaque',
      tiposEmpaqueGuia: 'tiposEmpaqueGuia',
      presentaciones: 'presentaciones',
      tiposCaja: 'tiposCaja',
      tiposClamshell: 'tiposClamshell',
      lugaresProduccion: 'lugaresProduccion',
      transportes: 'transportes',
      calibres: 'calibres',
      categorias: 'categorias',
      conductores: 'conductores',
      vehiculos: 'vehiculos',
      transportistas: 'transportistas',
      supervisores: 'supervisores',
      personalLogistica: 'personalLogistica',
    };

    const key = mapKey[t] ?? t;
    let e = d?.[key] ?? [];
    return e
  });

  readonly puedeCrear = computed(() => {
    const c = this.config();
    return this.isEditable() && !c?.noCrear;
  });

  async ngOnInit(): Promise<void> {
    const nro = this.getNroDocumentoFromUsuario();
    if (!nro) {
      this.savedConfig.set(null);
      return;
    }

    const cfg = await this.catalogosRepo.configuracionRepo.getByField('nrodocumento', nro);
    this.savedConfig.set(cfg ?? null);
    return;
  }

  constructor(
    private catalogosRepo: CatalogosRepository,
    private catalogosOperativosRepo: CatalogosOperativosRepository
  ) {
    effect(() => {
      const tipo = this.tipo();
      if (OPERARIOS_KEYS.has(tipo)) {
        this.cargarCatalogosOperariosSiHaceFalta();
      } else {
        this.cargarCatalogosBaseSiHaceFalta();
      }
    });
  }

  private getNroDocumentoFromUsuario(): string {
    const u: any = this.usuario();
    const v = u?.nrodocumento ?? u?.documentoidentidad ?? u?.documentoIdentidad ?? u?.documento ?? '';
    return String(v ?? '').trim();
  }

  private async cargarCatalogosOperariosSiHaceFalta(): Promise<void> {
    const dixieRepo = this.config().dixieRepo;
    let info = await this.catalogosOperativosRepo[dixieRepo as keyof CatalogosOperativosRepository].getAll()
    if (info.length > 0) {
      this.data.update(current => ({ ...current, [this.tipo()]: [...info] }))
      return;
    } else {
      await this.getCatalogosOperativosApi()
    }
  }

  private async cargarCatalogosBaseSiHaceFalta(): Promise<void> {
    const dixieRepo = this.config().dixieRepo;
    let info = await this.catalogosRepo[dixieRepo as keyof CatalogosRepository].getAll()
    if (info.length > 0) {
      this.data.update(current => ({ ...current, [this.tipo()]: [...info] }))
      return;
    } else {
      await this.getCatalogoApi()
    }
  }

  private async getCatalogosOperativosApi(): Promise<void> {
    this.isLoading.set(true);
    try {
      const resp: any = await firstValueFrom(this.catalogoService.listarForTablaCatalogos(this.config().tabla, this.savedConfig()?.codigoCultivo, this.savedConfig()?.idProyecto));
      const data = resp?.data ?? resp;
      const nombres = Object.keys(data ?? {});
      for (const element of nombres) {
        const confTemp = CATALOGOS_CONFIG[element as keyof typeof CATALOGOS_CONFIG];
        if (!confTemp) continue;
        const repo = this.catalogosOperativosRepo[confTemp.dixieRepo as keyof CatalogosOperativosRepository];
        const items = data[element].map((item: any) => ({
          ...item,
          bd: 1
        }));

        for (const item of items) {
          await repo.save(item);
        }
      }

      await this.getDataCatalogosOperativosDixie()

    } catch (err) {
      console.error('Error cargando catálogos operativos', err);
    } finally {
      this.isLoading.set(false);
    }
  }

  private async getCatalogoApi(): Promise<void> {
    this.isLoading.set(true);
    try {
      const resp: any = await firstValueFrom(this.catalogoService.listarForTablaCatalogos(this.config().tabla, this.savedConfig()?.codigoCultivo, this.savedConfig()?.idProyecto));
      const data = resp?.data ?? resp;
      const nombres = Object.keys(data ?? {});
      for (const element of nombres) {
        const confTemp = CATALOGOS_CONFIG[element as keyof typeof CATALOGOS_CONFIG];
        if (!confTemp) continue;
        const repo = this.catalogosRepo[confTemp.dixieRepo as keyof CatalogosRepository];
        const items = data[element].map((item: any) => ({
          ...item,
          bd: 1
        }));

        for (const item of items) {
          await repo.save(item);
        }

      }

      await this.getDataCatalogosDixie()

    } catch (err) {
      console.error('Error cargando catálogos base', err);
    } finally {
      this.isLoading.set(false);
    }
  }

  private async getDataCatalogosOperativosDixie(): Promise<void> {
    try {
      const dixieRepo = this.config().dixieRepo;
      const info = await this.catalogosOperativosRepo[dixieRepo as keyof CatalogosOperativosRepository].getAll();
      this.data.update(current => ({
        ...current,
        [this.tipo()]: info
      }));
    } catch (error) {
      console.error('Error cargando catálogos dixie', error);
      this.alertService.showAlert('Error', 'Error cargando catálogos dixie', 'error');
    }
  }

  private async getDataCatalogosDixie(): Promise<void> {
    try {
      const dixieRepo = this.config().dixieRepo;
      const info = await this.catalogosRepo[dixieRepo as keyof CatalogosRepository].getAll();
      this.data.update(current => ({
        ...current,
        [this.tipo()]: info
      }));
    } catch (error) {
      this.alertService.showAlert('Error', 'Error cargando catálogos dixie', 'error');
      console.error('Error cargando catálogos dixie', error);
    }
  }

  private async getCatalogoOperativosTipoApi(tabla: string): Promise<void> {
    console.log('getCatalogoOperativosTipoApi');
    this.isLoading.set(true);
    try {
      const resp: any = await firstValueFrom(this.catalogoService.listarForTablaCatalogos(tabla, this.savedConfig()?.codigoCultivo,this.savedConfig()?.idProyecto));
      const data = resp?.data ?? resp;
      const confTemp = CATALOGOS_CONFIG[this.tipo() as keyof typeof CATALOGOS_CONFIG];
      const repo = this.catalogosOperativosRepo[confTemp.dixieRepo as keyof CatalogosOperativosRepository];
      const uniqueField = confTemp.codigoField || 'codigo';
      for (const item of data) {
        const apiId = (item as any)?.id;
        const uniqueValue = (item as any)?.[uniqueField];
        const existing = apiId
          ? await repo.getByField('id', apiId)
          : (uniqueValue !== undefined && uniqueValue !== null && `${uniqueValue}`.trim() !== '')
            ? await repo.getByField(uniqueField, uniqueValue)
            : undefined;

        if (existing) {
          if ((existing as any)?.bd === 0) {
            continue;
          }
          (item as any)._pk = (existing as any)._pk;
        }

        (item as any).bd = 1;
        await repo.save(item);
      }

      await this.getDataCatalogosOperativosDixie();

    } catch (err) {
      console.error('Error cargando catálogos base', err);
    } finally {
      this.isLoading.set(false);
    }
  }


  private async getCatalogoTipoApi(tabla: string): Promise<void> {
    console.log('getCatalogoTipoApi');
    this.isLoading.set(true);
    try {
      const resp: any = await firstValueFrom(this.catalogoService.listarForTablaCatalogos(tabla, this.savedConfig()?.codigoCultivo,this.savedConfig()?.idProyecto));
      const data = resp?.data ?? resp;
      const confTemp = CATALOGOS_CONFIG[this.tipo() as keyof typeof CATALOGOS_CONFIG];
      const repo = this.catalogosRepo[confTemp.dixieRepo as keyof CatalogosRepository];
      const uniqueField = confTemp.codigoField || 'codigo';
      for (const item of data) {
        const apiId = (item as any)?.id;
        const uniqueValue = (item as any)?.[uniqueField];
        const existing = apiId
          ? await repo.getByField('id', apiId)
          : (uniqueValue !== undefined && uniqueValue !== null && `${uniqueValue}`.trim() !== '')
            ? await repo.getByField(uniqueField, uniqueValue)
            : undefined;

        if (existing) {
          if ((existing as any)?.bd === 0) {
            continue;
          }
          (item as any)._pk = (existing as any)._pk;
        }

        (item as any).bd = 1;
        await repo.save(item);
      }

      await this.getDataCatalogosDixie();

    } catch (err) {
      console.error('Error cargando catálogos base', err);
    } finally {
      this.isLoading.set(false);
    }
  }

  onSearchChange(value: string): void {
    this.searchTerm.set(value);
  }

  async onSincronizar(): Promise<void> {
    try {
      if (!this.online) {
        this.alertService.showAlert('Error', 'No tiene conexión a internet', 'error');
        return
      }

      const confirmar = await this.alertService.showConfirm(
        'Confirmar sincronización',
        'Se subirán a BD las registros pendientes. ¿Desea continuar?',
        'question',
      );

      if (confirmar) {
        // TODO: Implementar lógica de sincronización
        console.log('Sincronizando catálogos...');
        this.alertService.mostrarModalCarga();
        let dataSend: any
        if (OPERARIOS_KEYS.has(this.tipo())) {
          const columnaBd = this.config().columnas.find(col => col.campo === 'bd');
          if (columnaBd == undefined || columnaBd == null) {
            dataSend = []
          } else {
            dataSend = await this.catalogosOperativosRepo[this.config().dixieRepo as keyof CatalogosOperativosRepository].getAllNoSincronizado();
          }
        } else {
          const columnaBd = this.config().columnas.find(col => col.campo === 'bd');
          if (columnaBd == undefined || columnaBd == null) {
            dataSend = []
          } else {
            dataSend = await this.catalogosRepo[this.config().dixieRepo as keyof CatalogosRepository].getAllNoSincronizado();
          }
        }
        if (dataSend.length === 0) {
          if (OPERARIOS_KEYS.has(this.tipo())) {
            await this.catalogosOperativosRepo[this.config().dixieRepo as keyof CatalogosOperativosRepository].clear();
          } else {
            await this.catalogosRepo[this.config().dixieRepo as keyof CatalogosRepository].clear();
          }
          if (OPERARIOS_KEYS.has(this.tipo())) {
            this.getCatalogoOperativosTipoApi(this.config().tabla)
          } else {
            this.getCatalogoTipoApi(this.config().tabla)
          }
          this.alertService.showAlert('Éxito', 'No hay registros pendientes de sincronización', 'success');
          return
        } else {
          const payloads = structuredClone(dataSend);
          if( this.config().tabla == 'PLANTA_LugaresProduccion' 
            || this.config().tabla == 'PLANTA_Transportistas'
            || this.config().tabla == 'PLANTA_Vehiculos'
            || this.config().tabla == 'PLANTA_Supervisores'
            || this.config().tabla == 'PLANTA_PersonalLogistica'
            || this.config().tabla == 'PLANTA_Conductores'
          ){
            payloads.forEach((item: any) => {
              delete item.bd
              delete item._pk
              item.idproyecto = this.savedConfig()?.idProyecto
            })
          }else{
             payloads.forEach((item: any) => {
              delete item.bd
              delete item._pk
              item.codigoCultivo = this.savedConfig()?.codigoCultivo
            })
          }
          let { error, data, mensaje } = await firstValueFrom(this.catalogoService.sincronizarCatalogos(this.config().tabla, payloads));
          if (error) {
            this.alertService.showAlert('Error', mensaje, 'error');
          } else {
            if (OPERARIOS_KEYS.has(this.tipo())) {
              for (const element of dataSend) {
                await this.catalogosOperativosRepo[this.config().dixieRepo as keyof CatalogosOperativosRepository].delete(element._pk);
              }
            } else {
              for (const element of dataSend) {
                await this.catalogosRepo[this.config().dixieRepo as keyof CatalogosRepository].delete(element._pk);
              }
            }
            if (OPERARIOS_KEYS.has(this.tipo())) {
              this.getCatalogoOperativosTipoApi(this.config().tabla)
            } else {
              this.getCatalogoTipoApi(this.config().tabla)
            }
            this.alertService.showAlert('Éxito', mensaje, 'success');
          }

        }
      }
    } catch (error: any) {
      console.error('Error en sincronización:', error);
      this.alertService.showAlert('Error en sincronización', error, 'error');
    }
  }

  setEstadoFiltro(f: EstadoFiltro): void {
    this.estadoFiltro.set(f);
  }

  abrirNuevo(): void {
    this.modalModo.set('nuevo');
    this.modalValue.set(null);
    this.modalAbierto.set(true);
  }

  abrirEditar(item: any): void {
    this.modalModo.set('editar');
    this.modalValue.set(item);
    this.modalAbierto.set(true);
  }

  cerrarModal(): void {
    this.modalAbierto.set(false);
  }

  async enviarRegistrosApi(payloads: any[], pk: any = ''): Promise<boolean> {
    const label = this.config()?.label ?? 'registro';
    const tipo = this.tipo();
    try {
      const payloadArray = Array.isArray(payloads) ? payloads : [payloads];
      if( this.config().tabla == 'PLANTA_LugaresProduccion' 
          || this.config().tabla == 'PLANTA_Transportistas'
          || this.config().tabla == 'PLANTA_Vehiculos'
          || this.config().tabla == 'PLANTA_Supervisores'
          || this.config().tabla == 'PLANTA_PersonalLogistica'
          || this.config().tabla == 'PLANTA_Conductores'
        ){
        payloads = payloadArray.map(item => ({
          ...item,
          idproyecto: this.savedConfig()?.idProyecto
        }));
      }else{
        payloads = payloadArray.map(item => ({
          ...item,
          codigoCultivo: this.savedConfig()?.codigoCultivo
        }));
      }
      console.log(this.config().tabla)
      let { error, data, mensaje } = await firstValueFrom(this.catalogoService.sincronizarCatalogos(this.config().tabla, payloads));

      if (error) {
        this.alertService.showAlert('Error', `Error al guardar el ${label}, ${mensaje}.`, 'error')
        return false
      }
      if (pk !== '') {
        let existe
        if (OPERARIOS_KEYS.has(tipo)) {
          existe = await this.catalogosOperativosRepo[this.config().dixieRepo as keyof CatalogosOperativosRepository].getByKey(pk);
        } else {
          existe = await this.catalogosRepo[this.config().dixieRepo as keyof CatalogosRepository].getByKey(pk);
        }
        if (existe) {
          if (OPERARIOS_KEYS.has(tipo)) {
            await this.catalogosOperativosRepo[this.config().dixieRepo as keyof CatalogosOperativosRepository].delete(pk);
          } else {
            await this.catalogosRepo[this.config().dixieRepo as keyof CatalogosRepository].delete(pk);
          }
        }
      }
      if (OPERARIOS_KEYS.has(tipo)) {
        this.getCatalogoOperativosTipoApi(this.config().tabla)
      } else {
        this.getCatalogoTipoApi(this.config().tabla)
      }
      return true
    } catch (error) {
      console.log(error)
      this.alertService.showAlert('Error', `Error al guardar el ${label}, ${error}.`, 'error')
      return false
    }
  }

  async saveDixie(payload: any, modo: any): Promise<void> {
    const tipo = this.tipo();
    let repo;
    if (OPERARIOS_KEYS.has(tipo)) {
      repo = this.catalogosOperativosRepo[this.config().dixieRepo as keyof CatalogosOperativosRepository];
    } else {
      repo = this.catalogosRepo[this.config().dixieRepo as keyof CatalogosRepository];
    }
    if (modo === 'nuevo') {
      await repo.save(payload);
    } else if (modo === 'editar') {
      await repo.save(payload);
    }
    if (OPERARIOS_KEYS.has(tipo)) {
      await this.getDataCatalogosOperativosDixie()
    } else {
      await this.getDataCatalogosDixie()
    }
  }

  async guardarModal(payload: any): Promise<void> {
    const modo = payload?.modo ?? payload?.payload?.modo;
    const data = payload?.payload ?? payload;
    const _pk = data._pk
    if (payload?._pk !== undefined && payload?._pk !== null && (data as any)?._pk === undefined) {
      (data as any)._pk = payload._pk;
    }
    try {
      const tipo = this.tipo();
      this.alertService.mostrarModalCarga();
      const label = this.config()?.label ?? 'registro';
      if (modo === 'nuevo') {
        const keyField = this.config()?.codigoField || '';
        const keyValue = keyField ? data?.[keyField] : undefined;
        if (!keyField || keyValue === undefined || keyValue === null || `${keyValue}`.trim() === '') {
          this.alertService.showAlertAcept('Validación', 'No se detectó el campo clave para validar duplicados.', 'warning');
          return;
        }
        let duplicado
        if (OPERARIOS_KEYS.has(tipo)) {
          duplicado = await this.catalogosOperativosRepo[this.config().dixieRepo as keyof CatalogosOperativosRepository].getByField(keyField, keyValue);
        } else {
          duplicado = await this.catalogosRepo[this.config().dixieRepo as keyof CatalogosRepository].getByField(keyField, keyValue);
        }
        if (duplicado) {
          this.alertService.showAlert('Duplicado', `Ya existe un ${label} con ${keyField}: <b>${keyValue}</b>.`, 'error');
          return;
        }

        if (this.online) {
          if (!data) {
            this.alertService.showAlert('Error', `Error al guardar el ${label}.`, 'error');
            return
          } else {
            delete data.modo;
            delete (data as any)._pk;
            delete (data as any).bd;
            let res = await this.enviarRegistrosApi(data)
            if (res) {
              this.alertService.cerrarModalCarga();
              this.modalAbierto.set(false);
              return
            }
          }
        } else {
          delete data.modo;
          (data as any).bd = 0
          await this.saveDixie(data, 'nuevo')
          this.alertService.cerrarModalCarga();
          this.modalAbierto.set(false);
          return
        }

      } else if (modo === 'editar') {
        const keyField = this.config()?.codigoField || '';
        const keyValue = keyField ? data?.[keyField] : undefined;
        if (keyField && keyValue !== undefined && keyValue !== null && `${keyValue}`.trim() !== '') {
          let duplicado
          if (OPERARIOS_KEYS.has(tipo)) {
            duplicado = await this.catalogosOperativosRepo[this.config().dixieRepo as keyof CatalogosOperativosRepository].getByField(keyField, keyValue);
          } else {
            duplicado = await this.catalogosRepo[this.config().dixieRepo as keyof CatalogosRepository].getByField(keyField, keyValue);
          }
          if (duplicado && (duplicado as any)?._pk !== (data as any)?._pk) {
            this.alertService.showAlert('Duplicado', `Ya existe un ${label} con ${keyField}: <b>${keyValue}</b>.`, 'error');
            return;
          }
        }
        if (this.online) {
          if (!data) {
            this.alertService.showAlert('Error', `Error al guardar el ${label}.`, 'error');
            return
          } else {
            delete data.modo;
            delete (data as any).bd;
            delete (data as any)._pk;
            let res = await this.enviarRegistrosApi(data, _pk)
            if (res) {
              this.alertService.cerrarModalCarga();
              this.modalAbierto.set(false);
              return
            }
          }
        } else {
          delete data.modo;
          (data as any).bd = 0
          await this.saveDixie(data, 'editar')
          this.alertService.cerrarModalCarga();
          this.modalAbierto.set(false);
          return
        }
      }
      return
    } catch (error) {
      console.log(error)
      this.alertService.cerrarModalCarga();
      this.alertService.showAlertAcept('Error', 'No se pudo guardar el registro. Inténtalo nuevamente.', 'error');

    }
  }

  async onDesactivar(item: any): Promise<void> {
    this.alertService.mostrarModalCarga();
    let tipo = this.tipo();
    let existe: any
    if (OPERARIOS_KEYS.has(tipo)) {
      existe = await this.catalogosOperativosRepo[this.config().dixieRepo as keyof CatalogosOperativosRepository].getByKey(item._pk);
    } else {
      existe = await this.catalogosRepo[this.config().dixieRepo as keyof CatalogosRepository].getByKey(item._pk);
    }
    if (existe) {
      if (this.online) {
        delete existe.modo;
        delete (existe as any).bd;
        delete (existe as any)._pk;
        existe.activo = !existe.activo
        let res = await this.enviarRegistrosApi(existe, existe._pk)
        if (res) {
          this.alertService.cerrarModalCarga();
          return
        }
      } else {
        if (OPERARIOS_KEYS.has(tipo)) {
          await this.catalogosOperativosRepo[this.config().dixieRepo as keyof CatalogosOperativosRepository].update(existe._pk, { activo: !existe.activo, bd: 0 });
        } else {
          await this.catalogosRepo[this.config().dixieRepo as keyof CatalogosRepository].update(existe._pk, { activo: !existe.activo, bd: 0 });
        }
        if (OPERARIOS_KEYS.has(tipo)) {
          await this.getDataCatalogosOperativosDixie()
        } else {
          await this.getDataCatalogosDixie()
        }
      }
      this.alertService.cerrarModalCarga();
      return
    } else {
      this.alertService.showAlert('Error', 'No se encontró el registro.', 'error');
    }
  }

  onEliminar(item: any): void {
    console.log('Eliminar no implementado aún', { tipo: this.tipo(), item });
  }
}
