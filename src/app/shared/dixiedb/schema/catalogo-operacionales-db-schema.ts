

export const CATELOGO_OPERACIONALES_SCHEMA_V1 = {
    conductores: '++_pk,id,&documentoIdentidad,nombreCompleto,licenciaConducir,activo,fechaCreacion,bd',
    vehiculos: '++_pk,id,&placaPrincipal,placaRemolque,marca,certificadoInscripcion,activo,fechaCreacion,bd',
    transportistas: '++_pk,id,&ruc,razonSocial,activo,fechaCreacion,bd',
    supervisores: '++_pk,id,&dni,nombreCompleto,celular,activo,fechaCreacion,bd',
    personalesLogistico: '++_pk,id,&dni,nombreCompleto,celular,activo,fechaCreacion,bd',
    acopios: '++_pk,id,&codigo,nombre,serieGuia,activo,fechaCreacion,bd',
}
