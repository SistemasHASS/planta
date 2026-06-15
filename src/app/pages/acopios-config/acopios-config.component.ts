import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { CatalogosOperativosRepository } from '../../shared/dexiedb/repository/catalogos-operacionales.repository';
import { CatalogosRepository } from '../../shared/dexiedb/repository/catalogos.repository';
import { Acopio, AcopioDetalle, TipoProcesoEmpacado } from '../../shared/interfaces/catalogo.interface';
import { Configuracion } from '../../shared/interfaces/administracion.interface';
import { AlertService } from '../../shared/services/alert.service';
import { AuthService } from '../../shared/services/auth.service';
import { CatalogoService } from '../../shared/services/catalogo.service';
import { ConnectivityService } from '../../shared/services/connectivity.service';
import { AcopiosTablaComponent } from "./components/tabla/acopios-tabla.component";
import { AcopiosModalComponent } from "./components/modal/acopios-modal.component";
import { AcopiosModalResult } from "./components/modal/acopios-modal.component";

@Component({
  selector: 'app-acopios-config',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, AcopiosTablaComponent, AcopiosModalComponent],
  templateUrl: './acopios-config.component.html',
  styleUrl: './acopios-config.component.scss'
})
export class AcopiosConfigComponent {
  private readonly auth = inject(AuthService);
  private readonly alertService = inject(AlertService);
  private readonly connectivity = inject(ConnectivityService);
  private readonly catalogoService = inject(CatalogoService);
  private readonly catalogosRepository = inject(CatalogosRepository);
  private readonly catalogosOperativosRepo = inject(CatalogosOperativosRepository);
  readonly modalValue = signal<Acopio | null>(null);
  readonly modalValueDetalle = signal<AcopioDetalle[] | null>(null);
  readonly modaltiposProcesoEmpaque = signal<TipoProcesoEmpacado[] | null>(null);

  readonly usuario = this.auth.usuario;
  readonly savedConfig = signal<Configuracion | null>(null);
  readonly modalAbierto = signal(false);
  readonly isLoading = signal(false);
  readonly searchTerm = signal('');
  readonly items = signal<Acopio[]>([]);

  get online(): boolean {
    return this.connectivity.isOnline();
  }

  readonly filteredItems = computed(() => {
    const term = String(this.searchTerm() ?? '').trim().toLowerCase();
    const src = this.items() ?? [];
    if (!term) return src;
    return src.filter((a: any) => {
      const parts = [a?.acopioId, a?.acopioNombre, a?.serieGuia].map(v => String(v ?? '').toLowerCase());
      return parts.some(p => p.includes(term));
    });
  });

  async ngOnInit(): Promise<void> {
    await this.cargarConfiguracionGuardada();
    await this.cargarAcopios();
  }

  private getNroDocumentoFromUsuario(): string {
    const u: any = this.usuario();
    const v = u?.nrodocumento ?? u?.documentoidentidad ?? u?.documentoIdentidad ?? u?.documento ?? '';
    return String(v ?? '').trim();
  }

  private async cargarConfiguracionGuardada(): Promise<void> {
    const nro = this.getNroDocumentoFromUsuario();
    const cfg = await this.catalogosRepository.configuracionRepo.getByField('nrodocumento', nro);
    this.savedConfig.set(cfg ?? null);
  }

  onSearchChange(v: string): void {
    this.searchTerm.set(v);
  }

  private normalizeAcopio(raw: any): any {
    const cfg = this.savedConfig();
    const idproyecto = String(cfg?.idProyecto ?? '').trim();
    return {
      ...raw,
      id: Number(raw?.id ?? 0),
      codigoAcopio: String(raw?.codigoAcopio ?? raw?.codigoAcopio ?? '').trim(),
      acopioNombre: String(raw?.acopioNombre ?? '').trim(),
      serieGuia: String(raw?.serieGuia ?? '').trim(),
      idproyecto,
    };
  }

