import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { DexieService } from '@/app/shared/dixiedb/dexie-db.service';
import { Configuracion } from '@/app/shared/interfaces/Tables';
import { MaestrasService } from '../../services/maestras.service';
import { UtilsService } from '@/app/shared/utils/utils.service';
import { AlertService } from '@/app/shared/alertas/alerts.service';
import { Usuario } from '@/app/shared/interfaces/Tables';

@Component({
  selector: 'app-parametros',
  standalone: true,
  imports: [CommonModule,FormsModule],
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
  }

  async sincronizarTablasMaestras() {
    if (!navigator.onLine) {
      this.alertService.showAlert('Sin conexión', 'Necesita internet para sincronizar', 'warning');
      return;
    }

    this.sincronizando = true;
    
    try {
       //Acopio
      const acopios = await this.maestrasService.getAcopios([{ idempresa:'' }])
      if(!!acopios && acopios.length) { 
        await this.dexieService.saveAcopios(acopios);
        await this.ListarAcopios();
      }
      //Empresa
      const empresas = await this.maestrasService.getEmpresas([{ruc: this.usuario?.ruc}])
      if(!!empresas && empresas.length) { 
        await this.dexieService.saveEmpresas(empresas)
        await this.ListarEmpresas()
      }
      
      //Fundo
      const fundos = await this.maestrasService.getFundos([{ruc: this.usuario?.ruc}])
      if(!!fundos && fundos.length) { 
        await this.dexieService.saveFundos(fundos);
        await this.ListarFundos();
      }
      
      //Cultivo
      const cultivos = await this.maestrasService.getCultivos([{idempresa: this.usuario?.idempresa}])
      if(!!cultivos && cultivos.length) {  
        await this.dexieService.saveCultivos(cultivos); 
        await this.ListarCultivos();
      }

      //Cliente
      const clientes = await this.maestrasService.getClientes([{aplicacion:'PLANTA'}])
      if(!!clientes && clientes.length) { 
        await this.dexieService.saveClientes(clientes);
        await this.ListarClientes();
      }

      //Destino
      const destinos = await this.maestrasService.getDestinos([{aplicacion:'PLANTA'}])
      if(!!destinos && destinos.length) { 
        await this.dexieService.saveDestinos(destinos);
        await this.ListarDestinos();
      }

      //Formato
      const formatos = await this.maestrasService.getFormatos([{ idempresa : this.usuario?.idempresa, aplicacion : 'PLANTA' }])
      if(!!formatos && formatos.length) { 
        await this.dexieService.saveFormatos(formatos);
        await this.ListarFormatos();
      }

      this.maestrasService.getModulos(this.usuario?.idempresa).subscribe(
        async (resp)=> {
          if(!!resp && resp.length) {
            await this.dexieService.saveModulos(resp);
            await this.ListarModulos();
          }
        }
      );

      this.maestrasService.getLotes(this.usuario?.sociedad).subscribe(
        async (resp)=> {
          if(!!resp && resp.length) {
            await this.dexieService.saveLotes(resp);
            await this.ListarLotes();
          }
        }
      );

      this.maestrasService.getTurnos(this.usuario?.idempresa).subscribe(
        async (resp)=> {
          if(!!resp && resp.length) {
            await this.dexieService.saveTurnos(resp);
            await this.ListarTurnos();
          }
        }
      );

      //Variedad
      const variedades = await this.maestrasService.getVariedades([{ruc: this.usuario?.ruc}])
      if(!!variedades && variedades.length) { 
        await this.dexieService.saveVariedades(variedades);
        await this.ListarVariedades();
      }
      
      //Lineas
      const lineas = await this.maestrasService.getLineasProduccion([{ruc: this.usuario?.ruc}])
      if(!!lineas && lineas.length) { 
        await this.dexieService.saveLineas(lineas);
        await this.ListarLineas();
      }

      //Operarios
      const operarios = await this.maestrasService.getOperarios([{ruc: this.usuario?.ruc}])
      if(!!operarios && operarios.length) { 
        await this.dexieService.saveOperarios(operarios);
        await this.ListarOperarios();
      }

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
    if(this.cultivos.length === 1) {
      this.configuracion.idcultivo = this.cultivos[0].codigoCultivo;
    }
  }

  async ListarEmpresas() {
    this.empresas = await this.dexieService.showEmpresas();
  }

  async ListarClientes() {
    this.clientes = await this.dexieService.showClientes();
  }

  async ListarDestinos() {
    this.destinos = await this.dexieService.showDestinos();
  }

  async ListarFormatos() {
    this.formatos = await this.dexieService.showFormatos();
  }

  async ListarModulos() {
    this.modulos = await this.dexieService.showModulos();
  }

  async ListarLotes() {
    this.lotes = await this.dexieService.showLotes();
  }

  async ListarTurnos() {
    this.turnos = await this.dexieService.showTurnos();
  }

  async ListarVariedades() {
    this.variedades = await this.dexieService.showVariedades();
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

  async guardarConfiguracion() {
    this.showValidation = true;
    // if(this.configuracion.idempresa && this.configuracion.idfundo && this.configuracion.idcultivo && 
    //    this.configuracion.idacopio && this.configuracion.horario && this.configuracion.cliente && 
    //    this.configuracion.destino && this.configuracion.formato && this.configuracion.modulo && 
    //    this.configuracion.variedad && this.configuracion.mercado) {
      this.configuracion.id = this.usuario.documentoidentidad;
      await this.dexieService.saveConfiguracion(this.configuracion);
      this.alertService.showAlert('¡Éxito!','Configuración guardada correctamente', 'success');
    // } else {
    //   this.alertService.showAlert('Alerta!','Debe completar todos los campos', 'warning');
    // }
  }

}
