import { Component, ChangeDetectionStrategy, inject, signal, computed, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { CatalogoService } from '../../shared/services/catalogo.service';
import { PermissionService } from '../../shared/services/permission.service';
import { ConnectivityService } from '../../shared/services/connectivity.service';
import { AlertService } from '../../shared/services/alert.service';
import { AuthService } from '../../shared/services/auth.service';
import { Configuracion } from '../../shared/interfaces/administracion.interface';
import { Variedad, Campania } from '../../shared/interfaces/catalogo.interface';
import { CatalogosRepository } from '../../shared/dexiedb/repository/catalogos.repository';
import { CatalogoVariedadesMaestroTablaComponent } from './components/tabla/catalogo-variedades-maestro-tabla.component';
import { CatalogoVariedadesMaestroModalComponent } from './components/modal/catalogo-variedades-maestro-modal.component';
import { CatalogoConfig } from '../catalogos/catalogos.type';

const VARIEDADES_CONFIG: CatalogoConfig = {
  tabla: 'PLANTA_VariedadAuxiliar',
  label: 'Variedades - Maestro',
  icon: 'bi-flower1',
  columnas: [
    { campo: 'id', label: 'ID', tipo: 'varchar', visible: false, editable: false },
    { campo: 'codigo', label: 'codigo', tipo: 'varchar', maxLength: 100, required: true, editable: false, unique: true },
    { campo: 'cultivo', label: 'Cultivo', tipo: 'varchar', maxLength: 50, required: true, editable: false },
    { campo: 'idcultivo', label: 'IdCultivo', tipo: 'varchar', maxLength: 50, required: true, editable: false, visible: false },
    { campo: 'idvariedad', label: 'IdVariedad', tipo: 'varchar', maxLength: 100, required: true, editable: false },
    { campo: 'variedad', label: 'Variedad', tipo: 'varchar', maxLength: 100, required: true, editable: false },
    { campo: 'procedencia', label: 'Procedencia', tipo: 'varchar', maxLength: 100, required: false },
    { campo: 'esEnsayo', label: 'Es Ensayo', tipo: 'bit', default: 0 },
    { campo: 'eliminado', label: 'Eliminado', tipo: 'bit', visible: false, editable: false, default: false },
    { campo: 'bd', label: 'Sincronizado', tipo: 'bit', visible: true, editable: false, default: 0 },
  ],
  displayField: 'Nombre',
  codigoField: 'codigo',
  tieneActivo: false,
  noCrear: false,
  editable: true,
  fkTablas: ['ComposicionPalets'],
  dixieRepo: 'variedadesRepo' as const
};

@Component({
  selector: 'app-catalogo-variedades-maestro',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, CatalogoVariedadesMaestroTablaComponent, CatalogoVariedadesMaestroModalComponent],
  templateUrl: './catalogo-variedades-maestro.component.html',
  styleUrl: './catalogo-variedades-maestro.component.scss'
})
export class CatalogoVariedadesMaestroComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly catalogoService = inject(CatalogoService);
  readonly permissions = inject(PermissionService);
  private readonly connectivity = inject(ConnectivityService);
  private readonly alertService = inject(AlertService);
  private readonly catalogosRepo = inject(CatalogosRepository);

  readonly config = VARIEDADES_CONFIG;
  readonly savedConfig = signal<Configuracion | null>(null);
  readonly selectedCampania = signal<Campania | null>(null);
  readonly usuario = this.auth.usuario;

  isLoading = signal(false);
  readonly searchTerm = signal('');

  readonly modalAbierto = signal(false);
  readonly modalModo = signal<'nuevo' | 'editar'>('nuevo');
  readonly modalValue = signal<Variedad | null>(null);

  private readonly data = signal<Variedad[]>([]);

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
    await this.cargarCampania();
    await this.cargarVariedades();
  }

  private getNroDocumentoFromUsuario(): string {
    const u: any = this.usuario();
    const v = u?.nrodocumento ?? u?.documentoidentidad ?? u?.documentoIdentidad ?? u?.documento ?? '';
    return String(v ?? '').trim();
  }

  private async cargarCampania(): Promise<void> {
    try {
      const idProyecto = String(this.savedConfig()?.idProyecto ?? '').trim();
      if (!idProyecto) {
        this.selectedCampania.set(null);
        return;
      }
      const camp = await this.catalogosRepo.campaniaRepo.getByField('idproyecto', idProyecto);
      this.selectedCampania.set(camp ?? null);
    } catch (error) {
      console.error('Error cargando campaña', error);
      this.selectedCampania.set(null);
    }
  }

  private async cargarVariedades(): Promise<void> {
    await this.getDataVariedadesDexie();
    if (this.online) {
      await this.reemplazarVariedadesDesdeApi();
      await this.getDataVariedadesDexie();
    }
  }

  private async enriquecerVariedadesConCultivo(variedades: Variedad[]): Promise<Variedad[]> {
    try {
      const cultivos = await this.catalogosRepo.cultivoRepo.getAll() as any[];
      const cultivoMap = new Map<string, string>();
      for (const c of cultivos) {
        const keys = [c?.codigo, c?.cultivo, c?.id].filter(Boolean).map(String);
        for (const k of keys) {
          if (!cultivoMap.has(k)) cultivoMap.set(k, c.descripcion);
        }
      }
      return variedades.map(v => {
        const esEnsayoVal = v.esEnsayo;
        const esEnsayo = esEnsayoVal === true || (typeof esEnsayoVal === 'number' && esEnsayoVal === 1) || String(esEnsayoVal).toLowerCase() === 'true';
        const cultivoActual = String(v.cultivo ?? '').trim();
        const idcultivo = String(v.idcultivo ?? '').trim();
        if (esEnsayo && (!cultivoActual || cultivoActual === '-') && idcultivo && cultivoMap.has(idcultivo)) {
          return { ...v, cultivo: (cultivoMap.get(idcultivo) ?? '').toUpperCase() };
        }
        return v;
      });
    } catch (e) {
      console.error('Error enriqueciendo variedades con cultivo', e);
      return variedades;
    }
  }

  private async reemplazarVariedadesDesdeApi(): Promise<void> {
    this.isLoading.set(true);
    try {
      const resp: any = await firstValueFrom(
        this.catalogoService.listarForTablaCatalogos(this.config.tabla, this.selectedCampania()?.codcultivo, this.savedConfig()?.idProyecto)
      );
      const data: Variedad[] = resp?.data ?? resp;
      if (!Array.isArray(data) || data.length === 0) return;

      const todos = await this.catalogosRepo.variedadesRepo.getAll() as Variedad[];
      for (const item of todos) {
        const it = item as Variedad & { _pk?: number; bd?: number };
        if (it?.bd === 1 || it?.bd === undefined || it?.bd === null) {
          await this.catalogosRepo.variedadesRepo.delete((it as any)._pk);
        }
      }

      let variedadesCultivos = data.filter((p) => String(p.idcultivo) === String(this.selectedCampania()?.codcultivo));
      variedadesCultivos = await this.enriquecerVariedadesConCultivo(variedadesCultivos);
      for (const v of variedadesCultivos) {
        await this.catalogosRepo.variedadesRepo.save({ ...v, bd: 1 });
      }
    } catch (err) {
      console.error('Error cargando variedades desde API', err);
    } finally {
      this.isLoading.set(false);
    }
  }

  private async getDataVariedadesDexie(): Promise<void> {
    try {
      const info = await this.catalogosRepo.variedadesRepo.getAll();
      const activos = (info as Variedad[]).filter(v => v.eliminado !== true);
      this.data.set(activos.map(v => ({ ...v, cultivo: String(v.cultivo ?? '').toUpperCase() })));
    } catch (error) {
      console.error('Error cargando variedades dexie', error);
      this.alertService.showAlert('Error', 'Error cargando variedades', 'error');
    }
  }

  private async getVariedadesTipoApi(): Promise<void> {
    this.isLoading.set(true);
    try {
      const resp: any = await firstValueFrom(
        this.catalogoService.listarForTablaCatalogos(this.config.tabla, this.selectedCampania()?.codcultivo, this.savedConfig()?.idProyecto)
      );
      const codigoCultivo = this.selectedCampania()?.codcultivo;
      let data: Variedad[] = (resp?.data ?? resp).filter((p: any) =>
        !codigoCultivo || String(p.idcultivo) === String(codigoCultivo) || String(p.codigoCultivo) === String(codigoCultivo)
      );
      data = await this.enriquecerVariedadesConCultivo(data);
      for (const item of data) {
        const apiId = item?.id;
        const uniqueValue = item?.codigo;
        const existing = apiId
          ? await this.catalogosRepo.variedadesRepo.getByField('id', apiId)
          : (uniqueValue !== undefined && uniqueValue !== null && `${uniqueValue}`.trim() !== '')
            ? await this.catalogosRepo.variedadesRepo.getByField('codigo', uniqueValue)
            : undefined;
        if (existing) {
          if ((existing as any)?.bd === 0) continue;
          (item as any)._pk = (existing as any)._pk;
        }
        (item as any).bd = 1;
        await this.catalogosRepo.variedadesRepo.save(item);
      }
      await this.getDataVariedadesDexie();
    } catch (err) {
      console.error('Error cargando variedades', err);
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
      const dataSend = await this.catalogosRepo.variedadesRepo.getAllNoSincronizado();

      if (dataSend.length === 0) {
        await this.catalogosRepo.variedadesRepo.clear();
        this.getVariedadesTipoApi();
        this.alertService.showAlert('Exito', 'No hay registros pendientes de sincronizacion', 'success');
        return;
      }

      const payloads = this.mapearPayloadVariedades(
        dataSend.filter((item: Variedad | null) => item != null) as Variedad[]
      );

      const { error, data, mensaje } = await firstValueFrom(
        this.catalogoService.sincronizarVariedadEsEnsayo(payloads)
      );
      if (error) {
        this.alertService.showAlert('Error', mensaje, 'error');
      } else {
        for (const element of dataSend) {
          await this.catalogosRepo.variedadesRepo.delete((element as any)._pk);
        }
        this.getVariedadesTipoApi();
        this.alertService.showAlert('Exito', mensaje, 'success');
      }
    } catch (error: any) {
      console.error('Error en sincronizacion:', error);
      this.alertService.showAlert('Error en sincronizacion', error, 'error');
    }
  }

  abrirNuevo(): void {
    this.modalModo.set('nuevo');
    this.modalValue.set(null);
    this.modalAbierto.set(true);
  }

  abrirEditar(item: Variedad): void {
    this.modalModo.set('editar');
    this.modalValue.set(item);
    this.modalAbierto.set(true);
  }

  cerrarModal(): void {
    this.modalAbierto.set(false);
  }

  private mapearPayloadVariedades(items: Variedad[]): any[] {
    return items.map(item => {
      const idValor = String(item.codigo ?? '').trim() || String(item.idvariedad ?? '').trim() || null;
      return {
        id: idValor,
        cultivo: this.selectedCampania()?.fruta || item.cultivo || '',
        idcultivo: this.selectedCampania()?.codcultivo || item.idcultivo || '',
        variedad: item.variedad,
        procedencia: item.procedencia ?? null,
        esEnsayo: item.esEnsayo ?? false,
        eliminado: item.eliminado ?? false
      };
    });
  }

  async enviarRegistrosApi(payloads: Variedad[], pk: any = ''): Promise<boolean> {
    try {
      const payloadArray = Array.isArray(payloads) ? payloads : [payloads];
      const apiPayload = this.mapearPayloadVariedades(payloadArray);

      const { error, data, mensaje } = await firstValueFrom(
        this.catalogoService.sincronizarVariedadEsEnsayo(apiPayload)
      );
      if (error) {
        this.alertService.showAlert('Error', `Error al guardar la variedad, ${mensaje}.`, 'error');
        return false;
      }
      if (pk !== '') {
        const existe = await this.catalogosRepo.variedadesRepo.getByKey(pk);
        if (existe) await this.catalogosRepo.variedadesRepo.delete(pk);
      }
      this.getVariedadesTipoApi();
      return true;
    } catch (error) {
      console.log(error);
      this.alertService.showAlert('Error', `Error al guardar la variedad, ${error}.`, 'error');
      return false;
    }
  }

  async saveDixie(payload: Variedad & { _pk?: number; bd?: number; modo?: string }, modo: string): Promise<void> {
    await this.catalogosRepo.variedadesRepo.save(payload);
    await this.getDataVariedadesDexie();
  }

  async guardarModal(payload: { payload: any; modo: string; _pk?: number }): Promise<void> {
    console.log('payload',payload)
    const modo = payload?.modo ?? payload?.payload?.modo;
    const data = payload?.payload ?? payload;
    const _pk = data._pk;
    if (payload?._pk !== undefined && payload?._pk !== null && data?._pk === undefined) {
      data._pk = payload._pk;
    }
    try {
      this.alertService.mostrarModalCarga();
      if (modo === 'nuevo') {
        data.cultivo = this.selectedCampania()?.fruta || data.cultivo || '';
        data.idcultivo = this.selectedCampania()?.codcultivo || data.idcultivo || '';

        if (this.online) {
          if (!data) {
            this.alertService.showAlert('Error', 'Error al guardar la variedad.', 'error');
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
          const duplicado = await this.catalogosRepo.variedadesRepo.getByField(keyField, keyValue);
          if (duplicado && (duplicado as any)?._pk !== (data as any)?._pk) {
            this.alertService.showAlert('Duplicado', `Ya existe una variedad con ${keyField}: <b>${keyValue}</b>.`, 'error');
            return;
          }
        }
        if (this.online) {
          if (!data) {
            this.alertService.showAlert('Error', 'Error al guardar la variedad.', 'error');
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
    const existe = await this.catalogosRepo.variedadesRepo.getByKey(item._pk);
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
        await this.catalogosRepo.variedadesRepo.update(e._pk, { bd: 0 } as any);
        await this.getDataVariedadesDexie();
      }
      this.alertService.cerrarModalCarga();
      return;
    } else {
      this.alertService.showAlert('Error', 'No se encontro el registro.', 'error');
    }
  }

  async onEliminar(item: Variedad): Promise<void> {
    try {
      const confirmar = await this.alertService.showConfirm(
        'Confirmar eliminación',
        `¿Está seguro de eliminar la variedad <b>${item.variedad}</b>?`,
        'warning'
      );
      if (!confirmar) return;

      this.alertService.mostrarModalCarga();
      const existe = await this.catalogosRepo.variedadesRepo.getByKey((item as any)._pk);
      if (!existe) {
        this.alertService.showAlert('Error', 'No se encontro el registro.', 'error');
        return;
      }
      const e = existe as any;
      const pk = e._pk;
      if (this.online) {
        delete e.modo;
        delete e._pk;
        e.eliminado = true;
        const res = await this.enviarRegistrosApi(e, pk);
        if (res) {
          await this.catalogosRepo.variedadesRepo.delete(pk);
          await this.getDataVariedadesDexie();
          this.alertService.cerrarModalCarga();
          this.alertService.showAlert('Exito', 'Registro eliminado correctamente.', 'success');
        }
      } else {
        e.eliminado = true;
        e.bd = 0;
        await this.catalogosRepo.variedadesRepo.save(e);
        await this.getDataVariedadesDexie();
        this.alertService.cerrarModalCarga();
        this.alertService.showAlert('Exito', 'Registro marcado para eliminar.', 'success');
      }
    } catch (error) {
      console.error('Error eliminando variedad:', error);
      this.alertService.cerrarModalCarga();
      this.alertService.showAlert('Error', 'No se pudo eliminar el registro.', 'error');
    }
  }
}
