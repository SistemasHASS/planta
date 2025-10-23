import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';
import moment from 'moment';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { DexieService } from '@/app/shared/dixiedb/dexie-db.service';
import { ConnectivityService } from '../../services/connectivity.service';
import { AlertService } from '@/app/shared/alertas/alerts.service';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.scss'
})
export class LayoutComponent {
  fechaHoy: string = '';
  currentPath: string = '';
  usuario: any;
  isOnline: boolean = true;
  
  constructor(
    private router: Router,
    private connectivityService : ConnectivityService,
    private dexieService: DexieService,
    private alertService: AlertService
  ) {}
  
  async ngOnInit() {
    this.connectivityService.isOnline.subscribe((status: boolean) => {
      this.isOnline = status;
    });

    this.updateCurrentPath();
    this.router.events.subscribe(()=>{
      this.updateCurrentPath()
    })
    this.fechaHoy = this.getDate();
    this.usuario = await this.dexieService.showUsuario()
  }
  async logout() {
    const sinenviar = await this.dexieService.showTrabajadoresPlanillaSinEnviar()
    if(sinenviar.length > 0) {
      Swal.fire({
        title: 'Alerta!',
        text: 'Por favor cierre toda su planilla y sincronice',
        icon: 'info',
        showConfirmButton: false,
        timer: 2000
      })
    } else {
      Swal.fire({
        title: '¿Estás seguro?',
        text: 'Confirma que desea cerrar sesión',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, deseo salir',
        cancelButtonText: 'Cancelar',
        customClass: {
          confirmButton: 'btn btn-primary',
          cancelButton: 'btn btn-warning'
        },
        buttonsStyling: false // para aplicar tus propias clases
      }).then((result) => {
        if (result.isConfirmed) {
          this.router.navigate(['auth/login']);
          localStorage.clear()
          this.dexieService.clearConfiguracion();
          this.dexieService.clearUsuario();
          this.dexieService.clearMaestras();
          this.dexieService.clearDatosEnviados();
        }
      });
    }
  }

  formatNombre(nombre: string): string {
    if (!nombre) return ''; // Verifica si el nombre está vacío
  
    // Divide el nombre completo por espacios
    const partes = nombre.split(' ');
  
    // Asegúrate de que haya al menos un nombre y un apellido
    if (partes.length < 2) return ''; // Si no hay apellido, no hace nada
  
    // El primer nombre y el primer apellido
    const primerNombre = partes[0];
    const primerApellido = partes[1];
  
    // Devuelve el primer nombre y el primer apellido con la primera letra en mayúscula y el resto en minúscula
    return primerNombre.charAt(0).toUpperCase() + primerNombre.slice(1).toLowerCase() + ' ' +
          primerApellido.charAt(0).toUpperCase() + primerApellido.slice(1).toLowerCase();
  }

  formatNombreInicio(nombre: string): string {
    if (!nombre) return '';
    const words = nombre.toLowerCase().split(' ');
    if (words.length === 0) return '';
    words[0] = words[0].charAt(0).toUpperCase() + words[0].slice(1);
    return words.join(' ');
  }

  toggleSidebar() {
    const mainWrapper = document.getElementById('main-wrapper');
    if (window.matchMedia('(max-width: 1200px)').matches) {
      if (mainWrapper) {
        if (mainWrapper.classList.contains('show-sidebar')) {
          mainWrapper.setAttribute('data-sidebartype', 'mini-sidebar');
          mainWrapper.classList.remove('show-sidebar');
        } else {
          mainWrapper.setAttribute('data-sidebartype', 'full');
          mainWrapper.classList.toggle('show-sidebar');
        }
      }
    } else {
      if (mainWrapper) {
        mainWrapper.setAttribute('data-sidebartype', 'full');
        mainWrapper.classList.remove('show-sidebar');
      }
    }
  }

  getDate() {
    return moment(new Date()).format('YYYY-MM-DD')
  }
  updateCurrentPath() {
    const currentUrl = this.router.url.split('/').filter(Boolean);
    const pathMap: { [key: string]: string } = {
      'parametros': 'Parámetros',
      'configuracionaprobaciones': 'Roles de aprobación',
      'mantenedorincidencias': 'Mantenedor incidencias',
      'planillas' : 'Planillas',
      'reportes': 'Asistencias',
      'adicional': 'Planilla adicional',
      'incidencias': 'Incidencias',
      'bonos': 'Bonos',
      'aprobaciones': 'Aprobaciones'
    };
    
    this.currentPath = pathMap[currentUrl[currentUrl.length - 1]] || '';
  }

}
