import { Injectable } from '@angular/core';
import { Usuario,Configuracion,Fundo,Cultivo,Acopio,Ceco,Labor, 
  Trabajador, Incidencia,IncidenciaPersona, TareoAsistencia,
  TrabajadorPlanilla,PlanillasAdicional,MotivoSalida,PersonaFlujoAprobacion,
  BonosPersona,
  Turno} from '../interfaces/Tables'
import Dexie from 'dexie';

@Injectable({
  providedIn: 'root'
})

export class DexieService extends Dexie {
  public usuario!: Dexie.Table<Usuario, number>;
  public configuracion!: Dexie.Table<Configuracion, number>;
  public fundos!: Dexie.Table<Fundo, number>;
  public cultivos!: Dexie.Table<Cultivo, number>;
  public turnos!: Dexie.Table<Turno, number>;
  public acopios!: Dexie.Table<Acopio, string>
  public cecos!: Dexie.Table<Ceco, number>;
  public labor!: Dexie.Table<Labor, number>;
  public trabajadores!: Dexie.Table<Trabajador, string>;
  public trabajadoresPlanilla!: Dexie.Table<TrabajadorPlanilla, string>;
  public incidenciaPersona!: Dexie.Table<IncidenciaPersona, string>;
  public tareoAsistencia!: Dexie.Table<TareoAsistencia,string>;
  public planillasAdicional!: Dexie.Table<PlanillasAdicional, string>;
  public incidencias!: Dexie.Table<Incidencia, string>;
  public motivoSalida!: Dexie.Table<MotivoSalida, number>;
  public personaFlujo!: Dexie.Table<PersonaFlujoAprobacion, number>;
  public bonosPersona!: Dexie.Table<BonosPersona, string>
  
  constructor() {
    super('Tareo');
    console.log('DexieService Constructor - Base de datos inicializada');
    this.version(1).stores({
      usuario: `id,sociedad,ruc,razonSocial,idProyecto,proyecto,documentoIdentidad,usuario,
      clave,nombre,idrol,rol`,
      configuracion: `id,idfundo,idcultivo,idacopio,fechatareo,idceco,idlabor,fechainiciorefrigerio,
      horainiciorefrigerio,fechafinrefrigerio,horafinrefrigerio,horainiciojornada,idturno`,
      fundos: `id,codigoFundo,empresa,fundo,nombreFundo`,
      cultivos: `id,cultivo,codigo,descripcion,empresa`,
      turnos: 'id,codTurno,turno,nombreTurno,modulo',
      acopios: `id,nave,codigoAcopio,acopio`,
      cecos: `id,costcenter,localname`,
      labor: `id,costcenterdestinationgroup,costcenterdestination,localname`,
      trabajadores: `id,ruc,nrodocumento,nombres,apellidopaterno,apellidomaterno,estado,motivo,
      bloqueado,eliminado,idmotivo,motivosalida`,
      trabajadoresPlanilla: `nrodocumento,nombre,fechatareo,idfundo,idcultivo,idacopio,hora_inicio,
      fecha_fintareo,hora_fin,horas,fecha_iniciorefrigerio,hora_iniciorefrigerio,fecha_finrefrigerio,hora_finrefrigerio,
      horas_refrigerio,turno,motivosalida,disabled,checked,eliminado,estado,cerrado,idmotivocierre,labores`,
      tareoAsistencia: `idtareo_asistencia,ruc,nrodocumentosupervisor,fecha,tipo,fundo,codfundo,cultivo,codcultivo,planilla`,
      incidenciaPersona: `nrodocumento,idincidencia,fechainicio,fechafin,nombrePersona,
      nombreIncidencia,anular,glosa,aprobado,checked`,
      planillasAdicional: `id,idfundo,idcultivo,idacopio,fechatareo,hora_inicio,fecha_fintareo,
      hora_fin,horas,enviado,eliminado,trabajadores`,
      incidencias: `idincidencia,incidencia,estado,ruc`,
      motivoSalida: `idmotivo,ruc,motivo,estado`,
      personaFlujo: `nrodocumento,nombrePersona,rol,movimientos`,
      bonosPersona: `nrodocumento,nombres,ceco,labor,turno,monto,totalH,eliminado`
    });

    this.usuario = this.table('usuario');
    this.configuracion = this.table('configuracion');
    this.fundos = this.table('fundos');
    this.cultivos = this.table('cultivos');
    this.acopios = this.table('acopios');
    this.cecos = this.table('cecos');
    this.labor = this.table('labor');
    this.trabajadores = this.table('trabajadores')
    this.trabajadoresPlanilla = this.table('trabajadoresPlanilla')
    this.incidenciaPersona = this.table('incidenciaPersona')
    this.tareoAsistencia = this.table('tareoAsistencia')
    this.planillasAdicional = this.table('planillasAdicional')
    this.incidencias = this.table('incidencias')
    this.motivoSalida = this.table('motivoSalida')
    this.personaFlujo = this.table('personaFlujo')
    this.bonosPersona = this.table('bonosPersona')
  }

