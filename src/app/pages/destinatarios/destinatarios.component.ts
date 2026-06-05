import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AlertService } from '../../shared/services/alert.service';
import { DestinatariosTablaComponent } from './components/tabla/destinatarios-tabla.component';
import { DestinatariosModalComponent } from './components/modal/destinatarios-modal.component';
import { Destinatario } from '../../shared/interfaces/catalogo.interface';
import { CatalogoService } from '../../shared/services/catalogo.service';
import { CatalogosRepository } from '../../shared/dexiedb/repository/catalogos.repository';
import { ConnectivityService } from '../../shared/services/connectivity.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-destinatarios',
  standalone: true,
  imports: [CommonModule, FormsModule, DestinatariosTablaComponent, DestinatariosModalComponent],
  templateUrl: './destinatarios.component.html',
  styleUrl: './destinatarios.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DestinatariosComponent implements OnInit {
  private readonly alertService = inject(AlertService);
  private readonly catalogoService = inject(CatalogoService);
  private readonly catalogosRepo = inject(CatalogosRepository);
  private readonly connectivity = inject(ConnectivityService);

  readonly isLoading = signal(false);
  readonly searchTerm = signal('');

  readonly estadoFiltro = signal<'activos' | 'inactivos' | 'todos'>('todos');

  readonly modalAbierto = signal(false);
  readonly modalModo = signal<'nuevo' | 'editado'>('nuevo');
  readonly modalValue = signal<Destinatario | null>(null);

  readonly items = signal<Destinatario[]>([]);

  get online(): boolean {
    return this.connectivity.isOnline();
  }

  readonly filteredItems = computed(() => {
    const term = (this.searchTerm() ?? '').trim().toLowerCase();
    const estado = this.estadoFiltro();
    const base = this.items();

    let result = [...base];

    if (estado !== 'todos') {
      const wantActivo = estado === 'activos';
      result = result.filter(i => this.asBitBoolean(i?.activo) === wantActivo);
    }

    if (term) {
      result = result.filter(i => {
        const parts = [
          i.id,
          i.documentoFiscal,
          i.documento,
          i.nombre,
          i.domicilioFiscal,
          i.puntoLlegada,
        ]
          .map(v => String(v ?? ''))
          .join(' ')
          .toLowerCase();
        return parts.includes(term);
      });
    }

    return result.sort((a, b) => String(a?.nombre ?? '').localeCompare(String(b?.nombre ?? '')));
  });

  async ngOnInit(): Promise<void> {
    await this.listarDestinatarios();
  }

  async listarDestinatarios() {
    try {
      this.isLoading.set(true);
      if (this.online) {
        await this.apiListarDestinatarios();
      } else {
        await this.listarDestinatariosRepository();
      }
      this.isLoading.set(false);
    } catch (error) {
      console.log(error);
      this.alertService.showAlert('Error', 'Error al listar los destinatarios', 'error');
    } finally {
      this.isLoading.set(false);
    }
  }

  setEstadoFiltro(f: 'activos' | 'inactivos' | 'todos'): void {
    this.estadoFiltro.set(f);
  }

  async onToggleActivo(item: Destinatario): Promise<void> {
    try {
      this.alertService.mostrarModalCarga();
      const pk = (item as any)?._pk;
      if (pk === null || pk === undefined) {
        this.alertService.cerrarModalCarga();
        this.alertService.showAlert('Error', 'No se encontró el registro.', 'error');
        return;
      }

      const nuevoValor = !this.asBitBoolean(item.activo);

      // Offline: actualizar solo Dexie
      if (!this.online) {
        await this.catalogosRepo.destinatariosRepo.update(pk, { activo: nuevoValor, bd: 0 });
        await this.listarDestinatariosRepository();
        this.alertService.cerrarModalCarga();
        this.alertService.showAlert('Éxito', nuevoValor ? 'Destinatario activado' : 'Destinatario desactivado', 'success');
        return;
      }

      // Online: enviar al API
      const record = await this.catalogosRepo.destinatariosRepo.getByKey(pk);
      if (!record) {
        this.alertService.cerrarModalCarga();
        this.alertService.showAlert('Error', 'No se encontró el registro en base local.', 'error');
        return;
      }

      const payload = this.buildDestinatarioPayload({ ...record, activo: nuevoValor });
      const resp: any = await firstValueFrom(this.catalogoService.sincronizarDestinatarios([payload]));

      if (resp?.error) {
        this.alertService.cerrarModalCarga();
        this.alertService.showAlert('Error', resp.mensaje ?? 'Error al sincronizar.', 'error');
        return;
      }

      // Éxito: eliminar registro local y recargar desde API
      await this.catalogosRepo.destinatariosRepo.delete(pk);
      await this.apiListarDestinatarios();
      this.alertService.cerrarModalCarga();
      this.alertService.showAlert('Éxito', nuevoValor ? 'Destinatario activado' : 'Destinatario desactivado', 'success');
    } catch (error) {
      console.error(error);
      this.alertService.cerrarModalCarga();
      this.alertService.showAlert('Error', 'No se pudo cambiar el estado.', 'error');
    }
  }

  async listarDestinatariosRepository() {
    let info = await this.catalogosRepo.destinatariosRepo.getAll();
    if (info.length > 0) {
      this.items.set(info);
      return true;
    } else {
      this.items.set([]);
      return false;
    }
  }

  async apiListarDestinatarios() {
    if (!this.online) {
      this.alertService.showAlert('Error', 'No tienes conexión a internet', 'error');
      return;
    }
    const resp: any = await firstValueFrom(this.catalogoService.listarDestinatarios());
    if (resp?.error) {
      this.alertService.showAlert('Error', resp.mensaje, 'error');
      return;
    }
    const data = resp?.data ?? resp;
    const apiItems = Array.isArray(data) ? data : (data?.destinatarios ?? data?.items ?? []);
    const normalizados = await this.normalizarDestinatariosDexie(apiItems);
    // Reemplazar completamente Dexie con los datos de la API
    await this.catalogosRepo.destinatariosRepo.clear();
    if (normalizados.length > 0) {
      for (const item of normalizados) {
        await this.catalogosRepo.destinatariosRepo.save(item as any);
      }
    }
    await this.listarDestinatariosRepository();
  }

  async normalizarDestinatariosDexie(data: any[], bd: number = 1): Promise<any[]> {
    const normalizar: Destinatario[] = [];
    for (const item of (Array.isArray(data) ? data : [])) {
      normalizar.push({
        id: item.id,
        idCliente: item.idCliente,
        documentoFiscal: item.documentoFiscal,
        documento: item.documento,
        nombre: item.nombre,
        domicilioFiscal: item.domicilioFiscal ?? '',
        puntoLlegada: item.puntoLlegada ?? '',
        activo: item.activo ?? true,
        fechaCreacion: item.fechaCreacion ?? new Date().toISOString(),
        bd: bd,
      });
    }
    return normalizar;
  }

  onSearchChange(v: string): void {
    this.searchTerm.set(v);
  }

  abrirNuevo(): void {
    this.modalModo.set('nuevo');
    this.modalValue.set(null);
    this.modalAbierto.set(true);
  }

  abrirEditar(item: Destinatario): void {
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
    const existing: any = await this.catalogosRepo.destinatariosRepo.getByField('id', id);
    return existing?._pk;
  }

  private async findDuplicateDestinatario(payload: Partial<Destinatario>): Promise<Destinatario | undefined> {
    const docFiscal = (payload.documentoFiscal ?? '').trim();
    if (!docFiscal) return undefined;
    const all = await this.catalogosRepo.destinatariosRepo.getAll();
    return all.find((r: any) => {
      const sameDoc = (r.documentoFiscal ?? '').trim() === docFiscal;
      const differentId = Number(r.id ?? 0) !== Number(payload.id ?? 0);
      return sameDoc && differentId;
    });
  }

  async guardarModal(ev: any): Promise<void> {
    try {
      this.alertService.mostrarModalCarga();
      const modo = ev?.modo ?? this.modalModo();
      const payload = (ev?.payload ?? ev ?? {}) as Partial<Destinatario>;
      const pk = ev?._pk;

      if (this.isEmpty(payload?.documentoFiscal) || this.isEmpty(payload?.nombre)) {
        this.alertService.showAlert('Advertencia', 'Complete los campos obligatorios (*)', 'warning');
        return;
      }

      const dup = await this.findDuplicateDestinatario(payload);
      if (dup) {
        this.alertService.showAlertAcept('Advertencia', 'Ya existe un destinatario con ese documento fiscal.', 'warning');
        return;
      }

      const now = new Date().toISOString();
      const isNew = modo === 'nuevo';
      const record: any = {
        ...(payload as any),
        id: isNew ? this.nextId() : Number(payload?.id),
        bd: 0,
        fechaCreacion: isNew ? null : (payload as any)?.fechaCreacion ?? null,
        fechaModificacion: now,
        modo: isNew ? 'nuevo' : 'editado',
      };

      if (!isNew) {
        const resolvedPk = await this.resolvePkForEdit(payload, pk);
        if (resolvedPk !== null && resolvedPk !== undefined) {
          record._pk = resolvedPk;
        }
      }

      let normalizado = await this.normalizarDestinatariosDexie([record], 0);
      if (!isNew) {
        normalizado[0]._pk = record._pk;
      }

      // Offline: guardar en Dexie directamente
      if (!this.online) {
        await this.catalogosRepo.destinatariosRepo.saveFordec(normalizado[0]);
        await this.listarDestinatariosRepository();
        this.alertService.cerrarModalCarga();
        this.modalAbierto.set(false);
        this.alertService.showAlert('Éxito', isNew ? 'Destinatario creado' : 'Destinatario actualizado', 'success');
        return;
      }

      // Online: sincronizar con API
      const apiPayload = this.buildDestinatarioPayload(normalizado[0], isNew);
      const resp: any = await firstValueFrom(this.catalogoService.sincronizarDestinatarios([apiPayload]));

      if (resp?.error) {
        this.alertService.cerrarModalCarga();
        this.alertService.showAlert('Error', resp.mensaje ?? 'Error al sincronizar.', 'error');
        return;
      }

      // Éxito: eliminar registro local y recargar desde API
      if (!isNew && record._pk !== undefined) {
        await this.catalogosRepo.destinatariosRepo.delete(record._pk);
      }
      await this.apiListarDestinatarios();
      this.alertService.cerrarModalCarga();
      this.modalAbierto.set(false);
      this.alertService.showAlert('Éxito', isNew ? 'Destinatario creado' : 'Destinatario actualizado', 'success');
    } catch (error) {
      console.error(error);
      this.alertService.cerrarModalCarga();
      this.alertService.showAlert('Error', 'Error al guardar el destinatario.', 'error');
    }
  }

  async onSincronizar(): Promise<void> {
    try {
      if (!this.online) {
        this.alertService.showAlert('Error', 'No tiene conexión a internet', 'error');
        return;
      }

      const confirmar = await this.alertService.showConfirm(
        'Confirmar sincronización',
        'Se subirán a BD los registros pendientes. ¿Desea continuar?',
        'question',
      );

      if (!confirmar) return;

      this.alertService.mostrarModalCarga();
      const dataSend: any[] = await this.catalogosRepo.destinatariosRepo.getAllNoSincronizado();

      if (dataSend.length === 0) {
        await this.catalogosRepo.destinatariosRepo.clear();
        await this.apiListarDestinatarios();
        this.alertService.cerrarModalCarga();
        return;
      }

      const payloads = dataSend.map((item: any) => {
        const isNew = !item.fechaCreacion;
        return this.buildDestinatarioPayload(item, isNew);
      });

      const resp: any = await firstValueFrom(this.catalogoService.sincronizarDestinatarios(payloads));

      if (resp?.error) {
        this.alertService.cerrarModalCarga();
        this.alertService.showAlert('Error', resp.mensaje ?? 'Error al sincronizar.', 'error');
        return;
      }

      // Éxito: limpiar Dexie y recargar desde API
      await this.catalogosRepo.destinatariosRepo.clear();
      await this.apiListarDestinatarios();
      this.alertService.cerrarModalCarga();
      this.alertService.showAlert('Éxito', 'Sincronización realizada correctamente.', 'success');
    } catch (error) {
      console.error('Error en sincronización:', error);
      this.alertService.cerrarModalCarga();
      this.alertService.showAlert('Error', 'Error al sincronizar destinatarios.', 'error');
    }
  }

  private buildDestinatarioPayload(record: any, isNew: boolean = false): any {
    const payload: any = {
      id: isNew ? 0 : (record.id ?? 0),
      idCliente: record.idCliente ?? record.id ?? 0,
      documentoFiscal: (record.documentoFiscal ?? '').trim(),
      documento: (record.documento ?? record.documentoFiscal ?? '').trim(),
      domicilioFiscal: record.domicilioFiscal ?? '',
      puntoLlegada: record.puntoLlegada ?? '',
      activo: this.asBitBoolean(record.activo),
      nombre: record.nombre ?? '',
      tipoDocumento: record.tipoDocumento ?? '',
      esCliente: record.esCliente ?? '',
    };
    return payload;
  }

  private asBitBoolean(value: unknown): boolean {
    if (value === true) return true;
    if (value === false) return false;
    if (value === 1) return true;
    if (value === 0) return false;
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') {
      const v = value.trim().toLowerCase();
      if (v === '1' || v === 'true' || v === 'si' || v === 'sí' || v === 'y') return true;
      if (v === '0' || v === 'false' || v === 'no' || v === 'n' || v === '') return false;
    }
    return !!value;
  }

  private nextId(): number {
    const arr = this.items();
    if (!arr.length) return 1;
    return Math.max(...arr.map(x => Number(x?.id ?? 0))) + 1;
  }
}