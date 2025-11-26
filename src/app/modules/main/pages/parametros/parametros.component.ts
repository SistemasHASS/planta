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

  cultivos: any[] = [];
  fundos: any[] = [];
  empresas: any[] = [];
  acopios: any[] = [];
  horarios: any[] = [];
  
  configuracion: Configuracion = {
    id: '',
    idempresa: '',
    fechaproceso: '',
    idfundo: '',
    idcultivo: '',
    horario: '',
    idacopio: ''
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
      this.llenarDropdowns();
    }
  }

  async llenarDropdowns() {

  }

  async sincronizarTablasMaestras() {
    //Empresa
    const empresas = await this.maestrasService.getEmpresas([{ruc: this.usuario?.ruc}])
    if(!!empresas && empresas.length) { 
      // await this.dexieService.saveEmpresas(empresas)
      await this.ListarEmpresas()
      this.alertService.showAlert('¡Éxito!','La operación se completó correctamente','success')
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
    //Acopio
    const acopios = await this.maestrasService.getAcopios([{ ruc: this.usuario?.ruc }])
    if(!!acopios && acopios.length) { 
      await this.dexieService.saveAcopios(acopios);
      await this.ListarAcopios();
    }
  }

  async ListarFundos() {
    this.fundos = await this.dexieService.showFundos();
  }

  async ListarCultivos() {
    this.cultivos = await this.dexieService.showCultivos();
  }

  async ListarEmpresas() {
    // this.empresas = await this.dexieService.showEmpresas();

  }

  async ListarAcopios() {
    this.acopios = await this.dexieService.showAcopios();
  }

  async guardarConfiguracion() {
    this.showValidation = true;
    if(this.configuracion.idempresa && this.configuracion.idfundo && this.configuracion.idcultivo && this.configuracion.idacopio && this.configuracion.horario) {
      await this.dexieService.saveConfiguracion(this.configuracion);
      this.alertService.showAlert('Alerta!','Configuración guardada correctamente', 'success');
    } else {
      this.alertService.showAlert('Alerta!','Debe completar todos los campos', 'warning');
    }
  }

}
