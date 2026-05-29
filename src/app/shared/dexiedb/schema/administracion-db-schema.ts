
export const ADMINISTRACION_SCHEMA_V1 = {
    matricesCompatibilidad:'++_pk,&id,idProyecto,codigoCultivo,destinoId,destinoNombre,documentoCliente,documentoConsignatario,formatoId,formatoNombre,formatoCodigo,tipoEmpaqueId,tipoEmpaqueNombre,tipoEmpaqueGuiaId,tipoEmpaqueGuiaNombre,calibreId,calibreNombre,tipoCajaId,tipoCajaNombre,tipoClamshellId,tipoClamshellNombre,presentacionId,presentacionNombre,categoriaId,categoriaNombre,activo,fechaCreacion,fechaModificacion,modo,bd',
    usuarios:'++_pk,&usuario,id,codigoAcopio,acopioNombre,aplicacion,documentoIdentidad,idRol,idempresa,nombre,razonSocial,ruc,serieGuia,modo,bd',
    reglasSobrePeso:'++_pk,&id,idProyecto,codigoCultivo,documentoConsignatario,formatoId,destinoId,transporteId,porcentaje,activo,fechaCreacion,fechaModificacion,vigenciaDesde,vigenciaHasta,descripcion,modo,bd'
}