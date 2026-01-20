import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DexieService } from '@/app/shared/dixiedb/dexie-db.service';
import { ProcesosService } from '@/app/modules/main/services/procesos.service';
import { AlertService } from '@/app/shared/alertas/alerts.service';
import { UtilsService } from '@/app/shared/utils/utils.service';
import { Asignacion, Conteo, Usuario, Operario, Linea } from '@/app/shared/interfaces/Tables';

@Component({
  selector: 'app-conteo',
  imports: [CommonModule, FormsModule],
  templateUrl: './conteo.html',
  styleUrl: './conteo.scss',
})
export class ConteoComponent implements OnInit {
  asignaciones: any[] = [];
  conteos: Conteo[] = [];
  totalesPorAsignacion: Map<string, number> = new Map();
  cantidadesPorAsignacion: Map<string, number> = new Map();
  
  operarios: Operario[] = [];
  lineas: Linea[] = [];
  
  fechaSeleccionada: string = '';
  usuario: Usuario | null = null;
  
  pendientesSincronizar: number = 0;
  sincronizando: boolean = false;

  constructor(
    private dexieService: DexieService,
    private procesosService: ProcesosService,
    private alertService: AlertService,
    private utilsService: UtilsService
  ) {}

  async ngOnInit() {
    this.fechaSeleccionada = this.utilsService.formatDate3(new Date());
    await this.cargarUsuario();
    await this.cargarOperarios();
    await this.cargarLineas();
    await this.cargarAsignaciones();
    await this.cargarConteos();
    await this.contarPendientes();
  }

  async cargarUsuario() {
    const usuario = await this.dexieService.showUsuario();
    this.usuario = usuario || null;
  }

  async cargarOperarios() {
    this.operarios = await this.dexieService.showOperariosActivos();
  }

  async cargarLineas() {
    this.lineas = await this.dexieService.showLineasActivas();
  }

  async cargarAsignaciones() {
    const asignaciones = await this.dexieService.showAsignacionesByFecha(this.fechaSeleccionada);
    
    this.asignaciones = asignaciones
      .filter(a => a.estado === 1)
      .map(a => {
        const linea = this.lineas.find(l => l.id === a.idlinea);
        return {
          ...a,
          nombreoperario: this.getOperarioNombre(a.idoperario),
          nombrelinea: this.getLineaNombre(a.idlinea),
          color: linea?.color || '#6c757d',
          codigolinea: linea?.codigo || ''
        };
      });
  }

  async cargarConteos() {
    this.conteos = await this.dexieService.showConteosByFecha(this.fechaSeleccionada);
    this.calcularTotales();
  }

  calcularTotales() {
    this.totalesPorAsignacion.clear();
    for (const conteo of this.conteos) {
      const actual = this.totalesPorAsignacion.get(conteo.idasignacion) || 0;
      this.totalesPorAsignacion.set(conteo.idasignacion, actual + conteo.cantidad);
    }
  }

  getOperarioNombre(idoperario: number): string {
    const operario = this.operarios.find(o => o.id === idoperario);
    return operario ? operario.nombrescompletos : 'Operario desconocido';
  }

  getLineaNombre(idlinea: number): string {
    const linea = this.lineas.find(l => l.id === idlinea);
    return linea ? linea.linea : 'Línea desconocida';
  }

  getTotalCajas(idasignacion: string): number {
    return this.totalesPorAsignacion.get(idasignacion) || 0;
  }

  async registrarConteo(asignacion: any) {
    const cantidad = this.cantidadesPorAsignacion.get(asignacion.idasignacion) || 0;
    
    if (!cantidad || cantidad <= 0) {
      this.alertService.showAlert('Error', 'Debe ingresar una cantidad válida', 'warning');
      return;
    }

    if (!this.usuario) {
      this.alertService.showAlert('Error', 'No se ha cargado el usuario', 'error');
      return;
    }

    const nuevoConteo: Conteo = {
      idconteo: this.generarIdConteo(),
      ruc: this.usuario.ruc,
      idasignacion: asignacion.idasignacion,
      idoperario: asignacion.idoperario,
      idlinea: asignacion.idlinea,
      cantidad: cantidad,
      fechaproceso: this.fechaSeleccionada,
      fecharegistro: new Date().toISOString(),
      sincronizado: 0
    };

    await this.dexieService.saveConteo(nuevoConteo);
    await this.cargarConteos();
    await this.contarPendientes();
    
    this.cantidadesPorAsignacion.set(asignacion.idasignacion, 0);
    this.alertService.showAlert('Éxito', `${cantidad} cajas registradas. Total: ${this.getTotalCajas(asignacion.idasignacion)}`, 'success');
  }

  getCantidadInput(idasignacion: string): number {
    return this.cantidadesPorAsignacion.get(idasignacion) || 0;
  }

  setCantidadInput(idasignacion: string, cantidad: number) {
    this.cantidadesPorAsignacion.set(idasignacion, cantidad);
  }

  generarIdConteo(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  async contarPendientes() {
    const pendientes = await this.dexieService.showConteosPendientes();
    this.pendientesSincronizar = pendientes.length;
  }

  async sincronizar() {
    if (!navigator.onLine) {
      this.alertService.showAlert('Sin conexión', 'Necesita internet para sincronizar', 'warning');
      return;
    }

    const pendientes = await this.dexieService.showConteosPendientes();
    
    if (pendientes.length === 0) {
      this.alertService.showAlert('Sin cambios', 'No hay conteos pendientes de sincronizar', 'info');
      return;
    }

    this.sincronizando = true;
    
    try {
      const resultado = await this.procesosService.syncConteos(pendientes);
      
      if (resultado && resultado.success) {
        for (const conteo of pendientes) {
          await this.dexieService.updateConteoSincronizado(conteo.idconteo, 1);
        }
        
        await this.contarPendientes();
        this.alertService.showAlert('Éxito', `${pendientes.length} conteos sincronizados correctamente`, 'success');
      } else {
        this.alertService.showAlert('Error', 'Error al sincronizar conteos', 'error');
      }
    } catch (error: any) {
      console.error('Error sincronizando:', error);
      this.alertService.showAlert('Error', error.message || 'Error al sincronizar', 'error');
    } finally {
      this.sincronizando = false;
    }
  }

  async cambiarFecha() {
    await this.cargarAsignaciones();
    await this.cargarConteos();
  }
}
