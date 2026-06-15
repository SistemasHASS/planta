import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { AlertService } from '../../shared/services/alert.service';
import { ConnectivityService } from '../../shared/services/connectivity.service';
import { AdministracionService } from '../../shared/services/administracion.service';
import { AdministracionRepository } from '../../shared/dexiedb/repository/administracion.repository';
import { CatalogosRepository } from '../../shared/dexiedb/repository/catalogos.repository';

import { Configuracion, ReglaSobrePeso } from '../../shared/interfaces/administracion.interface';
import { Consignatario, Destino, Formato, Transporte } from '../../shared/interfaces/catalogo.interface';

import { SobrepesoTablaComponent } from './components/tabla/sobrepeso-tabla.component';
import { SobrepesoModalComponent } from './components/modal/sobrepeso-modal.component';
import { AuthService } from '../../shared/services/auth.service';

export type EstadoFiltro = 'activos' | 'inactivos' | 'todos';

type ReglaSobrePesoRow = ReglaSobrePeso & {
  _pk?: any;
  consignatarioNombre?: string;
  formatoNombre?: string;
  destinoNombre?: string;
  transporteNombre?: string;
};

@Component({
  selector: 'app-sobrepeso',
  standalone: true,
  imports: [CommonModule, FormsModule, SobrepesoTablaComponent, SobrepesoModalComponent],
  templateUrl: './sobrepeso.component.html',
  styleUrl: './sobrepeso.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SobrepesoComponent implements OnInit {
  private readonly alertService = inject(AlertService);
  private readonly administracionService = inject(AdministracionService);
  private readonly administracionRepository = inject(AdministracionRepository);
  private readonly catalogosRepository = inject(CatalogosRepository);
  private readonly connectivity = inject(ConnectivityService);
  private readonly auth = inject(AuthService);
  readonly usuario = this.auth.usuario;
  readonly savedConfig = signal<Configuracion | null>(null);
  

  readonly isLoading = signal(false);
  readonly searchTerm = signal('');
  readonly estadoFiltro = signal<EstadoFiltro>('todos');

  readonly modalAbierto = signal(false);
  readonly modalModo = signal<'nuevo' | 'editado'>('nuevo');
  readonly modalValue = signal<ReglaSobrePesoRow | null>(null);

  readonly items = signal<ReglaSobrePesoRow[]>([]);

  readonly consignatarios = signal<Consignatario[]>([]);
  readonly formatos = signal<Formato[]>([]);
  readonly destinos = signal<Destino[]>([]);
  readonly transportes = signal<Transporte[]>([]);

  get online(): boolean {
    return this.connectivity.isOnline();
  }

  readonly totalRegistros = computed(() => this.filteredItems().length);

  readonly lookup = computed(() => {
    const consignatarios = new Map<string, Consignatario>();
    const formatos = new Map<number, Formato>();
    const destinos = new Map<string, Destino>();
    const transportes = new Map<string, Transporte>();

    for (const c of this.consignatarios()) consignatarios.set(String(c.documento ?? '').trim(), c);
    for (const f of this.formatos()) formatos.set(Number(f.id), f);
    for (const d of this.destinos()) destinos.set(String(d.id ?? '').trim(), d);
    for (const t of this.transportes()) transportes.set(String((t as any)?.id ?? '').trim(), t);

    return { consignatarios, formatos, destinos, transportes };
  });

  readonly filteredItems = computed(() => {
    const term = (this.searchTerm() ?? '').trim().toLowerCase();
    const filtro = this.estadoFiltro();

    let base = this.items();
    if (filtro === 'activos') base = base.filter(i => !!i?.activo);
    if (filtro === 'inactivos') base = base.filter(i => !i?.activo);

    if (!term) return [...base].sort((a, b) => Number(b?.id ?? 0) - Number(a?.id ?? 0));

    return base
      .filter(i => {
        const parts = [
          i.id,
          i.consignatarioNombre,
          i.formatoNombre,
          i.destinoNombre,
          i.transporteNombre,
          i.porcentaje,
          i.descripcion,
          i.vigenciaDesde,
          i.vigenciaHasta,
          i.activo ? 'activo' : 'inactivo',
          i.fechaCreacion,
        ]
          .map(v => String(v ?? ''))
          .join(' ')
          .toLowerCase();
        return parts.includes(term);
      })
      .sort((a, b) => Number(b?.id ?? 0) - Number(a?.id ?? 0));
  });

  async ngOnInit(): Promise<void> {
    await this.cargarConfiguracionGuardada();
    await this.cargarCatalogos();
    await this.listarReglas();
  }

  private async cargarConfiguracionGuardada(): Promise<void> {
        const nro = this.getNroDocumentoFromUsuario();
        const cfg = await this.catalogosRepository.configuracionRepo.getByField('nrodocumento', nro);
        this.savedConfig.set(cfg ?? null);
  }

  private getNroDocumentoFromUsuario(): string {
      const u: any = this.usuario();
      const v = u?.nrodocumento ?? u?.documentoidentidad ?? u?.documentoIdentidad ?? u?.documento ?? '';
      return String(v ?? '').trim();
  }

  onSearchChange(v: string): void {
    this.searchTerm.set(v);
  }

  setEstadoFiltro(v: EstadoFiltro): void {
    this.estadoFiltro.set(v);
  }

  abrirNuevo(): void {
    this.modalModo.set('nuevo');
    this.modalValue.set(null);
    this.modalAbierto.set(true);
  }

  abrirEditar(item: ReglaSobrePesoRow): void {
    this.modalModo.set('editado');
    this.modalValue.set(item);
    this.modalAbierto.set(true);
  }

  cerrarModal(): void {
    this.modalAbierto.set(false);
  }

  private isEmpty(v: any): boolean {
    return v === null || v === undefined || (typeof v === 'string' && v.trim() === '');
  }

  private async cargarCatalogos(): Promise<void> {
    const [consignatarios, formatos, destinos, transportes] = await Promise.all([
      this.catalogosRepository.consignatariosRepo.getAll(),
      this.catalogosRepository.formatosRepo.getAll(),
      this.catalogosRepository.destinosRepo.getAll(),
      this.catalogosRepository.transportesRepo.getAll(),
    ]);

    this.consignatarios.set(consignatarios ?? []);
    this.formatos.set(formatos ?? []);
    this.destinos.set(destinos ?? []);
    this.transportes.set(transportes ?? []);
  }

  private enrichRow(row: any): ReglaSobrePesoRow {
    const lk = this.lookup();
    const consignatario = lk.consignatarios.get(String(row?.documentoConsignatario ?? '').trim());
    const formato = lk.formatos.get(Number(row?.formatoId));
    const destino = lk.destinos.get(String(row?.destinoId ?? '').trim());
    const transporte = lk.transportes.get(String(row?.transporteId ?? '').trim());

    return {
      ...(row as any),
      consignatarioNombre: consignatario ? `${consignatario.nombre}` : '—',
      formatoNombre: formato ? `${formato.descripcion ?? formato.descripcion ?? ''}`.trim() : '—',
      destinoNombre: destino ? `${destino.pais}` : '—',
      transporteNombre: transporte ? `${transporte.transporte}` : '—',
    };
  }

  private async listarReglasRepository(): Promise<boolean> {
    const cfg = this.savedConfig();
    const idProyecto = String(cfg?.idProyecto ?? '').trim();
    const codigoCultivo = String(cfg?.codigoCultivo ?? '').trim();

    const info: any = await this.administracionRepository.reglasSobrePesoRepository.getAll();
    const filtered = idProyecto && codigoCultivo
      ? (info ?? []).filter((r:any) => String((r as any)?.idProyecto ?? '').trim() === idProyecto && String((r as any)?.codigoCultivo ?? '').trim() === codigoCultivo)
      : (info ?? []);

    if (!filtered?.length) {
      this.items.set([]);
      return false;
    }
    this.items.set(filtered.map((r:any) => this.enrichRow(r)));
    return true;
  }

  private async apiListarReglas(): Promise<void> {
    const resp: any = await firstValueFrom(this.administracionService.listarReglasSobrePeso({idProyecto:this.savedConfig()?.idProyecto,codigoCultivo:this.savedConfig()?.codigoCultivo}));
    if (resp[0]?.error) {
      this.alertService.showAlert('Error', resp?.mensaje ?? 'Error al listar reglas de sobrepeso', 'error');
      return;
    }

    const list = Array.isArray(resp[0]?.data) ? resp[0].data : [];
    const cfg = this.savedConfig();
    const idProyectoCfg = String(cfg?.idProyecto ?? '').trim();
    const idCultivoCfg = String(cfg?.codigoCultivo ?? '').trim();

    const normalized = list.map((r: any) => ({
      ...r,
      idProyecto: String(r?.idProyecto ?? idProyectoCfg ?? '').trim(),
      codigoCultivo: String(r?.codigoCultivo ?? idCultivoCfg ?? '').trim(),
      documentoConsignatario: String(r?.documentoConsignatario ?? r?.documento_consignatario ?? r?.consignatarioDocumento ?? r?.consignatarioId ?? '').trim(),
      formatoId: r?.formatoId === null || r?.formatoId === undefined ? null : Number(r?.formatoId),
      destinoId: String(r?.destinoId ?? '').trim(),
      transporteId: String(r?.transporteId ?? '').trim(),
      porcentaje: r?.porcentaje === null || r?.porcentaje === undefined ? null : Number(r?.porcentaje),
      vigenciaDesde: String(r?.vigenciaDesde ?? '').trim(),
      vigenciaHasta: String(r?.vigenciaHasta ?? '').trim(),
      descripcion: r?.descripcion ?? '',
      activo: r?.activo === false ? false : true,
      bd: 1,
      modo: r?.modo ?? 'editado',
    }));
    await this.administracionRepository.reglasSobrePesoRepository.clear();
    await this.administracionRepository.reglasSobrePesoRepository.bulkSave(normalized);
    await this.listarReglasRepository();
  }

  async listarReglas(): Promise<void> {
    this.isLoading.set(true);
    try {
      const exists = await this.listarReglasRepository();
      if (!exists && this.online) {
        await this.apiListarReglas();
      }
    } catch (err) {
      console.error(err);
      this.alertService.showAlert('Error', 'Error al listar reglas de sobrepeso', 'error');
    } finally {
      this.isLoading.set(false);
    }
  }

  private nextId(): number {
    const arr = this.items();
    if (!arr.length) return 1;
    return Math.max(...arr.map(x => Number(x?.id ?? 0))) + 1;
  }

  async guardarModal(ev: any): Promise<void> {
    try {
      this.alertService.mostrarModalCarga();
      const modo = ev?.modo ?? this.modalModo();
      const payload = (ev?.payload ?? ev ?? {}) as Partial<ReglaSobrePeso>;
      const pk = ev?._pk;

      const cfg = this.savedConfig();
      const idProyectoCfg = String(cfg?.idProyecto ?? '').trim();
      const idCultivoCfg = String(cfg?.codigoCultivo ?? '').trim();
      if (!idProyectoCfg || !idCultivoCfg) {
        this.alertService.showAlert('Advertencia', 'Primero configure Proyecto/Cultivo en Parámetros.', 'warning');
        return;
      }

      if (
        this.isEmpty(payload?.documentoConsignatario) ||
        this.isEmpty(payload?.formatoId) ||
        this.isEmpty(payload?.destinoId) ||
        this.isEmpty(payload?.transporteId) ||
        payload?.porcentaje === null || payload?.porcentaje === undefined
      ) {
        this.alertService.showAlert('Advertencia', 'Complete los campos obligatorios (*)', 'warning');
        return;
      }

      const now = new Date().toISOString();
      const record: any = {
        ...(payload as any),
        idProyecto: idProyectoCfg,
        codigoCultivo: idCultivoCfg,
        id: modo === 'nuevo' ? this.nextId() : Number(payload?.id),
        bd: 0,
        activo: payload?.activo === false ? false : true,
        fechaCreacion: modo === 'nuevo' ? '' : (payload as any)?.fechaCreacion ?? '',
        fechaModificacion: now,
        modo: modo === 'nuevo' ? 'nuevo' : (payload as any)?.modo ?? 'editado',
        descripcion: (payload as any)?.descripcion ?? '',
        vigenciaDesde: (payload as any)?.vigenciaDesde ?? '',
        vigenciaHasta: (payload as any)?.vigenciaHasta ?? '',
      };

      if (modo === 'editado') {
        record._pk = pk ?? (this.modalValue() as any)?._pk;
      }

      const normalized = this.enrichRow(record);

      if (this.online) {
        const payloads: any[] = [structuredClone(normalized)];
        payloads.map((it: any) => {
          delete it.bd;
          delete it._pk;
          delete it.consignatarioNombre;
          delete it.formatoNombre;
          delete it.destinoNombre;
          delete it.transporteNombre;
          delete it.fechaCreacion;
        });

        const resp: any = await firstValueFrom(this.administracionService.sincronizarReglasSobrePeso(payloads));
        if (resp?.error) {
          this.alertService.showAlert('Error', resp?.mensaje ?? 'No se pudo guardar la regla', 'error');
          return;
        }

        await this.administracionRepository.reglasSobrePesoRepository.clear();
        await this.apiListarReglas();
        this.alertService.cerrarModalCarga();
        this.modalAbierto.set(false);
        this.alertService.showAlert('Éxito', modo === 'editado' ? 'Regla actualizada' : 'Regla creada', 'success');
        return;
      }

      await this.administracionRepository.reglasSobrePesoRepository.save(normalized as any);
      await this.listarReglasRepository();
      this.alertService.cerrarModalCarga();
      this.modalAbierto.set(false);
      this.alertService.showAlert('Éxito', modo === 'editado' ? 'Regla actualizada' : 'Regla creada', 'success');
    } catch (err) {
      console.error(err);
      this.alertService.cerrarModalCarga();
      this.alertService.showAlert('Error', 'No se pudo guardar la regla', 'error');
    }
  }

  async onDesactivar(item: ReglaSobrePesoRow): Promise<void> {
    try {
      this.alertService.mostrarModalCarga();
      const pk = (item as any)?._pk;
      if (pk === null || pk === undefined) {
        this.alertService.cerrarModalCarga();
        this.alertService.showAlert('Error', 'No se encontró el registro.', 'error');
        return;
      }

      const existe: any = await this.administracionRepository.reglasSobrePesoRepository.getByKey(pk);
      if (!existe) {
        this.alertService.cerrarModalCarga();
        this.alertService.showAlert('Error', 'No se encontró el registro.', 'error');
        return;
      }

      if (this.online) {
        const payloads: any[] = [structuredClone(item)];
        payloads.map((it: any) => {
          delete it.bd;
          delete it._pk;
          delete it.consignatarioNombre;
          delete it.formatoNombre;
          delete it.destinoNombre;
          delete it.transporteNombre;
          delete it.fechaCreacion;
          it.activo = !it.activo;
        });

        const resp: any = await firstValueFrom(this.administracionService.sincronizarReglasSobrePeso(payloads));
        if (resp?.error) {
          this.alertService.showAlert('Error', resp?.mensaje ?? 'No se pudo actualizar el estado', 'error');
          return;
        }

        await this.administracionRepository.reglasSobrePesoRepository.clear();
        await this.apiListarReglas();
        this.alertService.showAlert('Éxito', resp?.mensaje ?? 'Estado actualizado', 'success');
        return;
      }

      await this.administracionRepository.reglasSobrePesoRepository.update(pk, {
        activo: !existe.activo,
        bd: 0,
        fechaModificacion: new Date().toISOString(),
      } as any);
      await this.listarReglasRepository();
      this.alertService.cerrarModalCarga();
    } catch (err) {
      console.error(err);
      this.alertService.cerrarModalCarga();
      this.alertService.showAlertAcept('Error', 'No se pudo actualizar el estado.', 'error');
    }
  }

  async onEliminar(item: ReglaSobrePesoRow): Promise<void> {
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
        '¿Desea eliminar esta regla? Esta acción solo aplica para registros no sincronizados.',
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

      await this.administracionRepository.reglasSobrePesoRepository.delete(pk);
      await this.listarReglasRepository();
      this.alertService.cerrarModalCarga();
      this.alertService.showAlert('Éxito', 'Regla eliminada', 'success');
    } catch (err) {
      console.error(err);
      this.alertService.cerrarModalCarga();
      this.alertService.showAlertAcept('Error', 'No se pudo eliminar la regla.', 'error');
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
      const dataSend: any[] = await this.administracionRepository.reglasSobrePesoRepository.getAllNoSincronizado();

      if (!dataSend.length) {
        await this.administracionRepository.reglasSobrePesoRepository.clear();
        await this.apiListarReglas();
        this.alertService.cerrarModalCarga();
        this.alertService.showAlert('Éxito', 'No hay registros pendientes de sincronización', 'success');
        return;
      }

      const payloads = structuredClone(dataSend);
      payloads.map((it: any) => {
        delete it.bd;
        delete it._pk;
        delete it.consignatarioNombre;
        delete it.formatoNombre;
        delete it.destinoNombre;
        delete it.transporteNombre;
        delete it.fechaModificacion;
      });

      const resp: any = await firstValueFrom(this.administracionService.sincronizarReglasSobrePeso(payloads));
      if (resp?.error) {
        this.alertService.cerrarModalCarga();
        this.alertService.showAlert('Error', resp?.mensaje ?? 'Error en sincronización', 'error');
        return;
      }

      await this.administracionRepository.reglasSobrePesoRepository.clear();
      await this.apiListarReglas();
      this.alertService.cerrarModalCarga();
      this.alertService.showAlert('Éxito', resp?.mensaje ?? 'Sincronización completa', 'success');
    } catch (err) {
      console.error(err);
      this.alertService.cerrarModalCarga();
      this.alertService.showAlert('Error', 'Error en sincronización', 'error');
    }
  }
}
