
export const PROCESO_SCHEMA_V1 = {
    procesos:'++_pk,id,&idProceso,idProyecto,codigoAcopio,acopioNombre,fechaProceso,estado,fechaApertura,fechaCierre,turno,db',
    dProcesoLogisticos:'++_pk,&[id+idProceso],id,idProceso,idLogistico,fechaCreacion,db',
    dProcesoSupervisores:'++_pk,&[id+idProceso],id,idProceso,idSupervisor,fechaCreacion,db',
    palet: '++_pk,id,&idPalet,idProceso,numeroPalet,estado,cantidadCajas,pesoTotal,porcentajeAvance,formatoId,acopioId,fechaCreacion,fechaCierre,observaciones,medidaCorrectiva,formatoDescripcion,limiteCajasPorPalet,acopioCodigo,acopioNombre,turno,numeroViaje,primeraComposicionFecha'
};

