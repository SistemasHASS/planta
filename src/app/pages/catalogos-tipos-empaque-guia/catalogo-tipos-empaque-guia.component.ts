import { Component, ChangeDetectionStrategy, inject, signal, computed, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { CatalogoService } from '../../shared/services/catalogo.service';
import { PermissionService } from '../../shared/services/permission.service';
import { ConnectivityService } from '../../shared/services/connectivity.service';
import { AlertService } from '../../shared/services/alert.service';
import { AuthService } from '../../shared/services/auth.service';
import { Configuracion } from '../../shared/interfaces/administracion.interface';
import { TipoEmpaqueGuia } from '../../shared/interfaces/catalogo.interface';
import { CatalogosRepository } from '../../shared/dexiedb/repository/catalogos.repository';
import { CatalogoTiposEmpaqueGuiaTablaComponent, EstadoFiltro } from './components/tabla/catalogo-tipos-empaque-guia-tabla.component';
import { CatalogoTiposEmpaqueGuiaModalComponent } from './components/modal/catalogo-tipos-empaque-guia-modal.component';

const TIPOS_EMPAQUE_GUIA_CONFIG = {
  tabla: 'PLANTA_TiposEmpaqueGuia',
  label: 'Tipos Empaque Guía',
  icon: 'bi-file-earmark-text',
  columnas: [
    { campo: 'id', label: 'ID', tipo: 'int', visible: false, editable: false },
    { campo: 'codigo', label: 'Código', tipo: 'nvarchar', maxLength: 20, required: true, unique: true },
    { campo: 'nombre', label: 'Nombre', tipo: 'nvarchar', maxLength: 100, required: true },
    { campo: 'bd', label: 'Sincronizado', tipo: 'bit', visible: true, editable: false, default: 0 },
    { campo: 'activo', label: 'Estado', tipo: 'bit', required: true },
    { campo: 'fechaCreacion', label: 'Fecha Creación', tipo: 'datetime', auto: true, visible: true, editable: false }
  ],
  displayField: 'Nombre',
  codigoField: 'codigo',
  tieneActivo: true,
  editable: true,
  dixieRepo: 'tiposEmpaqueGuiaRepo' as const
};

@Component({
  selector: 'app-catalogo-tipos-empaque-guia',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, CatalogoTiposEmpaqueGuiaTablaComponent, CatalogoTiposEmpaqueGuiaModalComponent],
  templateUrl: './catalogo-tipos-empaque-guia.component.html',
  styleUrl: './catalogo-tipos-empaque-guia.component.scss'
})
export class CatalogoTiposEmpaqueGuiaComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly catalogoService = inject(CatalogoService);
  readonly permissions = inject(PermissionService);
  private readonly connectivity = inject(ConnectivityService);
  private readonly alertService = inject(AlertService);
  private readonly catalogosRepo = inject(CatalogosRepository);

  readonly config: any = TIPOS_EMPAQUE_GUIA_CONFIG;
  readonly savedConfig = signal<Configuracion | null>(null);
  readonly usuario = this.auth.usuario;

  isLoading = signal(false);
  readonly searchTerm = signal('');
  readonly estadoFiltro = signal<EstadoFiltro>('todos');

  readonly modalAbierto = signal(false);
  readonly modalModo = signal<'nuevo' | 'editar'>('nuevo');
  readonly modalValue = signal<any>(null);

  readonly calibres = signal<any[]>([]);
  readonly categorias = signal<any[]>([]);
  readonly tiposEmpaque = signal<any[]>([]);

  private readonly data = signal<TipoEmpaqueGuia[]>([]);

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
    await this.cargarTiposEmpaqueDexie();
    await this.cargarTiposEmpaqueGuia();
  }

  private getNroDocumentoFromUsuario(): string {
    const u: any = this.usuario();
    const v = u?.nrodocumento ?? u?.documentoidentidad ?? u?.documentoIdentidad ?? u?.documento ?? '';
    return String(v ?? '').trim();
  }

  private async cargarCalibresDexie(): Promise<void> {
    try {
      const codCultivo = this.savedConfig()?.codigoCultivo;
      if (!codCultivo) { this.calibres.set([]); return; }
      const all = await this.catalogosRepo.calibresRepo.getAll();
      const filtrados = (all ?? [])
        .filter((c: any) => String(c?.idCultivo ?? '') === String(codCultivo))
        .sort((a: any, b: any) => {
          const idA = Number(a?.id ?? 0); const idB = Number(b?.id ?? 0);
          if (idA !== idB) return idA - idB;
          return String(a?.calibre ?? '').localeCompare(String(b?.calibre ?? ''));
        });
      this.calibres.set(filtrados);
    } catch (e) { console.error('Error cargando calibres', e); this.calibres.set([]); }
  }

  private async cargarCategoriasDexie(): Promise<void> {
    try {
      const codCultivo = this.savedConfig()?.codigoCultivo;
      if (!codCultivo) { this.categorias.set([]); return; }
      const all = await this.catalogosRepo.categoriasRepo.getAll();
      let filtrados = (all ?? [])
        .filter((c: any) => String(c?.codigoCultivo ?? '') === String(codCultivo))
        .sort((a: any, b: any) => {
          const idA = Number(a?.id ?? 0); const idB = Number(b?.id ?? 0);
          if (idA !== idB) return idA - idB;
          return String(a?.nombre ?? '').localeCompare(String(b?.nombre ?? ''));
        });
      const calibresList = this.calibres();
      if (calibresList.length) {
        filtrados = filtrados.map((cat: any) => {
          if (!cat.calibreNombre && cat.calibreId) {
            const cal = calibresList.find((c: any) => String(c?.id ?? '') === String(cat.calibreId));
            if (cal) return { ...cat, calibreNombre: cal.calibre };
          }
          return cat;
        });
      }
      this.categorias.set(filtrados);
    } catch (e) { console.error('Error cargando categorias', e); this.categorias.set([]); }
  }

  private async cargarTiposEmpaqueDexie(): Promise<void> {
    try {
      const codCultivo = this.savedConfig()?.codigoCultivo;
      if (!codCultivo) { this.tiposEmpaque.set([]); return; }
      const all = await this.catalogosRepo.tiposEmpaqueRepo.getAll();
      let items = (all ?? [])
        .filter((c: any) => String(c?.codigoCultivo ?? '') === String(codCultivo) || !c?.codigoCultivo)
        .sort((a: any, b: any) => {
          const idA = Number(a?.id ?? 0); const idB = Number(b?.id ?? 0);
          if (idA !== idB) return idA - idB;
          return String(a?.descripcion ?? '').localeCompare(String(b?.descripcion ?? ''));
        });
      const cats = this.categorias();
      if (cats.length) {
        items = items.map((item: any) => {
          if (item?.codigoCategoria) {
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
      this.tiposEmpaque.set(items);
    } catch (e) { console.error('Error cargando tipos de empaque', e); this.tiposEmpaque.set([]); }
  }

  private enriquecerTiposEmpaqueGuiaConTipoEmpaque(items: TipoEmpaqueGuia[]): TipoEmpaqueGuia[] {
    const tipos = this.tiposEmpaque();
    if (!tipos.length) return items;
    return items.map(item => {
      if (item?.codigoTipoEmpaque) {
        const te = tipos.find((c: any) => String(c?.codigo ?? '') === String(item.codigoTipoEmpaque));
        if (te) {
          const updates: any = {};
          if (!item.nombreTipoEmpaque) updates.nombreTipoEmpaque = te.descripcion ?? te.nombre ?? '';
          if (!item.nombreCategoria) updates.nombreCategoria = te.nombreCategoria ?? '';
          if (!item.nombreCalibre) updates.nombreCalibre = te.nombreCalibre ?? '';
          if (Object.keys(updates).length) return { ...item, ...updates };
        }
      }
      return item;
    });
  }

  private async cargarTiposEmpaqueGuia(): Promise<void> {
    await this.getDataTiposEmpaqueGuiaDexie();
    if (this.online) {
      await this.reemplazarTiposEmpaqueGuiaDesdeApi();
      await this.getDataTiposEmpaqueGuiaDexie();
    }
  }

  private async reemplazarTiposEmpaqueGuiaDesdeApi(): Promise<void> {
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
        itemsApi = data['tiposEmpaqueGuia'] ?? [];
      }

      if (itemsApi.length === 0) return;

      const todos = await this.catalogosRepo.tiposEmpaqueGuiaRepo.getAll();
      for (const item of todos) {
        const it = item as any;
        if (it?.bd === 1 || it?.bd === undefined || it?.bd === null) {
          await this.catalogosRepo.tiposEmpaqueGuiaRepo.delete(it._pk);
        }
      }

      for (const item of itemsApi) {
        await this.catalogosRepo.tiposEmpaqueGuiaRepo.save({ ...item, bd: 1 });
      }
    } catch (err) {
      console.error('Error cargando tipos empaque guia desde API', err);
    } finally {
      this.isLoading.set(false);
    }
  }

  private async getDataTiposEmpaqueGuiaDexie(): Promise<void> {
    try {
      const info = await this.catalogosRepo.tiposEmpaqueGuiaRepo.getAll();
      this.data.set(this.enriquecerTiposEmpaqueGuiaConTipoEmpaque(info));
    } catch (error) {
      console.error('Error cargando tipos empaque guia dexie', error);
      this.alertService.showAlert('Error', 'Error cargando tipos empaque guia', 'error');
    }
  }

  private async getTiposEmpaqueGuiaTipoApi(): Promise<void> {
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
          ? await this.catalogosRepo.tiposEmpaqueGuiaRepo.getByField('id', apiId)
          : (uniqueValue !== undefined && uniqueValue !== null && `${uniqueValue}`.trim() !== '')
            ? await this.catalogosRepo.tiposEmpaqueGuiaRepo.getByField('codigo', uniqueValue)
            : undefined;
        if (existing) {
          if ((existing as any)?.bd === 0) continue;
          (item as any)._pk = (existing as any)._pk;
        }
        (item as any).bd = 1;
        await this.catalogosRepo.tiposEmpaqueGuiaRepo.save(item);
      }
      await this.getDataTiposEmpaqueGuiaDexie();
    } catch (err) {
      console.error('Error cargando tipos empaque guia', err);
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
      const dataSend = await this.catalogosRepo.tiposEmpaqueGuiaRepo.getAllNoSincronizado();

      if (dataSend.length === 0) {
        await this.catalogosRepo.tiposEmpaqueGuiaRepo.clear();
        this.getTiposEmpaqueGuiaTipoApi();
        this.alertService.showAlert('Exito', 'No hay registros pendientes de sincronizacion', 'success');
        return;
      }

      const payloads = structuredClone(dataSend);
      payloads.forEach((item: any) => {
        delete item.bd;
        delete item._pk;
        delete item.nombreTipoEmpaque;
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
          await this.catalogosRepo.tiposEmpaqueGuiaRepo.delete((element as any)._pk);
        }
        this.getTiposEmpaqueGuiaTipoApi();
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

  async enviarRegistrosApi(payloads: TipoEmpaqueGuia[], pk: any = ''): Promise<boolean> {
    try {
      const payloadArray = Array.isArray(payloads) ? payloads : [payloads];
      payloads = payloadArray.map(item => ({
        ...item,
        codigoCultivo: this.savedConfig()?.codigoCultivo ?? item.codigoCultivo ?? ''
      })) as TipoEmpaqueGuia[];

      const { error, data, mensaje } = await firstValueFrom(
        this.catalogoService.sincronizarCatalogos(this.config.tabla, payloads)
      );
      if (error) {
        this.alertService.showAlert('Error', `Error al guardar el tipo empaque guia, ${mensaje}.`, 'error');
        return false;
      }
      if (pk !== '') {
        const existe = await this.catalogosRepo.tiposEmpaqueGuiaRepo.getByKey(pk);
        if (existe) await this.catalogosRepo.tiposEmpaqueGuiaRepo.delete(pk);
      }
      this.getTiposEmpaqueGuiaTipoApi();
      return true;
    } catch (error) {
      console.log(error);
      this.alertService.showAlert('Error', `Error al guardar el tipo empaque guia, ${error}.`, 'error');
      return false;
    }
  }

  async saveDixie(payload: any, modo: any): Promise<void> {
    await this.catalogosRepo.tiposEmpaqueGuiaRepo.save(payload);
    await this.getDataTiposEmpaqueGuiaDexie();
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
        const duplicado = await this.catalogosRepo.tiposEmpaqueGuiaRepo.getByField(keyField, keyValue);
        if (duplicado) {
          this.alertService.showAlert('Duplicado', `Ya existe un tipo empaque guia con ${keyField}: <b>${keyValue}</b>.`, 'error');
          return;
        }
        if (this.online) {
          if (!data) {
            this.alertService.showAlert('Error', 'Error al guardar el tipo empaque guia.', 'error');
            return;
          }
          delete data.modo;
          delete (data as any)._pk;
          delete (data as any).bd;
          delete (data as any).nombreTipoEmpaque;
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
          const duplicado = await this.catalogosRepo.tiposEmpaqueGuiaRepo.getByField(keyField, keyValue);
          if (duplicado && (duplicado as any)?._pk !== (data as any)?._pk) {
            this.alertService.showAlert('Duplicado', `Ya existe un tipo empaque guia con ${keyField}: <b>${keyValue}</b>.`, 'error');
            return;
          }
        }
        if (this.online) {
          if (!data) {
            this.alertService.showAlert('Error', 'Error al guardar el tipo empaque guia.', 'error');
            return;
          }
          delete data.modo;
          delete (data as any).bd;
          delete (data as any)._pk;
          delete (data as any).nombreTipoEmpaque;
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
    const existe = await this.catalogosRepo.tiposEmpaqueGuiaRepo.getByKey(item._pk);
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
        await this.catalogosRepo.tiposEmpaqueGuiaRepo.update(e._pk, { activo: !e.activo, bd: 0 });
        await this.getDataTiposEmpaqueGuiaDexie();
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
