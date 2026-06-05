

export const CATELOGO_OPERACIONALES_SCHEMA_V1 = {
    conductores: '++_pk,&id,idproyecto,documentoIdentidad,licenciaConducir,nombreCompleto,activo,fechaCreacion,bd',
    vehiculos: '++_pk,&id,idproyecto,placaPrincipal,placaRemolque,marca,certificadoInscripcion,activo,fechaCreacion,bd',
    transportistas: '++_pk,&id,idproyecto,ruc_Transportistas,razonSocial,activo,fechaCreacion,bd',
    supervisores: '++_pk,&id,idproyecto,dni,nombreCompleto,celular,activo,fechaCreacion,bd',
    personalesLogistico: '++_pk,&id,idproyecto,dni,nombreCompleto,celular,activo,fechaCreacion,bd',
    acopios: '++_pk,id,idproyecto,&codigoAcopio,acopioNombre,serieGuia,bd',
    acopiosDetalles: '++_pk,&id,codigoAcopio,codigoTipoProcesoEmpacado,nombreTipoProcesoEmpacado,fechaCreacion,activo,bd',
}
