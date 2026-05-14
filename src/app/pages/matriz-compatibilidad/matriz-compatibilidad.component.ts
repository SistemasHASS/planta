import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatrizCompatibilidadTablaComponent } from './components/tabla/matriz-compatibilidad-tabla.component';
import { MatrizCompatibilidadModalComponent } from './components/modal/matriz-compatibilidad-modal.component';
import { MatrizCompatibilidad } from '../../shared/interfaces/administracion.interface';
import { AdministracionService } from '../../shared/services/administracion.service';
import { firstValueFrom } from 'rxjs';
import { ConnectivityService } from '../../shared/services/connectivity.service';
import { AlertService } from '../../shared/services/alert.service';
import { AdministracionRepository } from '../../shared/dixiedb/repository/administracion.repository';
import { CatalogosRepository } from '../../shared/dixiedb/repository/catalogos.repository';

export type EstadoFiltro = 'activos' | 'inactivos' | 'todos';


@Component({
  selector: 'app-matriz-compatibilidad',
  standalone: true,
  imports: [CommonModule, FormsModule, MatrizCompatibilidadTablaComponent, MatrizCompatibilidadModalComponent],
  templateUrl: './matriz-compatibilidad.component.html',
  styleUrl: './matriz-compatibilidad.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MatrizCompatibilidadComponent implements OnInit {
  private readonly administracionService = inject(AdministracionService);
  private readonly connectivity = inject(ConnectivityService);
  private readonly alertService = inject(AlertService);

  readonly isLoading = signal(false);
  readonly searchTerm = signal('');
  readonly estadoFiltro = signal<EstadoFiltro>('activos');

  readonly modalAbierto = signal(false);
  readonly modalModo = signal<'nuevo' | 'editado'>('nuevo');
  readonly modalValue = signal<MatrizCompatibilidad | null>(null);

  readonly totalRegistros = computed(() => this.filteredItems().length);
  get online(): boolean {
    return this.connectivity.isOnline();
  }
  readonly items = signal<MatrizCompatibilidad[]>([
    {
      id: 15,
      destinoId: 1,
      clienteId: 1,
      consignatarioId: 1,
      formatoId: 1,
      tipoEmpaqueId: 1,
      calibreId: 1,
      tipoCajaId: 1,
      tipoClamshellId: 1,
      fechaCreacion: new Date().toISOString(),
      presentacionId: 1,
      activo: true,
      tipoEmpaqueGuiaId: 1,
      categoriaId: 1,
      modo: 'editado',
    },
  ]);

  readonly filteredItems = computed(() => {
    const term = (this.searchTerm() ?? '').trim().toLowerCase();
    const f = this.estadoFiltro();

    let base = this.items();

    if (f === 'activos') base = base.filter(i => !!i?.activo);
    if (f === 'inactivos') base = base.filter(i => !i?.activo);

    if (!term) return [...base].sort((a, b) => Number(b?.id ?? 0) - Number(a?.id ?? 0));

    return base
      .filter(i => {
        const parts = [
          i.id,
          i.clienteCodigo,
          i.clienteNombre,
          i.consignatarioCodigo,
          i.consignatarioNombre,
          i.destinoCodigo,
          i.destinoNombre,
          i.formatoCodigo,
          i.formatoNombre,
          i.tipoEmpaqueNombre,
          i.tipoEmpaqueGuiaNombre,
          i.calibreNombre,
          i.tipoCajaNombre,
          i.tipoClamshellNombre,
          i.presentacionNombre,
          i.categoriaNombre,
          i.fechaCreacion,
        ]
          .map(v => String(v ?? ''))
          .join(' ')
          .toLowerCase();

        return parts.includes(term);
      })
      .sort((a, b) => Number(b?.id ?? 0) - Number(a?.id ?? 0));
  });

  constructor(
    private administracionRepository: AdministracionRepository,
    private catalogosRepository: CatalogosRepository,
  ) { }

  async ngOnInit(): Promise<void> {
    await this.listarMatricesCompatibilidad();
  }

  async listarMatricesCompatibilidad() {
    try {
      this.isLoading.set(true);
      let repo = await this.listarMatricesCompatibilidadRespository();
      if (!repo) {
        await this.apiListarMatricesCompatibilidad();
      }
      this.isLoading.set(false);
    } catch (error) {
      console.log(error)
      this.alertService.showAlert('Error', 'Error al listar las matrices de compatibilidad', 'error');
    } finally {
      this.isLoading.set(false);
    }
  }

  async listarMatricesCompatibilidadRespository() {
    let info = await this.administracionRepository.matricesCompatibilidadRepository.getAll();
    if (info.length > 0) {
      this.items.set(info);
      return true
    } else {
      this.items.set([]);
      return false
    }
  }

  async apiListarMatricesCompatibilidad() {
    if (!this.online) {
      this.alertService.showAlert('Error', 'No tienes conexión a internet', 'error');
      return
    }
    const resp: any = await firstValueFrom(this.administracionService.listarMatricesCompatibilidad({}));
    if (resp?.error) {
      this.alertService.showAlert('Error', 'Error al listar las matrices de compatibilidad', 'error');
      return
    }
    const data = resp?.data ?? resp;
    const apiItems = Array.isArray(data) ? data : (data?.matricesCompatibilidad ?? data?.items ?? []);

    const normalizados = await this.normalizarMatricesCompatibilidadDixie(apiItems);
    if (normalizados.length > 0) {
      for (const item of normalizados) {
        await this.administracionRepository.matricesCompatibilidadRepository.save(item as any);
      }
      let repo = await this.listarMatricesCompatibilidadRespository();
      if (!repo) {
        this.alertService.showAlert('Error', 'Error al listar las matrices de compatibilidad', 'error');
      }
    }
  }

  async normalizarMatricesCompatibilidadDixie(data: any[], bd: number = 1): Promise<any[]> {
    const normalizar: MatrizCompatibilidad[] = [];

    for (const item of (Array.isArray(data) ? data : [])) {
      const cliente = item?.clienteId ? await this.catalogosRepository.clientesRepo.getByField('id', item.clienteId) : undefined;
      const consignatario = item?.consignatarioId ? await this.catalogosRepository.consignatariosRepo.getByField('id', item.consignatarioId) : undefined;
      const destino = item?.destinoId ? await this.catalogosRepository.destinosRepo.getByField('id', item.destinoId) : undefined;
      const formato = item?.formatoId ? await this.catalogosRepository.formatosRepo.getByField('id', item.formatoId) : undefined;
      const tipoEmpaque = item?.tipoEmpaqueId ? await this.catalogosRepository.tiposEmpaqueRepo.getByField('id', item.tipoEmpaqueId) : undefined;
      const tipoEmpaqueGuia = item?.tipoEmpaqueGuiaId ? await this.catalogosRepository.tiposEmpaqueGuiaRepo.getByField('id', item.tipoEmpaqueGuiaId) : undefined;
      const calibre = item?.calibreId ? await this.catalogosRepository.calibresRepo.getByField('id', item.calibreId) : undefined;
      const tipoCaja = item?.tipoCajaId ? await this.catalogosRepository.tiposCajaRepo.getByField('id', item.tipoCajaId) : undefined;
      const tipoClamshell = item?.tipoClamshellId ? await this.catalogosRepository.tiposClamshellRepo.getByField('id', item.tipoClamshellId) : undefined;
      const presentacion = item?.presentacionId ? await this.catalogosRepository.presentacionesRepo.getByField('id', item.presentacionId) : undefined;
      const categoria = item?.categoriaId ? await this.catalogosRepository.categoriasRepo.getByField('id', item.categoriaId) : undefined;

      const row: MatrizCompatibilidad = {
        id: Number(item?.id ?? 0),
        clienteId: Number(item?.clienteId ?? 0),
        clienteNombre: (cliente as any)?.razonSocial ?? (cliente as any)?.nombre ?? (cliente as any)?.descripcion,
        clienteCodigo: (cliente as any)?.codigo,

        consignatarioId: Number(item?.consignatarioId ?? 0),
        consignatarioNombre: (consignatario as any)?.razonSocial ?? (consignatario as any)?.nombre ?? (consignatario as any)?.descripcion,
        consignatarioCodigo: (consignatario as any)?.codigo,

        destinoId: Number(item?.destinoId ?? 0),
        destinoNombre: (destino as any)?.nombre ?? (destino as any)?.descripcion,
        destinoCodigo: (destino as any)?.codigo,

        formatoId: Number(item?.formatoId ?? 0),
        formatoNombre: (formato as any)?.descripcion ?? (formato as any)?.nombre,
        formatoCodigo: (formato as any)?.codigo,

        tipoEmpaqueId: Number(item?.tipoEmpaqueId ?? 0),
        tipoEmpaqueNombre: (tipoEmpaque as any)?.descripcion ?? (tipoEmpaque as any)?.nombre,

        tipoEmpaqueGuiaId: Number(item?.tipoEmpaqueGuiaId ?? 0),
        tipoEmpaqueGuiaNombre: (tipoEmpaqueGuia as any)?.nombre ?? (tipoEmpaqueGuia as any)?.descripcion,

        calibreId: Number(item?.calibreId ?? 0),
        calibreNombre: (calibre as any)?.nombre ?? (calibre as any)?.descripcion,

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
        bd: bd,
      };

      normalizar.push(row);
    }

    return normalizar;
  }



  onSearchChange(value: string): void {
    this.searchTerm.set(value);
  }

  setEstadoFiltro(f: EstadoFiltro): void {
    this.estadoFiltro.set(f);
  }

  abrirNuevo(): void {
    this.modalModo.set('nuevo');
    this.modalValue.set(null);
    this.modalAbierto.set(true);
  }

  abrirEditar(item: MatrizCompatibilidad): void {
    this.modalModo.set('editado');
    this.modalValue.set(item);
    this.modalAbierto.set(true);
  }

  cerrarModal(): void {
    this.modalAbierto.set(false);
  }

  private isEmpty(v: any): boolean {
    return v === null || v === undefined || v === '';
  }

  private async findDuplicateCombination(payload: Partial<MatrizCompatibilidad>, excludePk?: any): Promise<MatrizCompatibilidad | undefined> {
    const all = await this.administracionRepository.matricesCompatibilidadRepository.getAll();

    const same = (a: any, b: any) => {
      const av = a === undefined ? null : a;
      const bv = b === undefined ? null : b;
      return Number(av ?? 0) === Number(bv ?? 0);
    };

    return all.find((r: any) => {
      if (excludePk !== null && excludePk !== undefined && (r as any)?._pk === excludePk) return false;
      return (
        same(r?.clienteId, payload?.clienteId) &&
        same(r?.consignatarioId, payload?.consignatarioId) &&
        same(r?.destinoId, payload?.destinoId) &&
        same(r?.formatoId, payload?.formatoId) &&
        same(r?.tipoEmpaqueId, payload?.tipoEmpaqueId) &&
        same(r?.tipoEmpaqueGuiaId, payload?.tipoEmpaqueGuiaId) &&
        same(r?.calibreId, payload?.calibreId) &&
        same(r?.tipoCajaId, payload?.tipoCajaId) &&
        same(r?.tipoClamshellId, payload?.tipoClamshellId) &&
        same(r?.presentacionId, payload?.presentacionId) &&
        same(r?.categoriaId, payload?.categoriaId)
      );
    });
  }

  private async resolvePkForEdit(payload: any, pk: any): Promise<any> {
    if (pk !== null && pk !== undefined) return pk;
    const id = payload?.id;
    if (id === null || id === undefined) return undefined;
    const existing: any = await this.administracionRepository.matricesCompatibilidadRepository.getByField('id', id);
    return existing?._pk;
  }

  async guardarModal(ev: any): Promise<void> {
    try {
      this.alertService.mostrarModalCarga();
      const modo = ev?.modo ?? this.modalModo();
      const payload = (ev?.payload ?? ev ?? {}) as Partial<MatrizCompatibilidad>;
      const pk = ev?._pk;
      if (
        this.isEmpty(payload?.clienteId) ||
        this.isEmpty(payload?.consignatarioId) ||
        this.isEmpty(payload?.destinoId) ||
        this.isEmpty(payload?.formatoId) ||
        this.isEmpty(payload?.calibreId) ||
        this.isEmpty(payload?.tipoEmpaqueId) ||
        this.isEmpty(payload?.tipoEmpaqueGuiaId) ||
        this.isEmpty(payload?.tipoCajaId) ||
        this.isEmpty(payload?.tipoClamshellId)
      ) {
        this.alertService.showAlert('Advertencia', 'Complete los campos obligatorios (*)', 'warning');
        return;
      }

      const excludePk = modo === 'editado' ? await this.resolvePkForEdit(payload, pk) : undefined;
      const dup = await this.findDuplicateCombination(payload, excludePk);
      if (dup) {
        this.alertService.showAlertAcept('Advertencia', 'Ya existe la combinación seleccionada.', 'warning');
        return;
      }

      const now = new Date().toISOString();

      const record: any = {
        ...(payload as any),
        id: modo === 'nuevo' ? this.nuevoId() : Number(payload?.id),
        bd: 0,
        activo: payload?.activo === false ? false : true,
        fechaCreacion: modo === 'nuevo' ? now : (payload as any)?.fechaCreacion ?? now,
        fechaModificacion: now,
        modo: modo === 'nuevo' ? 'nuevo' : payload.modo
      };

      if (modo === 'editado') {
        const resolvedPk = await this.resolvePkForEdit(payload, pk);
        if (resolvedPk !== null && resolvedPk !== undefined) {
          record._pk = resolvedPk;
        }
      }
      let normalizado = await this.normalizarMatricesCompatibilidadDixie([record], 0);
      if (modo === 'editado'){ 
        normalizado[0]._pk = record._pk; 
      }

      if (!this.online) {
        const payloads = structuredClone(normalizado);
          payloads.map((item: any) => {
            delete item.clienteNombre
            delete item.clienteCodigo
            delete item.consignatarioNombre
            delete item.consignatarioCodigo
            delete item.destinoNombre
            delete item.destinoCodigo
            delete item.formatoNombre
            delete item.formatoCodigo
            delete item.tipoEmpaqueNombre
            delete item.tipoEmpaqueGuiaNombre
            delete item.calibreNombre
            delete item.tipoCajaNombre
            delete item.tipoClamshellNombre
            delete item.presentacionNombre
            delete item.categoriaNombre
            delete item.bd
            delete item._pk
          })
          let { error, data, mensaje } = await firstValueFrom(this.administracionService.sincronizarMatricesCompatibilidad(payloads))
          if (error) {
            this.alertService.showAlert('Error', mensaje, 'error');
          } else {
            await this.administracionRepository.matricesCompatibilidadRepository.clear();
            await this.apiListarMatricesCompatibilidad();
            this.alertService.cerrarModalCarga()
            this.modalAbierto.set(false);
            this.alertService.showAlert('Éxito', modo === 'editado' ? 'Combinación actualizada' : 'Combinación creada', 'success');
            return
          }
      }else{  
        await this.administracionRepository.matricesCompatibilidadRepository.save(normalizado[0]);
        await this.listarMatricesCompatibilidadRespository();
        this.alertService.cerrarModalCarga()
        this.modalAbierto.set(false);
        this.alertService.showAlert('Éxito', modo === 'editado' ? 'Combinación actualizada' : 'Combinación creada', 'success');
        return
      }
    } catch (error) {
      console.error(error);
      this.alertService.cerrarModalCarga();
      this.alertService.showAlert('Error', 'No se pudo guardar la combinación', 'error');
    }
  }

  async onDesactivar(item: MatrizCompatibilidad): Promise<void> {
    try {
      this.alertService.mostrarModalCarga();
      const pk = (item as any)?._pk;
      if (pk === null || pk === undefined) {
        this.alertService.cerrarModalCarga();
        this.alertService.showAlert('Error', 'No se encontró el registro.', 'error');
        return;
      }

      const existe: any = await this.administracionRepository.matricesCompatibilidadRepository.getByKey(pk);
      if (!existe) {
        this.alertService.cerrarModalCarga();
        this.alertService.showAlert('Error', 'No se encontró el registro.', 'error');
        return;
      }

      if (this.online) {
         const payloads = structuredClone([item]);
          payloads.map((item: any) => {
            delete item.clienteNombre
            delete item.clienteCodigo
            delete item.consignatarioNombre
            delete item.consignatarioCodigo
            delete item.destinoNombre
            delete item.destinoCodigo
            delete item.formatoNombre
            delete item.formatoCodigo
            delete item.tipoEmpaqueNombre
            delete item.tipoEmpaqueGuiaNombre
            delete item.calibreNombre
            delete item.tipoCajaNombre
            delete item.tipoClamshellNombre
            delete item.presentacionNombre
            delete item.categoriaNombre
            delete item.bd
            delete item._pk
            item.activo = !item.activo
          })
          let { error, data, mensaje } = await firstValueFrom(this.administracionService.sincronizarMatricesCompatibilidad(payloads))
          if (error) {
            this.alertService.showAlert('Error', mensaje, 'error');
          } else {
            await this.administracionRepository.matricesCompatibilidadRepository.clear();
            await this.apiListarMatricesCompatibilidad();
            this.alertService.showAlert('Éxito', mensaje, 'success');
            return
          }
      } else {
        await this.administracionRepository.matricesCompatibilidadRepository.update(pk, {
          activo: !existe.activo,
          bd: 0,
          fechaModificacion: new Date().toISOString(),
        } as any);
        await this.listarMatricesCompatibilidadRespository();
        this.alertService.cerrarModalCarga();
      }
    } catch (error) {
      console.error(error);
      this.alertService.cerrarModalCarga();
      this.alertService.showAlertAcept('Error', 'No se pudo actualizar el estado.', 'error');
    }
  }

  nuevoId(): number {
    const mayor = this.items().reduce((max, item) =>
      item.id > max.id ? item : max
    );
    return mayor.id + 1;
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
        console.log('Sincronizando catálogos...');
        this.alertService.mostrarModalCarga();
        let dataSend: any
        dataSend = await this.administracionRepository.matricesCompatibilidadRepository.getAllNoSincronizado();
        if (dataSend.length === 0) {
          await this.administracionRepository.matricesCompatibilidadRepository.clear();
          await this.apiListarMatricesCompatibilidad();
          this.alertService.showAlert('Éxito', 'No hay registros pendientes de sincronización', 'success');
          return
        } else {
          const payloads = structuredClone(dataSend);
          payloads.map((item: any) => {
            delete item.clienteNombre
            delete item.clienteCodigo
            delete item.consignatarioNombre
            delete item.consignatarioCodigo
            delete item.destinoNombre
            delete item.destinoCodigo
            delete item.formatoNombre
            delete item.formatoCodigo
            delete item.tipoEmpaqueNombre
            delete item.tipoEmpaqueGuiaNombre
            delete item.calibreNombre
            delete item.tipoCajaNombre
            delete item.tipoClamshellNombre
            delete item.presentacionNombre
            delete item.categoriaNombre
            delete item.bd
            delete item._pk
          })
          let { error, data, mensaje } = await firstValueFrom(this.administracionService.sincronizarMatricesCompatibilidad(payloads))
          if (error) {
            this.alertService.showAlert('Error', mensaje, 'error');
          } else {
            await this.administracionRepository.matricesCompatibilidadRepository.clear();
            await this.apiListarMatricesCompatibilidad();
            this.alertService.showAlert('Éxito', mensaje, 'success');
            return
          }
        }
      }

    } catch (error) {
      console.error('Error en sincronización:', error);
      this.alertService.showAlert('Error en sincronización', String(error), 'error');
    }
  }

}