  async saveUsuario(usuario: Usuario) {await this.usuario.put(usuario);}
  async showUsuario() {return await this.usuario.toCollection().first()}
  async clearUsuario() {await this.usuario.clear();}

  async saveFundo(fundo: Fundo) {await this.fundos.put(fundo);}
  async saveFundos(fundos: Fundo[]) {await this.fundos.bulkPut(fundos);}
  async showFundos() {return await this.fundos.toArray();}
  async showFundoById(id: number) {return await this.fundos.where('id').equals(id).first()}
  async clearFundos() {await this.fundos.clear();}
  //
  async saveCultivo(cultivo: Cultivo) {await this.cultivos.put(cultivo);}  
  async saveCultivos(cultivos: Cultivo[]) {await this.cultivos.bulkPut(cultivos);}
  async showCultivos() {return await this.cultivos.toArray();}
  async showCultivoById(id: number) {return await this.cultivos.where('id').equals(id).first()}
  async clearCultivos() {await this.cultivos.clear();}
  //
  async saveAcopios(params: Acopio[]) {await this.acopios.bulkPut(params);}
  async showAcopios() {return await this.acopios.toArray();}
  async clearAcopios() {await this.acopios.clear();}
  //
  async saveCecos(params: Ceco[]) {await this.cecos.bulkPut(params);}
  async showCecosById(id: any) {return await this.cecos.where('id').equals(id).first();}
  async showCecos() {return await this.cecos.toArray();}
  async clearCecos() {await this.cecos.clear();}
  //
  async saveLabores(params: Labor[]) {await this.labor.bulkPut(params);}
  async showLaboresById(id: any) {return await this.labor.where('id').equals(id).first();}
  async showLabores() {return await this.labor.toArray();}
  async clearLabores() {await this.labor.clear();}
  //
  async saveTurno(turno: Turno) {await this.turnos.put(turno);}
  async saveTurnos(turnos: Turno[]) {await this.turnos.bulkPut(turnos);}
  async showTurnos() {return await this.turnos.toArray();}
  async showTurnoById(id: number) {return await this.turnos.where('id').equals(id).first()}
  async ShowTurnosByIdTurno(idturno: number) { return await this.turnos.filter(turno => turno.id == idturno).toArray()}
  async clearTurnos() {await this.turnos.clear();}
  //
  async saveIncidencias(params: Incidencia[]) {await this.incidencias.bulkPut(params);}
  async showIncidencias() {return await this.incidencias.toArray();}
  async showIncidenciasById(id: any) {return await this.incidencias.where('idincidencia').equals(id).first();}
  //
  async saveTrabajadores(params: Trabajador[]) {await this.trabajadores.bulkPut(params);}
  async saveTrabajador(params: Trabajador) {await this.trabajadores.put(params);}
  async showTrabajadorById(id: any) { return await this.trabajadores.where('id').equals(id).first(); }
  async showTrabajadores() { return await this.trabajadores.toArray(); }
  async deleteTrabajador(id: any) { return await this.trabajadores.where('id').equals(id).delete(); }
  //
  async saveTareos(params: TareoAsistencia[]) { await this.tareoAsistencia.bulkPut(params); }
  async saveTareo(params: TareoAsistencia) { await this.tareoAsistencia.put(params); }
  async showTareosById(id: any) { return await this.tareoAsistencia.where('idtareo_asistencia').equals(id).first(); }
  // async updateTareoEnviado(id: any, enviado: number) { await this.tareoAsistencia.update(id, { estado : enviado }) }
  async showTareos() { return await this.tareoAsistencia.toArray(); }
  //
  async savePlanillaAdicionales(params: PlanillasAdicional[]) { await this.planillasAdicional.bulkPut(params); }
  async savePlanillaAdicional(params: PlanillasAdicional) { await this.planillasAdicional.put(params); }
  async showPlanillaAdicionalById(id: any) { return await this.planillasAdicional.where('id').equals(id).first(); }
  async showPlanillaAdicionales() { return await this.planillasAdicional.toArray(); }
  async updatePlanillaAdicionalEnviado(id:any){return await this.planillasAdicional.update(id, {estado : 1})}
  async updateTrabajadoresPlanillaAdicional(id: any, trabajadores: any) { 
    await this.planillasAdicional.update(id, { trabajadores : trabajadores }) }
  async deletePlanillaAdicional(id: any) { 
    await this.planillasAdicional.where('id').equals(id).delete(); }
  //
  async saveTrabajadoresPlanilla(params: TrabajadorPlanilla[]) {await this.trabajadoresPlanilla.bulkPut(params);}
  async saveTrabajadorPlanilla(params: TrabajadorPlanilla) {await this.trabajadoresPlanilla.put(params);}
  async showTrabajdorPlanillaById(id: any) {return await this.trabajadoresPlanilla.where('nrodocumento').equals(id).first();}
  async showTrabajadoresPlanilla() {return await this.trabajadoresPlanilla.toArray();}
  async updateCheckedTrabajadorPlanilla(id: any, checked: boolean){
    await this.trabajadoresPlanilla.update(id, { checked : checked})}
  async updateLaboresTrabajadorPlanilla(id: any, labores: any){ await this.trabajadoresPlanilla.update(id, { labores : labores})}
  async updateHfinTrabajadoresPlanilla(id:string, date:string){await this.trabajadoresPlanilla.update(id, { hora_fin: date})}
  async updateFfinTrabajadoresPlanilla(id:string, date:string){await this.trabajadoresPlanilla.update(id, { fecha_fintareo: date})}
  async updateHorasTrabajadores(id:string, horas:number){await this.trabajadoresPlanilla.update(id, { horas: horas})}
  async updateHorasRefrigerioTrabajadores(id:string, horas:number) {await this.trabajadoresPlanilla.update(id, { horas_refrigerio: horas})}
  async updateDisabledTrabajadorPlanilla(id: string, dis: boolean){await this.trabajadoresPlanilla.update(id, { disabled : dis})}
  async deleteTrabajadorPlanilla(nrodocumento: any,){await this.trabajadoresPlanilla.update(nrodocumento,{eliminado : 1})}
  async clearTrabajadoresPlanilla() {await this.trabajadoresPlanilla.where('estado').equals(1).delete();}
  async showTrabajadoresPlanillaSinEnviar() {return await this.trabajadoresPlanilla.where('estado')
    .equals(0).filter(trabajador => trabajador.cerrado == false).toArray();}
  async updateTrabajadorPlanillaEnviado(id:any, enviado: number){return await this.trabajadoresPlanilla.update(id,{estado : enviado})}
  async updateHIRefrigerioTrabajadoresPlanilla(id:string, date:string){await this.trabajadoresPlanilla.update(id, { hora_iniciorefrigerio: date})}
  async updateHFRefrigerioTrabajadoresPlanilla(id:string, date:string){await this.trabajadoresPlanilla.update(id, { hora_finrefrigerio: date})}
  async updateFIRefrigerioTrabajadoresPlanilla(id:string, date:string){await this.trabajadoresPlanilla.update(id, { fecha_iniciorefrigerio: date})}
  async updateFFRefrigerioTrabajadoresPlanilla(id:string, date:string){await this.trabajadoresPlanilla.update(id, { fecha_finrefrigerio: date})}
  async updateFundoCultivo(id: string, idfundo: number, idcultivo: number) {await this.trabajadoresPlanilla.update(id, { idfundo: idfundo, idcultivo: idcultivo })}
  async updateMotivoCierre(id: string,idmotivocierre: number,motivosalida: string) { await this.trabajadoresPlanilla.update(id, { idmotivocierre: idmotivocierre,motivosalida: motivosalida })}
  //
  async saveIncidenciaPersona(incidenciaPersona: IncidenciaPersona) {await this.incidenciaPersona.put(incidenciaPersona);}
  async showIncidenciasPersona() {return await this.incidenciaPersona.toArray()}
  async updateAIncidenciaPersona(dni:string, number:number) {return await this.incidenciaPersona.update(dni, { aprobado: number })}
  async updateEstadoIncidenciaPersona(id:any, enviado: number){return await this.incidenciaPersona.update(id,{estado : enviado})}
  async clearIncidenciaPersona() {await this.incidenciaPersona.clear();}
  async deleteIncidenciaPersona(id: any){return await this.incidenciaPersona.delete(id)}
  //
  async saveMotivoSalida(params: MotivoSalida[]) {await this.motivoSalida.bulkPut(params);}
  async showMotivosSalida() {return await this.motivoSalida.toArray();}
  //
  async savePersonaFlujo(personaFlujo: PersonaFlujoAprobacion) {await this.personaFlujo.put(personaFlujo);}
  async showPersonaFlujo() {return await this.personaFlujo.toArray()}
  async clearPersonaFlujo() {await this.personaFlujo.clear();}
  async deletePersonaFlujo(id: any){return await this.personaFlujo.delete(id)}
  //
  async saveBonosPersona(bonoPersona: BonosPersona){await this.bonosPersona.put(bonoPersona)}
  async showBonosPersonas(){return await this.bonosPersona.toArray()}
  async updateBonosPersona(dni:string, data:BonosPersona){await this.bonosPersona.update( dni, data )}
  async eliminarBonosPersona(dni:string){await this.bonosPersona.update(dni, { eliminado: 1 })}
  //
  async clearMaestras() {
    await this.clearFundos();
    await this.clearCultivos();
    await this.clearAcopios();
    await this.clearCecos();
    await this.clearLabores();
    console.log('Todas las tablas de configuracion han sido limpiadas en indexedDB.');
  }
  //
  async clearDatosEnviados() {
    await this.clearTrabajadoresPlanilla()
    console.log('Todas los datos sincronizados han sido limpiadas en indexedDB.');
  }
  //
  async saveConfiguracion(configuracion: Configuracion) { await this.configuracion.put(configuracion); }
  async obtenerConfiguracion() {return await this.configuracion.toArray();} 
  async clearConfiguracion() {await this.configuracion.clear();}

}