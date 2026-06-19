import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { AlertService } from '../../shared/services/alert.service';
import { AdministracionService } from '../../shared/services/administracion.service';
import { ConnectivityService } from '../../shared/services/connectivity.service';
import { AdministracionRepository } from '../../shared/dexiedb/repository/administracion.repository';
import { CorrelativoDocumento, Modo } from '../../shared/interfaces/administracion.interface';
import { CorrelativosDocumentosTablaComponent } from './components/tabla/correlativos-documentos-tabla.component';
import { CorrelativosDocumentosModalComponent } from './components/modal/correlativos-documentos-modal.component';

@Component({
  selector: 'app-correlativos-documentos',
  standalone: true,
  imports: [CommonModule, FormsModule, CorrelativosDocumentosTablaComponent, CorrelativosDocumentosModalComponent],
  templateUrl: './correlativos-documentos.component.html',
  styleUrl: './correlativos-documentos.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CorrelativosDocumentosComponent implements OnInit {
  private readonly alertService = inject(AlertService);
  private readonly administracionService = inject(AdministracionService);
  private readonly connectivity = inject(ConnectivityService);
  private readonly administracionRepository = inject(AdministracionRepository);

  readonly isLoading = signal(false);
  readonly searchTerm = signal('');
  readonly modalAbierto = signal(false);
  readonly modalModo = signal<'nuevo' | 'editar'>('nuevo');
  readonly modalValue = signal<CorrelativoDocumento | null>(null);

  readonly items = signal<CorrelativoDocumento[]>([]);

  get online(): boolean {
    return this.connectivity.isOnline();
  }

  readonly filteredItems = computed(() => {
    const term = (this.searchTerm() ?? '').trim().toLowerCase();
    let base = this.items();
    if (!term) return base;
    return base.filter(i => {
      const parts = [String(i?.serie ?? ''), String(i?.numero ?? '')];
      return parts.join(' ').toLowerCase().includes(term);
    });
  });

  async ngOnInit(): Promise<void> {
    await this.listar();
  }

  async listar() {
    try {
      this.isLoading.set(true);
      const repo = await this.listarRepository();
      if (!repo) {
        await this.apiListar();
      }
      this.isLoading.set(false);
    } catch (error) {
      console.log(error);
      this.alertService.showAlert('Error', 'Error al listar series', 'error');
    } finally {
      this.isLoading.set(false);
    }
  }

  async listarRepository(): Promise<boolean> {
    const info = await this.administracionRepository.correlativosDocumentosRepository.getAll();
    // Si quedó un registro corrupto (array anidado en propiedad data), limpiar y forzar API
    if (info.length === 1 && Array.isArray((info[0] as any)?.data)) {
      await this.administracionRepository.correlativosDocumentosRepository.clear();
      return false;
    }
    if (info.length > 0) {
      this.items.set(info);
      return true;
    }
    this.items.set([]);
    return false;
  }

  async apiListar() {
    if (!this.online) {
      this.alertService.showAlert('Error', 'No tienes conexión a internet', 'error');
      return;
    }
    const resp: any = await firstValueFrom(this.administracionService.listarCorrelativosDocumentos());
    if (resp[0]?.error) {
      this.alertService.showAlert('Error', resp[0]?.mensaje ?? 'Error al listar series', 'error');
      return;
    }
    const apiItems = resp[0]?.data ?? [];
    const normalizados = apiItems.map((item: any) => ({
      ...item,
      modo: 'editado',
      bd: 1
    }));
    if (normalizados.length > 0) {
      await this.administracionRepository.correlativosDocumentosRepository.clear();
      await this.administracionRepository.correlativosDocumentosRepository.bulkSave(normalizados);
      await this.listarRepository();
    }
  }

  abrirNuevo(): void {
    this.modalModo.set('nuevo');
    this.modalValue.set(null);
    this.modalAbierto.set(true);
  }

  abrirEditar(item: CorrelativoDocumento): void {
    this.modalModo.set('editar');
    this.modalValue.set(item);
    this.modalAbierto.set(true);
  }

  cerrarModal(): void {
    this.modalAbierto.set(false);
  }

  async onToggleEstado(item: CorrelativoDocumento): Promise<void> {
    try {
      const pk = (item as any)?._pk;
      if (pk === null || pk === undefined) {
        this.alertService.showAlert('Error', 'No se encontró el registro.', 'error');
        return;
      }

      const current = await this.administracionRepository.correlativosDocumentosRepository.getByField('_pk', pk);
      if (!current) {
        this.alertService.showAlert('Error', 'No se encontró el registro en Dexie.', 'error');
        return;
      }

      const nuevoEliminado = !this.asBitBoolean(current.eliminado);
      const updated = {
        ...current,
        eliminado: nuevoEliminado,
        bd: 0,
        modo: 'editado' as Modo,
        fechaModificacion: new Date().toISOString(),
      };

      await this.administracionRepository.correlativosDocumentosRepository.save(updated);

      if (this.online) {
        this.alertService.mostrarModalCarga();
        const payload = structuredClone([updated]);
        payload.forEach((p: any) => {
          delete p.bd;
          delete p._pk;
          delete p.fechaCreacion;
          delete p.fechaModificacion;
        });
        const { error, mensaje } = await firstValueFrom(
          this.administracionService.sincronizarCorrelativosDocumentos(payload)
        );
        if (error) {
          this.alertService.cerrarModalCarga();
          this.alertService.showAlert('Error', mensaje, 'error');
        } else {
          await this.administracionRepository.correlativosDocumentosRepository.clear();
          await this.apiListar();
          this.alertService.cerrarModalCarga();
          this.alertService.showAlert('Éxito', nuevoEliminado ? 'Serie desactivada' : 'Serie activada', 'success');
          return;
        }
      }

      await this.listarRepository();
      this.alertService.showAlert('Éxito', nuevoEliminado ? 'Serie desactivada (pendiente)' : 'Serie activada (pendiente)', 'success');
    } catch (error) {
      console.error(error);
      this.alertService.cerrarModalCarga();
      this.alertService.showAlert('Error', 'No se pudo cambiar el estado.', 'error');
    }
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

  async onEliminar(item: CorrelativoDocumento): Promise<void> {
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
        '¿Desea eliminar esta serie? Esta acción solo aplica para registros no sincronizados.',
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

      await this.administracionRepository.correlativosDocumentosRepository.delete(pk);
      await this.listarRepository();
      this.alertService.cerrarModalCarga();
      this.alertService.showAlert('Éxito', 'Serie eliminada', 'success');
    } catch (error) {
      console.error(error);
      this.alertService.cerrarModalCarga();
      this.alertService.showAlertAcept('Error', 'No se pudo eliminar la serie.', 'error');
    }
  }

  private isEmpty(v: any): boolean {
    return v === null || v === undefined || v === '';
  }

  private async resolvePkForEdit(payload: any, pk: any): Promise<any> {
    if (pk !== null && pk !== undefined) return pk;
    const id = payload?.id;
    if (id === null || id === undefined) return undefined;
    const existing: any = await this.administracionRepository.correlativosDocumentosRepository.getByField('id', id);
    return existing?._pk;
  }

  private async findDuplicateSerie(payload: Partial<CorrelativoDocumento>): Promise<CorrelativoDocumento | undefined> {
    const serie = (payload.serie ?? '').trim().toUpperCase();
    if (!serie) return undefined;
    const all = await this.administracionRepository.correlativosDocumentosRepository.getAll();
    return all.find((r: any) => {
      const sameSerie = (r.serie ?? '').trim().toUpperCase() === serie;
      const differentId = Number(r.id ?? 0) !== Number(payload.id ?? 0);
      return sameSerie && differentId;
    });
  }

  async guardarModal(ev: any): Promise<void> {
    try {
      this.alertService.mostrarModalCarga();
      const modo = ev?.modo ?? this.modalModo();
      const payload = (ev?.payload ?? ev ?? {}) as Partial<CorrelativoDocumento>;
      const pk = ev?._pk;

      if (this.isEmpty(payload?.serie) || this.isEmpty(payload?.numero)) {
        this.alertService.showAlert('Advertencia', 'Complete los campos obligatorios (*)', 'warning');
        return;
      }

      const excludePk = modo === 'editar' ? await this.resolvePkForEdit(payload, pk) : undefined;
      const dup = await this.findDuplicateSerie(payload);
      if (dup) {
        this.alertService.showAlertAcept('Advertencia', 'Ya existe la serie.', 'warning');
        return;
      }

      const now = new Date().toISOString();
      const record: any = {
        ...(payload as any),
        id: modo === 'nuevo' ? this.nextId() : Number(payload?.id),
        idTipoDocumento: 'GRE',
        idTipoDocumentoNombre: (payload as any)?.idTipoDocumentoNombre ?? 'Guía de Remisión',
        bd: 0,
        fechaCreacion: modo === 'nuevo' ? null : (payload as any)?.fechaCreacion ?? null,
        fechaModificacion: now,
        modo: modo === 'nuevo' ? 'nuevo' : payload.modo
      };

      if (modo === 'editar') {
        const resolvedPk = await this.resolvePkForEdit(payload, pk);
        if (resolvedPk !== null && resolvedPk !== undefined) {
          record._pk = resolvedPk;
        }
      }

      const normalizado = [{
        ...record,
        serie: String(record.serie).trim().toUpperCase(),
        numero: String(record.numero).trim()
      }];

      if (modo === 'editar') {
        normalizado[0]._pk = record._pk;
      }

      if (this.online) {
        const payloads = structuredClone(normalizado);
        payloads.map((item: any) => {
          delete item.bd;
          delete item._pk;
          delete item.fechaCreacion;
        });
        const { error, data, mensaje } = await firstValueFrom(this.administracionService.sincronizarCorrelativosDocumentos(payloads));
        if (error) {
          this.alertService.showAlert('Error', mensaje, 'error');
        } else {
          await this.administracionRepository.correlativosDocumentosRepository.clear();
          await this.apiListar();
          this.alertService.cerrarModalCarga();
          this.modalAbierto.set(false);
          this.alertService.showAlert('Éxito', modo === 'editar' ? 'Serie actualizada' : 'Serie creada', 'success');
          return;
        }
      } else {
        await this.administracionRepository.correlativosDocumentosRepository.save(normalizado[0]);
        await this.listarRepository();
        this.alertService.cerrarModalCarga();
        this.modalAbierto.set(false);
        this.alertService.showAlert('Éxito', modo === 'editar' ? 'Serie actualizada' : 'Serie creada', 'success');
        return;
      }
    } catch (error) {
      console.error(error);
      this.alertService.cerrarModalCarga();
      this.alertService.showAlert('Error', 'Error al sincronizar.', 'error');
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
        'Se subirán a BD las registros pendientes. ¿Desea continuar?',
        'question',
      );

      if (confirmar) {
        this.alertService.mostrarModalCarga();
        const dataSend: any = await this.administracionRepository.correlativosDocumentosRepository.getAllNoSincronizado();
        if (dataSend.length === 0) {
          await this.administracionRepository.correlativosDocumentosRepository.clear();
          await this.apiListar();
          this.alertService.cerrarModalCarga();
          return;
        } else {
          const payloads = structuredClone(dataSend);
          payloads.map((item: any) => {
            delete item.bd;
            delete item._pk;
            delete item.fechaModificacion;
          });
          const { error, data, mensaje } = await firstValueFrom(this.administracionService.sincronizarCorrelativosDocumentos(payloads));
          if (error) {
            this.alertService.cerrarModalCarga();
            this.alertService.showAlert('Error', mensaje, 'error');
          } else {
            await this.administracionRepository.correlativosDocumentosRepository.clear();
            await this.apiListar();
            this.alertService.cerrarModalCarga();
          }
        }
      }
    } catch (error) {
      console.error('Error en sincronización:', error);
      this.alertService.cerrarModalCarga();
    }
  }

  private nextId(): number {
    const arr = this.items();
    if (!arr.length) return 1;
    return Math.max(...arr.map(x => Number(x?.id ?? 0))) + 1;
  }
}
