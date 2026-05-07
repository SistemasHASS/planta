import { CatalogoConfig, CatalogoKey } from "./catalogos.type";


export const CATALOGOS_CONFIG: Record<CatalogoKey, CatalogoConfig> = {
  clientes: {
    tabla: 'Clientes',
    label: 'Clientes',
    icon: 'bi-building',
    columnas: [
      { campo: 'id', label: 'ID', tipo: 'int', visible: false, editable: false },
      { campo: 'codigo', label: 'Código', tipo: 'varchar', maxLength: 50, required: true, unique: true },
      { campo: 'razonSocial', label: 'Razón Social', tipo: 'varchar', maxLength: 200, required: true },
      { campo: 'bd', label: 'Sincronizado', tipo: 'bit', visible: true, editable: false, default: 0 },
      { campo: 'activo', label: 'Estado', tipo: 'bit',required: true }
    ],
    displayField: 'RazonSocial',
    codigoField: 'codigo',
    tieneActivo: true,
    noCrear: true,
    fkTablas: ['ComposicionPalets', 'MatrizCompatibilidad'],
    dixieRepo: 'clientesRepo'
  },
  consignatarios: {
    tabla: 'Consignatarios',
    label: 'Consignatarios',
    icon: 'bi-person-vcard',
    columnas: [
      { campo: 'id', label: 'ID', tipo: 'int', visible: false, editable: false },
      { campo: 'codigo', label: 'Código', tipo: 'varchar', maxLength: 50, required: true, unique: true },
      { campo: 'razonSocial', label: 'Razón Social', tipo: 'varchar', maxLength: 200, required: true },
      { campo: 'bd', label: 'Sincronizado', tipo: 'bit', visible: true, editable: false, default: 0 },
      { campo: 'activo', label: 'Estado', tipo: 'bit',required: true }
    ],
    displayField: 'RazonSocial',
    codigoField: 'codigo',
    tieneActivo: true,
    fkTablas: ['ComposicionPalets', 'MatrizCompatibilidad', 'ReglasSobrepeso'],
    dixieRepo: 'consignatariosRepo'
  },
  destinos: {
    tabla: 'Destinos',
    label: 'Destinos',
    icon: 'bi-geo-alt',
    columnas: [
      { campo: 'id', label: 'ID', tipo: 'int', visible: false, editable: false },
      { campo: 'codigo', label: 'Código', tipo: 'varchar', maxLength: 50, required: true, unique: true },
      { campo: 'nombre', label: 'Nombre', tipo: 'varchar', maxLength: 100, required: true },
      { campo: 'pais', label: 'País', tipo: 'varchar', maxLength: 100, required: true },
      { campo: 'bd', label: 'Sincronizado', tipo: 'bit', visible: true, editable: false, default: 0 },
      { campo: 'activo', label: 'Estado', tipo: 'bit',required: true }
    ],
    displayField: 'Nombre',
    codigoField: 'codigo',
    tieneActivo: true,
    fkTablas: ['ComposicionPalets', 'MatrizCompatibilidad', 'ReglasSobrepeso'],
    dixieRepo: 'destinosRepo'
  },
  formatos: {
    tabla: 'Formatos',
    label: 'Formatos',
    icon: 'bi-box',
    columnas: [
      { campo: 'id', label: 'ID', tipo: 'int', visible: false, editable: false },
      { campo: 'codigo', label: 'Código', tipo: 'varchar', maxLength: 20, required: true, unique: true },
      { campo: 'descripcion', label: 'Descripción', tipo: 'varchar', maxLength: 100, required: true },
      { campo: 'pesoPorCaja', label: 'Peso por Caja (Kg)', tipo: 'decimal', required: true },
      { campo: 'limiteCajasPorPalet', label: 'Límite Cajas/Palet', tipo: 'int', required: true },
      { campo: 'bd', label: 'Sincronizado', tipo: 'bit', visible: true, editable: false, default: 0 },
      { campo: 'activo', label: 'Estado', tipo: 'bit', required: true }
    ],
    displayField: 'Descripcion',
    codigoField: 'codigo',
    tieneActivo: true,
    fkTablas: ['ComposicionPalets', 'MatrizCompatibilidad', 'Palets', 'ReglasSobrepeso'],
    dixieRepo: 'formatosRepo'
  },
  tiposEmpaque: {
    tabla: 'TiposEmpaque',
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
    fkTablas: ['ComposicionPalets', 'MatrizCompatibilidad'],
    dixieRepo: 'tiposEmpaqueRepo'
  },
  tiposEmpaqueGuia: {
    tabla: 'TiposEmpaqueGuia',
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
    fkTablas: ['ComposicionPalets', 'MatrizCompatibilidad'],
    dixieRepo: 'tiposEmpaqueGuiaRepo'
  },
  presentaciones: {
    tabla: 'Presentacion',
    label: 'Presentaciones',
    icon: 'bi-tag',
    columnas: [
      { campo: 'id', label: 'ID', tipo: 'int', visible: false, editable: false },
      { campo: 'nombre', label: 'Nombre', tipo: 'nvarchar', maxLength: 100, required: true, unique: true },
      { campo: 'bd', label: 'Sincronizado', tipo: 'bit', visible: true, editable: false, default: 0 },
      { campo: 'activo', label: 'Estado', tipo: 'bit', required: true },
      { campo: 'fechaCreacion', label: 'Fecha Creación', tipo: 'datetime2', auto: true, visible: true, editable: false }
    ],
    displayField: 'Nombre',
    codigoField: 'nombre',
    tieneActivo: true,
    fkTablas: ['ComposicionPalets', 'MatrizCompatibilidad'],
    dixieRepo: 'presentacionesRepo'
  },
  tiposCaja: {
    tabla: 'TiposCaja',
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
    fkTablas: ['ComposicionPalets', 'MatrizCompatibilidad'],
    dixieRepo: 'tiposCajaRepo'
  },
  tiposClamshell: {
    tabla: 'tiposClamshell',
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
    fkTablas: ['ComposicionPalets', 'MatrizCompatibilidad'],
    dixieRepo: 'tiposClamshellRepo'
  },
  variedades: {
    tabla: 'Variedades',
    label: 'Variedades',
    icon: 'bi-flower1',
    columnas: [
      { campo: 'id', label: 'ID', tipo: 'int', visible: false, editable: false },
      { campo: 'codigo', label: 'Código', tipo: 'varchar', maxLength: 50, required: true, unique: true },
      { campo: 'nombre', label: 'Nombre', tipo: 'varchar', maxLength: 100, required: true },
      { campo: 'procedencia', label: 'Procedencia', tipo: 'varchar', maxLength: 100, required: true },
      { campo: 'esEnsayo', label: 'Es Ensayo', tipo: 'bit', default: 0 },
      { campo: 'bd', label: 'Sincronizado', tipo: 'bit', visible: true, editable: false, default: 0 },
      { campo: 'activo', label: 'Estado', tipo: 'bit', required: true }
    ],
    displayField: 'Nombre',
    codigoField: 'codigo',
    tieneActivo: true,
    fkTablas: ['ComposicionPalets'],
    dixieRepo: 'variedadesRepo'
  },
  lugaresProduccion: {
    tabla: 'LugaresProduccion',
    label: 'Lugares de Producción',
    icon: 'bi-pin-map',
    columnas: [
      { campo: 'id', label: 'ID', tipo: 'int', visible: false, editable: false },
      { campo: 'codigo', label: 'Código', tipo: 'varchar', maxLength: 50, required: true, unique: true },
      { campo: 'descripcion', label: 'Descripción', tipo: 'varchar', maxLength: 200, required: true },
      { campo: 'bd', label: 'Sincronizado', tipo: 'bit', visible: true, editable: false, default: 0 },
      { campo: 'activo', label: 'Estado', tipo: 'bit',required: true }
    ],
    displayField: 'Descripcion',
    codigoField: 'codigo',
    tieneActivo: true,
    fkTablas: ['ComposicionPalets', 'CodigosRancho'],
    dixieRepo: 'lugaresProduccionRepo'
  },
  transportes: {
    tabla: 'Transporte',
    label: 'Transporte',
    icon: 'bi-truck',
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
    fkTablas: ['ComposicionPalets', 'ReglasSobrepeso'],
    dixieRepo: 'transportesRepo'
  },
  calibres: {
    tabla: 'Calibres',
    label: 'Calibres',
    icon: 'bi-rulers',
    columnas: [
      { campo: 'id', label: 'ID', tipo: 'int', visible: false, editable: false },
      { campo: 'codigo', label: 'Código', tipo: 'nvarchar', maxLength: 50, required: true, unique: true },
      { campo: 'nombre', label: 'Nombre', tipo: 'nvarchar', maxLength: 50, required: true },
      { campo: 'categoriaId', label: 'Categoría', tipo: 'int', required: false, fkTabla: 'Categorias', fkDisplay: 'Nombre' },
      { campo: 'bd', label: 'Sincronizado', tipo: 'bit', visible: true, editable: false, default: 0 },
      { campo: 'activo', label: 'Estado', tipo: 'bit',required: true },
      { campo: 'fechaCreacion', label: 'Fecha Creación', tipo: 'datetime', auto: true, visible: true, editable: false }
    ],
    displayField: 'Nombre',
    codigoField: 'codigo',
    tieneActivo: true,
    fkTablas: ['ComposicionPalets', 'MatrizCompatibilidad'],
    dixieRepo: 'calibresRepo'
  },
  categorias: {
    tabla: 'Categorias',
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
    fkTablas: ['Calibres', 'MatrizCompatibilidad'],
    dixieRepo: 'categoriasRepo'
  },
  conductores: {
    tabla: 'Conductores',
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
    fkTablas: ['GuiasRemision'],
    dixieRepo: 'conductoresRepo'
  },
  vehiculos: {
    tabla: 'Vehiculos',
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
    fkTablas: ['GuiasRemision'],
    dixieRepo: 'vehiculosRepo'
  },
  transportistas: {
    tabla: 'Transportistas',
    label: 'Transportistas',
    icon: 'bi-building-gear',
    columnas: [
      { campo: 'id', label: 'ID', tipo: 'int', visible: false, editable: false },
      { campo: 'razonSocial', label: 'Razón Social', tipo: 'varchar', maxLength: 300, required: true },
      { campo: 'ruc', label: 'RUC', tipo: 'varchar', maxLength: 50, required: true, unique: true },
      { campo: 'bd', label: 'Sincronizado', tipo: 'bit', visible: true, editable: false, default: 0 },
      { campo: 'activo', label: 'Estado', tipo: 'bit', required: true },
      { campo: 'fechaCreacion', label: 'Fecha Creación', tipo: 'datetime', auto: true, visible: true, editable: false }
    ],
    displayField: 'RazonSocial',
    codigoField: 'ruc',
    tieneActivo: true,
    fkTablas: ['GuiasRemision'],
    dixieRepo: 'transportistasRepo'
  },
  supervisores: {
    tabla: 'Supervisores',
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
    fkTablas: ['ProcesoSupervisores'],
    dixieRepo: 'supervisoresRepo'
  },
  personalLogistica: {
    tabla: 'PersonalLogistica',
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
    fkTablas: ['ProcesoLogisticos'],
    dixieRepo: 'personalLogisticoRepo'
  },
  acopios: {
    tabla: 'Acopios',
    label: 'Acopios',
    icon: 'bi-house-gear',
    columnas: [
      { campo: 'id', label: 'ID', tipo: 'int', visible: false, editable: false },
      { campo: 'codigo', label: 'Código', tipo: 'varchar', maxLength: 10, required: true, unique: true },
      { campo: 'nombre', label: 'Nombre', tipo: 'varchar', maxLength: 100, required: true },
      { campo: 'serieGuia', label: 'Serie de Guía', tipo: 'varchar', maxLength: 10, required: true },
      { campo: 'activo', label: 'Estado', tipo: 'bit',required: true },
      { campo: 'bd', label: 'Sincronizado', tipo: 'bit', visible: true, editable: false, default: 0 },
      { campo: 'fechaCreacion', label: 'Fecha Creación', tipo: 'datetime', auto: true, visible: true, editable: false },
    ],
    displayField: 'Nombre',
    codigoField: 'codigo',
    tieneActivo: true,
    noCrear: true,
    fkTablas: ['Procesos', 'Palets', 'ConfigAcopioTipoProceso'],
    dixieRepo: 'acopiosRepo'
  }
}