  private async cargarAcopios(): Promise<void> {
    this.isLoading.set(true);
    try {
      if (this.online) {
        const cfg = this.savedConfig();
        const idproyecto = String(cfg?.idProyecto ?? '').trim();
        const resp: any = await firstValueFrom(this.catalogoService.listarAcopios(idproyecto));
        const data = resp?.data ?? [];
        if (resp?.error) {
          this.alertService.showAlert('Error', resp?.mensaje ?? 'Error al listar acopios', 'error');
        } else {
          const noSincronizados = await this.catalogosOperativosRepo.acopiosRepo.getAllNoSincronizado();
          if ((noSincronizados ?? []).length === 0) {
            await this.catalogosOperativosRepo.acopiosRepo.clear();
            await this.catalogosOperativosRepo.acopiosDetallesRepo.clear();
            for (const a of (data ?? [])) {
              const row = this.normalizeAcopio(a);
              row.bd = 1;
              await this.catalogosOperativosRepo.acopiosRepo.save(row as any);
              if (a.tiposProcesoEmpacado.length > 0) {
                for (const ad of (a.tiposProcesoEmpacado ?? [])) {
                  let detalle: AcopioDetalle = {
                    id: ad.id,
                    codigoAcopio: a.codigoAcopio,
                    codigoTipoProcesoEmpacado: ad.codigo,
                    nombreTipoProcesoEmpacado: ad.nombre,
                    fechaCreacion: ad.fechaCreacion,
                    activo: ad.activo,
                    bd: 1,
                  };
                  this.catalogosOperativosRepo.acopiosDetallesRepo.save(detalle)
                }
              }
            }
          }
        }
      }

      const dexie = await this.catalogosOperativosRepo.acopiosRepo.getAll();
      (dexie ?? []).map(a => this.normalizeAcopio(a))
      for (let a of dexie) {
        const dexieDetalle = await this.catalogosOperativosRepo.acopiosDetallesRepo.getAcopioDetalle(a.codigoAcopio);
        const filtered = dexieDetalle.filter(d => d.activo === true);
        (a as any).tiposActivosCount = filtered.length;
        (a as any).tiposActivosNombres = filtered.map(d => d.nombreTipoProcesoEmpacado).join(', ');
      }
      this.items.set(dexie);
    } catch (error: any) {
      console.error('Error cargando acopios:', error);
      this.alertService.showAlert('Error', `${error?.error?.message ?? 'Error cargando acopios'}`, 'error');
    } finally {
      this.isLoading.set(false);
    }
  }

  async guardarSerieGuia(item: Acopio, serieGuia: string): Promise<void> {
    const row: any = this.normalizeAcopio(item);
    row.serieGuia = String(serieGuia ?? '').trim();
    row.bd = 0;

    await this.catalogosOperativosRepo.acopiosRepo.save(row);

    const dexie = await this.catalogosOperativosRepo.acopiosRepo.getAll();
    this.items.set((dexie ?? []).map(a => this.normalizeAcopio(a)));
  }

