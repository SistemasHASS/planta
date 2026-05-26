import { CatalogoConfig, CatalogoKey } from "./catalogos.type";


export const CATALOGOS_CONFIG: Record<CatalogoKey, CatalogoConfig> = {
  clientes: {
    tabla: 'Clientes',
    label: 'Clientes - Maestro',
    icon: 'bi-building',
    columnas: [
      { campo: 'id', label: 'ID', tipo: 'int', visible: false, editable: false },
      { campo: 'documento', label: 'Documento', tipo: 'varchar', maxLength: 50, required: true, unique: true },
      { campo: 'documentoFiscal', label: 'DocumentoFiscal', tipo: 'varchar',visible: false, maxLength: 50, required: true, unique: true },
      { campo: 'nombre', label: 'Razón Social', tipo: 'varchar', maxLength: 200, required: true },
    ],
    displayField: 'RazonSocial',
    codigoField: 'codigo',
    tieneActivo: true,
    editable: false,
    noCrear: true,
    fkTablas: ['ComposicionPalets', 'MatrizCompatibilidad'],
    dixieRepo: 'clientesRepo'
  },

  consignatarios: {
    tabla: 'Consignatarios',
    label: 'Consignatarios - Maestro',
    icon: 'bi-person-vcard',
    columnas: [
      { campo: 'id', label: 'ID', tipo: 'int', visible: false, editable: false },
      { campo: 'documento', label: 'Documento', tipo: 'varchar', maxLength: 50, required: true, unique: true },
      { campo: 'documentoFiscal', label: 'DocumentoFiscal', tipo: 'varchar',visible: false, maxLength: 50, required: true, unique: true },
      { campo: 'nombre', label: 'Razón Social', tipo: 'varchar', maxLength: 200, required: true },
   ],
    displayField: 'RazonSocial',
    codigoField: 'codigo',
    tieneActivo: true,
    editable: false,
    fkTablas: ['ComposicionPalets', 'MatrizCompatibilidad', 'ReglasSobrepeso'],
    dixieRepo: 'consignatariosRepo'
  },

  destinos: {
    tabla: 'Destinos',
    label: 'Destinos - Maestro',
    icon: 'bi-geo-alt',
    columnas: [
      { campo: 'id', label: 'ID', tipo: 'varchar', visible: false, editable: false },
      { campo: 'pais', label: 'Pais', tipo: 'varchar', maxLength: 50, required: true, unique: true },
      { campo: 'nacionalidad', label: 'Nacionalidad', tipo: 'varchar', maxLength: 50, required: true, unique: true },
    ],
    displayField: 'Nombre',
    codigoField: 'id',
    tieneActivo: true,
    editable: false,
    fkTablas: ['ComposicionPalets', 'MatrizCompatibilidad', 'ReglasSobrepeso'],
    dixieRepo: 'destinosRepo'
  },
  
  formatos: {
    tabla: 'PLANTA_Formatos',
    label: 'Formatos',
    icon: 'bi-box',
    columnas: [
      { campo: 'id', label: 'ID', tipo: 'int', visible: false, editable: false, unique: true  },
      { campo: 'codigoCultivo', label: 'codigoCultivo', tipo: 'varchar', maxLength: 50, required: true, visible:false, editable: false },
      { campo: 'codigo', label: 'Código', tipo: 'varchar', maxLength: 50, required: true},
      { campo: 'descripcion', label: 'Descripción', tipo: 'varchar', maxLength: 100, required: true, editable: true },
      { campo: 'pesoPorCaja', label: 'Peso por Caja', tipo: 'decimal', required: true, editable: true },
      { campo: 'limiteCajasPorPalet', label: 'Límite Cajas/Palet', tipo: 'int', required: true },
      { campo: 'activo', label: 'Estado', tipo: 'bit', required: true },
      { campo: 'bd', label: 'Sincronizado', tipo: 'bit', visible: true, editable: false, default: 0 },
    ],
    displayField: 'Descripcion',
    codigoField: 'codigo',
    tieneActivo: true,
    noCrear: false,
    editable: true,
    fkTablas: ['ComposicionPalets', 'MatrizCompatibilidad', 'Palets', 'ReglasSobrepeso'],
    dixieRepo: 'formatosRepo'
  },

  tiposEmpaque: {
    tabla: 'PLANTA_TiposEmpaque',
    label: 'Tipos de Empaque',
    icon: 'bi-archive',
    columnas: [
      { campo: 'id', label: 'ID', tipo: 'int', visible: false, editable: false },
      { campo: 'codigo', label: 'Código', tipo: 'varchar', maxLength: 50, required: true, unique: true },
      { campo: 'descripcion', label: 'Descripción', tipo: 'varchar', maxLength: 100, required: true },
      { campo: 'bd', label: 'Sincronizado', tipo: 'bit', visible: true, editable: false, default: 0 },
      { campo: 'activo', label: 'Estado', tipo: 'bit', required: true }
    ],
    displayField: 'Descripcion',
    codigoField: 'codigo',
    tieneActivo: true,
    editable: true,
    fkTablas: ['ComposicionPalets', 'MatrizCompatibilidad'],
    dixieRepo: 'tiposEmpaqueRepo'
  },

  tiposEmpaqueGuia: {
    tabla: 'PLANTA_TiposEmpaqueGuia',
    label: 'Tipos Empaque Guía',
    icon: 'bi-file-earmark-text',
    columnas: [
      { campo: 'id', label: 'ID', tipo: 'int', visible: false, editable: false },
      { campo: 'codigo', label: 'Código', tipo: 'nvarchar', maxLength: 20, required: true, unique: true },
      { campo: 'nombre', label: 'Nombre', tipo: 'nvarchar', maxLength: 100, required: true },
      { campo: 'bd', label: 'Sincronizado', tipo: 'bit', visible: true, editable: false, default: 0 },
      { campo: 'activo', label: 'Estado', tipo: 'bit', required: true },
      { campo: 'fechaCreacion', label: 'Fecha Creación', tipo: 'datetime', auto: true, visible: true, editable: false }
    ],
    displayField: 'Nombre',
    codigoField: 'codigo',
    tieneActivo: true,
    editable: true,
    fkTablas: ['ComposicionPalets', 'MatrizCompatibilidad'],
    dixieRepo: 'tiposEmpaqueGuiaRepo'
  },

  presentaciones: {
    tabla: 'PLANTA_Presentacion',
    label: 'Presentaciones',
    icon: 'bi-tag',
    columnas: [
      { campo: 'id', label: 'ID', tipo: 'int', visible: false, editable: false },
      { campo: 'codigo', label: 'Código', tipo: 'nvarchar', maxLength: 20, required: true, unique: true },
      { campo: 'nombre', label: 'Nombre', tipo: 'nvarchar', maxLength: 100, required: true, unique: true },
      { campo: 'bd', label: 'Sincronizado', tipo: 'bit', visible: true, editable: false, default: 0 },
      { campo: 'activo', label: 'Estado', tipo: 'bit', required: true },
      { campo: 'fechaCreacion', label: 'Fecha Creación', tipo: 'datetime2', auto: true, visible: true, editable: false }
    ],
    displayField: 'Nombre',
    codigoField: 'nombre',
    tieneActivo: true,
    editable: true,
    fkTablas: ['ComposicionPalets', 'MatrizCompatibilidad'],
    dixieRepo: 'presentacionesRepo'
  },

  tiposCaja: {
    tabla: 'PLANTA_TiposCaja',
    label: 'Tipos de Caja',
    icon: 'bi-inbox',
    columnas: [
      { campo: 'id', label: 'ID', tipo: 'int', visible: false, editable: false },
      { campo: 'codigo', label: 'Código', tipo: 'nvarchar', maxLength: 100, required: true, unique: true },
      { campo: 'nombre', label: 'Nombre', tipo: 'nvarchar', maxLength: 200, required: true },
      { campo: 'bd', label: 'Sincronizado', tipo: 'bit', visible: true, editable: false, default: 0 },
      { campo: 'activo', label: 'Estado', tipo: 'bit', required: true },
      { campo: 'fechaCreacion', label: 'Fecha Creación', tipo: 'datetime', auto: true, visible: true, editable: false }
    ],
    displayField: 'Nombre',
    codigoField: 'codigo',
    tieneActivo: true,
    editable: true,
    fkTablas: ['ComposicionPalets', 'MatrizCompatibilidad'],
    dixieRepo: 'tiposCajaRepo'
  },

  tiposClamshell: {
    tabla: 'PLANTA_tiposClamshell',
    label: 'Tipos de Clamshell',
    icon: 'bi-layers',
    columnas: [
      { campo: 'id', label: 'ID', tipo: 'int', visible: false, editable: false },
      { campo: 'codigo', label: 'Código', tipo: 'nvarchar', maxLength: 100, required: true, unique: true },
      { campo: 'nombre', label: 'Nombre', tipo: 'nvarchar', maxLength: 200, required: true },
      { campo: 'bd', label: 'Sincronizado', tipo: 'bit', visible: true, editable: false, default: 0 },
      { campo: 'activo', label: 'Estado', tipo: 'bit', required: true },
      { campo: 'fechaCreacion', label: 'Fecha Creación', tipo: 'datetime', auto: true, visible: true, editable: false }
    ],
    displayField: 'Nombre',
    codigoField: 'codigo',
    tieneActivo: true,
    // noCrear: false,
    // editable: false,
    fkTablas: ['ComposicionPalets', 'MatrizCompatibilidad'],
    dixieRepo: 'tiposClamshellRepo'
  },

  variedades: {
    tabla: 'PLANTA_Variedades',
    label: 'Variedades - Maestro',
    icon: 'bi-flower1',
    columnas: [
      { campo: 'id', label: 'ID', tipo: 'varchar', visible: true, editable: false, unique: true },
      { campo: 'idcultivo', label: 'IdCultivo', tipo: 'varchar', maxLength: 50, required: true,editable: false },
      // { campo: 'nombreCultivo', label: 'Cultivo', tipo: 'varchar', maxLength: 100, required: true },
      { campo: 'idmodulo', label: 'Modulo', tipo: 'varchar', maxLength: 100, required: true,editable: false },
      { campo: 'idvariedad', label: 'IdVariedad', tipo: 'varchar', maxLength: 100, required: true,editable: false },
      { campo: 'variedad', label: 'Variedad', tipo: 'varchar', maxLength: 100, required: true,editable: false },
      { campo: 'esEnsayo', label: 'Es Ensayo', tipo: 'bit', default: 0 },
      { campo: 'bd', label: 'Sincronizado', tipo: 'bit', visible: true, editable: false, default: 0 },
    ],
    displayField: 'Nombre',
    codigoField: 'codigo',
    tieneActivo: false,
    noCrear: true,
    editable: true,
    fkTablas: ['ComposicionPalets'],
    dixieRepo: 'variedadesRepo'
  },

  lugaresProduccion: {
    tabla: 'PLANTA_LugaresProduccion',
    label: 'Lugares de Producción',
    icon: 'bi-pin-map',
    columnas: [
      { campo: 'id', label: 'ID', tipo: 'int', visible: false, editable: false },
      { campo: 'codigo', label: 'Código', tipo: 'varchar', maxLength: 50, required: true, unique: true },
      { campo: 'descripcion', label: 'Descripción', tipo: 'varchar', maxLength: 200, required: true },
      { campo: 'activo', label: 'Estado', tipo: 'bit', required: true },
      { campo: 'bd', label: 'Sincronizado', tipo: 'bit', visible: true, editable: false, default: 0 }
    ],
    displayField: 'Descripcion',
    codigoField: 'codigo',
    tieneActivo: true,
    editable: true,
    fkTablas: ['ComposicionPalets', 'CodigosRancho'],
    dixieRepo: 'lugaresProduccionRepo'
  },

  transportes: {
    tabla: 'PLANTA_Transporte',
    label: 'Transporte - Maestro',
    icon: 'bi-truck',
    columnas: [
      { campo: 'id', label: 'Codigo', tipo: 'int', editable: false },
      { campo: 'transporte', label: 'Transporte', tipo: 'nvarchar', maxLength: 50, required: true, unique: true },
      
    ],
    displayField: 'Nombre',
    codigoField: 'codigo',
    tieneActivo: true,
    editable: false,
    fkTablas: ['ComposicionPalets', 'ReglasSobrepeso'],
    dixieRepo: 'transportesRepo'
  },

  calibres: {
    tabla: 'PLANTA_Calibres',
    label: 'Calibres - Maestro',
    icon: 'bi-rulers',
    columnas: [
      { campo: 'id', label: 'ID', tipo: 'int', visible: true, editable: false },
      { campo: 'calibre', label: 'Calibre', tipo: 'nvarchar', maxLength: 50, required: true },
      { campo: 'idCultivo', label: 'idCultivo', tipo: 'nvarchar', maxLength: 50, required: true },
    ],
    displayField: 'Nombre',
    codigoField: 'codigo',
    tieneActivo: true,
    editable: false,
    fkTablas: ['ComposicionPalets', 'MatrizCompatibilidad'],
    dixieRepo: 'calibresRepo'
  },

  categorias: {
    tabla: 'PLANTA_Categorias',
    label: 'Categorías',
    icon: 'bi-bookmark',
    columnas: [
      { campo: 'id', label: 'ID', tipo: 'int', visible: false, editable: false },
      { campo: 'codigo', label: 'Código', tipo: 'nvarchar', maxLength: 50, required: true, unique: true },
      { campo: 'nombre', label: 'Nombre', tipo: 'nvarchar', maxLength: 100, required: true },
      { campo: 'descripcion', label: 'Descripción', tipo: 'nvarchar', maxLength: 200, required: false },
      { campo: 'bd', label: 'Sincronizado', tipo: 'bit', visible: true, editable: false, default: 0 },
      { campo: 'activo', label: 'Estado', tipo: 'bit',required: true },
      { campo: 'fechaCreacion', label: 'Fecha Creación', tipo: 'datetime', auto: true, visible: true, editable: false }
    ],
    displayField: 'Nombre',
    codigoField: 'codigo',
    tieneActivo: true,
    editable: true,
    fkTablas: ['Calibres', 'MatrizCompatibilidad'],
    dixieRepo: 'categoriasRepo'
  },
  conductores: {
    tabla: 'PLANTA_Conductores',
    label: 'Conductores',
    icon: 'bi-person-badge',
    columnas: [
      { campo: 'id', label: 'ID', tipo: 'int', visible: false, editable: false },
      { campo: 'nombreCompleto', label: 'Nombre Completo', tipo: 'varchar', maxLength: 200, required: true },
      { campo: 'documentoIdentidad', label: 'Documento Identidad', tipo: 'varchar', maxLength: 20, required: true, unique: true },
      { campo: 'licenciaConducir', label: 'Licencia de Conducir', tipo: 'varchar', maxLength: 30, required: false },
      { campo: 'bd', label: 'Sincronizado', tipo: 'bit', visible: true, editable: false, default: 0 },
      { campo: 'activo', label: 'Estado', tipo: 'bit',required: true },
      { campo: 'fechaCreacion', label: 'Fecha Creación', tipo: 'datetime', auto: true, visible: true, editable: false }
    ],
    displayField: 'NombreCompleto',
    codigoField: 'documentoIdentidad',
    tieneActivo: true,
    editable: true,
    fkTablas: ['GuiasRemision'],
    dixieRepo: 'conductoresRepo'
  },
  vehiculos: {
    tabla: 'PLANTA_Vehiculos',
    label: 'Vehículos',
    icon: 'bi-truck-front',
    columnas: [
      { campo: 'id', label: 'ID', tipo: 'int', visible: false, editable: false },
      { campo: 'placaPrincipal', label: 'Placa Principal', tipo: 'varchar', maxLength: 20, required: true, unique: true },
      { campo: 'placaRemolque', label: 'Placa Remolque', tipo: 'varchar', maxLength: 20, required: false },
      { campo: 'marca', label: 'Marca', tipo: 'varchar', maxLength: 100, required: false },
      { campo: 'certificadoInscripcion', label: 'Certificado Inscripción', tipo: 'varchar', maxLength: 50, required: false },
      { campo: 'bd', label: 'Sincronizado', tipo: 'bit', visible: true, editable: false, default: 0 },
      { campo: 'activo', label: 'Estado', tipo: 'bit', required: true },
      { campo: 'fechaCreacion', label: 'Fecha Creación', tipo: 'datetime', auto: true, visible: true, editable: false }
    ],
    displayField: 'PlacaPrincipal',
    codigoField: 'placaPrincipal',
    tieneActivo: true,
    editable: true,
    fkTablas: ['GuiasRemision'],
    dixieRepo: 'vehiculosRepo'
  },
  transportistas: {
    tabla: 'PLANTA_Transportistas',
    label: 'Transportistas',
    icon: 'bi-building-gear',
    columnas: [
      { campo: 'id', label: 'ID', tipo: 'int', visible: false, editable: false },
      { campo: 'razonSocial', label: 'Razón Social', tipo: 'varchar', maxLength: 300, required: true },
      { campo: 'ruc_Transportistas', label: 'RUC', tipo: 'varchar', maxLength: 50, required: true, unique: true },
      { campo: 'bd', label: 'Sincronizado', tipo: 'bit', visible: true, editable: false, default: 0 },
      { campo: 'activo', label: 'Estado', tipo: 'bit', required: true },
      { campo: 'fechaCreacion', label: 'Fecha Creación', tipo: 'datetime', auto: true, visible: true, editable: false }
    ],
    displayField: 'RazonSocial',
    codigoField: 'ruc_Transportistas',
    tieneActivo: true,
    editable: true,
    fkTablas: ['GuiasRemision'],
    dixieRepo: 'transportistasRepo'
  },
  supervisores: {
    tabla: 'PLANTA_Supervisores',
    label: 'Supervisores',
    icon: 'bi-person-check',
    columnas: [
      { campo: 'id', label: 'ID', tipo: 'int', visible: false, editable: false },
      { campo: 'dni', label: 'DNI', tipo: 'varchar', maxLength: 20, required: true, unique: true },
      { campo: 'nombreCompleto', label: 'Nombre Completo', tipo: 'nvarchar', maxLength: 200, required: true },
      { campo: 'celular', label: 'Celular', tipo: 'varchar', maxLength: 20, required: false },
      { campo: 'bd', label: 'Sincronizado', tipo: 'bit', visible: true, editable: false, default: 0 },
      { campo: 'activo', label: 'Estado', tipo: 'bit',required: true },
      { campo: 'fechaCreacion', label: 'Fecha Creación', tipo: 'datetime', auto: true, visible: true, editable: false }
    ],
    displayField: 'NombreCompleto',
    codigoField: 'dni',
    tieneActivo: true,
    editable: true,
    fkTablas: ['ProcesoSupervisores'],
    dixieRepo: 'supervisoresRepo'
  },
  personalLogistica: {
    tabla: 'PLANTA_PersonalLogistica',
    label: 'Personal Logística',
    icon: 'bi-people',
    columnas: [
      { campo: 'id', label: 'ID', tipo: 'int', visible: false, editable: false },
      { campo: 'dni', label: 'DNI', tipo: 'varchar', maxLength: 20, required: true, unique: true },
      { campo: 'nombreCompleto', label: 'Nombre Completo', tipo: 'nvarchar', maxLength: 200, required: true },
      { campo: 'celular', label: 'Celular', tipo: 'varchar', maxLength: 20, required: false },
      { campo: 'activo', label: 'Estado', tipo: 'bit',required: true },
      { campo: 'bd', label: 'Sincronizado', tipo: 'bit', visible: true, editable: false, default: 0 },
      { campo: 'fechaCreacion', label: 'Fecha Creación', tipo: 'datetime', auto: true, visible: true, editable: false }
    ],
    displayField: 'NombreCompleto',
    codigoField: 'dni',
    tieneActivo: true,
    editable: true,
    fkTablas: ['ProcesoLogisticos'],
    dixieRepo: 'personalLogisticoRepo'
  },
  acopios: {
    tabla: 'PLANTA_Acopio_SerieGuia',
    label: 'Acopios - Maestro',
    icon: 'bi-house-gear',
    columnas: [
      { campo: 'id', label: 'ID', tipo: 'int', visible: false, editable: false },
      { campo: 'acopioId', label: 'Código', tipo: 'varchar', maxLength: 10, required: true, unique: true,editable: false },
      { campo: 'acopioNombre', label: 'Nombre', tipo: 'varchar', maxLength: 100, required: true,editable: false },
      { campo: 'serieGuia', label: 'Serie de Guía', tipo: 'varchar', maxLength: 10, required: true },
      { campo: 'bd', label: 'Sincronizado', tipo: 'bit', visible: true, editable: false, default: 0 },
    ],
    displayField: 'Nombre',
    codigoField: 'acopioId',
    tieneActivo: false,
    editable: true,
    noCrear: true,
    fkTablas: ['Procesos', 'Palets', 'ConfigAcopioTipoProceso'],
    dixieRepo: 'acopiosRepo'
  }
}