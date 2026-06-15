import { Component, ChangeDetectionStrategy, inject, signal, computed, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { CatalogoService } from '../../shared/services/catalogo.service';
import { PermissionService } from '../../shared/services/permission.service';
import { ConnectivityService } from '../../shared/services/connectivity.service';
import { AlertService } from '../../shared/services/alert.service';
import { AuthService } from '../../shared/services/auth.service';
import { Configuracion } from '../../shared/interfaces/administracion.interface';
import { Consignatario } from '../../shared/interfaces/catalogo.interface';
import { CatalogosRepository } from '../../shared/dexiedb/repository/catalogos.repository';
import { CatalogoConsignatariosTablaComponent, EstadoFiltro } from './components/tabla/catalogo-consignatarios-tabla.component';
import { CatalogoConsignatariosModalComponent } from './components/modal/catalogo-consignatarios-modal.component';

const CONSIGNATARIOS_CONFIG = {
  tabla: 'Consignatarios',
  label: 'Consignatarios',
  icon: 'bi-person-vcard',
  columnas: [
    { campo: 'id', label: 'ID', tipo: 'int', visible: false, editable: false },
    { campo: 'documento', label: 'Documento', tipo: 'nvarchar', maxLength: 50, required: true, unique: true },
    { campo: 'documentoFiscal', label: 'Documento Fiscal', tipo: 'nvarchar', maxLength: 50, required: true, unique: true },
    { campo: 'nombre', label: 'Razón Social', tipo: 'nvarchar', maxLength: 200, required: true },
    { campo: 'bd', label: 'Sincronizado', tipo: 'bit', visible: true, editable: false, default: 0 },
    { campo: 'activo', label: 'Estado', tipo: 'bit', required: true },
    { campo: 'fechaCreacion', label: 'Fecha Creación', tipo: 'datetime', auto: true, visible: true, editable: false }
  ],
  displayField: 'nombre',
  codigoField: 'documento',
  tieneActivo: true,
  editable: true,
  noCrear: true,
  dixieRepo: 'consignatariosRepo' as const
};

@Component({
  selector: 'app-catalogo-consignatarios',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, CatalogoConsignatariosTablaComponent, CatalogoConsignatariosModalComponent],
  templateUrl: './catalogo-consignatarios.component.html',
  styleUrl: './catalogo-consignatarios.component.scss'
})
export class CatalogoConsignatariosComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly catalogoService = inject(CatalogoService);
  readonly permissions = inject(PermissionService);
  private readonly connectivity = inject(ConnectivityService);
  private readonly alertService = inject(AlertService);
  private readonly catalogosRepo = inject(CatalogosRepository);

  readonly config: any = CONSIGNATARIOS_CONFIG;
  readonly savedConfig = signal<Configuracion | null>(null);
  readonly usuario = this.auth.usuario;

  isLoading = signal(false);
  readonly searchTerm = signal('');
  readonly estadoFiltro = signal<EstadoFiltro>('todos');

  readonly modalAbierto = signal(false);
  readonly modalModo = signal<'nuevo' | 'editar'>('nuevo');
  readonly modalValue = signal<any>(null);

  private readonly data = signal<Consignatario[]>([]);

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
    await this.cargarConsignatarios();
  }

  private getNroDocumentoFromUsuario(): string {
    const u: any = this.usuario();
    const v = u?.nrodocumento ?? u?.documentoidentidad ?? u?.documentoIdentidad ?? u?.documento ?? '';
    return String(v ?? '').trim();
  }

  private async cargarConsignatarios(): Promise<void> {
    await this.getDataDexie();
    if (this.online) {
      await this.reemplazarDesdeApi();
      await this.getDataDexie();
    }
  }

  private extractItemsFromApiResponse(resp: any): any[] {
    if (!resp) return [];
    let raw = resp;
    if (Array.isArray(resp) && resp.length > 0) {
      raw = resp[0];
    }
    if (raw && typeof raw === 'object') {
      const d = raw.data ?? raw;
      if (typeof d === 'string') {
        try { return JSON.parse(d); } catch { return []; }
      }
      if (Array.isArray(d)) return d;
      if (d && typeof d === 'object' && Array.isArray(d.consignatarios)) return d.consignatarios;
      return [];
    }
    if (Array.isArray(raw)) return raw;
    return [];
  }

  private async reemplazarDesdeApi(): Promise<void> {
    this.isLoading.set(true);
    try {
      const resp: any = await firstValueFrom(
        this.catalogoService.listarForTablaCatalogos(this.config.tabla, this.savedConfig()?.codigoCultivo, this.savedConfig()?.idProyecto)
      );
      const itemsApi = this.extractItemsFromApiResponse(resp);

      await this.catalogosRepo.consignatariosRepo.clear();

      for (const item of itemsApi) {
        await this.catalogosRepo.consignatariosRepo.save({ ...item, bd: 1 });
      }
    } catch (err) {
      console.error('Error cargando consignatarios desde API', err);
    } finally {
      this.isLoading.set(false);
    }
  }

  private async getDataDexie(): Promise<void> {
    try {
      const info = await this.catalogosRepo.consignatariosRepo.getAll();
      this.data.set(info);
    } catch (error) {
      console.error('Error cargando consignatarios dexie', error);
      this.alertService.showAlert('Error', 'Error cargando consignatarios', 'error');
    }
  }

  private async getDataApi(): Promise<void> {
    this.isLoading.set(true);
    try {
      const resp: any = await firstValueFrom(this.catalogoService.listarForTablaCatalogos(this.config.tabla, this.savedConfig()?.codigoCultivo, this.savedConfig()?.idProyecto));
      const itemsApi = this.extractItemsFromApiResponse(resp);
      await this.catalogosRepo.consignatariosRepo.clear();
      for (const item of itemsApi) {
        (item as any).bd = 1;
        await this.catalogosRepo.consignatariosRepo.save(item);
      }
      await this.getDataDexie();
    } catch (err) {
      console.error('Error cargando consignatarios', err);
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
      const dataSend = await this.catalogosRepo.consignatariosRepo.getAllNoSincronizado();

      if (dataSend.length === 0) {
        await this.catalogosRepo.consignatariosRepo.clear();
        this.getDataApi();
        this.alertService.showAlert('Exito', 'No hay registros pendientes de sincronizacion', 'success');
        return;
      }

      const payloads = structuredClone(dataSend);
      payloads.forEach((item: any) => {
        delete item.bd;
        delete item._pk;
      });

      const { error, data, mensaje } = await firstValueFrom(
        this.catalogoService.sincronizarConsignatarios(payloads)
      );
      if (error) {
        this.alertService.showAlert('Error', mensaje, 'error');
      } else {
        for (const element of dataSend) {
          await this.catalogosRepo.consignatariosRepo.delete((element as any)._pk);
        }
        this.getDataApi();
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

  async enviarRegistrosApi(payloads: Consignatario[], pk: any = ''): Promise<boolean> {
    try {
      const payloadArray = Array.isArray(payloads) ? payloads : [payloads];

      const { error, data, mensaje } = await firstValueFrom(
        this.catalogoService.sincronizarConsignatarios(payloadArray)
      );
      if (error) {
        this.alertService.showAlert('Error', `Error al guardar el consignatario, ${mensaje}.`, 'error');
        return false;
      }
      if (pk !== '') {
        const existe = await this.catalogosRepo.consignatariosRepo.getByKey(pk);
        if (existe) await this.catalogosRepo.consignatariosRepo.delete(pk);
      }
      this.getDataApi();
      return true;
    } catch (error) {
      console.log(error);
      this.alertService.showAlert('Error', `Error al guardar el consignatario, ${error}.`, 'error');
      return false;
    }
  }

  async saveDixie(payload: any, modo: any): Promise<void> {
    await this.catalogosRepo.consignatariosRepo.save(payload);
    await this.getDataDexie();
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
        const duplicado = await this.catalogosRepo.consignatariosRepo.getByField(keyField, keyValue);
        if (duplicado) {
          this.alertService.showAlert('Duplicado', `Ya existe un consignatario con ${keyField}: <b>${keyValue}</b>.`, 'error');
          return;
        }
        if (this.online) {
          if (!data) {
            this.alertService.showAlert('Error', 'Error al guardar el consignatario.', 'error');
            return;
          }
          delete data.modo;
          delete (data as any)._pk;
          delete (data as any).bd;
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
          const duplicado = await this.catalogosRepo.consignatariosRepo.getByField(keyField, keyValue);
          if (duplicado && (duplicado as any)?._pk !== (data as any)?._pk) {
            this.alertService.showAlert('Duplicado', `Ya existe un consignatario con ${keyField}: <b>${keyValue}</b>.`, 'error');
            return;
          }
        }
        if (this.online) {
          if (!data) {
            this.alertService.showAlert('Error', 'Error al guardar el consignatario.', 'error');
            return;
          }
          delete data.modo;
          delete (data as any).bd;
          delete (data as any)._pk;
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
    const existe = await this.catalogosRepo.consignatariosRepo.getByKey(item._pk);
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
        // await this.catalogosRepo.consignatariosRepo.update(e._pk, { activo: !e.activo, bd: 0 });
        // await this.getDataDexie();
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
