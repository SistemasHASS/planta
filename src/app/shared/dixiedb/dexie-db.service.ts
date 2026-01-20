import { Injectable } from '@angular/core';
import { Usuario, Configuracion, Fundo, Cultivo, Acopio, Empresa, Linea, Operario, Asignacion, Conteo, Cliente, Destino, Formato, Modulo, Turno, Lote, Variedad, Mercado } from '../interfaces/Tables'
import Dexie from 'dexie';

@Injectable({
  providedIn: 'root'
})

export class DexieService extends Dexie {
  public usuario!: Dexie.Table<Usuario, number>;
  public configuracion!: Dexie.Table<Configuracion, number>;
  public fundos!: Dexie.Table<Fundo, number>;
  public cultivos!: Dexie.Table<Cultivo, number>;
  public acopios!: Dexie.Table<Acopio, string>;
  public empresas!: Dexie.Table<Empresa, string>;
  public lineas!: Dexie.Table<Linea, number>;
  public operarios!: Dexie.Table<Operario, number>;
  public asignaciones!: Dexie.Table<Asignacion, string>;
  public conteos!: Dexie.Table<Conteo, string>;
  public clientes!: Dexie.Table<Cliente, number>;
  public destinos!: Dexie.Table<Destino, number>;
  public formatos!: Dexie.Table<Formato, number>;
  public modulos!: Dexie.Table<Modulo, number>;
  public lotes!: Dexie.Table<Lote, number>;
  public turnos!: Dexie.Table<Turno, number>;
  public variedades!: Dexie.Table<Variedad, number>;
  public mercados!: Dexie.Table<Mercado, number>;