  async onSincronizar(): Promise<void> {
    try {
      if (!this.online) {
        this.alertService.showAlert('Error', 'No tiene conexión a internet', 'error');
        return;
      }

      const confirmar = await this.alertService.showConfirm(
        'Confirmar sincronización',
        'Se subirán a BD las configuraciones de acopios pendientes. ¿Desea continuar?',
        'question',
      );

      if (!confirmar) return;

      this.alertService.mostrarModalCarga();

      const acopiosPendientes: any[] = await this.catalogosOperativosRepo.acopiosRepo.getAllNoSincronizado();
      const detallesPendientes: any[] = await this.catalogosOperativosRepo.acopiosDetallesRepo.getAllNoSincronizado();

      if ((acopiosPendientes ?? []).length === 0 && (detallesPendientes ?? []).length === 0) {
        this.alertService.cerrarModalCarga();
        this.alertService.showAlert('Éxito', 'No hay registros pendientes de sincronización', 'success');
        return;
      }

      const jsonCabecera = JSON.stringify((acopiosPendientes ?? []).map((x: any) => ({
        codigoAcopio: String(x?.codigoAcopio ?? '').trim(),
        acopioNombre: String(x?.acopioNombre ?? '').trim(),
        serieGuia: String(x?.serieGuia ?? '').trim(),
      })));

      const jsonDetalle = JSON.stringify((detallesPendientes ?? []).map((x: any) => ({
        codigoAcopio: String(x?.codigoAcopio ?? '').trim(),
        codigoTipoProcesoEmpacado: String(x?.codigoTipoProcesoEmpacado ?? '').trim(),
        activo: x?.activo === true,
      })));

      const resp: any = await firstValueFrom(this.catalogoService.sincronizarAcopios(jsonCabecera, jsonDetalle));

      if (resp?.error) {
        this.alertService.cerrarModalCarga();
        this.alertService.showAlert('Error', resp?.mensaje ?? 'Error sincronizando acopios', 'error');
        return;
      }

      // Marcar todo como sincronizado
      for (const a of (acopiosPendientes ?? [])) {
        await this.catalogosOperativosRepo.acopiosRepo.save({ ...a, bd: 1 });
      }
      for (const d of (detallesPendientes ?? [])) {
        await this.catalogosOperativosRepo.acopiosDetallesRepo.save({ ...d, bd: 1 });
      }

      this.alertService.cerrarModalCarga();
      this.alertService.showAlert('Éxito', resp?.mensaje ?? 'Sincronización completada', 'success');

      // Recargar lista desde Dexie (sin tocar servidor para no perder cambios locales)
      const dexieSync = await this.catalogosOperativosRepo.acopiosRepo.getAll();
      for (let a of dexieSync) {
        const dexieDetalle = await this.catalogosOperativosRepo.acopiosDetallesRepo.getAcopioDetalle(a.codigoAcopio);
        const filtered = dexieDetalle.filter(d => d.activo === true);
        (a as any).tiposActivosCount = filtered.length;
        (a as any).tiposActivosNombres = filtered.map(d => d.nombreTipoProcesoEmpacado).join(', ');
      }
      this.items.set(dexieSync);
    } catch (error: any) {
      console.error('Error en sincronización acopios:', error);
      this.alertService.cerrarModalCarga();
      this.alertService.showAlert('Error', `${error?.error?.message ?? 'Error en sincronización'}`, 'error');
    }
  }

  async abrirEditar(item: Acopio): Promise<void> {
    this.modalValue.set(item);
    let detalle = await this.catalogosOperativosRepo.acopiosDetallesRepo.getAcopioDetalle(item.codigoAcopio);
    this.modalValueDetalle.set(detalle);
    let tipoProcesoEmpaque = await this.catalogosRepository.tipoProcesoEmpacadoRepo.getAll();
    this.modaltiposProcesoEmpaque.set(tipoProcesoEmpaque);
    this.modalAbierto.set(true);
  }

