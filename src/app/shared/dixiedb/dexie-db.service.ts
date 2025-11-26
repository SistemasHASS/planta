import { Injectable } from '@angular/core';
import { Usuario,Configuracion,Fundo,Cultivo,Acopio} from '../interfaces/Tables'
import Dexie from 'dexie';

@Injectable({
  providedIn: 'root'
})

export class DexieService extends Dexie {
  public usuario!: Dexie.Table<Usuario, number>;
  public configuracion!: Dexie.Table<Configuracion, number>;
  public fundos!: Dexie.Table<Fundo, number>;
  public cultivos!: Dexie.Table<Cultivo, number>;
  public acopios!: Dexie.Table<Acopio, string>
  
  constructor() {
    super('Planta');
    console.log('DexieService Constructor - Base de datos inicializada');
    this.version(1).stores({
      usuario: `id,sociedad,ruc,razonSocial,idProyecto,proyecto,documentoIdentidad,usuario,
      clave,nombre,idrol,rol`,
      configuracion: `id,idempresa,fechaproceso,idfundo,idcultivo,horario,idacopio`,
      fundos: `id,codigoFundo,empresa,fundo,nombreFundo`,
      cultivos: `id,cultivo,codigo,descripcion,empresa`,
      acopios: `id,nave,codigoAcopio,acopio`
    });

    this.usuario = this.table('usuario');
    this.configuracion = this.table('configuracion');
    this.fundos = this.table('fundos');
    this.cultivos = this.table('cultivos');
    this.acopios = this.table('acopios');
  }
  //
  async saveConfiguracion(configuracion: Configuracion) { await this.configuracion.put(configuracion); }
  async obtenerConfiguracion() { return await this.configuracion.toCollection().first() } 
  async clearConfiguracion() { await this.configuracion.clear(); }
  //
  async saveUsuario(usuario: Usuario) { await this.usuario.put(usuario); }
  async showUsuario() { return await this.usuario.toCollection().first() }
  async clearUsuario() { await this.usuario.clear(); }
  //
  async saveFundo(fundo: Fundo) { await this.fundos.put(fundo); }
  async saveFundos(fundos: Fundo[]) { await this.fundos.bulkPut(fundos); }
  async showFundos() {return await this.fundos.toArray();}
  async showFundoById(id: number) {return await this.fundos.where('id').equals(id).first()}
  async clearFundos() {await this.fundos.clear();}
  //
  async saveCultivo(cultivo: Cultivo) { await this.cultivos.put(cultivo); }  
  async saveCultivos(cultivos: Cultivo[]) { await this.cultivos.bulkPut(cultivos); }
  async showCultivos() { return await this.cultivos.toArray(); }
  async showCultivoById(id: number) { return await this.cultivos.where('id').equals(id).first() }
  async clearCultivos() { await this.cultivos.clear(); }
  //
  async saveAcopios(params: Acopio[]) {await this.acopios.bulkPut(params);}
  async showAcopios() {return await this.acopios.toArray();}  
  async clearAcopios() {await this.acopios.clear();}
  
  //
  async clearMaestras() {
    await this.clearFundos();
    await this.clearCultivos();
    await this.clearAcopios();
    console.log('Todas las tablas de configuracion han sido limpiadas en indexedDB.');
  }
}