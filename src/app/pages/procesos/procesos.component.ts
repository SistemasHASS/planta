import { Component, ChangeDetectionStrategy, inject, signal, OnInit, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ProcesoService } from '../../shared/services/proceso.service';
import { CatalogoService } from '../../shared/services/catalogo.service';
import { AuthService } from '../../shared/services/auth.service';
import { AlertService } from '../../shared/services/alert.service';
import { PermissionService } from '../../shared/services/permission.service';
import { Proceso, PersonalDisponible } from '../../shared/interfaces/proceso.interface';
import moment from 'moment';
import 'moment/locale/es';

@Component({
  selector: 'app-procesos',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink],
  templateUrl: './procesos.component.html',
  styleUrl: './procesos.component.scss'
})
export class ProcesosComponent implements OnInit {
  private readonly procesoService = inject(ProcesoService);
  private readonly catalogoService = inject(CatalogoService);
  private readonly auth = inject(AuthService);
  private readonly alertService = inject(AlertService);
  readonly permissions = inject(PermissionService);

  procesos = signal<Proceso[]>([]);
  procesosActivos = signal<Proceso[]>([]);
  acopios = signal<any[]>([]);
  campanias = signal<any[]>([]);
  isLoading = signal(true);
  isCreating = signal(false);
  filterFecha = signal('');
  acopioSeleccionado = signal<number | null>(null);

  // Personal disponible signals
  supervisoresDisponibles = signal<PersonalDisponible[]>([]);
  logisticosDisponibles = signal<PersonalDisponible[]>([]);
  cargandoPersonal = signal(false);

  readonly perfil = this.auth.perfil;
  readonly usuario = this.auth.usuario;

  readonly campaniaActiva = computed(() => {
    const lista = this.campanias();
    const activa = lista.find(c => c.Activa) ?? lista[0] ?? null;
    return activa;
  });

  readonly historial = computed(() => {
    const fecha = this.filterFecha();
    const lista = this.procesos();
    if (!fecha) return lista;
    return lista.filter(p => {
      if (!p.fechaProceso) return false;
      const fechaProceso = p.fechaProceso.split('T')[0];
      return fechaProceso === fecha;
    });
  });

  nuevoProceso = signal<{ fechaProceso: string; turno: string; supervisores: number[]; logisticos: number[] }>({
    fechaProceso: new Date().toISOString().split('T')[0],
    turno: '',
    supervisores: [],
    logisticos: []
  });

  private syncProcesosActivosFromLista(lista: Proceso[]): void {
    // Para ADMIN/COORDINACION la pantalla muestra procesos abiertos en una grilla
    // usando la data del listado completo.
    if (this.perfil() === 'ADMINISTRADOR' || this.perfil() === 'COORDINACION') {
      const abiertos = (lista ?? []).filter(p => p.estado === 'ABIERTO');
      this.procesosActivos.set(abiertos);
    }
  }

  ngOnInit(): void {
    this.cargarDatos();
    this.cargarPersonalDisponible();
    
    // Si el usuario tiene acopio asignado, seleccionarlo automáticamente
    const usr = this.usuario();
    if (usr?.acopioId) {
      this.acopioSeleccionado.set(usr.acopioId);
      this.cargarProcesosPorAcopio(usr.acopioId);
    }
  }

  cargarDatos(): void {
    this.isLoading.set(true);
    
    // Cargar campaña activa específicamente
    this.catalogoService.obtenerCampaniaActiva().subscribe({
      next: (res: any) => {
        const campaniaActiva = res?.data ?? res;
        
        if (campaniaActiva && campaniaActiva.Id) {
          this.campanias.set([campaniaActiva]);
        } else {
          this.campanias.set([]);
        }
      },
      error: (err: any) => {
        this.campanias.set([]);
        this.alertService.showAlert('Error', 'Error al cargar campaña activa', 'error');
      }
    });
    
    this.procesoService.listar({ estado: 'TODOS' }).subscribe({
      next: (res: any) => {
        const raw = res?.data ?? res;
        const data = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : Array.isArray(raw?.items) ? raw.items : [];
        this.procesos.set(data);
        this.syncProcesosActivosFromLista(data);
        this.isLoading.set(false);
      },
      error: () => {
        this.alertService.showAlert('Error', 'Error al cargar procesos', 'error');
        this.isLoading.set(false);
      }
    });
    
    this.catalogoService.listarTodos().subscribe({
      next: (r: any) => {
        const data = r?.data ?? r;
        this.acopios.set(data?.acopios ?? []);
        // No sobreescribir campanias ya que ya cargamos la activa
      }
    });
  }

