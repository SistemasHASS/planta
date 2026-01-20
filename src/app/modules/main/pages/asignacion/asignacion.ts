import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DexieService } from '@/app/shared/dixiedb/dexie-db.service';
import { ProcesosService } from '@/app/modules/main/services/procesos.service';
import { MaestrasService } from '@/app/modules/main/services/maestras.service';
import { AlertService } from '@/app/shared/alertas/alerts.service';
import { UtilsService } from '@/app/shared/utils/utils.service';
import { Linea, Operario, Asignacion, Usuario, Configuracion } from '@/app/shared/interfaces/Tables';
import { v4 as uuidv4 } from 'uuid';

@Component({
  selector: 'app-asignacion',
  imports: [CommonModule, FormsModule],
  templateUrl: './asignacion.html',
  styleUrls: ['./asignacion.scss'],
})
export class AsignacionComponent implements OnInit {
  lineas: Linea[] = [];
  operarios: Operario[] = [];
  asignaciones: Asignacion[] = [];
  asignacionesPorLinea: Map<number, Asignacion[]> = new Map();
  
  lineaSeleccionada: Linea | null = null;
  fechaSeleccionada: string = '';
  
  usuario: Usuario | null = null;
  configuracion: Configuracion | null = null;
  
  pendientesSincronizar: number = 0;
  sincronizando: boolean = false;
  operarioSeleccionadoId: number = 0;

  constructor(
    private dexieService: DexieService,
    private procesosService: ProcesosService,
    private maestrasService: MaestrasService,
    private alertService: AlertService,
    private utilsService: UtilsService
  ) {}

  async ngOnInit() {
    this.fechaSeleccionada = this.utilsService.formatDate3(new Date());
    await this.cargarUsuario();
    await this.cargarConfiguracion();
    await this.cargarLineas();
    await this.cargarOperarios();
    await this.cargarAsignaciones();
    await this.contarPendientes();
  }

  async cargarUsuario() {
    const usuario = await this.dexieService.showUsuario();
    this.usuario = usuario || null;
  }

  async cargarConfiguracion() {
    const config = await this.dexieService.obtenerConfiguracion();
    this.configuracion = config || null;
  }

  async cargarLineas() {
    this.lineas = await this.dexieService.showLineasActivas();
  }

  async cargarOperarios() {
    this.operarios = await this.dexieService.showOperariosActivos();
  }

  async cargarAsignaciones() {
    const asignaciones = await this.dexieService.showAsignacionesByFecha(this.fechaSeleccionada);
    this.asignaciones = asignaciones;
    this.organizarAsignacionesPorLinea();
  }

  organizarAsignacionesPorLinea() {
    this.asignacionesPorLinea.clear();
    for (const asig of this.asignaciones) {
      if (!this.asignacionesPorLinea.has(asig.idlinea)) {
        this.asignacionesPorLinea.set(asig.idlinea, []);
      }
      this.asignacionesPorLinea.get(asig.idlinea)!.push(asig);
    }
  }

  seleccionarLinea(linea: Linea) {
    this.lineaSeleccionada = linea;
  }

  getPosiciones(linea: Linea): number[] {
    return Array.from({ length: linea.espacios }, (_, i) => i + 1);
  }

  getAsignacionEnPosicion(idlinea: number, posicion: number): Asignacion | undefined {
    const asignaciones = this.asignacionesPorLinea.get(idlinea) || [];
    return asignaciones.find(a => a.posicion === posicion && a.estado === 1);
  }

  getOperarioNombre(idoperario: number): string {
    const operario = this.operarios.find(o => o.id === idoperario);
    return operario ? operario.nombrescompletos : 'Sin asignar';
  }

  async asignarOperario(linea: Linea, posicion: number, operario: Operario) {
    if (!this.usuario || !this.configuracion) {
      this.alertService.showAlert('Error', 'No se ha cargado la configuración', 'error');
      return;
    }

    const asignacionExistente = this.getAsignacionEnPosicion(linea.id, posicion);
    
    if (asignacionExistente) {
      const confirmar = await this.alertService.showConfirm(
        'Reasignar posición',
        `¿Desea reasignar esta posición? Actualmente está asignada a ${this.getOperarioNombre(asignacionExistente.idoperario)}`,
        'warning'
      );
      
      if (!confirmar) return;
      
      asignacionExistente.estado = 0;
      await this.dexieService.saveAsignacion(asignacionExistente);
    }

    const nuevaAsignacion: Asignacion = {
      idasignacion: uuidv4(),
      ruc: this.usuario.ruc,
      idlinea: linea.id,
      posicion: posicion,
      idoperario: operario.id,
      fechaproceso: this.fechaSeleccionada,
      idfundo: this.configuracion.idfundo,
      idcultivo: this.configuracion.idcultivo,
      idacopio: this.configuracion.idacopio,
      cliente: this.configuracion.cliente,
      destino: this.configuracion.destino,
      formato: this.configuracion.formato,
      modulo: this.configuracion.modulo,
      variedad: this.configuracion.variedad,
      mercado: this.configuracion.mercado,
      estado: 1,
      sincronizado: 0,
      fechaasignacion: new Date().toISOString()
    };

    await this.dexieService.saveAsignacion(nuevaAsignacion);
    await this.cargarAsignaciones();
    await this.contarPendientes();
    
    this.alertService.showAlert('Éxito', 'Operario asignado correctamente', 'success');
  }

  async removerAsignacion(asignacion: Asignacion) {
    const confirmar = await this.alertService.showConfirm(
      'Remover asignación',
      '¿Está seguro de remover esta asignación?',
      'warning'
    );
    
    if (!confirmar) return;

    asignacion.estado = 0;
    await this.dexieService.saveAsignacion(asignacion);
    await this.cargarAsignaciones();
    await this.contarPendientes();
    
    this.alertService.showAlert('Éxito', 'Asignación removida', 'success');
  }

  async contarPendientes() {
    const pendientes = await this.dexieService.showAsignacionesPendientes();
    this.pendientesSincronizar = pendientes.length;
  }

  async sincronizar() {
    if (!navigator.onLine) {
      this.alertService.showAlert('Sin conexión', 'Necesita internet para sincronizar', 'warning');
      return;
    }

    const pendientes = await this.dexieService.showAsignacionesPendientes();
    
    if (pendientes.length === 0) {
      this.alertService.showAlert('Sin cambios', 'No hay asignaciones pendientes de sincronizar', 'info');
      return;
    }

    this.sincronizando = true;
    
    try {
      const resultado = await this.procesosService.syncAsignaciones(pendientes);
      
      if (resultado && resultado.success) {
        for (const asig of pendientes) {
          await this.dexieService.updateAsignacionSincronizada(asig.idasignacion, 1);
        }
        
        await this.contarPendientes();
        this.alertService.showAlert('Éxito', `${pendientes.length} asignaciones sincronizadas correctamente`, 'success');
      } else {
        this.alertService.showAlert('Error', 'Error al sincronizar asignaciones', 'error');
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
  }

  async asignarOperarioPorId(linea: Linea, posicion: number) {
    const operario = this.operarios.find(o => o.id === this.operarioSeleccionadoId);
    if (operario) {
      await this.asignarOperario(linea, posicion, operario);
      this.operarioSeleccionadoId = 0;
    }
  }
}
