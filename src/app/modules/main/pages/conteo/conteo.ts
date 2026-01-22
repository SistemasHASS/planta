import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DexieService } from '@/app/shared/dixiedb/dexie-db.service';
import { AlertService } from '@/app/shared/alertas/alerts.service';
import { Linea, Operario, Asignacion, Conteo as ConteoInterface, Usuario, Configuracion } from '@/app/shared/interfaces/Tables';
import { Modal } from 'bootstrap';
import moment from 'moment';

interface LineaConOperarios extends Linea {
  operariosAsignados: Operario[];
  conteos: ConteoInterface[];
}

@Component({
  selector: 'app-conteo',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './conteo.html',
  styleUrl: './conteo.scss',
})
export class Conteo implements OnInit {
  @ViewChild('modalConteo') modalConteoRef!: ElementRef;

  usuario: Usuario = {} as Usuario;
  configuracion: Configuracion = {} as Configuracion;
  lineas: LineaConOperarios[] = [];
  lineaSeleccionada: LineaConOperarios | null = null;
  operariosConConteo: any[] = [];
  fechaProceso: string = '';
  
  modalConteoInstance: any;
  cargando: boolean = false;

  constructor(
    private dexieService: DexieService,
    private alertService: AlertService
  ) {}

  async ngOnInit(): Promise<void> {
    await this.cargarUsuario();
    await this.cargarConfiguracion();
    this.fechaProceso = moment().format('YYYY-MM-DD');
    await this.cargarLineasConOperarios();
  }

  async cargarUsuario() {
    const usuario = await this.dexieService.showUsuario();
    if (usuario) {
      this.usuario = usuario;
    }
  }

  async cargarConfiguracion() {
    const config = await this.dexieService.obtenerConfiguracion();
    if (config) {
      this.configuracion = config;
    }
  }

  async cargarLineasConOperarios() {
    this.cargando = true;
    try {
      const lineasActivas = await this.dexieService.showLineasActivas();
      
      this.lineas = await Promise.all(
        lineasActivas.map(async (linea: Linea) => {
          const operariosAsignados = linea.operariosAsignados || [];
          const conteos = await this.dexieService.showConteosByFecha(this.fechaProceso);
          const conteosLinea = conteos.filter(c => c.idlinea === linea.id);
          
          return {
            ...linea,
            operariosAsignados,
            conteos: conteosLinea
          } as LineaConOperarios;
        })
      );

      console.log('Líneas con operarios cargadas:', this.lineas);
    } catch (error) {
      console.error('Error cargando líneas:', error);
      this.alertService.showAlert('Error', 'Error al cargar las líneas', 'error');
    } finally {
      this.cargando = false;
    }
  }

  tieneOperarios(linea: LineaConOperarios): boolean {
    return linea.operariosAsignados && linea.operariosAsignados.length > 0;
  }

  getContadorOperarios(linea: LineaConOperarios): number {
    return linea.operariosAsignados?.length || 0;
  }

  getTotalConteo(linea: LineaConOperarios): number {
    return linea.conteos?.reduce((sum, c) => sum + (c.cantidad || 0), 0) || 0;
  }

  async abrirModalConteo(linea: LineaConOperarios) {
    if (!this.tieneOperarios(linea)) {
      this.alertService.showAlert(
        'Sin Operarios',
        'Esta línea no tiene operarios asignados. Por favor, asigne operarios desde el módulo de Ajustes de Línea.',
        'warning'
      );
      return;
    }

    this.lineaSeleccionada = linea;
    
    this.operariosConConteo = linea.operariosAsignados.map(operario => {
      const conteoExistente = linea.conteos.find(c => c.idoperario === operario.id);
      return {
        ...operario,
        cantidad: conteoExistente?.cantidad || 0,
        idconteo: conteoExistente?.idconteo || null,
        sincronizado: conteoExistente?.sincronizado || 0
      };
    });

    this.modalConteoInstance = new Modal(this.modalConteoRef.nativeElement);
    this.modalConteoInstance.show();
  }

  cerrarModalConteo() {
    if (this.modalConteoInstance) {
      this.modalConteoInstance.hide();
    }
    this.lineaSeleccionada = null;
    this.operariosConConteo = [];
  }

  async guardarConteos() {
    if (!this.lineaSeleccionada) return;

    try {
      const conteosAGuardar: ConteoInterface[] = this.operariosConConteo.map(op => {
        const idconteo = op.idconteo || `${this.usuario.ruc}-${this.lineaSeleccionada!.id}-${op.id}-${this.fechaProceso}-${Date.now()}`;
        
        return {
          idconteo,
          ruc: this.usuario.ruc,
          idasignacion: '',
          idoperario: op.id,
          idlinea: this.lineaSeleccionada!.id,
          cantidad: op.cantidad || 0,
          fechaproceso: this.fechaProceso,
          fecharegistro: moment().format('YYYY-MM-DD HH:mm:ss'),
          sincronizado: 0
        };
      });

      await this.dexieService.saveConteos(conteosAGuardar);
      
      await this.cargarLineasConOperarios();
      
      this.alertService.showAlert(
        '¡Éxito!',
        'Conteos guardados correctamente',
        'success'
      );
      
      this.cerrarModalConteo();
    } catch (error) {
      console.error('Error guardando conteos:', error);
      this.alertService.showAlert('Error', 'Error al guardar los conteos', 'error');
    }
  }

  incrementarCantidad(operario: any) {
    operario.cantidad = (operario.cantidad || 0) + 1;
  }

  decrementarCantidad(operario: any) {
    if (operario.cantidad > 0) {
      operario.cantidad--;
    }
  }

  limpiarConteos() {
    this.operariosConConteo.forEach(op => {
      op.cantidad = 0;
    });
  }

  getColorFondo(color: string): string {
    return color || '#6c757d';
  }

  getColorTexto(color: string): string {
    if (!color) return '#ffffff';
    
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    
    return brightness > 128 ? '#000000' : '#ffffff';
  }

  getTotalOperariosConteo(): number {
    return this.operariosConConteo.reduce((sum, op) => sum + (op.cantidad || 0), 0);
  }
}
