import { Component, ChangeDetectionStrategy, inject, signal, computed, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { CatalogoService } from '../../shared/services/catalogo.service';
import { PermissionService } from '../../shared/services/permission.service';
import { ConnectivityService } from '../../shared/services/connectivity.service';
import { AlertService } from '../../shared/services/alert.service';
import { AuthService } from '../../shared/services/auth.service';
import { Configuracion } from '../../shared/interfaces/administracion.interface';
import { TipoEmpaque } from '../../shared/interfaces/catalogo.interface';
import { CatalogosRepository } from '../../shared/dexiedb/repository/catalogos.repository';
import { CatalogoTiposEmpaqueTablaComponent, EstadoFiltro } from './components/tabla/catalogo-tipos-empaque-tabla.component';
import { CatalogoTiposEmpaqueModalComponent } from './components/modal/catalogo-tipos-empaque-modal.component';

const TIPOS_EMPAQUE_CONFIG = {
  tabla: 'PLANTA_TiposEmpaque',
  label: 'Tipos de Empaque',
  icon: 'bi-archive',
  columnas: [
    { campo: 'id', label: 'ID', tipo: 'int', visible: false, editable: false },
    { campo: 'codigo', label: 'Código', tipo: 'varchar', maxLength: 50, required: true, unique: true },
    { campo: 'descripcion', label: 'Descripción', tipo: 'varchar', maxLength: 100 },
    { campo: 'bd', label: 'Sincronizado', tipo: 'bit', visible: true, editable: false, default: 0 },
    { campo: 'activo', label: 'Estado', tipo: 'bit', required: true },
    { campo: 'fechaCreacion', label: 'Fecha Creación', tipo: 'datetime', auto: true, visible: true, editable: false }
  ],
  displayField: 'Descripcion',
  codigoField: 'codigo',
  tieneActivo: true,
  editable: true,
  dixieRepo: 'tiposEmpaqueRepo' as const
};

@Component({
  selector: 'app-catalogo-tipos-empaque',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, CatalogoTiposEmpaqueTablaComponent, CatalogoTiposEmpaqueModalComponent],
  templateUrl: './catalogo-tipos-empaque.component.html',
  styleUrl: './catalogo-tipos-empaque.component.scss'
})
export class CatalogoTiposEmpaqueComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly catalogoService = inject(CatalogoService);
  readonly permissions = inject(PermissionService);
  private readonly connectivity = inject(ConnectivityService);
  private readonly alertService = inject(AlertService);
  private readonly catalogosRepo = inject(CatalogosRepository);

  readonly config: any = TIPOS_EMPAQUE_CONFIG;
  readonly savedConfig = signal<Configuracion | null>(null);
  readonly usuario = this.auth.usuario;

  isLoading = signal(false);
  readonly searchTerm = signal('');
  readonly estadoFiltro = signal<EstadoFiltro>('todos');

  readonly modalAbierto = signal(false);
  readonly modalModo = signal<'nuevo' | 'editar'>('nuevo');
  readonly modalValue = signal<any>(null);

  readonly categorias = signal<any[]>([]);
  readonly calibres = signal<any[]>([]);

  private readonly data = signal<TipoEmpaque[]>([]);

  readonly items = computed(() => this.data() ?? []);

  get online(): boolean {
    return this.connectivity.isOnline();
  }

  async ngOnInit(): Promise<void> {
    const nro = this.getNroDocumentoFromUsuario();
    if (!nro) {
      this.savedConfig.set(null);
      return;
    }
    const cfg = await this.catalogosRepo.configuracionRepo.getByField('nrodocumento', nro);
    this.savedConfig.set(cfg ?? null);
    await this.cargarCalibresDexie();
    await this.cargarCategoriasDexie();
    await this.cargarTiposEmpaque();
  }

  private async cargarCalibresDexie(): Promise<void> {
    try {
      const codCultivo = this.savedConfig()?.codigoCultivo;
      if (!codCultivo) {
        this.calibres.set([]);
        return;
      }
      const all = await this.catalogosRepo.calibresRepo.getAll();
      const filtrados = (all ?? [])
        .filter((c: any) => String(c?.idCultivo ?? '') === String(codCultivo))
        .sort((a: any, b: any) => {
          const idA = Number(a?.id ?? 0);
          const idB = Number(b?.id ?? 0);
          if (idA !== idB) return idA - idB;
          return String(a?.calibre ?? '').localeCompare(String(b?.calibre ?? ''));
        });
      this.calibres.set(filtrados);
    } catch (e) {
      console.error('Error cargando calibres', e);
      this.calibres.set([]);
    }
  }

  private async cargarCategoriasDexie(): Promise<void> {
    try {
      const codCultivo = this.savedConfig()?.codigoCultivo;
      if (!codCultivo) {
        this.categorias.set([]);
        return;
      }
      const all = await this.catalogosRepo.categoriasRepo.getAll();
      let filtrados = (all ?? [])
        .filter((c: any) => String(c?.codigoCultivo ?? '') === String(codCultivo))
        .sort((a: any, b: any) => {
          const idA = Number(a?.id ?? 0);
          const idB = Number(b?.id ?? 0);
          if (idA !== idB) return idA - idB;
          return String(a?.nombre ?? '').localeCompare(String(b?.nombre ?? ''));
        });
      // enriquecer categorias con calibreNombre si falta
      const calibresList = this.calibres();
      if (calibresList.length) {
        filtrados = filtrados.map((cat: any) => {
          if (!cat.calibreNombre && cat.calibreId) {
            const cal = calibresList.find((c: any) => String(c?.id ?? '') === String(cat.calibreId));
            if (cal) {
              return { ...cat, calibreNombre: cal.calibre };
            }
          }
          return cat;
        });
      }
      this.categorias.set(filtrados);
    } catch (e) {
      console.error('Error cargando categorias', e);
      this.categorias.set([]);
    }
  }

  private enriquecerTiposEmpaqueConCategoria(items: TipoEmpaque[]): TipoEmpaque[] {
    const cats = this.categorias();
    if (!cats.length) return items;
    return items.map(item => {
      if (item.codigoCategoria) {
        const cat = cats.find((c: any) => String(c?.codigo ?? '') === String(item.codigoCategoria));
        if (cat) {
          const updates: any = {};
          if (!item.nombreCategoria) updates.nombreCategoria = cat.nombre;
          if (!item.nombreCalibre && cat.calibreNombre) updates.nombreCalibre = cat.calibreNombre;
          if (Object.keys(updates).length) return { ...item, ...updates };
        }
      }
      return item;
    });
  }

  private getNroDocumentoFromUsuario(): string {
    const u: any = this.usuario();
    const v = u?.nrodocumento ?? u?.documentoidentidad ?? u?.documentoIdentidad ?? u?.documento ?? '';
    return String(v ?? '').trim();
  }

  private async cargarTiposEmpaque(): Promise<void> {
    await this.getDataTiposEmpaqueDexie();
    if (this.online) {
      await this.reemplazarTiposEmpaqueDesdeApi();
      await this.getDataTiposEmpaqueDexie();
      await this.cargarCalibresDexie();
      await this.cargarCategoriasDexie();
    }
  }

  private async reemplazarTiposEmpaqueDesdeApi(): Promise<void> {
    this.isLoading.set(true);
    try {
      const resp: any = await firstValueFrom(
        this.catalogoService.listarForTablaCatalogos(this.config.tabla, this.savedConfig()?.codigoCultivo, this.savedConfig()?.idProyecto)
      );
      const data = resp?.data ?? resp;

      let itemsApi: any[] = [];
      if (Array.isArray(data)) {
        itemsApi = data;
      } else if (data && typeof data === 'object') {
        itemsApi = data['tiposEmpaque'] ?? [];
      }

      if (itemsApi.length === 0) return;

      const todos = await this.catalogosRepo.tiposEmpaqueRepo.getAll();
      for (const item of todos) {
        const it = item as any;
        if (it?.bd === 1 || it?.bd === undefined || it?.bd === null) {
          await this.catalogosRepo.tiposEmpaqueRepo.delete(it._pk);
        }
      }

      for (const item of itemsApi) {
        await this.catalogosRepo.tiposEmpaqueRepo.save({ ...item, bd: 1 });
      }
      await this.cargarCategoriasDexie();
    } catch (err) {
      console.error('Error cargando tipos de empaque desde API', err);
    } finally {
      this.isLoading.set(false);
    }
  }

  private async getDataTiposEmpaqueDexie(): Promise<void> {
    try {
      const info = await this.catalogosRepo.tiposEmpaqueRepo.getAll();
      this.data.set(this.enriquecerTiposEmpaqueConCategoria(info));
    } catch (error) {
      console.error('Error cargando tipos de empaque dexie', error);
      this.alertService.showAlert('Error', 'Error cargando tipos de empaque', 'error');
    }
  }

  private async getTiposEmpaqueTipoApi(): Promise<void> {
    this.isLoading.set(true);
    try {
      const resp: any = await firstValueFrom(
        this.catalogoService.listarForTablaCatalogos(this.config.tabla, this.savedConfig()?.codigoCultivo, this.savedConfig()?.idProyecto)
      );
      const data = resp?.data ?? resp;
      for (const item of data) {
        const apiId = (item as any)?.id;
        const uniqueValue = (item as any)?.['codigo'];
        const existing = apiId
          ? await this.catalogosRepo.tiposEmpaqueRepo.getByField('id', apiId)
          : (uniqueValue !== undefined && uniqueValue !== null && `${uniqueValue}`.trim() !== '')
            ? await this.catalogosRepo.tiposEmpaqueRepo.getByField('codigo', uniqueValue)
            : undefined;
        if (existing) {
          if ((existing as any)?.bd === 0) continue;
          (item as any)._pk = (existing as any)._pk;
        }
        (item as any).bd = 1;
        await this.catalogosRepo.tiposEmpaqueRepo.save(item);
      }
      await this.getDataTiposEmpaqueDexie();
    } catch (err) {
      console.error('Error cargando tipos de empaque', err);
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
        this.alertService.showAlert('Error', 'No tiene conexion a internet', 'error');
        return;
      }
      const confirmar = await this.alertService.showConfirm(
        'Confirmar sincronizacion',
        'Se subiran a BD las registros pendientes. Desea continuar?',
        'question'
      );
      if (!confirmar) return;

      this.alertService.mostrarModalCarga();
      const dataSend = await this.catalogosRepo.tiposEmpaqueRepo.getAllNoSincronizado();

      if (dataSend.length === 0) {
        await this.catalogosRepo.tiposEmpaqueRepo.clear();
        this.getTiposEmpaqueTipoApi();
        this.alertService.showAlert('Exito', 'No hay registros pendientes de sincronizacion', 'success');
        return;
      }

      const payloads = structuredClone(dataSend);
      payloads.forEach((item: any) => {
        delete item.bd;
        delete item._pk;
        delete item.nombreCategoria;
        delete item.nombreCalibre;
        item.codigoCultivo = this.savedConfig()?.codigoCultivo;
      });

      const { error, data, mensaje } = await firstValueFrom(
        this.catalogoService.sincronizarCatalogos(this.config.tabla, payloads)
      );
      if (error) {
        this.alertService.showAlert('Error', mensaje, 'error');
      } else {
        for (const element of dataSend) {
          await this.catalogosRepo.tiposEmpaqueRepo.delete((element as any)._pk);
        }
        this.getTiposEmpaqueTipoApi();
        this.alertService.showAlert('Exito', mensaje, 'success');
      }
    } catch (error: any) {
      console.error('Error en sincronizacion:', error);
      this.alertService.showAlert('Error en sincronizacion', error, 'error');
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

  async enviarRegistrosApi(payloads: TipoEmpaque[], pk: any = ''): Promise<boolean> {
    try {
      const payloadArray = Array.isArray(payloads) ? payloads : [payloads];
      payloads = payloadArray.map(item => ({
        ...item,
        codigoCultivo: this.savedConfig()?.codigoCultivo ?? item.codigoCultivo ?? ''
      })) as TipoEmpaque[];

      const { error, data, mensaje } = await firstValueFrom(
        this.catalogoService.sincronizarCatalogos(this.config.tabla, payloads)
      );
      if (error) {
        this.alertService.showAlert('Error', `Error al guardar el tipo de empaque, ${mensaje}.`, 'error');
        return false;
      }
      if (pk !== '') {
        const existe = await this.catalogosRepo.tiposEmpaqueRepo.getByKey(pk);
        if (existe) await this.catalogosRepo.tiposEmpaqueRepo.delete(pk);
      }
      this.getTiposEmpaqueTipoApi();
      return true;
    } catch (error) {
      console.log(error);
      this.alertService.showAlert('Error', `Error al guardar el tipo de empaque, ${error}.`, 'error');
      return false;
    }
  }

  async saveDixie(payload: any, modo: any): Promise<void> {
    await this.catalogosRepo.tiposEmpaqueRepo.save(payload);
    await this.getDataTiposEmpaqueDexie();
  }

  async guardarModal(payload: any): Promise<void> {
    const modo = payload?.modo ?? payload?.payload?.modo;
    const data = payload?.payload ?? payload;
    const _pk = data._pk;
    if (payload?._pk !== undefined && payload?._pk !== null && (data as any)?._pk === undefined) {
      (data as any)._pk = payload._pk;
    }
    try {
      this.alertService.mostrarModalCarga();
      if (modo === 'nuevo') {
        const keyField = this.config.codigoField || '';
        const keyValue = keyField ? data?.[keyField] : undefined;
        if (!keyField || keyValue === undefined || keyValue === null || `${keyValue}`.trim() === '') {
          this.alertService.showAlertAcept('Validacion', 'No se detecto el campo clave para validar duplicados.', 'warning');
          return;
        }
        const duplicado = await this.catalogosRepo.tiposEmpaqueRepo.getByField(keyField, keyValue);
        if (duplicado) {
          this.alertService.showAlert('Duplicado', `Ya existe un tipo de empaque con ${keyField}: <b>${keyValue}</b>.`, 'error');
          return;
        }
        if (this.online) {
          if (!data) {
            this.alertService.showAlert('Error', 'Error al guardar el tipo de empaque.', 'error');
            return;
          }
          delete data.modo;
          delete (data as any)._pk;
          delete (data as any).bd;
          delete (data as any).nombreCategoria;
          delete (data as any).nombreCalibre;
          const res = await this.enviarRegistrosApi(data);
          if (res) {
            this.alertService.cerrarModalCarga();
            this.modalAbierto.set(false);
            return;
          }
        } else {
          delete data.modo;
          (data as any).bd = 0;
          await this.saveDixie(data, 'nuevo');
          this.alertService.cerrarModalCarga();
          this.modalAbierto.set(false);
          return;
        }
      } else if (modo === 'editar') {
        const keyField = this.config.codigoField || '';
        const keyValue = keyField ? data?.[keyField] : undefined;
        if (keyField && keyValue !== undefined && keyValue !== null && `${keyValue}`.trim() !== '') {
          const duplicado = await this.catalogosRepo.tiposEmpaqueRepo.getByField(keyField, keyValue);
          if (duplicado && (duplicado as any)?._pk !== (data as any)?._pk) {
            this.alertService.showAlert('Duplicado', `Ya existe un tipo de empaque con ${keyField}: <b>${keyValue}</b>.`, 'error');
            return;
          }
        }
        if (this.online) {
          if (!data) {
            this.alertService.showAlert('Error', 'Error al guardar el tipo de empaque.', 'error');
            return;
          }
          delete data.modo;
          delete (data as any).bd;
          delete (data as any)._pk;
          delete (data as any).nombreCategoria;
          delete (data as any).nombreCalibre;
          const res = await this.enviarRegistrosApi(data, _pk);
          if (res) {
            this.alertService.cerrarModalCarga();
            this.modalAbierto.set(false);
            return;
          }
        } else {
          delete data.modo;
          (data as any).bd = 0;
          await this.saveDixie(data, 'editar');
          this.alertService.cerrarModalCarga();
          this.modalAbierto.set(false);
          return;
        }
      }
    } catch (error) {
      console.log(error);
      this.alertService.cerrarModalCarga();
      this.alertService.showAlertAcept('Error', 'No se pudo guardar el registro. Intentalo nuevamente.', 'error');
    }
  }

  async onDesactivar(item: any): Promise<void> {
    this.alertService.mostrarModalCarga();
    const existe = await this.catalogosRepo.tiposEmpaqueRepo.getByKey(item._pk);
    const e = existe as any;
    if (e) {
      if (this.online) {
        delete e.modo;
        delete e.bd;
        delete e._pk;
        e.activo = !e.activo;
        const res = await this.enviarRegistrosApi(e, e._pk);
        if (res) {
          this.alertService.cerrarModalCarga();
          return;
        }
      } else {
        await this.catalogosRepo.tiposEmpaqueRepo.update(e._pk, { activo: !e.activo, bd: 0 });
        await this.getDataTiposEmpaqueDexie();
      }
      this.alertService.cerrarModalCarga();
      return;
    } else {
      this.alertService.showAlert('Error', 'No se encontro el registro.', 'error');
    }
  }

  onEliminar(item: any): void {
    console.log('Eliminar no implementado aun', { item });
  }
}
