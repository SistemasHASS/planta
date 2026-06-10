import { Component, ChangeDetectionStrategy, inject, signal, computed, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom, finalize } from 'rxjs';
import { CatalogoService } from '../../shared/services/catalogo.service';
import { PermissionService } from '../../shared/services/permission.service';
import { ConnectivityService } from '../../shared/services/connectivity.service';
import { AlertService } from '../../shared/services/alert.service';
import { AuthService } from '../../shared/services/auth.service';
import { Configuracion } from '../../shared/interfaces/administracion.interface';
import { Categoria } from '../../shared/interfaces/catalogo.interface';
import { CatalogosRepository } from '../../shared/dexiedb/repository/catalogos.repository';
import { CatalogoCategoriasTablaComponent, EstadoFiltro } from './components/tabla/catalogo-categorias-tabla.component';
import { CatalogoCategoriasModalComponent } from './components/modal/catalogo-categorias-modal.component';

const CATEGORIAS_CONFIG = {
  tabla: 'PLANTA_Categorias',
  label: 'Categorías',
  icon: 'bi-bookmark',
  columnas: [
    { campo: 'id', label: 'ID', tipo: 'int', visible: false, editable: false },
    { campo: 'codigo', label: 'Código', tipo: 'nvarchar', maxLength: 50, required: true, unique: true },
    { campo: 'nombre', label: 'Nombre', tipo: 'nvarchar', maxLength: 100, required: true },
    { campo: 'descripcion', label: 'Descripción', tipo: 'nvarchar', maxLength: 200, required: false },
    { campo: 'bd', label: 'Sincronizado', tipo: 'bit', visible: true, editable: false, default: 0 },
    { campo: 'activo', label: 'Estado', tipo: 'bit', required: true },
    { campo: 'fechaCreacion', label: 'Fecha Creación', tipo: 'datetime', auto: true, visible: true, editable: false }
  ],
  displayField: 'Nombre',
  codigoField: 'codigo',
  tieneActivo: true,
  editable: true,
  dixieRepo: 'categoriasRepo' as const
};

