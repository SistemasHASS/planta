

export const CATELOGO_SCHEMA_V1 = {
    //Catálogos
    clientes : 'id,codigo,razonSocial,activo,bd',
    consignatarios : 'id,codigo,razonSocial,activo,bd',
    destinos : 'id,codigo,nombre,pais,activo,bd',
    formatos: 'id,codigo,descripcion,nombre,pesoPorCaja,limiteCajasPorPalet,activo,bd',
    calibres: 'id,codigo,nombre,activo,bd',
    categorias: 'id,codigo,nombre,descripcion,activo,fechaCreacion,bd',
    tiposEmpaque: 'id,codigo,descripcion,activo,bd',
    tiposEmpaqueGuia: 'id,codigo,nombre,activo,fechaCreacion,bd',
    presentaciones: 'id,nombre,descripcion,activo,fechaCreacion,bd',
    tiposCaja: 'id,codigo,nombre,activo,fechaCreacion,bd',
    tiposClamshell: 'id,codigo,nombre,activo,fechaCreacion,bd',
    variedades: 'id,codigo,nombre,presedencia,esEnsayo,activo,bd',
    lugaresProduccion: 'id,codigo,nombre,descripcion,activo,bd',
    transportes: 'id,codigo,nombre,descripcion,activo,fechaCreacion,bd',

    //Catálogos Operativos
    conductores: 'id,nombreCompleto,documentoIdentidad,licenciaConducir,activo,fechaCreacion,bd',
    vehiculos: 'id,placaPrincipal,placaRemolque,marca,certificadoInscripcion,activo,fechaCreacion,bd',
    transportistas: 'id,razonSocial,ruc,activo,fechaCreacion,bd',
    supervisores: 'id,dni,nombreCompleto,celular,activo,fechaCreacion,bd',
    personalesLogistico: 'id,dni,nombreCompleto,celular,activo,fechaCreacion,bd',
    acopios: 'id,codigo,nombre,serieGuia,activo,fechaCreacion,bd',
    
}