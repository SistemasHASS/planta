import { Component, ChangeDetectionStrategy, inject, signal, OnInit, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ProcesoService } from '../../shared/services/proceso.service';
import { CatalogoService } from '../../shared/services/catalogo.service';
import { AuthService } from '../../shared/services/auth.service';
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
  readonly permissions = inject(PermissionService);

  procesos = signal<Proceso[]>([]);
  procesosActivos = signal<Proceso[]>([]);
  acopios = signal<any[]>([]);
  campanias = signal<any[]>([]);
  isLoading = signal(true);
  isCreating = signal(false);
  errorMsg = signal('');
  successMsg = signal('');
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
    console.log('🔍 Computando campaniaActiva, lista:', lista);
    const activa = lista.find(c => c.Activa) ?? lista[0] ?? null;
    console.log('🔍 Campaña activa encontrada:', activa);
    return activa;
  });

  readonly historial = computed(() => {
    const fecha = this.filterFecha();
    const lista = this.procesos();
    if (!fecha) return lista;
    return lista.filter(p => {
      if (!p.FechaProceso) return false;
      const fechaProceso = p.FechaProceso.split('T')[0];
      return fechaProceso === fecha;
    });
  });

  nuevoProceso = signal<{ fechaProceso: string; turno: string; supervisores: number[]; logisticos: number[] }>({
    fechaProceso: new Date().toISOString().split('T')[0],
    turno: '',
    supervisores: [],
    logisticos: []
  });

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
    console.log('📋 Cargando campaña activa...');
    this.catalogoService.obtenerCampaniaActiva().subscribe({
      next: (res: any) => {
        console.log('✅ Respuesta campaña activa:', res);
        console.log('✅ Data:', res?.data);
        console.log('✅ Res directo:', res);
        
        const campaniaActiva = res?.data ?? res;
        console.log('📋 Campaña activa procesada:', campaniaActiva);
        
        if (campaniaActiva && campaniaActiva.Id) {
          this.campanias.set([campaniaActiva]);
          console.log('✅ Campaña establecida:', campaniaActiva.Nombre);
        } else {
          this.campanias.set([]);
          console.log('❌ No se encontró campaña activa válida');
        }
      },
      error: (err: any) => {
        console.error('❌ Error cargando campaña activa:', err);
        console.error('❌ Status:', err?.status);
        console.error('❌ Error completo:', err);
        this.campanias.set([]);
      }
    });
    
    this.procesoService.listar({ estado: 'TODOS' }).subscribe({
      next: (res: any) => {
        const raw = res?.data ?? res;
        const data = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : Array.isArray(raw?.items) ? raw.items : [];
        this.procesos.set(data);
        this.isLoading.set(false);
      },
      error: () => { this.errorMsg.set('Error al cargar procesos'); this.isLoading.set(false); }
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
        console.error('❌ Error cargando procesos por acopio:', err);
        this.procesosActivos.set([]);
        this.isLoading.set(false);
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
      this.errorMsg.set('Máximo 2 supervisores permitidos');
      return;
    }
    this.nuevoProceso.update(prev => ({ ...prev, supervisores: selectedIds }));
  }

  onLogisticosChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const selectedIds = Array.from(select.selectedOptions).map(o => Number(o.value));
    if (selectedIds.length > 5) {
      this.errorMsg.set('Máximo 5 personal de logística permitidos');
      return;
    }
    this.nuevoProceso.update(prev => ({ ...prev, logisticos: selectedIds }));
  }

  crearProceso(): void {
    const np = this.nuevoProceso();
    const usr = this.usuario();
    if (!np.fechaProceso || !np.turno) {
      this.errorMsg.set('Complete la fecha y el turno.');
      return;
    }
    if (!np.supervisores || np.supervisores.length < 1 || np.supervisores.length > 2) {
      this.errorMsg.set('Seleccione entre 1 y 2 supervisores.');
      return;
    }
    if (!np.logisticos || np.logisticos.length < 1 || np.logisticos.length > 5) {
      this.errorMsg.set('Seleccione entre 1 y 5 personal de logística.');
      return;
    }
    this.isCreating.set(true);
    this.errorMsg.set('');
    this.procesoService.crear({
      fechaProceso: np.fechaProceso,
      turno: np.turno,
      acopioId: usr?.acopioId ?? 0,
      usuarioId: usr?.id ?? 1,
      campaniaId: this.campaniaActiva()?.Id ?? null,
      supervisores: np.supervisores,
      logisticos: np.logisticos
    }).subscribe({
      next: () => {
        this.isCreating.set(false);
        this.successMsg.set('Proceso abierto exitosamente');
        this.nuevoProceso.set({ fechaProceso: new Date().toISOString().split('T')[0], turno: '', supervisores: [], logisticos: [] });
        this.cargarDatos();
        setTimeout(() => this.successMsg.set(''), 3000);
      },
      error: (err: unknown) => {
        this.isCreating.set(false);
        const errObj = err as Record<string, unknown>;
        const errBody = errObj['error'] as Record<string, string> | undefined;
        const msg = errBody?.['message'] ?? 'Error al crear proceso';
        this.errorMsg.set(msg);
      }
    });
  }

  cerrarProceso(p: Proceso): void {
    const usr = this.usuario();
    this.procesoService.cerrar(p.Id, usr?.id ?? 1).subscribe({
      next: () => {
        this.successMsg.set('Proceso cerrado exitosamente');
        this.cargarDatos();
        setTimeout(() => this.successMsg.set(''), 3000);
      },
      error: () => this.errorMsg.set('Error al cerrar proceso')
    });
  }

  reabrirProceso(p: Proceso): void {
    if (!confirm('¿Reabrir este proceso? Se volverá a estado ABIERTO.')) return;
    this.procesoService.reabrir(p.Id).subscribe({
      next: () => {
        this.successMsg.set('Proceso reabierto exitosamente');
        this.cargarDatos();
        setTimeout(() => this.successMsg.set(''), 3000);
      },
      error: () => this.errorMsg.set('Error al reabrir proceso')
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
