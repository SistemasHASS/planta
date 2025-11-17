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
  // @ViewChild('modalTransportista') modalTransportistaRef!: ElementRef;
  // modalTransportistaInstance!: Modal;

  // localidades: any[] = [];
  // tiposLocalidades: any[] = [
  //   { id: 'I', descripcion: 'INTERNO' },
  //   { id: 'E', descripcion: 'EXTERNO' },
  // ];
  // localidad: Linea = {
  //   id: 0,
  //   codigo: '',
  //   ruc: '',
  //   descripcion: '',
  //   ubicaciones: 0,
  //   color: '',
  //   estado: '',
  //   eliminado: 0
  // };
  // editMode = false;
  // showValidation = false;
  // usuario: Usuario = {
  //   id: '',
  //   documentoidentidad: '',
  //   idproyecto: '',
  //   idrol: '',
  //   nombre: '',
  //   proyecto: '',
  //   razonSocial: '',
  //   rol: '',
  //   ruc: '',
  //   sociedad: 0,
  //   usuario: '',
  //   idempresa: ''
  // }

  // constructor(private maestrasService: MaestrasService, private dexieService: DexieService, private alertService: AlertService) {}

  // async ngOnInit(): Promise<void> {
  //   await this.cargarUsuario();
  //   await this.cargarLocalidades();
  // }

  // async cargarUsuario() {
  //   const usuario =  await this.dexieService.showUsuario();
  //   if (usuario) {
  //     this.usuario = usuario;
  //   }
  // }

  // async cargarLocalidades() {
  //   const localidades = await this.maestrasService.getLocalidades([{ ruc: this.usuario.ruc }]).toPromise();
  //   this.localidades = localidades;
  // }

  // openModal(localidad?: any) {
  //   this.localidad = localidad ? { ...localidad } : {};
  //   this.editMode = !!localidad;

  //   // Inicializa modal si aún no existe
  //   if (!this.modalTransportistaInstance) {
  //     this.modalTransportistaInstance = new Modal(this.modalTransportistaRef.nativeElement);
  //   }
  //   this.modalTransportistaInstance.show();
  // }

  // closeModal() {
  //   this.modalTransportistaInstance?.hide();
  // }

  // guardar() {
  //   this.showValidation = true;
  //   if (!this.localidad.localidad || !this.localidad.tipo) {
  //     return;
  //   }
  //   this.localidad.bestado = 1;
  //   const formato = this.formatoLocalidad(this.localidad);
  //   this.maestrasService.createLocalidades(formato).subscribe({
  //     next: (data) => {
  //       this.cargarLocalidades();
  //       this.closeModal();
  //       this.alertService.showAlert('Localidad creada', 'Creado con exito!', 'success');
  //     },
  //     error: (err) => {
  //       console.error('Error al crear localidad', err);
  //       this.alertService.showAlert('Error al crear localidad', 'Error al crear localidad', 'error');
  //     },
  //   });
  // }

  // formatoLocalidad(t: any) {
  //   return [
	// 		{
	// 			ruc: this.usuario.ruc,
	// 			nrodocumento: this.usuario.documentoidentidad,
	// 			idlocalidad: t.idlocalidad,
	// 			localidad: t.localidad,
	// 			tipo: t.tipo,
  //       bestado: t.bestado
	// 		}
	// 	]
  // }

  // async eliminar(t: any) {
  //   const confirmacion =  await this.alertService.showConfirm('Eliminar Localidad', '¿Está seguro de eliminar esta localidad?', 'warning');
  //   if (confirmacion) {
  //     t.bestado = 0;
  //     const formato = this.formatoLocalidad(t);
  //     this.maestrasService.createLocalidades(formato).subscribe({
  //       next: (data) => {
  //         this.alertService.showAlert('Localidad eliminada', 'Eliminado con exito!', 'success');
  //         this.cargarLocalidades();
  //       },
  //       error: (err) => {console.error('Error al eliminar localidad', err); this.alertService.showAlert('Error al eliminar localidad', 'Error al eliminar localidad', 'error');}
  //     });
  //   }
  // }

  // abrirNuevo() {
  //   this.clearLocalidad();
  //   this.editMode = false;
  //   this.modalTransportistaInstance = new Modal(this.modalTransportistaRef.nativeElement);
  //   this.modalTransportistaInstance.show();
  // }

  // clearLocalidad() {
  //   this.showValidation = false;
  //   this.localidad = {
  //     id: 0,
  //     idlocalidad: 0,
  //     localidad: '',
  //     tipo: '',
  //     bestado: 0
  //   };
  //   this.editMode = false;
  // }

  // editar(c: Localidad) {
  //   this.editMode = true;
  //   this.localidad = {
  //     ...c,
  //   };
  //   this.modalTransportistaInstance = new Modal(this.modalTransportistaRef.nativeElement);
  //   this.modalTransportistaInstance.show();
  // }
}
