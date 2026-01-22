import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { Modal } from 'bootstrap';
import { MaestrasService } from '@/app/modules/main/services/maestras.service';
import { Linea, Usuario } from '@/app/shared/interfaces/Tables';
import { DexieService } from '@/app/shared/dixiedb/dexie-db.service';
import { AlertService } from '@/app/shared/alertas/alerts.service';
import dayjs from 'dayjs';

@Component({
  selector: 'app-mantenedor-lineas',
  imports: [CommonModule, FormsModule, TableModule, ButtonModule],
  templateUrl: './mantenedor-lineas.html',
  styleUrl: './mantenedor-lineas.scss',
})

export class MantenedorLineasComponent {
  @ViewChild('modalLinea') modalLineaRef!: ElementRef;
  modalLineaInstance!: Modal;
  lineas: any[] = [];
  linea: Linea = {
    id: 0,
    ruc: '',
    linea: '',
    espacios: 0,
    color: '',
    estado: 0,
    tipo: '',
    codigo: ''
  };
  editMode = false;
  showValidation = false;
  usuario: Usuario = {
    id: '',
    documentoidentidad: '',
    idproyecto: '',
    idrol: '',
    nombre: '',
    proyecto: '',
    razonSocial: '',
    rol: '',
    ruc: '',
    sociedad: 0,
    usuario: '',
    idempresa: ''
  }

  constructor(
    private maestrasService: MaestrasService, 
    private dexieService: DexieService, 
    private alertService: AlertService
  ) {}

  async ngOnInit(): Promise<void> {
    await this.cargarUsuario();
    await this.cargarLineas();
  }

  async cargarUsuario() {
    const usuario = await this.dexieService.showUsuario();
    if (usuario) {
      this.usuario = usuario;
    }
  }

  async cargarLineas() {
    this.maestrasService.getLineasProduccion([{ruc: this.usuario.ruc}]).subscribe(
      (lineas) => {
        this.lineas = lineas;
      }
    );
  }

  openModal(linea?: any) {
    this.linea = linea ? { ...linea } : {};
    this.editMode = !!linea;
    if (!this.modalLineaInstance) {
      this.modalLineaInstance = new Modal(this.modalLineaRef.nativeElement);
    }
    this.modalLineaInstance.show();
  }

  closeModal() {
    this.modalLineaInstance?.hide();
  }

  async guardar() {
    this.showValidation = true;
    if (!this.linea.linea || !this.linea.espacios || !this.linea.color || !this.linea.tipo) {
      return;
    }
    this.linea.estado = 1;
    
    if (!this.editMode) {
      this.linea.codigo = await this.generarCodigo(this.linea.tipo);
    }
    
    const formato = this.formatoLinea(this.linea);
    this.maestrasService.crudLineaProduccion(formato).subscribe({
      next: (data) => {
        this.cargarLineas();
        this.closeModal();
        this.alertService.showAlert('Línea creada', 'Creado con éxito!', 'success');
      },
      error: (err) => {
        console.error('Error al crear línea', err);
        this.alertService.showAlert('Error al crear línea', 'Error al crear línea', 'error');
      },
    });
  }

  formatoLinea(l: any) {
    return [
      {
        ruc: this.usuario.ruc,
        idlineaprodempa: l.id || 0,
        linea: l.linea,
        espacios: l.espacios,
        color: l.color || '',
        estado: l.estado,
        tipo: l.tipo || '',
        codigo: l.codigo || ''
      }
    ]
  }

  async generarCodigo(tipo: string): Promise<string> {
    const tipoLetra = tipo === 'M' ? 'M' : 'H';
    const lineasMismoTipo = this.lineas.filter(l => l.tipo === tipo && l.estado === 1);
    const correlativo = lineasMismoTipo.length + 1;
    const correlativoFormateado = correlativo.toString().padStart(4, '0');
    return `${this.usuario.ruc}${tipoLetra}${correlativoFormateado}`;
  }

  async eliminar(l: any) {
    const confirmacion = await this.alertService.showConfirm('Eliminar Línea', '¿Está seguro de eliminar la línea?', 'warning');
    if (confirmacion) {
      l.estado = 0;
      const formato = this.formatoLinea(l);
      this.maestrasService.crudLineaProduccion(formato).subscribe({
        next: (data) => {
          this.alertService.showAlert('Línea eliminada', 'Eliminado con éxito!', 'success');
          this.cargarLineas();
        },
        error: (err) => {
          console.error('Error al eliminar línea', err);
          this.alertService.showAlert('Error al eliminar línea', 'Error al eliminar línea', 'error');
        }
      });
    }
  }

  abrirNuevo() {
    this.clearLinea();
    this.editMode = false;
    this.modalLineaInstance = new Modal(this.modalLineaRef.nativeElement);
    this.modalLineaInstance.show();
  }

  clearLinea() {
    this.showValidation = false;
    this.linea = {
      id: 0,
      ruc: '',
      linea: '',
      espacios: 0,
      color: '',
      estado: 0,
      tipo: '',
      codigo: ''
    };
    this.editMode = false;
  }

  editar(l: Linea) {
    this.clearLinea();
    this.editMode = true;
    this.linea = {
      ...l
    };
    this.modalLineaInstance = new Modal(this.modalLineaRef.nativeElement);
    this.modalLineaInstance.show();
  }
}