  async guardarModal(a: AcopiosModalResult): Promise<void> {
    const value: any = a?.value;
    const codigoAcopio = String(value?.codigoAcopio ?? '').trim();
    if (!codigoAcopio) {
      this.modalAbierto.set(false);
      return;
    }

    const seleccionados = new Set((a?.seleccionados ?? []).map(x => String(x ?? '').trim()).filter(Boolean));
    const nuevaSerie = String(a?.serieGuia ?? '').trim();

    let acopioModificado = false;

    const existingAcopio: any = await this.catalogosOperativosRepo.acopiosRepo.getByField('codigoAcopio', codigoAcopio);
    if (existingAcopio) {
      const prevSerie = String(existingAcopio?.serieGuia ?? '').trim();
      const serieChanged = prevSerie !== nuevaSerie;

      if (serieChanged) {
        const updatedAcopio = {
          ...existingAcopio,
          serieGuia: nuevaSerie,
          bd: 0,
        };
        await this.catalogosOperativosRepo.acopiosRepo.save(updatedAcopio);
        acopioModificado = true;
      }
    }

    let detallesCambiados = false;
    const detalles = await this.catalogosOperativosRepo.acopiosDetallesRepo.getAcopioDetalle(codigoAcopio);
    const codigosExistentes = new Set<string>();
    for (const d of (detalles ?? [])) {
      const codigoTipo = String((d as any)?.codigoTipoProcesoEmpacado ?? '').trim();
      if (!codigoTipo) continue;
      codigosExistentes.add(codigoTipo);

      const nuevoActivo = seleccionados.has(codigoTipo);
      const prevActivo = (d as any)?.activo !== false;
      if (prevActivo === nuevoActivo) continue;

      detallesCambiados = true;
      const existingDetalle: any = await this.catalogosOperativosRepo.acopiosDetallesRepo.getByField('id', (d as any).id);
      const detalleToSave = {
        ...(existingDetalle ?? d),
        activo: nuevoActivo,
        bd: 0,
      };
      await this.catalogosOperativosRepo.acopiosDetallesRepo.save(detalleToSave);
    }


    const tiposDisponibles = this.modaltiposProcesoEmpaque() ?? [];
    for (const codigoTipo of seleccionados) {
      if (codigosExistentes.has(codigoTipo)) continue;
      const tipo = tiposDisponibles.find((t: any) => String(t?.codigo ?? '').trim() === codigoTipo);
      const nuevoDetalle: AcopioDetalle = {
        id: -Date.now(),
        codigoAcopio,
        codigoTipoProcesoEmpacado: codigoTipo,
        nombreTipoProcesoEmpacado: tipo?.nombre ?? codigoTipo,
        fechaCreacion: new Date().toISOString(),
        activo: true,
        bd: 0,
      };
      await this.catalogosOperativosRepo.acopiosDetallesRepo.save(nuevoDetalle);
      detallesCambiados = true;
    }


    if (detallesCambiados && existingAcopio && !acopioModificado) {
      const updatedAcopio = {
        ...existingAcopio,
        bd: 0,
      };
      await this.catalogosOperativosRepo.acopiosRepo.save(updatedAcopio);
    }

    if (this.online) {
      this.alertService.mostrarModalCarga();
      try {
        const acopioToSync = await this.catalogosOperativosRepo.acopiosRepo.getByField('codigoAcopio', codigoAcopio);
        const detallesToSync = await this.catalogosOperativosRepo.acopiosDetallesRepo.getAcopioDetalle(codigoAcopio);

        const jsonCabecera = JSON.stringify([{
          codigoAcopio: acopioToSync?.codigoAcopio ?? codigoAcopio,
          acopioNombre: acopioToSync?.acopioNombre ?? '',
          serieGuia: acopioToSync?.serieGuia ?? '',
        }]);

        const jsonDetalle = JSON.stringify((detallesToSync ?? []).map(d => ({
          codigoAcopio: d.codigoAcopio,
          codigoTipoProcesoEmpacado: d.codigoTipoProcesoEmpacado,
          activo: d.activo ?? true,
        })));

        const resp: any = await firstValueFrom(this.catalogoService.sincronizarAcopios(jsonCabecera, jsonDetalle));
        if (!resp?.error) {
          if (acopioToSync) {
            await this.catalogosOperativosRepo.acopiosRepo.save({ ...acopioToSync, bd: 1 });
          }
          for (const d of (detallesToSync ?? [])) {
            await this.catalogosOperativosRepo.acopiosDetallesRepo.save({ ...d, bd: 1 });
          }
        }
      } catch (syncErr) {
        console.error('Error sincronizando acopio en línea:', syncErr);
      } finally {
        this.alertService.cerrarModalCarga();
      }
    }

    const dexie = await this.catalogosOperativosRepo.acopiosRepo.getAll();
    for (let a of dexie) {
      const dexieDetalle = await this.catalogosOperativosRepo.acopiosDetallesRepo.getAcopioDetalle(a.codigoAcopio);
      const filtered = dexieDetalle.filter(d => d.activo === true);
      (a as any).tiposActivosCount = filtered.length;
      (a as any).tiposActivosNombres = filtered.map(d => d.nombreTipoProcesoEmpacado).join(', ');
    }
    this.items.set(dexie);

    this.modalAbierto.set(false);
  }

}
