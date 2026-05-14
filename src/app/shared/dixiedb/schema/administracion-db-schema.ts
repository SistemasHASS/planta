
export const ADMINISTRACION_SCHEMA_V1 = {
    matricesCompatibilidad:'++_pk,&id,clienteId,clienteNombre,clienteCodigo,consignatarioId,consignatarioNombre,consignatarioCodigo,destinoId,destinoNombre,destinoCodigo,formatoId,formatoNombre,formatoCodigo,tipoEmpaqueId,tipoEmpaqueNombre,tipoEmpaqueGuiaId,tipoEmpaqueGuiaNombre,calibreId,calibreNombre,tipoCajaId,tipoCajaNombre,tipoClamshellId,tipoClamshellNombre,presentacionId,presentacionNombre,categoriaId,categoriaNombre,activo,fechaCreacion,fechaModificacion,modo,bd',
    usuarios:'++_pk,&id,usuario,password,nombreCompleto,perfil,acopioId,serieGuia,activo,fechaCreacion,fechaModificacion,modo,bd',
    reglasSobrePeso:'++_pk,&id,consignatarioId,formatoId,destinoId,transporteId,porcentaje,activo,fechaCreacion,fechaModificacion,vigenciaDesde,vigenciaHasta,descripcion,modo,bd'
}