  constructor() {
    super('Planta');
    console.log('DexieService Constructor - Base de datos inicializada');
    this.version(1).stores({
      usuario: `id,sociedad,ruc,razonSocial,idProyecto,proyecto,documentoIdentidad,usuario,clave,nombre,idrol,rol`,
      empresas: `id,idempresa,ruc,razonsocial,empresa`,
      configuracion: `id,idempresa,fechaproceso,idfundo,idcultivo,horario,idacopio,cliente,destino,formato,modulo,variedad,mercado`,
      fundos: `id,codigoFundo,empresa,fundo,nombreFundo`,
      cultivos: `id,cultivo,codigo,descripcion,empresa`,
      acopios: `id,nave,codigoAcopio,acopio`,
      lineas: `id,ruc,linea,espacios,color,tipo,codigo,estado`,
      operarios: `id,ruc,dni,nombres,apellidopaterno,apellidomaterno,nombrescompletos,estado`,
      asignaciones: `idasignacion,ruc,idlinea,posicion,idoperario,fechaproceso,estado,sincronizado`,
      conteos: `idconteo,ruc,idasignacion,idoperario,idlinea,fechaproceso,sincronizado`,
      clientes: `id,codigo,nombre`,
      destinos: `iddestino,codigo,nombre`,
      formatos: `id,codigo,descripcion`,
      modulos: `id,codigo,descripcion`,
      turnos: `id,codigo,descripcion`,
      lotes: `id,codigo,descripcion`,
      variedades: `id,codigo,descripcion`,
      mercados: `id,codigo,nombre`
    });

    this.usuario = this.table('usuario');
    this.configuracion = this.table('configuracion');
    this.empresas = this.table('empresas');
    this.fundos = this.table('fundos');
    this.cultivos = this.table('cultivos');
    this.acopios = this.table('acopios');
    this.lineas = this.table('lineas');
    this.operarios = this.table('operarios');
    this.asignaciones = this.table('asignaciones');
    this.conteos = this.table('conteos');
    this.clientes = this.table('clientes');
    this.destinos = this.table('destinos');
    this.formatos = this.table('formatos');
    this.modulos = this.table('modulos');
    this.lineas = this.table('lineas');
    this.turnos = this.table('turnos');
    this.variedades = this.table('variedades');
    this.mercados = this.table('mercados');
    this.lotes = this.table('lotes');
    this.turnos = this.table('turnos');
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
  async saveEmpresa(empresa: Empresa) {await this.empresas.put(empresa);}
  async saveEmpresas(empresas: Empresa[]) {await this.empresas.bulkPut(empresas);}
  async showEmpresas() {return await this.empresas.orderBy('razonsocial').toArray();}
  async showEmpresaById(id: string) {return await this.empresas.where('id').equals(id).first()}
  async clearEmpresas() {await this.empresas.clear();}
  //
  async clearMaestras() {
    await this.clearFundos();
    await this.clearCultivos();
    await this.clearAcopios();
    await this.clearClientes();
    await this.clearDestinos();
    await this.clearFormatos();
    await this.clearModulos();
    await this.clearVariedades();
    await this.clearMercados();
    console.log('Todas las tablas de configuracion han sido limpiadas en indexedDB.');
  }
  //
  async saveLinea(linea: Linea) { await this.lineas.put(linea); }
  async saveLineas(lineas: Linea[]) { await this.lineas.bulkPut(lineas); }
  async showLineas() { return await this.lineas.toArray(); }
  async showLineasActivas() { return await this.lineas.where('estado').equals(1).toArray(); }
  async showLineaById(id: number) { return await this.lineas.where('id').equals(id).first(); }
  async clearLineas() { await this.lineas.clear(); }
  //
  async saveOperario(operario: Operario) { await this.operarios.put(operario); }
  async saveOperarios(operarios: Operario[]) { await this.operarios.bulkPut(operarios); }
  async showOperarios() { return await this.operarios.toArray(); }
  async showOperariosActivos() { return await this.operarios.where('estado').equals(1).toArray(); }
  async showOperarioById(id: number) { return await this.operarios.where('id').equals(id).first(); }
  async clearOperarios() { await this.operarios.clear(); }
  //
  async saveAsignacion(asignacion: Asignacion) { await this.asignaciones.put(asignacion); }
  async saveAsignaciones(asignaciones: Asignacion[]) { await this.asignaciones.bulkPut(asignaciones); }
  async showAsignaciones() { return await this.asignaciones.toArray(); }
  async showAsignacionesByFecha(fecha: string) { 
    return await this.asignaciones.where('fechaproceso').equals(fecha).toArray(); 
  }
  async showAsignacionesPendientes() { 
    return await this.asignaciones.where('sincronizado').equals(0).toArray(); 
  }
  async updateAsignacionSincronizada(idasignacion: string, sincronizado: number) { 
    await this.asignaciones.update(idasignacion, { sincronizado }); 
  }
  async deleteAsignacion(idasignacion: string) { 
    await this.asignaciones.delete(idasignacion); 
  }
  async clearAsignaciones() { await this.asignaciones.clear(); }
  //
  async saveConteo(conteo: Conteo) { await this.conteos.put(conteo); }
  async saveConteos(conteos: Conteo[]) { await this.conteos.bulkPut(conteos); }
  async showConteos() { return await this.conteos.toArray(); }
  async showConteosByFecha(fecha: string) { 
    return await this.conteos.where('fechaproceso').equals(fecha).toArray(); 
  }
  async showConteosPendientes() { 
    return await this.conteos.where('sincronizado').equals(0).toArray(); 
  }
  async updateConteoSincronizado(idconteo: string, sincronizado: number) { 
    await this.conteos.update(idconteo, { sincronizado }); 
  }
  async clearConteos() { await this.conteos.clear(); }
  //
  async saveClientes(clientes: Cliente[]) { await this.clientes.bulkPut(clientes); }
  async showClientes() { return await this.clientes.toArray(); }
  async clearClientes() { await this.clientes.clear(); }
  //
  async saveDestinos(destinos: Destino[]) { await this.destinos.bulkPut(destinos); }
  async showDestinos() { return await this.destinos.toArray(); }
  async clearDestinos() { await this.destinos.clear(); }
  //
  async saveFormatos(formatos: Formato[]) { await this.formatos.bulkPut(formatos); }
  async showFormatos() { return await this.formatos.toArray(); }
  async clearFormatos() { await this.formatos.clear(); }
  //
  async saveModulos(modulos: Modulo[]) { await this.modulos.bulkPut(modulos); }
  async showModulos() { return await this.modulos.toArray(); }
  async clearModulos() { await this.modulos.clear(); }
  //
  async saveTurnos(turnos: Turno[]) { await this.turnos.bulkPut(turnos); }
  async showTurnos() { return await this.turnos.toArray(); }
  async clearTurnos() { await this.turnos.clear(); }
  //
  async saveLotes(lotes: Lote[]) { await this.lotes.bulkPut(lotes); }
  async showLotes() { return await this.lotes.toArray(); }
  async clearLotes() { await this.lotes.clear(); }
  //
  async saveVariedades(variedades: Variedad[]) { await this.variedades.bulkPut(variedades); }
  async showVariedades() { return await this.variedades.toArray(); }
  async clearVariedades() { await this.variedades.clear(); }
  //
  async saveMercados(mercados: Mercado[]) { await this.mercados.bulkPut(mercados); }
  async showMercados() { return await this.mercados.toArray(); }
  async clearMercados() { await this.mercados.clear(); }
}