import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { Modal } from 'bootstrap';
import { MaestrasService } from '@/app/modules/main/services/maestras.service';
import { Linea, Usuario, Configuracion, Operario } from '@/app/shared/interfaces/Tables';
import { DexieService } from '@/app/shared/dixiedb/dexie-db.service';
import { AlertService } from '@/app/shared/alertas/alerts.service';

@Component({
  selector: 'app-ajustes-linea',
  imports: [CommonModule, FormsModule, TableModule, ButtonModule],
  templateUrl: './ajustes-linea.html',
  styleUrl: './ajustes-linea.scss',
})
export class AjustesLinea implements OnInit {
  vistaActual: 'lista' | 'configuracion' | 'operarios' = 'lista';

  lineas: Linea[] = [];
  lineaSeleccionada: Linea | null = null;
  operariosDisponibles: Operario[] = [];
  operariosAsignados: Operario[] = [];
  operarioSeleccionado: number = 0;

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
  };

  configuracion: Configuracion = {
    id: '',
    idempresa: '',
    fechaproceso: '',
    idfundo: '',
    idcultivo: '',
    horario: '',
    idacopio: '',
    cliente: '',
    destino: '',
    formato: '',
    modulo: '',
    turno: '',
    lote: '',
    variedad: '',
    mercado: ''
  };

  acopios: any[] = [];
  fundos: any[] = [];
  cultivos: any[] = [];
  clientes: any[] = [];
  destinos: any[] = [];
  formatos: any[] = [];
  modulos: any[] = [];
  turnos: any[] = [];
  lotes: any[] = [];
  variedades: any[] = [];
  allVariedades: any[] = [];
  mercados: any[] = [];
  showValidation = false;
  variedadesFiltradas: any[] = [];

  constructor(
    private maestrasService: MaestrasService,
    private dexieService: DexieService,
    private alertService: AlertService
  ) {}

  async ngOnInit(): Promise<void> {
    await this.cargarUsuario();
    await this.cargarOperarios();
    await this.cargarParametrosGlobales();
    await this.cargarLineas();
    // this.sincronizarLineas();
  }

  async cargarUsuario() {
    const usuario = await this.dexieService.showUsuario();
    if (usuario) {
      this.usuario = usuario;
    }
  }

  sincronizarLineas() {
    if (navigator.onLine && this.usuario.ruc) {
      this.maestrasService.getLineasProduccion([{ ruc: this.usuario.ruc }]).subscribe(
        async (lineas) => {
          if (lineas && lineas.length) {
            const lineasExistentes = await this.dexieService.showLineas();
            const lineasActualizadas = lineas.map((lineaAPI: any) => {
              const lineaExistente = lineasExistentes.find(l => l.id === lineaAPI.id);
              return {
                ...lineaAPI,
                configuraciones: lineaExistente?.configuraciones || undefined,
                operariosAsignados: lineaExistente?.operariosAsignados || []
              };
            });
            await this.dexieService.saveLineas(lineasActualizadas);
            await this.cargarLineas();
          }
        }
      );
    }
  }

  async cargarLineas() {
    const todasLineas = await this.dexieService.showLineas();
    console.log('Todas las líneas en Dexie:', todasLineas);
    this.lineas = await this.dexieService.showLineasActivas();
    console.log('Líneas activas (estado=1):', this.lineas);
  }

  async cargarOperarios() {
    this.operariosDisponibles = await this.dexieService.showOperariosActivos();
  }

  async cargarParametrosGlobales() {
    const config = await this.dexieService.obtenerConfiguracion();
    if (config) {
      this.configuracion = { ...config };
    }
    await this.cargarDropdowns();
  }

  async cargarDropdowns() {
    this.acopios = await this.dexieService.showAcopios();
    this.fundos = await this.dexieService.showFundos();
    this.cultivos = await this.dexieService.showCultivos();
    this.clientes = await this.dexieService.showClientes();
    const destinosData = await this.dexieService.showDestinos();
    this.destinos = destinosData.map((d: any) => ({
      ...d,
      destinoCompleto: `${d.mercado} - ${d.destino}`
    }));
    this.formatos = await this.dexieService.showFormatos();
    const modulosData = await this.dexieService.showModulos();
    this.modulos = modulosData.filter((m: any) => m.idcultivo === '0802');
    this.allVariedades = await this.dexieService.showVariedades();
    this.variedadesFiltradas = [];
    this.mercados = await this.dexieService.showMercados();
  }

  onModuloChange(moduloId: any) {
    this.configuracion.variedad = '';
    
    if (!moduloId) {
      this.variedadesFiltradas = [];
      return;
    }

    this.filtrarVariedadesPorModulo(moduloId);
  }

  filtrarVariedadesPorModulo(moduloId: string) {
    this.variedadesFiltradas = this.allVariedades.filter((variedad: any) => variedad.idmodulo === moduloId);
    
    if (this.variedadesFiltradas.length === 1) {
      this.configuracion.variedad = this.variedadesFiltradas[0].idvariedad;
    }
  }

  abrirVistaConfiguracion(linea: Linea) {
    this.lineaSeleccionada = linea;
    if (linea.configuraciones) {
      this.configuracion = { ...linea.configuraciones };
      if (this.configuracion.modulo) {
        this.filtrarVariedadesPorModulo(this.configuracion.modulo);
      }
    } else {
      this.cargarParametrosGlobales();
    }
    this.showValidation = false;
    this.vistaActual = 'configuracion';
  }

  volverALista() {
    this.vistaActual = 'lista';
    this.lineaSeleccionada = null;
    this.showValidation = false;
  }

  async guardarConfiguracion() {
    this.showValidation = true;

    const isValid = 
      this.configuracion.idfundo != null && this.configuracion.idfundo !== '' &&
      this.configuracion.idcultivo != null && this.configuracion.idcultivo !== '' &&
      this.configuracion.idacopio != null && this.configuracion.idacopio !== '' &&
      this.configuracion.horario != null && this.configuracion.horario !== '' &&
      this.configuracion.cliente != null && this.configuracion.cliente !== '' &&
      this.configuracion.destino != null && this.configuracion.destino !== '' &&
      this.configuracion.formato != null && this.configuracion.formato !== '' &&
      this.configuracion.modulo != null && this.configuracion.modulo !== '' &&
      this.configuracion.variedad != null && this.configuracion.variedad !== '';

    if (isValid && this.lineaSeleccionada) {
      this.lineaSeleccionada.configuraciones = { ...this.configuracion };
      await this.dexieService.saveLinea(this.lineaSeleccionada);
      await this.cargarLineas();
      this.volverALista();
      this.alertService.showAlert('¡Éxito!', 'Configuración guardada correctamente', 'success');
    } else {
      this.alertService.showAlert('Alerta!', 'Debe completar todos los campos', 'warning');
    }
  }

  abrirVistaOperarios(linea: Linea) {
    this.lineaSeleccionada = linea;
    this.operariosAsignados = linea.operariosAsignados || [];
    this.operarioSeleccionado = 0;
    this.vistaActual = 'operarios';
  }

  async agregarOperario() {
    if (!this.operarioSeleccionado || this.operarioSeleccionado === 0) {
      this.alertService.showAlert('Alerta', 'Debe seleccionar un operario', 'warning');
      return;
    }

    const operario = this.operariosDisponibles.find(o => o.id === this.operarioSeleccionado);
    if (!operario) {
      return;
    }

    const yaAsignado = this.operariosAsignados.some(o => o.id === operario.id);
    if (yaAsignado) {
      this.alertService.showAlert('Alerta', 'Este operario ya está asignado a esta línea', 'warning');
      return;
    }

    this.operariosAsignados.push(operario);
    if (this.lineaSeleccionada) {
      this.lineaSeleccionada.operariosAsignados = [...this.operariosAsignados];
      await this.dexieService.saveLinea(this.lineaSeleccionada);
      await this.cargarLineas();
    }
    this.operarioSeleccionado = 0;
    this.alertService.showAlert('¡Éxito!', 'Operario asignado correctamente', 'success');
  }

  async eliminarOperario(operario: Operario) {
    const confirmacion = await this.alertService.showConfirm(
      'Eliminar Operario',
      '¿Está seguro de eliminar este operario de la línea?',
      'warning'
    );

    if (confirmacion && this.lineaSeleccionada) {
      this.operariosAsignados = this.operariosAsignados.filter(o => o.id !== operario.id);
      this.lineaSeleccionada.operariosAsignados = [...this.operariosAsignados];
      await this.dexieService.saveLinea(this.lineaSeleccionada);
      await this.cargarLineas();
      this.alertService.showAlert('¡Éxito!', 'Operario eliminado correctamente', 'success');
    }
  }

  tieneConfiguracion(linea: Linea): boolean {
    return !!linea.configuraciones;
  }

  tieneOperarios(linea: Linea): boolean {
    return !!linea.operariosAsignados && linea.operariosAsignados.length > 0;
  }
}
