import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AlertService } from '../../shared/services/alert.service';
import { UsuariosTablaComponent } from './components/tabla/usuarios-tabla.component';
import { UsuariosModalComponent } from './components/modal/usuarios-modal.component';
import { Usuario } from '../../shared/interfaces/administracion.interface';
import { AdministracionService } from '../../shared/services/administracion.service';
import { firstValueFrom } from 'rxjs';
import { AdministracionRepository } from '../../shared/dexiedb/repository/administracion.repository';
import { ConnectivityService } from '../../shared/services/connectivity.service';
import { CatalogosOperativosRepository } from '../../shared/dexiedb/repository/catalogos-operacionales.repository';

@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [CommonModule, FormsModule, UsuariosTablaComponent, UsuariosModalComponent],
  templateUrl: './usuarios.component.html',
  styleUrl: './usuarios.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsuariosComponent implements OnInit {
  private readonly alertService = inject(AlertService);
  private readonly administracionService = inject(AdministracionService);
  private readonly connectivity = inject(ConnectivityService);

  readonly isLoading = signal(false);
  readonly searchTerm = signal('');
  readonly mostrarTodos = signal(false);

  readonly modalAbierto = signal(false);
  readonly modalModo = signal<'nuevo' | 'editado'>('nuevo');
  readonly modalValue = signal<Usuario | null>(null);

  readonly items = signal<Usuario[]>([]);
  get online(): boolean {
    return this.connectivity.isOnline();
  }
  readonly filteredItems = computed(() => {
    const term = (this.searchTerm() ?? '').trim().toLowerCase();
    const verTodos = !!this.mostrarTodos();

    let base = this.items();
    if (!verTodos) base = base.filter(i => !!true);

    if (!term) return [...base].sort((a, b) => Number(b?.id ?? 0) - Number(a?.id ?? 0));

    return base
      .filter(i => {
        const parts = [
          i.id,
          i.usuario,
          i.nombre,
          i.idRol,
          i.codigoAcopio,
          i.acopioNombre,
          i.serieGuia,
          // i.activo ? 'activo' : 'inactivo',
          // i.fechaCreacion,
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
    private catalogosOperativosRepository: CatalogosOperativosRepository,
  ) { }


  async ngOnInit(): Promise<void> {
    await this.listarUsuarios();
  }

  async listarUsuarios() {
    try {
      this.isLoading.set(true);
      let repo = await this.listarUsuariosRespository();
      if (!repo) {
        await this.apiListarUsuarios();
      }
      this.isLoading.set(false);
    } catch (error) {
      console.log(error)
      this.alertService.showAlert('Error', 'Error al listar los usuarios', 'error');
    } finally {
      this.isLoading.set(false);
    }
  }

  async onEliminar(item: Usuario): Promise<void> {
    try {
      const bd0 = Number((item as any)?.bd ?? 0) === 0;
      const fc = (item as any)?.fechaCreacion;
      const noFecha = fc === null || fc === undefined || (typeof fc === 'string' && fc.trim() === '');

      if (!bd0 || !noFecha) {
        this.alertService.showAlertAcept(
          'No disponible',
          'Solo se puede eliminar cuando el registro no está sincronizado y aún no tiene fecha de creación.',
          'warning',
        );
        return;
      }

      const confirmar = await this.alertService.showConfirm(
        'Confirmar eliminación',
        '¿Desea eliminar este usuario? Esta acción solo aplica para registros no sincronizados.',
        'warning',
      );
      if (!confirmar) return;

      this.alertService.mostrarModalCarga();
      const pk = (item as any)?._pk;
      if (pk === null || pk === undefined) {
        this.alertService.cerrarModalCarga();
        this.alertService.showAlert('Error', 'No se encontró el registro.', 'error');
        return;
      }

      await this.administracionRepository.usuariosRepository.delete(pk);
      await this.listarUsuariosRespository();
      this.alertService.cerrarModalCarga();
      this.alertService.showAlert('Éxito', 'Usuario eliminado', 'success');
    } catch (error) {
      console.error(error);
      this.alertService.cerrarModalCarga();
      this.alertService.showAlertAcept('Error', 'No se pudo eliminar el usuario.', 'error');
    }
  }

  async listarUsuariosRespository() {
    let info = await this.administracionRepository.usuariosRepository.getAll();
    if (info.length > 0) {
      this.items.set(info);
      return true
    } else {
      this.items.set([]);
      return false
    }
  }

  async apiListarUsuarios() {
    if (!this.online) {
      this.alertService.showAlert('Error', 'No tienes conexión a internet', 'error');
      return
    }
    const resp: any = await firstValueFrom(this.administracionService.listarUsuarios({}));
    if (resp?.error) {
      this.alertService.showAlert('Error', resp.mensaje, 'error');
      return
    }
    const data = resp?.data ?? resp;
    const apiItems = Array.isArray(data) ? data : (data?.usuarios ?? data?.items ?? []);
    const normalizados = await this.normalizarUsuariosDixie(apiItems);
    if (normalizados.length > 0) {
      for (const item of normalizados) {
        await this.administracionRepository.usuariosRepository.save(item as any);
      }
      let repo = await this.listarUsuariosRespository();
      if (!repo) {
        this.alertService.showAlert('Error', 'Error al listar los usuarios', 'error');
      }
    }
  }

  async normalizarUsuariosDixie(data: any[], bd: number = 1, withPassword: number = 0): Promise<any[]> {
    const normalizar: Usuario[] = [];

    for (const item of (Array.isArray(data) ? data : [])) {
      const acopio = item?.codigoAcopio ? await this.catalogosOperativosRepository.acopiosRepo.getByField('codigoAcopio', item.codigoAcopio) : undefined;
      normalizar.push({
        id: item.id,
        idempresa: item.idempresa,
        ruc: item.ruc,
        razonSocial: item.razonSocial,
        usuario: item.usuario,
        nombre: item.nombre,
        documentoIdentidad: item.documentoIdentidad,
        idRol: item.idRol,
        aplicacion: item.aplicacion ?? 'PLANTA',
        codigoAcopio: item?.codigoAcopio ?? 0,
        acopioNombre: acopio?.acopioNombre || '',
        serieGuia: item.serieGuia || null,
        modo: item?.modo ?? 'editado',
        bd: bd
      });
    }
    return normalizar;
  }

  onSearchChange(v: string): void {
    this.searchTerm.set(v);
  }

  toggleMostrarTodos(): void {
    this.mostrarTodos.set(!this.mostrarTodos());
  }

  abrirNuevo(): void {
    this.modalModo.set('nuevo');
    this.modalValue.set(null);
    this.modalAbierto.set(true);
  }

  abrirEditar(item: Usuario): void {
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

  private async resolvePkForEdit(payload: any, pk: any): Promise<any> {
    if (pk !== null && pk !== undefined) return pk;
    const id = payload?.id;
    if (id === null || id === undefined) return undefined;
    const existing: any = await this.administracionRepository.usuariosRepository.getByField('id', id);
    return existing?._pk;
  }

  private async findDuplicateUsuario(payload: Partial<Usuario>): Promise<Usuario | undefined> {

    const usuario = (payload.usuario ?? '').trim().toLowerCase();

    if (!usuario) return undefined;

    const all = await this.administracionRepository.usuariosRepository.getAll();

    return all.find((r: any) => {
      const sameUsuario =
        (r.usuario ?? '').trim().toLowerCase() === usuario;

      const differentId =
        Number(r.id ?? 0) !== Number(payload.id ?? 0);

      return sameUsuario && differentId;
    });
  }

  async guardarModal(ev: any): Promise<void> {
    try {
      this.alertService.mostrarModalCarga();
      const modo = ev?.modo ?? this.modalModo();
      const payload = (ev?.payload ?? ev ?? {}) as Partial<Usuario>;
      const pk = ev?._pk;
      if (
        this.isEmpty(payload?.usuario) ||
        this.isEmpty(payload?.idRol)
      ) {
        this.alertService.showAlert('Advertencia', 'Complete los campos obligatorios (*)', 'warning');
        return;
      }
      const excludePk = modo === 'editado' ? await this.resolvePkForEdit(payload, pk) : undefined;
      const dup = await this.findDuplicateUsuario(payload);
      if (dup) {
        this.alertService.showAlertAcept('Advertencia', 'Ya existe el usuario.', 'warning');
        return;
      }

      const now = new Date().toISOString();
      const record: any = {
        ...(payload as any),
        id: modo === 'nuevo' ? this.nextId() : Number(payload?.id),
        bd: 0,
        // activo: payload?.activo === false ? false : true,
        fechaCreacion: modo === 'nuevo' ? null : (payload as any)?.fechaCreacion ?? null,
        fechaModificacion: now,
        modo: modo === 'nuevo' ? 'nuevo' : payload.modo
      };

      if (modo === 'editado') {
        const resolvedPk = await this.resolvePkForEdit(payload, pk);
        if (resolvedPk !== null && resolvedPk !== undefined) {
          record._pk = resolvedPk;
        }
      }

      let normalizado = await this.normalizarUsuariosDixie([record], 0, 1);
      if (modo === 'editado') {
        normalizado[0]._pk = record._pk;
      }

      if (this.online) {
        const payloads = structuredClone(normalizado);
        payloads.map((item: any) => {
          delete item.bd;
          delete item._pk;
          delete item.fechaCreacion
        });
        let { error, data, mensaje } = await firstValueFrom(this.administracionService.sincronizarUsuarios(payloads))
        if (error) {
          this.alertService.showAlert('Error', mensaje, 'error');
        } else {
          await this.administracionRepository.usuariosRepository.clear();
          await this.apiListarUsuarios();
          this.alertService.cerrarModalCarga()
          this.modalAbierto.set(false);
          this.alertService.showAlert('Éxito', modo === 'editado' ? 'Combinación actualizada' : 'Combinación creada', 'success');
          return
        }
        // TODO: sincronizar con API
      } else {
        await this.administracionRepository.usuariosRepository.saveFordecForUsuario(normalizado[0]);
        await this.listarUsuariosRespository();
        this.alertService.cerrarModalCarga()
        this.modalAbierto.set(false);
        this.alertService.showAlert('Éxito', modo === 'editado' ? 'Combinación actualizada' : 'Combinación creada', 'success');
        return
      }
    } catch (error) {
      console.error(error);
      this.alertService.cerrarModalCarga();
      this.alertService.showAlert('Error', 'Error al sincronizar.', 'error');
    }
  }

  async onToggleActivo(item: Usuario): Promise<void> {
    try {
      this.alertService.mostrarModalCarga();
      const pk = (item as any)?._pk;
      if (pk === null || pk === undefined) {
        this.alertService.cerrarModalCarga();
        this.alertService.showAlert('Error', 'No se encontró el registro.', 'error');
        return;
      }

      const existe: any = await this.administracionRepository.usuariosRepository.getByKey(pk);
      if (!existe) {
        this.alertService.cerrarModalCarga();
        this.alertService.showAlert('Error', 'No se encontró el registro.', 'error');
        return;
      }

      if (this.online) {
        const payloads = structuredClone([item]);
        payloads.map((item: any) => {
          delete item.bd
          delete item._pk
          delete item.fechaCreacion
          item.activo = !item.activo
        })
        let { error, data, mensaje } = await firstValueFrom(this.administracionService.sincronizarUsuarios(payloads))
        if (error) {
          this.alertService.showAlert('Error', mensaje, 'error');
        } else {
          await this.administracionRepository.usuariosRepository.clear();
          await this.apiListarUsuarios();
          this.alertService.showAlert('Éxito', mensaje, 'success');
          return
        }
      } else {
        await this.administracionRepository.usuariosRepository.update(pk, {
          activo: !existe.activo,
          bd: 0,
          fechaModificacion: new Date().toISOString(),
        } as any);
        await this.listarUsuariosRespository();
        this.alertService.cerrarModalCarga();
      }

    } catch (error) {
      console.error(error);
      this.alertService.cerrarModalCarga();
      this.alertService.showAlertAcept('Error', 'No se pudo actualizar el estado.', 'error');
    }
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
        dataSend = await this.administracionRepository.usuariosRepository.getAllNoSincronizado();
        if (dataSend.length === 0) {
          await this.administracionRepository.usuariosRepository.clear();
          await this.apiListarUsuarios();
          this.alertService.cerrarModalCarga();
          return
        } else {
          const payloads = structuredClone(dataSend);
          payloads.map((item: any) => {
            delete item.bd
            delete item._pk
            delete item.fechaModificacion
          })
          let { error, data, mensaje } = await firstValueFrom(this.administracionService.sincronizarUsuarios(payloads))
          if (error) {
            this.alertService.cerrarModalCarga();
            this.alertService.showAlert('Error', mensaje, 'error');
          } else {
            await this.administracionRepository.usuariosRepository.clear();
            await this.apiListarUsuarios();
            this.alertService.cerrarModalCarga();
            return
          }
        }

      }

    } catch (error) {
      console.error('Error en sincronización:', error);
      this.alertService.cerrarModalCarga();
      // this.alertService.showAlert('Error en sincronización', String(error), 'error');
    }
  }

  private nextId(): number {
    const arr = this.items();
    if (!arr.length) return 1;
    return Math.max(...arr.map(x => Number(x?.id ?? 0))) + 1;
  }
}
