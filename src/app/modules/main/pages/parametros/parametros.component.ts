import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { DexieService } from '@/app/shared/dixiedb/dexie-db.service';
import { Configuracion } from '@/app/shared/interfaces/Tables';
import { MaestrasService } from '../../services/maestras.service';
import { UtilsService } from '@/app/shared/utils/utils.service';
import { AlertService } from '@/app/shared/alertas/alerts.service';
import { Usuario } from '@/app/shared/interfaces/Tables';
import { DropdownComponent } from '@/app/modules/main/components/dropdown/dropdown.component';

@Component({
  selector: 'app-parametros',
  standalone: true,
  imports: [CommonModule,FormsModule,DropdownComponent],
  templateUrl: './parametros.component.html',
  styleUrl: './parametros.component.scss'
})
export class ParametrosComponent {

  constructor(
    private dexieService: DexieService,
    private maestrasService: MaestrasService,
    private utilsService: UtilsService,
    private alertService: AlertService
  ) {}

  empresas: any[] = [];
  cultivos: any[] = [];
  fundos: any[] = [];
  acopios: any[] = [];
  horarios: any[] = [];
  clientes: any[] = [];
  destinos: any[] = [];
  formatos: any[] = [];
  modulos: any[] = [];
  variedades: any[] = [];
  allVariedades: any[] = [];
  mercados: any[] = [];
  lineas: any[] = [];
  operarios: any[] = [];
  lotes: any[] = [];
  turnos: any[] = [];
  sincronizando: boolean = false;
  
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
  }

  usuario: Usuario = {
    documentoidentidad: '',
    id: '',
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

  showValidation: boolean = false;

  async ngOnInit() {
    await this.getUsuario()
    await this.validarExisteConfiguracion()
    this.llenarDropdowns();
  }

  async getUsuario() {
    const usuario = await this.dexieService.showUsuario();
    if (usuario) { this.usuario = usuario } else { console.log('Error', 'Usuario not found', 'error');}
  }

  async validarExisteConfiguracion() {
    this.configuracion.fechaproceso = this.utilsService.formatDate3(new Date());
    const configuracion = await this.dexieService.obtenerConfiguracion();
    if(configuracion) {
      this.configuracion = configuracion;
      // this.llenarDropdowns();
    }
  }

  async llenarDropdowns() {
    await this.ListarEmpresas();
    await this.ListarAcopios();
    await this.ListarFundos();
    await this.ListarCultivos();    
    await this.ListarClientes();
    await this.ListarDestinos();
    await this.ListarFormatos();
    await this.ListarModulos();
    await this.ListarVariedades();
    await this.ListarMercados();
    await this.ListarLotes();
    await this.ListarTurnos();
    
    if (this.configuracion.modulo) {
      this.variedades = this.allVariedades.filter((variedad: any) => variedad.idmodulo === this.configuracion.modulo);
    }
  }

  async sincronizarTablasMaestras() {
    if (!navigator.onLine) {
      this.alertService.showAlert('Sin conexión', 'Necesita internet para sincronizar', 'warning');
      return;
    }
    this.sincronizando = true;
    try {
      const acopios = await this.maestrasService.getAcopios([{ idempresa:'' }])
      if(!!acopios && acopios.length) { 
        await this.dexieService.saveAcopios(acopios);
        await this.ListarAcopios();
      }
      
      this.maestrasService.getFundos([{ruc: this.usuario?.ruc}]).subscribe(
        async (resp)=> {
          if(!!resp && resp.length) {
            await this.dexieService.saveFundos(resp);
            await this.ListarFundos();
          }
        }
      );
      
      this.maestrasService.getCultivos([{idempresa: this.usuario?.idempresa}]).subscribe(
        async (resp)=> {
          if(!!resp && resp.length) {  
            await this.dexieService.saveCultivos(resp); 
            await this.ListarCultivos();
          }
        }
      );

      this.maestrasService.getClientes([{aplicacion:'PLANTA'}]).subscribe(
        async (resp)=> {
          if(!!resp && resp.length) { 
            await this.dexieService.saveClientes(resp);
            await this.ListarClientes();
          }
        }
      );

      this.maestrasService.getDestinos([{aplicacion:'PLANTA'}]).subscribe(
        async (resp)=> {
          if(!!resp && resp.length) { 
            await this.dexieService.saveDestinos(resp);
            await this.ListarDestinos();
          }
        }
      );

      this.maestrasService.getFormatos([{ idempresa : this.usuario?.idempresa, aplicacion : 'PLANTA' }]).subscribe(
        async (resp)=> {
          if(!!resp && resp.length) { 
            await this.dexieService.saveFormatos(resp);
            await this.ListarFormatos();
          }
        }
      );

      this.maestrasService.getModulos([{ idempresa: this.usuario?.idempresa, aplicacion:'PLANTA'}]).subscribe(
        async (resp)=> {
          if(!!resp && resp.length) {
            await this.dexieService.saveModulos(resp);
            await this.ListarModulos();
          }
        }
      );

      // this.maestrasService.getLotes(this.usuario?.idempresa).subscribe(
      //   async (resp)=> {
      //     if(!!resp && resp.length) {
      //       await this.dexieService.saveLotes(resp);
      //       await this.ListarLotes();
      //     }
      //   }
      // );

      // this.maestrasService.getTurnos(this.usuario?.idempresa).subscribe(
      //   async (resp)=> {
      //     if(!!resp && resp.length) {
      //       await this.dexieService.saveTurnos(resp);
      //       await this.ListarTurnos();
      //     }
      //   }
      // );

      this.maestrasService.getVariedades([{ idempresa: this.usuario?.idempresa, aplicacion:'PLANTA'}]).subscribe(
        async (resp) => {
          if(!!resp && resp.length) {
            await this.dexieService.saveVariedades(resp);
            await this.ListarVariedades();
          }
        }
      );
      
      this.maestrasService.getLineasProduccion([{ruc: this.usuario?.ruc}]).subscribe(
        async (lineas) => {
          if(!!lineas && lineas.length) {
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
            await this.ListarLineas();
          }
        }
      );

      this.maestrasService.getOperarios([{ruc: this.usuario?.ruc}]).subscribe(
        async (operarios) => {
          if(!!operarios && operarios.length) {
            await this.dexieService.saveOperarios(operarios);
            await this.ListarOperarios();
          }
        }
      );

      this.alertService.showAlert('¡Éxito!','Todos los catálogos sincronizados correctamente','success');
    } catch (error: any) {
      console.error('Error sincronizando:', error);
      this.alertService.showAlert('Error', error.message || 'Error al sincronizar catálogos', 'error');
    } finally {
      this.sincronizando = false;
    }
  }

  async ListarAcopios() {
    const acopiostotales = await this.dexieService.showAcopios();
    this.acopios = acopiostotales.filter((acopio: any) => acopio.ruc === this.usuario.ruc);
    if(this.acopios.length === 1) {
      this.configuracion.idacopio = this.acopios[0].codigoAcopio;
    }
  }

  async ListarFundos() {
    const fundostotales = await this.dexieService.showFundos();
    this.fundos = fundostotales.filter((fundo: any) => fundo.empresa === this.usuario.sociedad);
    if(this.fundos.length === 1) {
      this.configuracion.idfundo = this.fundos[0].codigoFundo;
    }
  }

  async ListarCultivos() {
    const cultivos = await this.dexieService.showCultivos();
    this.cultivos = cultivos.filter((cultivo: any) => cultivo.empresa === this.usuario.sociedad);
    this.configuracion.idcultivo = '0802';
  }

  async ListarModulos() {
    const modulos = await this.dexieService.showModulos();
    // console.log('m: ', modulos)
    this.modulos = modulos.filter((m: any) => m.idcultivo == '0802')
  }

  async ListarEmpresas() {
    this.empresas = await this.dexieService.showEmpresas();
  }

  async ListarClientes() {
    this.clientes = await this.dexieService.showClientes();
  }

  async ListarDestinos() {
    const destinosData = await this.dexieService.showDestinos();
    this.destinos = destinosData.map((d: any) => ({
      ...d,
      destinoCompleto: `${d.mercado} - ${d.destino}`
    }));
  }

  async ListarFormatos() {
    this.formatos = await this.dexieService.showFormatos();
  }

  

  async ListarLotes() {
    const allLotes = await this.dexieService.showLotes();
    this.lotes = allLotes.filter((lote: any) => lote.codcultivo === '0802');
  }

  async ListarTurnos() {
    this.turnos = await this.dexieService.showTurnos();
  }

  async ListarVariedades() {
    this.allVariedades = await this.dexieService.showVariedades();
    this.variedades = [];
  }

  onModuloChange(moduloId: any) {
    this.configuracion.variedad = '';
    
    if (!moduloId) {
      this.variedades = [];
      return;
    }

    this.variedades = this.allVariedades.filter((variedad: any) => variedad.idmodulo === moduloId);
    
    if (this.variedades.length === 1) {
      this.configuracion.variedad = this.variedades[0].idvariedad;
    }
  }

  async ListarMercados() {
    this.mercados = await this.dexieService.showMercados();
  }

  async ListarLineas() {
    this.lineas = await this.dexieService.showLineas();
  }

  async ListarOperarios() {
    this.operarios = await this.dexieService.showOperarios();
  }

  onLoteChange(loteId: any) {
    if (!loteId) {
      this.configuracion.modulo = '';
      this.configuracion.turno = '';
      this.configuracion.variedad = '';
      this.variedades = [...this.allVariedades];
      return;
    }

    const selectedLote = this.lotes.find((lote: any) => lote.id === loteId);
    if (selectedLote) {
      this.configuracion.modulo = selectedLote.codmodulo;
      
      const selectedTurno = this.turnos.find((turno: any) => turno.id === selectedLote.turno);
      if (selectedTurno) {
        this.configuracion.turno = selectedTurno.id;
      }
      
      this.variedades = this.allVariedades.filter((variedad: any) => variedad.lote === selectedLote.lote);
      
      if (this.variedades.length === 1) {
        this.configuracion.variedad = this.variedades[0].codigo;
      } else {
        this.configuracion.variedad = '';
      }
    }
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
    
    if(isValid) {
      this.configuracion.id = this.usuario.documentoidentidad;
      await this.dexieService.saveConfiguracion(this.configuracion);
      this.alertService.showAlert('¡Éxito!','Configuración guardada correctamente', 'success');
    } else {
      this.alertService.showAlert('Alerta!','Debe completar todos los campos', 'warning');
    }
  }

}
