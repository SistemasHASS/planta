/**
 * Tablas que la aplicacion ya no usa (nunca se leian ni se escribian).
 *
 * Se conservan SOLO para declarar la version 6 tal como quedo instalada en los navegadores y para que la
 * version 7 pueda eliminarlas: Dexie borra una tabla cuando una version nueva la declara en null.
 * No se deben usar desde ningun repositorio.
 */
export const TABLAS_ELIMINADAS_V7 = {
  codigosCaja: "++_pk,id,codigoItem,documentoConsignatario,idDestino,codigoFormato,codigoVariedad,idTipoEmpaqueGuia,codigoRancho,idLugarProduccion,idPresentacion,pesoPorCaja,idTransporte,fechaCreacion,bd",
  lugaresProduccionConfig: "++_pk,&id,idproyecto,idCodigoRancho,idLugaresDeProduccion,activo,fechaCreacion,bd",
  motivosTraslado: "++_pk,id,&codigo,descripcion",
  usuarios: "++_pk,&usuario,id,codigoAcopio,acopioNombre,aplicacion,documentoIdentidad,idRol,idempresa,nombre,razonSocial,ruc,serieGuia,modo,bd",
  dpalets: "++_pk,id,idPalet,&idDPalet,documentoCliente,destinoId,destinoNombre,documentoConsignatario,consignatarioNombre,formatoId,formatoNombre,tiposEmpaqueId,calibreId,presentacionId,variedadId,variedadNombre,lugarProduccionId,codigoRanchoId,cantidadCajas,tipoCajaId,tipoClamshellId,pesoPorCaja,pesoTotal,tipoEmpaqueGuiaId,transporteId,tipoProcesoEmpacadoId,esReposicion,variedadGuiaId,esEnsayo,eliminado,fechaCreacion,bd",
  guiasRemision: "++_pk,&codigoGuiaRemision,idProyecto,serie,numero,codigoProceso,nombreProceso,estadoSunat,documentoDestinatario,nombreDestinatario,puntoPartida,puntoLlegada,fechaEmision,idTransportista,razonSocialTransportista,idConductor,nombreConductor,apellidoConductor,nombreCompletoConductor,idVehiculo,placaPrincipalVehiculo,motivoTraslado,precinto,inicioTraslado,observaciones,estado,pesoTotal,totalCajas,cantidadPalets,usuarioEmision,fechaCreacionWeb,fechaCierre,parihuelas,observacionesUsuario,esReposicion,inspeccionTemperatura,inspeccionLibreOlores,inspeccionLibreInsectos,inspeccionLibreMateriasExtranas,inspeccionUnidadLimpia,inspeccionObservaciones,inspeccionMedidaCorrectiva,numeroViaje,snapshotDetalle,esEnsayo,eliminado,sincroniza,fechaCreacion,bd",
  guiasRemisionPalets: "++_pk,codigoGuiaRemision,codigoPalet,codigoItem,transactionId_uuid,cantidadCajas,fechaCreacion,bd",
};

/** Version 7: todas las tablas de arriba pasan a null para que Dexie las elimine. */
export const ELIMINAR_TABLAS_V7 = Object.fromEntries(Object.keys(TABLAS_ELIMINADAS_V7).map((tabla) => [tabla, null]));