  updateNuevoProceso(field: string, value: unknown): void {
    this.nuevoProceso.update(prev => ({ ...prev, [field]: value }));
    if (field === 'fechaProceso' || field === 'turno') {
      if (field === 'turno') {
        this.nuevoProceso.update(prev => ({ ...prev, supervisores: [], logisticos: [] }));
      }
      this.cargarPersonalDisponible();
    }
    if (field === 'acopioId') {
      this.acopioSeleccionado.set(value as number);
      this.cargarProcesosPorAcopio(value as number);
    }
  }

  cargarProcesosPorAcopio(acopioId: number): void {
    if (!acopioId) {
      this.procesos.set([]);
      return;
    }
    this.isLoading.set(true);
    this.procesoService.listarPorAcopio(acopioId).subscribe({
      next: (res: any) => {
        const raw = res?.data ?? res;
        const data = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : Array.isArray(raw?.items) ? raw.items : [];
        this.procesosActivos.set(data);
        this.isLoading.set(false);
      },
      error: (err: any) => {
        this.procesosActivos.set([]);
        this.isLoading.set(false);
        this.alertService.showAlert('Error', 'Error al cargar procesos por acopio', 'error');
      }
    });
  }

  cargarPersonalDisponible(): void {
    const np = this.nuevoProceso();
    if (!np.fechaProceso || !np.turno) {
      this.supervisoresDisponibles.set([]);
      this.logisticosDisponibles.set([]);
      return;
    }

    this.cargandoPersonal.set(true);
    this.procesoService.obtenerPersonalDisponible(np.fechaProceso, np.turno).subscribe({
      next: (res: any) => {
        const data = res?.data ?? res;
        const supervisores = data?.supervisores ?? [];
        const logisticos = data?.logisticos ?? [];
        this.supervisoresDisponibles.set(Array.isArray(supervisores) ? supervisores : []);
        this.logisticosDisponibles.set(Array.isArray(logisticos) ? logisticos : []);
        this.cargandoPersonal.set(false);
      },
      error: () => {
        this.cargandoPersonal.set(false);
        this.supervisoresDisponibles.set([]);
        this.logisticosDisponibles.set([]);
      }
    });
  }

  onSupervisoresChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const selectedIds = Array.from(select.selectedOptions).map(o => Number(o.value));
    if (selectedIds.length > 2) {
      this.alertService.showAlert('Validación', 'Máximo 2 supervisores permitidos', 'warning');
      return;
    }
    this.nuevoProceso.update(prev => ({ ...prev, supervisores: selectedIds }));
  }

  toggleSupervisor(id: number, checked: boolean): void {
    const current = this.nuevoProceso().supervisores;
    const next = checked
      ? Array.from(new Set([...current, id]))
      : current.filter(x => x !== id);
    if (next.length > 2) {
      this.alertService.showAlert('Validación', 'Máximo 2 supervisores permitidos', 'warning');
      return;
    }
    this.nuevoProceso.update(prev => ({ ...prev, supervisores: next }));
  }

  isSupervisorSeleccionado(id: number): boolean {
    return this.nuevoProceso().supervisores.includes(id);
  }

  onLogisticosChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const selectedIds = Array.from(select.selectedOptions).map(o => Number(o.value));
    if (selectedIds.length > 5) {
      this.alertService.showAlert('Validación', 'Máximo 5 personal de logística permitidos', 'warning');
      return;
    }
    this.nuevoProceso.update(prev => ({ ...prev, logisticos: selectedIds }));
  }

  toggleLogistico(id: number, checked: boolean): void {
    const current = this.nuevoProceso().logisticos;
    const next = checked
      ? Array.from(new Set([...current, id]))
      : current.filter(x => x !== id);
    if (next.length > 5) {
      this.alertService.showAlert('Validación', 'Máximo 5 personal de logística permitidos', 'warning');
      return;
    }
    this.nuevoProceso.update(prev => ({ ...prev, logisticos: next }));
  }

  isLogisticoSeleccionado(id: number): boolean {
    return this.nuevoProceso().logisticos.includes(id);
  }

  crearProceso(): void {
    const np = this.nuevoProceso();
    const usr = this.usuario();
    if (!np.fechaProceso || !np.turno) {
      this.alertService.showAlert('Validación', 'Complete la fecha y el turno.', 'warning');
      return;
    }
    if (!np.supervisores || np.supervisores.length < 1 || np.supervisores.length > 2) {
      this.alertService.showAlert('Validación', 'Seleccione entre 1 y 2 supervisores.', 'warning');
      return;
    }
    if (!np.logisticos || np.logisticos.length < 1 || np.logisticos.length > 5) {
      this.alertService.showAlert('Validación', 'Seleccione entre 1 y 5 personal de logística.', 'warning');
      return;
    }
    this.isCreating.set(true);
    this.alertService.mostrarModalCarga();
    this.procesoService.crear({
      fechaProceso: np.fechaProceso,
      turno: np.turno,
      acopioId: usr?.acopioId ?? 0,
      usuarioId: usr?.id ?? 1,
      campaniaId: this.campaniaActiva()?.Id ?? null,
      supervisores: np.supervisores,
      logisticos: np.logisticos
    }).subscribe({
      next: (res: any) => {
        this.isCreating.set(false);
        this.alertService.cerrarModalCarga();

        const ok = res?.success;
        if (ok === false) {
          const msg = res?.message ?? 'Error al crear proceso';
          this.alertService.showAlertAcept('Error', String(msg), 'error');
          return;
        }

        this.alertService.showAlert('Éxito', 'Proceso abierto exitosamente', 'success');
        this.nuevoProceso.set({ fechaProceso: new Date().toISOString().split('T')[0], turno: '', supervisores: [], logisticos: [] });
        this.cargarDatos();
      },
      error: (err: unknown) => {
        this.isCreating.set(false);
        this.alertService.cerrarModalCarga();
        const errObj = err as Record<string, unknown>;
        const errBody = errObj['error'] as Record<string, string> | undefined;
        const msg = errBody?.['message'] ?? 'Error al crear proceso';
        this.alertService.showAlertAcept('Error', msg, 'error');
      }
    });
  }

  cerrarProceso(p: Proceso): void {
    const usr = this.usuario();
    this.alertService.mostrarModalCarga();
    this.procesoService.cerrar(p.id, usr?.id ?? 1).subscribe({
      next: () => {
        this.alertService.cerrarModalCarga();
        this.alertService.showAlert('Éxito', 'Proceso cerrado exitosamente', 'success');
        this.cargarDatos();
      },
      error: () => {
        this.alertService.cerrarModalCarga();
        this.alertService.showAlertAcept('Error', 'Error al cerrar proceso', 'error');
      }
    });
  }

  async reabrirProceso(p: Proceso): Promise<void> {
    const ok = await this.alertService.showConfirm('Confirmación', '¿Reabrir este proceso? Se volverá a estado ABIERTO.', 'warning');
    if (!ok) return;

    this.alertService.mostrarModalCarga();
    this.procesoService.reabrir(p.id).subscribe({
      next: () => {
        this.alertService.cerrarModalCarga();
        this.alertService.showAlert('Éxito', 'Proceso reabierto exitosamente', 'success');
        this.cargarDatos();
      },
      error: () => {
        this.alertService.cerrarModalCarga();
        this.alertService.showAlertAcept('Error', 'Error al reabrir proceso', 'error');
      }
    });
  }

  formatearFechaLarga(fecha: string): string {
    if (!fecha) return '';
    const d = moment(fecha);
    return d.format('dddd, D [de] MMMM [de] YYYY');
  }

  formatearFechaCorta(fecha: string): string {
    if (!fecha) return '';
    const d = moment(fecha);
    return d.format('DD/MM/YYYY');
  }

  formatearFechaHora(fecha: string | null): string {
    if (!fecha) return '—';
    const d = moment(fecha);
    return d.format('DD/MM/YYYY, HH:mm');
  }

  limpiarFiltroFecha(): void {
    this.filterFecha.set('');
  }
}
