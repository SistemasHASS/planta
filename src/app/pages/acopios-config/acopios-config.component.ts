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
        const resp: any = await firstValueFrom(this.catalogoService.listarAcopios());
        const data = resp?.data ?? [];
        if (resp?.error) {
          this.alertService.showAlert('Error', resp?.mensaje ?? 'Error al listar acopios', 'error');
        } else {
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

      const dexie = await this.catalogosOperativosRepo.acopiosRepo.getAll();
      (dexie ?? []).map(a => this.normalizeAcopio(a))
      for (let a of dexie) {
        const dexieDetalle = await this.catalogosOperativosRepo.acopiosDetallesRepo.getAcopioDetalle(a.codigoAcopio);
        const filtered = dexieDetalle.filter(d => d.activo === true);
        (a as any).tiposActivosCount = filtered.length
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
        'Se subirán a BD las series guía pendientes. ¿Desea continuar?',
        'question',
      );

      if (!confirmar) return;

      this.alertService.mostrarModalCarga();

      const dataSend: any[] = await this.catalogosOperativosRepo.acopiosRepo.getAllNoSincronizado();
      if ((dataSend ?? []).length === 0) {
        await this.cargarAcopios();
        this.alertService.cerrarModalCarga();
        this.alertService.showAlert('Éxito', 'No hay registros pendientes de sincronización', 'success');
        return;
      }

      const cfg = this.savedConfig();
      const idProyecto = String(cfg?.idProyecto ?? '').trim();

      const payloads = structuredClone(dataSend);
      payloads.forEach((x: any) => {
        delete x.bd;
        delete x._pk;
        x.idproyecto = idProyecto;
        x.acopioId = String(x?.acopioId ?? x?.codigoAcopio ?? '').trim();
      });

      const { error, mensaje } = await firstValueFrom(this.catalogoService.sincronizarCatalogos('PLANTA_Acopio_SerieGuia', payloads));

      if (error) {
        this.alertService.cerrarModalCarga();
        this.alertService.showAlert('Error', mensaje ?? 'Error sincronizando acopios', 'error');
        return;
      }

      for (const element of dataSend) {
        await this.catalogosOperativosRepo.acopiosRepo.delete((element as any)._pk);
      }

      await this.cargarAcopios();
      this.alertService.cerrarModalCarga();
      this.alertService.showAlert('Éxito', mensaje ?? 'Sincronización completada', 'success');
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

  async guardarModal(a:any) :Promise<void>{
    console.log('1-1-1-1',a)
  }

}