@Component({
  selector: 'app-catalogo-categorias',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, CatalogoCategoriasTablaComponent, CatalogoCategoriasModalComponent],
  templateUrl: './catalogo-catagorias.component.html',
  styleUrl: './catalogo-catagorias.component.scss'
})
export class CatalogoCategoriasComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly catalogoService = inject(CatalogoService);
  readonly permissions = inject(PermissionService);
  private readonly connectivity = inject(ConnectivityService);
  private readonly alertService = inject(AlertService);
  private readonly catalogosRepo = inject(CatalogosRepository);

  readonly config: any = CATEGORIAS_CONFIG;
  readonly savedConfig = signal<Configuracion | null>(null);
  readonly usuario = this.auth.usuario;

  isLoading = signal(false);
  readonly searchTerm = signal('');
  readonly estadoFiltro = signal<EstadoFiltro>('todos');

  readonly modalAbierto = signal(false);
  readonly modalModo = signal<'nuevo' | 'editar'>('nuevo');
  readonly modalValue = signal<any>(null);

  readonly calibres = signal<any[]>([]);

  private readonly data = signal<Categoria[]>([]);

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
    await this.cargarCalibres();
    await this.cargarCategorias();
  }

  private async cargarCalibres(): Promise<void> {
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

  private enriquecerCategoriasConCalibre(items: Categoria[]): Categoria[] {
    const calibresList = this.calibres();
    if (!calibresList.length) return items;
    return items.map(item => {
      if (!item.calibreNombre && item.calibreId) {
        const cal = calibresList.find((c: any) => String(c?.id ?? '') === String(item.calibreId));
        if (cal) {
          return { ...item, calibreNombre: cal.calibre };
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

  private async cargarCategorias(): Promise<void> {
    // 1. Mostrar inmediatamente lo que hay en Dexie (para no dejar pantalla en blanco)
    await this.getDataCategoriasDexie();

    // 2. Si online, refrescar desde API en background
    if (this.online) {
      await this.reemplazarCategoriasDesdeApi();
      await this.getDataCategoriasDexie();
    }
  }

  private async reemplazarCategoriasDesdeApi(): Promise<void> {
    this.isLoading.set(true);
    try {
      const resp: any = await firstValueFrom(
        this.catalogoService.listarForTablaCatalogos(this.config.tabla, this.savedConfig()?.codigoCultivo, this.savedConfig()?.idProyecto)
      );
      const data = resp?.data ?? resp;

      // Detectar formato: array directo u objeto con key 'categorias'
      let itemsApi: any[] = [];
      if (Array.isArray(data)) {
        itemsApi = data;
      } else if (data && typeof data === 'object') {
        itemsApi = data['categorias'] ?? [];
      }

      if (itemsApi.length === 0) return;

      // Solo borrar los sincronizados DESPUES de obtener datos del API
      const todos = await this.catalogosRepo.categoriasRepo.getAll();
      for (const item of todos) {
        const it = item as any;
        if (it?.bd === 1 || it?.bd === undefined || it?.bd === null) {
          await this.catalogosRepo.categoriasRepo.delete(it._pk);
        }
      }

      for (const item of itemsApi) {
        await this.catalogosRepo.categoriasRepo.save({ ...item, bd: 1 });
      }

      await this.cargarCalibres();
    } catch (err) {
      console.error('Error cargando categorias desde API', err);
    } finally {
      this.isLoading.set(false);
    }
  }

  private async getDataCategoriasDexie(): Promise<void> {
    try {
      const info = await this.catalogosRepo.categoriasRepo.getAll();
      this.data.set(this.enriquecerCategoriasConCalibre(info));
    } catch (error) {
      console.error('Error cargando categorias dexie', error);
      this.alertService.showAlert('Error', 'Error cargando categorias', 'error');
    }
  }

  private async getCategoriasTipoApi(): Promise<void> {
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
          ? await this.catalogosRepo.categoriasRepo.getByField('id', apiId)
          : (uniqueValue !== undefined && uniqueValue !== null && `${uniqueValue}`.trim() !== '')
            ? await this.catalogosRepo.categoriasRepo.getByField('codigo', uniqueValue)
            : undefined;
        if (existing) {
          if ((existing as any)?.bd === 0) continue;
          (item as any)._pk = (existing as any)._pk;
        }
        (item as any).bd = 1;
        await this.catalogosRepo.categoriasRepo.save(item);
      }
      await this.cargarCalibres();
      await this.getDataCategoriasDexie();
    } catch (err) {
      console.error('Error cargando categorias', err);
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
      const dataSend = await this.catalogosRepo.categoriasRepo.getAllNoSincronizado();

      if (dataSend.length === 0) {
        await this.catalogosRepo.categoriasRepo.clear();
        this.getCategoriasTipoApi();
        this.alertService.showAlert('Exito', 'No hay registros pendientes de sincronizacion', 'success');
        return;
      }

      const payloads = structuredClone(dataSend);
      payloads.forEach((item: any) => {
        delete item.bd;
        delete item._pk;
        delete item.calibreNombre;
        item.codigoCultivo = this.savedConfig()?.codigoCultivo;
      });

      const { error, data, mensaje } = await firstValueFrom(
        this.catalogoService.sincronizarCatalogos(this.config.tabla, payloads)
      );
      if (error) {
        this.alertService.showAlert('Error', mensaje, 'error');
      } else {
        for (const element of dataSend) {
          await this.catalogosRepo.categoriasRepo.delete((element as any)._pk);
        }
        this.getCategoriasTipoApi();
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

  async enviarRegistrosApi(payloads: Categoria[], pk: any = ''): Promise<boolean> {
    try {
      const payloadArray = Array.isArray(payloads) ? payloads : [payloads];
      payloads = payloadArray.map(item => ({
        ...item,
        codigoCultivo: this.savedConfig()?.codigoCultivo ?? item.codigoCultivo ?? ''
      })) as Categoria[];

      const { error, data, mensaje } = await firstValueFrom(
        this.catalogoService.sincronizarCatalogos(this.config.tabla, payloads)
      );
      if (error) {
        this.alertService.showAlert('Error', `Error al guardar la categoria, ${mensaje}.`, 'error');
        return false;
      }
      if (pk !== '') {
        const existe = await this.catalogosRepo.categoriasRepo.getByKey(pk);
        if (existe) await this.catalogosRepo.categoriasRepo.delete(pk);
      }
      this.getCategoriasTipoApi();
      return true;
    } catch (error) {
      console.log(error);
      this.alertService.showAlert('Error', `Error al guardar la categoria, ${error}.`, 'error');
      return false;
    }
  }

  async saveDixie(payload: any, modo: any): Promise<void> {
    await this.catalogosRepo.categoriasRepo.save(payload);
    await this.getDataCategoriasDexie();
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
        const duplicado = await this.catalogosRepo.categoriasRepo.getByField(keyField, keyValue);
        if (duplicado) {
          this.alertService.showAlert('Duplicado', `Ya existe una categoria con ${keyField}: <b>${keyValue}</b>.`, 'error');
          return;
        }
        if (this.online) {
          if (!data) {
            this.alertService.showAlert('Error', 'Error al guardar la categoria.', 'error');
            return;
          }
          delete data.modo;
          delete (data as any)._pk;
          delete (data as any).bd;
          delete (data as any).calibreNombre;
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
          const duplicado = await this.catalogosRepo.categoriasRepo.getByField(keyField, keyValue);
          if (duplicado && (duplicado as any)?._pk !== (data as any)?._pk) {
            this.alertService.showAlert('Duplicado', `Ya existe una categoria con ${keyField}: <b>${keyValue}</b>.`, 'error');
            return;
          }
        }
        if (this.online) {
          if (!data) {
            this.alertService.showAlert('Error', 'Error al guardar la categoria.', 'error');
            return;
          }
          delete data.modo;
          delete (data as any).bd;
          delete (data as any)._pk;
          delete (data as any).calibreNombre;
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
    const existe = await this.catalogosRepo.categoriasRepo.getByKey(item._pk);
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
        await this.catalogosRepo.categoriasRepo.update(e._pk, { activo: !e.activo, bd: 0 });
        await this.getDataCategoriasDexie();
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