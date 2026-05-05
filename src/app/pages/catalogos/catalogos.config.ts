import { CatalogoConfig, CatalogoKey } from "./catalogos.type";


export const CATALOGOS_CONFIG: Record<CatalogoKey, CatalogoConfig> = {
  clientes: {
    tabla: 'Clientes',
    label: 'Clientes',
    icon: 'bi-building',
    columnas: [
      { campo: 'Id', label: 'ID', tipo: 'int', visible: false, editable: false },
      { campo: 'Codigo', label: 'Código', tipo: 'varchar', maxLength: 50, required: true, unique: true },
      { campo: 'RazonSocial', label: 'Razón Social', tipo: 'varchar', maxLength: 200, required: true },
      { campo: 'db', label: 'Sincronizado', tipo: 'bit', visible: true, editable: false, default: 0 },
      { campo: 'Activo', label: 'Estado', tipo: 'bit', default: 1 }
    ],
    displayField: 'RazonSocial',
    codigoField: 'Codigo',
    tieneActivo: true,
    noCrear: true, // D) Bloquear creación de nuevos clientes
    fkTablas: ['ComposicionPalets', 'MatrizCompatibilidad']
  },
  consignatarios: {
    tabla: 'Consignatarios',
    label: 'Consignatarios',
    icon: 'bi-person-vcard',
    columnas: [
      { campo: 'Id', label: 'ID', tipo: 'int', visible: false, editable: false },
      { campo: 'Codigo', label: 'Código', tipo: 'varchar', maxLength: 50, required: true, unique: true },
      { campo: 'RazonSocial', label: 'Razón Social', tipo: 'varchar', maxLength: 200, required: true },
      { campo: 'db', label: 'Sincronizado', tipo: 'bit', visible: true, editable: false, default: 0 },
      { campo: 'Activo', label: 'Estado', tipo: 'bit', default: 1 }
    ],
    displayField: 'RazonSocial',
    codigoField: 'Codigo',
    tieneActivo: true,
    fkTablas: ['ComposicionPalets', 'MatrizCompatibilidad', 'ReglasSobrepeso']
  },
  destinos: {
    tabla: 'Destinos',
    label: 'Destinos',
    icon: 'bi-geo-alt',
    columnas: [
      { campo: 'Id', label: 'ID', tipo: 'int', visible: false, editable: false },
      { campo: 'Codigo', label: 'Código', tipo: 'varchar', maxLength: 50, required: true, unique: true },
      { campo: 'Nombre', label: 'Nombre', tipo: 'varchar', maxLength: 100, required: true },
      { campo: 'Pais', label: 'País', tipo: 'varchar', maxLength: 100, required: true },
      { campo: 'db', label: 'Sincronizado', tipo: 'bit', visible: true, editable: false, default: 0 },
      { campo: 'Activo', label: 'Estado', tipo: 'bit', default: 1 }
    ],
    displayField: 'Nombre',
    codigoField: 'Codigo',
    tieneActivo: true,
    fkTablas: ['ComposicionPalets', 'MatrizCompatibilidad', 'ReglasSobrepeso']
  },
  formatos: {
    tabla: 'Formatos',
    label: 'Formatos',
    icon: 'bi-box',
    columnas: [
      { campo: 'Id', label: 'ID', tipo: 'int', visible: false, editable: false },
      { campo: 'Codigo', label: 'Código', tipo: 'varchar', maxLength: 20, required: true, unique: true },
      { campo: 'Descripcion', label: 'Descripción', tipo: 'varchar', maxLength: 100, required: true },
      { campo: 'PesoPorCaja', label: 'Peso por Caja (Kg)', tipo: 'decimal', required: true },
      { campo: 'LimiteCajasPorPalet', label: 'Límite Cajas/Palet', tipo: 'int', required: true },
      { campo: 'db', label: 'Sincronizado', tipo: 'bit', visible: true, editable: false, default: 0 },
      { campo: 'Activo', label: 'Estado', tipo: 'bit', default: 1 }
    ],
    displayField: 'Descripcion',
    codigoField: 'Codigo',
    tieneActivo: true,
    fkTablas: ['ComposicionPalets', 'MatrizCompatibilidad', 'Palets', 'ReglasSobrepeso']
  },
  tiposempaque: {
    tabla: 'TiposEmpaque',
    label: 'Tipos de Empaque',
    icon: 'bi-archive',
    columnas: [
      { campo: 'Id', label: 'ID', tipo: 'int', visible: false, editable: false },
      { campo: 'Codigo', label: 'Código', tipo: 'varchar', maxLength: 50, required: true, unique: true },
      { campo: 'Descripcion', label: 'Descripción', tipo: 'varchar', maxLength: 100, required: true },
      { campo: 'db', label: 'Sincronizado', tipo: 'bit', visible: true, editable: false, default: 0 },
      { campo: 'Activo', label: 'Estado', tipo: 'bit', default: 1 }
    ],
    displayField: 'Descripcion',
    codigoField: 'Codigo',
    tieneActivo: true,
    fkTablas: ['ComposicionPalets', 'MatrizCompatibilidad']
  },
  tiposempaqueguia: {
    tabla: 'TiposEmpaqueGuia',
    label: 'Tipos Empaque Guía',
    icon: 'bi-file-earmark-text',
    columnas: [
      { campo: 'Id', label: 'ID', tipo: 'int', visible: false, editable: false },
      { campo: 'Codigo', label: 'Código', tipo: 'nvarchar', maxLength: 20, required: true, unique: true },
      { campo: 'Nombre', label: 'Nombre', tipo: 'nvarchar', maxLength: 100, required: true },
      { campo: 'db', label: 'Sincronizado', tipo: 'bit', visible: true, editable: false, default: 0 },
      { campo: 'Activo', label: 'Estado', tipo: 'bit', default: 1 },
      { campo: 'FechaCreacion', label: 'Fecha Creación', tipo: 'datetime', auto: true, visible: true, editable: false }
    ],
    displayField: 'Nombre',
    codigoField: 'Codigo',
    tieneActivo: true,
    fkTablas: ['ComposicionPalets', 'MatrizCompatibilidad']
  },
  presentaciones: {
    tabla: 'Presentacion',
    label: 'Presentaciones',
    icon: 'bi-tag',
    columnas: [
      { campo: 'Id', label: 'ID', tipo: 'int', visible: false, editable: false },
      { campo: 'Nombre', label: 'Nombre', tipo: 'nvarchar', maxLength: 100, required: true, unique: true },
      { campo: 'db', label: 'Sincronizado', tipo: 'bit', visible: true, editable: false, default: 0 },
      { campo: 'Activo', label: 'Estado', tipo: 'bit', default: 1 },
      { campo: 'FechaCreacion', label: 'Fecha Creación', tipo: 'datetime2', auto: true, visible: true, editable: false }
    ],
    displayField: 'Nombre',
    codigoField: null,
    tieneActivo: true,
    fkTablas: ['ComposicionPalets', 'MatrizCompatibilidad']
  },
  tiposcaja: {
    tabla: 'TiposCaja',
    label: 'Tipos de Caja',
    icon: 'bi-inbox',
    columnas: [
      { campo: 'Id', label: 'ID', tipo: 'int', visible: false, editable: false },
      { campo: 'Codigo', label: 'Código', tipo: 'nvarchar', maxLength: 100, required: true, unique: true },
      { campo: 'Nombre', label: 'Nombre', tipo: 'nvarchar', maxLength: 200, required: true },
      { campo: 'db', label: 'Sincronizado', tipo: 'bit', visible: true, editable: false, default: 0 },
      { campo: 'Activo', label: 'Estado', tipo: 'bit', default: 1 },
      { campo: 'FechaCreacion', label: 'Fecha Creación', tipo: 'datetime', auto: true, visible: true, editable: false }
    ],
    displayField: 'Nombre',
    codigoField: 'Codigo',
    tieneActivo: true,
    fkTablas: ['ComposicionPalets', 'MatrizCompatibilidad']
  },
  tiposclamshell: {
    tabla: 'TiposClamshell',
    label: 'Tipos de Clamshell',
    icon: 'bi-layers',
    columnas: [
      { campo: 'Id', label: 'ID', tipo: 'int', visible: false, editable: false },
      { campo: 'Codigo', label: 'Código', tipo: 'nvarchar', maxLength: 100, required: true, unique: true },
      { campo: 'Nombre', label: 'Nombre', tipo: 'nvarchar', maxLength: 200, required: true },
      { campo: 'db', label: 'Sincronizado', tipo: 'bit', visible: true, editable: false, default: 0 },
      { campo: 'Activo', label: 'Estado', tipo: 'bit', default: 1 },
      { campo: 'FechaCreacion', label: 'Fecha Creación', tipo: 'datetime', auto: true, visible: true, editable: false }
    ],
    displayField: 'Nombre',
    codigoField: 'Codigo',
    tieneActivo: true,
    fkTablas: ['ComposicionPalets', 'MatrizCompatibilidad']
  },
  variedades: {
    tabla: 'Variedades',
    label: 'Variedades',
    icon: 'bi-flower1',
    columnas: [
      { campo: 'Id', label: 'ID', tipo: 'int', visible: false, editable: false },
      { campo: 'Codigo', label: 'Código', tipo: 'varchar', maxLength: 50, required: true, unique: true },
      { campo: 'Nombre', label: 'Nombre', tipo: 'varchar', maxLength: 100, required: true },
      { campo: 'Procedencia', label: 'Procedencia', tipo: 'varchar', maxLength: 100, required: true },
      { campo: 'EsEnsayo', label: 'Es Ensayo', tipo: 'bit', default: 0 },
      { campo: 'db', label: 'Sincronizado', tipo: 'bit', visible: true, editable: false, default: 0 },
      { campo: 'Activo', label: 'Estado', tipo: 'bit', default: 1 }
    ],
    displayField: 'Nombre',
    codigoField: 'Codigo',
    tieneActivo: true,
    fkTablas: ['ComposicionPalets']
  },
  lugaresproduccion: {
    tabla: 'LugaresProduccion',
    label: 'Lugares de Producción',
    icon: 'bi-pin-map',
    columnas: [
      { campo: 'Id', label: 'ID', tipo: 'int', visible: false, editable: false },
      { campo: 'Codigo', label: 'Código', tipo: 'varchar', maxLength: 50, required: true, unique: true },
      { campo: 'Descripcion', label: 'Descripción', tipo: 'varchar', maxLength: 200, required: true },
      { campo: 'db', label: 'Sincronizado', tipo: 'bit', visible: true, editable: false, default: 0 },
      { campo: 'Activo', label: 'Estado', tipo: 'bit', default: 1 }
    ],
    displayField: 'Descripcion',
    codigoField: 'Codigo',
    tieneActivo: true,
    fkTablas: ['ComposicionPalets', 'CodigosRancho']
  },
  transporte: {
    tabla: 'Transporte',
    label: 'Transporte',
    icon: 'bi-truck',
    columnas: [
      { campo: 'Id', label: 'ID', tipo: 'int', visible: false, editable: false },
      { campo: 'Codigo', label: 'Código', tipo: 'nvarchar', maxLength: 50, required: true, unique: true },
      { campo: 'Nombre', label: 'Nombre', tipo: 'nvarchar', maxLength: 100, required: true },
      { campo: 'Descripcion', label: 'Descripción', tipo: 'nvarchar', maxLength: 200, required: false },
      { campo: 'db', label: 'Sincronizado', tipo: 'bit', visible: true, editable: false, default: 0 },
      { campo: 'Activo', label: 'Estado', tipo: 'bit', default: 1 },
      { campo: 'FechaCreacion', label: 'Fecha Creación', tipo: 'datetime', auto: true, visible: true, editable: false }
    ],
    displayField: 'Nombre',
    codigoField: 'Codigo',
    tieneActivo: true,
    fkTablas: ['ComposicionPalets', 'ReglasSobrepeso']
  },
  calibres: {
    tabla: 'Calibres',
    label: 'Calibres',
    icon: 'bi-rulers',
    columnas: [
      { campo: 'Id', label: 'ID', tipo: 'int', visible: false, editable: false },
      { campo: 'Codigo', label: 'Código', tipo: 'nvarchar', maxLength: 50, required: true, unique: true },
      { campo: 'Nombre', label: 'Nombre', tipo: 'nvarchar', maxLength: 50, required: true },
      { campo: 'CategoriaId', label: 'Categoría', tipo: 'int', required: false, fkTabla: 'Categorias', fkDisplay: 'Nombre' },
      { campo: 'db', label: 'Sincronizado', tipo: 'bit', visible: true, editable: false, default: 0 },
      { campo: 'Activo', label: 'Estado', tipo: 'bit', default: 1 },
      { campo: 'FechaCreacion', label: 'Fecha Creación', tipo: 'datetime', auto: true, visible: true, editable: false }
    ],
    displayField: 'Nombre',
    codigoField: 'Codigo',
    tieneActivo: true,
    fkTablas: ['ComposicionPalets', 'MatrizCompatibilidad']
  },
  categorias: {
    tabla: 'Categorias',
    label: 'Categorías',
    icon: 'bi-bookmark',
    columnas: [
      { campo: 'Id', label: 'ID', tipo: 'int', visible: false, editable: false },
      { campo: 'Codigo', label: 'Código', tipo: 'nvarchar', maxLength: 50, required: true, unique: true },
      { campo: 'Nombre', label: 'Nombre', tipo: 'nvarchar', maxLength: 100, required: true },
      { campo: 'Descripcion', label: 'Descripción', tipo: 'nvarchar', maxLength: 200, required: false },
      { campo: 'db', label: 'Sincronizado', tipo: 'bit', visible: true, editable: false, default: 0 },
      { campo: 'Activo', label: 'Estado', tipo: 'bit', default: 1 },
      { campo: 'FechaCreacion', label: 'Fecha Creación', tipo: 'datetime', auto: true, visible: true, editable: false }
    ],
    displayField: 'Nombre',
    codigoField: 'Codigo',
    tieneActivo: true,
    fkTablas: ['Calibres', 'MatrizCompatibilidad']
  },
  conductores: {
    tabla: 'Conductores',
    label: 'Conductores',
    icon: 'bi-person-badge',
    columnas: [
      { campo: 'Id', label: 'ID', tipo: 'int', visible: false, editable: false },
      { campo: 'NombreCompleto', label: 'Nombre Completo', tipo: 'varchar', maxLength: 200, required: true },
      { campo: 'DocumentoIdentidad', label: 'Documento Identidad', tipo: 'varchar', maxLength: 20, required: true, unique: true },
      { campo: 'LicenciaConducir', label: 'Licencia de Conducir', tipo: 'varchar', maxLength: 30, required: false },
      { campo: 'db', label: 'Sincronizado', tipo: 'bit', visible: true, editable: false, default: 0 },
      { campo: 'Activo', label: 'Estado', tipo: 'bit', default: 1 },
      { campo: 'FechaCreacion', label: 'Fecha Creación', tipo: 'datetime', auto: true, visible: true, editable: false }
    ],
    displayField: 'NombreCompleto',
    codigoField: 'DocumentoIdentidad',
    tieneActivo: true,
    fkTablas: ['GuiasRemision']
  },
  vehiculos: {
    tabla: 'Vehiculos',
    label: 'Vehículos',
    icon: 'bi-truck-front',
    columnas: [
      { campo: 'Id', label: 'ID', tipo: 'int', visible: false, editable: false },
      { campo: 'PlacaPrincipal', label: 'Placa Principal', tipo: 'varchar', maxLength: 20, required: true, unique: true },
      { campo: 'PlacaRemolque', label: 'Placa Remolque', tipo: 'varchar', maxLength: 20, required: false },
      { campo: 'Marca', label: 'Marca', tipo: 'varchar', maxLength: 100, required: false },
      { campo: 'CertificadoInscripcion', label: 'Certificado Inscripción', tipo: 'varchar', maxLength: 50, required: false },
      { campo: 'db', label: 'Sincronizado', tipo: 'bit', visible: true, editable: false, default: 0 },
      { campo: 'Activo', label: 'Estado', tipo: 'bit', default: 1 },
      { campo: 'FechaCreacion', label: 'Fecha Creación', tipo: 'datetime', auto: true, visible: true, editable: false }
    ],
    displayField: 'PlacaPrincipal',
    codigoField: 'PlacaPrincipal',
    tieneActivo: true,
    fkTablas: ['GuiasRemision']
  },
  transportistas: {
    tabla: 'Transportistas',
    label: 'Transportistas',
    icon: 'bi-building-gear',
    columnas: [
      { campo: 'Id', label: 'ID', tipo: 'int', visible: false, editable: false },
      { campo: 'RazonSocial', label: 'Razón Social', tipo: 'varchar', maxLength: 300, required: true },
      { campo: 'Ruc', label: 'RUC', tipo: 'varchar', maxLength: 20, required: true, unique: true },
      { campo: 'db', label: 'Sincronizado', tipo: 'bit', visible: true, editable: false, default: 0 },
      { campo: 'Activo', label: 'Estado', tipo: 'bit', default: 1 },
      { campo: 'FechaCreacion', label: 'Fecha Creación', tipo: 'datetime', auto: true, visible: true, editable: false }
    ],
    displayField: 'RazonSocial',
    codigoField: 'Ruc',
    tieneActivo: true,
    fkTablas: ['GuiasRemision']
  },
  supervisores: {
    tabla: 'Supervisores',
    label: 'Supervisores',
    icon: 'bi-person-check',
    columnas: [
      { campo: 'Id', label: 'ID', tipo: 'int', visible: false, editable: false },
      { campo: 'DNI', label: 'DNI', tipo: 'varchar', maxLength: 20, required: true, unique: true },
      { campo: 'NombreCompleto', label: 'Nombre Completo', tipo: 'nvarchar', maxLength: 200, required: true },
      { campo: 'Celular', label: 'Celular', tipo: 'varchar', maxLength: 20, required: false },
      { campo: 'db', label: 'Sincronizado', tipo: 'bit', visible: true, editable: false, default: 0 },
      { campo: 'Activo', label: 'Estado', tipo: 'bit', default: 1 },
      { campo: 'FechaCreacion', label: 'Fecha Creación', tipo: 'datetime', auto: true, visible: true, editable: false }
    ],
    displayField: 'NombreCompleto',
    codigoField: 'DNI',
    tieneActivo: true,
    fkTablas: ['ProcesoSupervisores']
  },
  personallogistica: {
    tabla: 'PersonalLogistica',
    label: 'Personal Logística',
    icon: 'bi-people',
    columnas: [
      { campo: 'Id', label: 'ID', tipo: 'int', visible: false, editable: false },
      { campo: 'DNI', label: 'DNI', tipo: 'varchar', maxLength: 20, required: true, unique: true },
      { campo: 'NombreCompleto', label: 'Nombre Completo', tipo: 'nvarchar', maxLength: 200, required: true },
      { campo: 'Celular', label: 'Celular', tipo: 'varchar', maxLength: 20, required: false },
      { campo: 'Activo', label: 'Estado', tipo: 'bit', default: 1 },
      { campo: 'db', label: 'Sincronizado', tipo: 'bit', visible: true, editable: false, default: 0 },
      { campo: 'FechaCreacion', label: 'Fecha Creación', tipo: 'datetime', auto: true, visible: true, editable: false }
    ],
    displayField: 'NombreCompleto',
    codigoField: 'DNI',
    tieneActivo: true,
    fkTablas: ['ProcesoLogisticos']
  },
  acopios: {
    tabla: 'Acopios',
    label: 'Acopios',
    icon: 'bi-house-gear',
    columnas: [
      { campo: 'Id', label: 'ID', tipo: 'int', visible: false, editable: false },
      { campo: 'Codigo', label: 'Código', tipo: 'varchar', maxLength: 10, required: true, unique: true },
      { campo: 'Nombre', label: 'Nombre', tipo: 'varchar', maxLength: 100, required: true },
      { campo: 'SerieGuia', label: 'Serie de Guía', tipo: 'varchar', maxLength: 10, required: true },
      { campo: 'Activo', label: 'Estado', tipo: 'bit', default: 1 },
      { campo: 'db', label: 'Sincronizado', tipo: 'bit', visible: true, editable: false, default: 0 },
      { campo: 'FechaCreacion', label: 'Fecha Creación', tipo: 'datetime', auto: true, visible: true, editable: false },
    ],
    displayField: 'Nombre',
    codigoField: 'Codigo',
    tieneActivo: true,
    noCrear: true,
    fkTablas: ['Procesos', 'Palets', 'ConfigAcopioTipoProceso']
  }
}