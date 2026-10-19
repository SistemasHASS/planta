import { CatalogoPorCultivo, CatalogoPorProyecto } from '../../shared/services/catalogos-api.service';

export type CatalogoKey =
  | 'conductores' | 'vehiculos' | 'transportistas' | 'supervisores' | 'personalLogistica'
  | 'tipoProcesoEmpacado' | 'clientes' | 'formatos' | 'presentaciones' | 'tiposCaja' | 'tiposClamshell'
  | 'lugaresProduccion' | 'codigosRancho' | 'categorias' | 'tiposEmpaque' | 'tiposEmpaqueGuia'
  | 'destinos' | 'calibres' | 'transportes';

export interface OpcionCampo {
  value: string;
  label: string;
}

/** De dónde sale la lista de la pantalla. */
export type OrigenListado =
  | { tipo: 'proyecto'; catalogo: CatalogoPorProyecto }
  | { tipo: 'cultivo'; catalogo: CatalogoPorCultivo }
  | { tipo: 'clientes' }
  | { tipo: 'paises' }
  | { tipo: 'calibres' }
  | { tipo: 'transportes' };

/** Opciones de un select que se piden al servidor al abrir la ventana de nuevo/editar. */
export type FuenteSelect =
  | { origen: 'cultivo'; catalogo: CatalogoPorCultivo; valor: string; etiqueta: string[] }
  | { origen: 'calibres'; valor: string; etiqueta: string[] };

/** Un dato del registro (se muestra en la ventana de nuevo/editar y, si está en `columnas`, en la tabla). */
export interface CampoCatalogo {
  campo: string;
  etiqueta: string;
  tipo: 'texto' | 'select' | 'numero';
  maxLength?: number;
  requerido?: boolean;
  /** Se escribe en mayúsculas (placas, licencia). */
  mayusculas?: boolean;
  /** Solo números (documentos). */
  soloDigitos?: boolean;
  /** En 'numero': admite decimales (si no, solo enteros). */
  decimal?: boolean;
  placeholder?: string;
  /** Opciones fijas del select. */
  opciones?: OpcionCampo[];
  /** Opciones del select que vienen del servidor. */
  fuente?: FuenteSelect;
  /** Valor por defecto al crear. */
  porDefecto?: string;
  /**
   * Datos de solo lectura que se muestran bajo el select según la opción elegida: `campo` = dato de la fila elegida;
   * `calibre` = nombre del calibre de la fila elegida (por su calibreId).
   */
  muestra?: { etiqueta: string; campo?: string; calibre?: boolean }[];
}

export interface ConfigCatalogo {
  clave: CatalogoKey;
  /** Texto pequeño sobre el título. */
  grupo: 'operativos' | 'catalogos';
  /** Tabla de la base (la usa el SP genérico de sincronización). Vacía en los maestros de solo lectura. */
  tabla: string;
  origen: OrigenListado;
  /** Con qué dato de la campaña se guarda: proyecto (idproyecto), cultivo (codigoCultivo) o ninguno. */
  alcance: 'proyecto' | 'cultivo' | 'ninguno';
  /** Maestros de apimaestra: solo se ven. */
  soloLectura?: boolean;
  titulo: string;
  /** "conductor", "vehículo"... (para los textos). */
  singular: string;
  /** "o" | "a": "Nuevo conductor", "Nueva presentación". */
  genero: 'o' | 'a';
  descripcion: string;
  buscarPlaceholder: string;
  campos: CampoCatalogo[];
  /** Columnas de la tabla (campos, o nombres que ya trae el SP, en orden). */
  columnas: string[];
  /** Etiqueta de las columnas que no son un campo editable. */
  etiquetas?: Record<string, string>;
  /** Campo que no se puede repetir (el servidor lo exige único). Vacío si no aplica. */
  campoUnico: string;
  /** Campos con los que se arma el nombre del registro en los mensajes. */
  campoNombre: string[];
  /** Columnas con filtro múltiple (solo sobre lo listado). */
  filtros: string[];
  /** Si la lista trae calibreId, se cruza con los calibres guardados en el equipo para mostrar `nombreCalibre`. */
  cruzarCalibre?: boolean;
}

/** Un registro tal como lo devuelve el servidor, con el estado ya normalizado a verdadero/falso. */
export interface RegistroCatalogo {
  id: number;
  /** Identificador para la tabla (los maestros pueden traer ids de texto). */
  clave: string;
  activo: boolean;
  [campo: string]: string | number | boolean;
}

const TIPOS_DOCUMENTO: OpcionCampo[] = [
  { value: '1', label: 'DNI' },
  { value: '4', label: 'CE' },
  { value: '6', label: 'RUC' },
  { value: '7', label: 'PAS' },
  { value: 'A', label: 'CDI' },
  { value: 'B', label: 'CRP' },
  { value: 'C', label: 'TIN' },
  { value: 'D', label: 'IN' },
  { value: '0', label: 'SIN RUC' },
];

const OPERATIVOS: Partial<Record<CatalogoKey, ConfigCatalogo>> = {
  conductores: {
    clave: 'conductores',
    tabla: 'PLANTA_Conductores',
    grupo: 'operativos',
    origen: { tipo: 'proyecto', catalogo: 'conductores' },
    alcance: 'proyecto',
    titulo: 'Conductores',
    singular: 'conductor',
    genero: 'o',
    descripcion: 'Conductores que se pueden elegir al armar una guía de remisión.',
    buscarPlaceholder: 'Apellidos, nombres, documento o licencia',
    campos: [
      { campo: 'apellidos', etiqueta: 'Apellidos', tipo: 'texto', maxLength: 200, requerido: true, placeholder: 'Ej: PÉREZ GÓMEZ' },
      { campo: 'nombres', etiqueta: 'Nombres', tipo: 'texto', maxLength: 200, requerido: true, placeholder: 'Ej: JUAN CARLOS' },
      { campo: 'tipoDocumentoIdentidad', etiqueta: 'Tipo de documento', tipo: 'select', requerido: true, opciones: TIPOS_DOCUMENTO, porDefecto: '1' },
      { campo: 'documentoIdentidad', etiqueta: 'Documento de identidad', tipo: 'texto', maxLength: 20, requerido: true, placeholder: 'Ej: 12345678' },
      { campo: 'licenciaConducir', etiqueta: 'Licencia de conducir', tipo: 'texto', maxLength: 30, mayusculas: true, placeholder: 'Ej: Q12345678' },
    ],
    columnas: ['apellidos', 'nombres', 'tipoDocumentoIdentidad', 'documentoIdentidad', 'licenciaConducir'],
    campoUnico: 'documentoIdentidad',
    campoNombre: ['apellidos', 'nombres'],
    filtros: ['tipoDocumentoIdentidad'],
  },
  vehiculos: {
    clave: 'vehiculos',
    tabla: 'PLANTA_Vehiculos',
    grupo: 'operativos',
    origen: { tipo: 'proyecto', catalogo: 'vehiculos' },
    alcance: 'proyecto',
    titulo: 'Vehículos',
    singular: 'vehículo',
    genero: 'o',
    descripcion: 'Vehículos que se pueden elegir al armar una guía de remisión.',
    buscarPlaceholder: 'Placa, remolque, marca o certificado',
    campos: [
      { campo: 'placaPrincipal', etiqueta: 'Placa principal', tipo: 'texto', maxLength: 20, requerido: true, mayusculas: true, placeholder: 'Ej: ABC123' },
      { campo: 'placaRemolque', etiqueta: 'Placa remolque', tipo: 'texto', maxLength: 20, mayusculas: true, placeholder: 'Ej: XYZ987' },
      { campo: 'marca', etiqueta: 'Marca', tipo: 'texto', maxLength: 100, placeholder: 'Ej: VOLVO' },
      { campo: 'certificadoInscripcion', etiqueta: 'Certificado de inscripción', tipo: 'texto', maxLength: 50, mayusculas: true },
    ],
    columnas: ['placaPrincipal', 'placaRemolque', 'marca', 'certificadoInscripcion'],
    campoUnico: 'placaPrincipal',
    campoNombre: ['placaPrincipal'],
    filtros: ['marca'],
  },
  transportistas: {
    clave: 'transportistas',
    tabla: 'PLANTA_Transportistas',
    grupo: 'operativos',
    origen: { tipo: 'proyecto', catalogo: 'transportistas' },
    alcance: 'proyecto',
    titulo: 'Transportistas',
    singular: 'transportista',
    genero: 'o',
    descripcion: 'Empresas de transporte que se pueden elegir al armar una guía de remisión.',
    buscarPlaceholder: 'Razón social o RUC',
    campos: [
      { campo: 'razonSocial', etiqueta: 'Razón social', tipo: 'texto', maxLength: 300, requerido: true, placeholder: 'Ej: TRANSPORTES DEL SUR S.A.C.' },
      { campo: 'ruc_Transportistas', etiqueta: 'RUC', tipo: 'texto', maxLength: 20, requerido: true, soloDigitos: true, placeholder: 'Ej: 20123456789' },
    ],
    columnas: ['razonSocial', 'ruc_Transportistas'],
    campoUnico: 'ruc_Transportistas',
    campoNombre: ['razonSocial'],
    filtros: [],
  },
  supervisores: {
    clave: 'supervisores',
    tabla: 'PLANTA_Supervisores',
    grupo: 'operativos',
    origen: { tipo: 'proyecto', catalogo: 'supervisores' },
    alcance: 'proyecto',
    titulo: 'Supervisores',
    singular: 'supervisor',
    genero: 'o',
    descripcion: 'Supervisores que se pueden asignar a un proceso.',
    buscarPlaceholder: 'DNI, nombre o celular',
    campos: [
      { campo: 'dni', etiqueta: 'DNI', tipo: 'texto', maxLength: 20, requerido: true, soloDigitos: true, placeholder: 'Ej: 12345678' },
      { campo: 'nombreCompleto', etiqueta: 'Nombre completo', tipo: 'texto', maxLength: 200, requerido: true, placeholder: 'Ej: JUAN PÉREZ GÓMEZ' },
      { campo: 'celular', etiqueta: 'Celular', tipo: 'texto', maxLength: 20, soloDigitos: true, placeholder: 'Ej: 987654321' },
    ],
    columnas: ['dni', 'nombreCompleto', 'celular'],
    campoUnico: 'dni',
    campoNombre: ['nombreCompleto'],
    filtros: [],
  },
  personalLogistica: {
    clave: 'personalLogistica',
    tabla: 'PLANTA_PersonalLogistica',
    grupo: 'operativos',
    origen: { tipo: 'proyecto', catalogo: 'personalLogistico' },
    alcance: 'proyecto',
    titulo: 'Personal Logística',
    singular: 'personal de logística',
    genero: 'o',
    descripcion: 'Personal de logística que se puede asignar a un proceso.',
    buscarPlaceholder: 'DNI, nombre o celular',
    campos: [
      { campo: 'dni', etiqueta: 'DNI', tipo: 'texto', maxLength: 20, requerido: true, soloDigitos: true, placeholder: 'Ej: 12345678' },
      { campo: 'nombreCompleto', etiqueta: 'Nombre completo', tipo: 'texto', maxLength: 200, requerido: true, placeholder: 'Ej: JUAN PÉREZ GÓMEZ' },
      { campo: 'celular', etiqueta: 'Celular', tipo: 'texto', maxLength: 20, soloDigitos: true, placeholder: 'Ej: 987654321' },
    ],
    columnas: ['dni', 'nombreCompleto', 'celular'],
    campoUnico: 'dni',
    campoNombre: ['nombreCompleto'],
    filtros: [],
  },
};

const NUEVOS: Partial<Record<CatalogoKey, ConfigCatalogo>> = {
  tipoProcesoEmpacado: {
    clave: 'tipoProcesoEmpacado',
    grupo: 'catalogos',
    tabla: 'PLANTA_TipoProcesoEmpacado',
    origen: { tipo: 'proyecto', catalogo: 'tiposProcesoEmpacado' },
    alcance: 'proyecto',
    titulo: 'Tipo Proceso Empacado',
    singular: 'tipo de proceso de empacado',
    genero: 'o',
    descripcion: 'Tipos de proceso de empacado de la campaña.',
    buscarPlaceholder: 'Código o nombre',
    campos: [
      { campo: 'codigo', etiqueta: 'Código', tipo: 'texto', maxLength: 5, requerido: true, mayusculas: true, placeholder: 'Ej: EXP' },
      { campo: 'nombre', etiqueta: 'Nombre', tipo: 'texto', maxLength: 100, requerido: true, placeholder: 'Ej: EXPORTACIÓN' },
    ],
    columnas: ['codigo', 'nombre'],
    campoUnico: 'codigo',
    campoNombre: ['nombre'],
    filtros: [],
  },
  clientes: {
    clave: 'clientes',
    grupo: 'catalogos',
    tabla: 'PLANTA_GrupoCliente',
    origen: { tipo: 'clientes' },
    alcance: 'ninguno',
    titulo: 'Grupo Clientes',
    singular: 'grupo de clientes',
    genero: 'o',
    descripcion: 'Agrupadores de clientes (se usan en la matriz de compatibilidad y en los consignatarios).',
    buscarPlaceholder: 'Código o razón social',
    campos: [
      { campo: 'codigo', etiqueta: 'Código', tipo: 'texto', maxLength: 50, requerido: true },
      { campo: 'nombre', etiqueta: 'Razón social', tipo: 'texto', maxLength: 200, requerido: true },
    ],
    columnas: ['codigo', 'nombre'],
    campoUnico: 'codigo',
    campoNombre: ['nombre'],
    filtros: [],
  },
  formatos: {
    clave: 'formatos',
    grupo: 'catalogos',
    tabla: 'PLANTA_Formatos',
    origen: { tipo: 'cultivo', catalogo: 'formatos' },
    alcance: 'cultivo',
    titulo: 'Formatos',
    singular: 'formato',
    genero: 'o',
    descripcion: 'Formatos de caja con su peso y el límite de cajas por palet.',
    buscarPlaceholder: 'Código o descripción',
    campos: [
      { campo: 'codigo', etiqueta: 'Código', tipo: 'texto', maxLength: 50, requerido: true, placeholder: 'Ej: 300G' },
      { campo: 'descripcion', etiqueta: 'Descripción', tipo: 'texto', maxLength: 100, requerido: true, placeholder: 'Ej: 300 G' },
      { campo: 'pesoPorCaja', etiqueta: 'Peso por caja', tipo: 'numero', decimal: true, requerido: true, placeholder: 'Ej: 2.4' },
      { campo: 'limiteCajasPorPalet', etiqueta: 'Límite de cajas por palet', tipo: 'numero', requerido: true, placeholder: 'Ej: 144' },
    ],
    columnas: ['codigo', 'descripcion', 'pesoPorCaja', 'limiteCajasPorPalet'],
    campoUnico: 'codigo',
    campoNombre: ['descripcion'],
    filtros: [],
  },
  presentaciones: {
    clave: 'presentaciones',
    grupo: 'catalogos',
    tabla: 'PLANTA_Presentacion',
    origen: { tipo: 'cultivo', catalogo: 'presentaciones' },
    alcance: 'cultivo',
    titulo: 'Presentaciones',
    singular: 'presentación',
    genero: 'a',
    descripcion: 'Presentaciones que se pueden elegir en la matriz de compatibilidad.',
    buscarPlaceholder: 'Código o nombre',
    campos: [
      { campo: 'codigo', etiqueta: 'Código', tipo: 'texto', maxLength: 20, requerido: true },
      { campo: 'nombre', etiqueta: 'Nombre', tipo: 'texto', maxLength: 100, requerido: true },
    ],
    columnas: ['codigo', 'nombre'],
    campoUnico: 'codigo',
    campoNombre: ['nombre'],
    filtros: [],
  },
  tiposCaja: {
    clave: 'tiposCaja',
    grupo: 'catalogos',
    tabla: 'PLANTA_TiposCaja',
    origen: { tipo: 'cultivo', catalogo: 'tiposCaja' },
    alcance: 'cultivo',
    titulo: 'Tipos de Caja',
    singular: 'tipo de caja',
    genero: 'o',
    descripcion: 'Tipos de caja que se pueden elegir en la matriz de compatibilidad.',
    buscarPlaceholder: 'Código o nombre',
    campos: [
      { campo: 'codigo', etiqueta: 'Código', tipo: 'texto', maxLength: 100, requerido: true },
      { campo: 'nombre', etiqueta: 'Nombre', tipo: 'texto', maxLength: 200, requerido: true },
    ],
    columnas: ['codigo', 'nombre'],
    campoUnico: 'codigo',
    campoNombre: ['nombre'],
    filtros: [],
  },
  tiposClamshell: {
    clave: 'tiposClamshell',
    grupo: 'catalogos',
    tabla: 'PLANTA_TiposClamshell',
    origen: { tipo: 'cultivo', catalogo: 'tiposClamshell' },
    alcance: 'cultivo',
    titulo: 'Tipos de Clamshell',
    singular: 'tipo de clamshell',
    genero: 'o',
    descripcion: 'Tipos de clamshell que se pueden elegir en la matriz de compatibilidad.',
    buscarPlaceholder: 'Código o nombre',
    campos: [
      { campo: 'codigo', etiqueta: 'Código', tipo: 'texto', maxLength: 100, requerido: true },
      { campo: 'nombre', etiqueta: 'Nombre', tipo: 'texto', maxLength: 200, requerido: true },
    ],
    columnas: ['codigo', 'nombre'],
    campoUnico: 'codigo',
    campoNombre: ['nombre'],
    filtros: [],
  },
  lugaresProduccion: {
    clave: 'lugaresProduccion',
    grupo: 'catalogos',
    tabla: 'PLANTA_LugaresProduccion',
    origen: { tipo: 'proyecto', catalogo: 'lugaresProduccion' },
    alcance: 'proyecto',
    titulo: 'Lugares de Producción',
    singular: 'lugar de producción',
    genero: 'o',
    descripcion: 'Lugares de producción de la campaña.',
    buscarPlaceholder: 'Código o descripción',
    campos: [
      { campo: 'codigo', etiqueta: 'Código', tipo: 'texto', maxLength: 50, requerido: true },
      { campo: 'descripcion', etiqueta: 'Descripción', tipo: 'texto', maxLength: 200, requerido: true },
    ],
    columnas: ['codigo', 'descripcion'],
    campoUnico: 'codigo',
    campoNombre: ['descripcion'],
    filtros: [],
  },
  codigosRancho: {
    clave: 'codigosRancho',
    grupo: 'catalogos',
    tabla: 'PLANTA_CodigosRancho',
    origen: { tipo: 'proyecto', catalogo: 'codigosRancho' },
    alcance: 'ninguno',
    titulo: 'Códigos Rancho',
    singular: 'código de rancho',
    genero: 'o',
    descripcion: 'Códigos de rancho que se asignan a los consignatarios.',
    buscarPlaceholder: 'Código',
    campos: [{ campo: 'codigo', etiqueta: 'Código', tipo: 'texto', maxLength: 50, requerido: true }],
    columnas: ['codigo'],
    campoUnico: 'codigo',
    campoNombre: ['codigo'],
    filtros: [],
  },
  categorias: {
    clave: 'categorias',
    grupo: 'catalogos',
    tabla: 'PLANTA_Categorias',
    origen: { tipo: 'cultivo', catalogo: 'categorias' },
    alcance: 'cultivo',
    titulo: 'Categorías',
    singular: 'categoría',
    genero: 'a',
    descripcion: 'Categorías de la campaña, cada una con su calibre.',
    buscarPlaceholder: 'Código, nombre o calibre',
    campos: [
      { campo: 'codigo', etiqueta: 'Código', tipo: 'texto', maxLength: 50, requerido: true },
      { campo: 'nombre', etiqueta: 'Nombre', tipo: 'texto', maxLength: 100, requerido: true },
      { campo: 'calibreId', etiqueta: 'Calibre', tipo: 'select', requerido: true, fuente: { origen: 'calibres', valor: 'id', etiqueta: ['calibre'] } },
      { campo: 'descripcion', etiqueta: 'Descripción', tipo: 'texto', maxLength: 200 },
    ],
    columnas: ['codigo', 'nombre', 'nombreCalibre', 'descripcion'],
    etiquetas: { nombreCalibre: 'Calibre' },
    campoUnico: 'codigo',
    campoNombre: ['nombre'],
    filtros: ['nombreCalibre'],
    cruzarCalibre: true,
  },
  tiposEmpaque: {
    clave: 'tiposEmpaque',
    grupo: 'catalogos',
    tabla: 'PLANTA_TiposEmpaque',
    origen: { tipo: 'cultivo', catalogo: 'tiposEmpaque' },
    alcance: 'cultivo',
    titulo: 'Tipos de Empaque',
    singular: 'tipo de empaque',
    genero: 'o',
    descripcion: 'Tipos de empaque de la campaña, cada uno con su categoría.',
    buscarPlaceholder: 'Código, descripción o categoría',
    campos: [
      { campo: 'codigo', etiqueta: 'Código', tipo: 'texto', maxLength: 50, requerido: true },
      { campo: 'descripcion', etiqueta: 'Descripción', tipo: 'texto', maxLength: 100 },
      { campo: 'codigoCategoria', etiqueta: 'Categoría', tipo: 'select', requerido: true, fuente: { origen: 'cultivo', catalogo: 'categorias', valor: 'codigo', etiqueta: ['codigo', 'nombre'] }, muestra: [{ etiqueta: 'Calibre', calibre: true }] },
    ],
    columnas: ['codigo', 'descripcion', 'categoria', 'nombreCalibre'],
    etiquetas: { categoria: 'Categoría', nombreCalibre: 'Calibre' },
    campoUnico: 'codigo',
    campoNombre: ['descripcion', 'codigo'],
    filtros: ['categoria', 'nombreCalibre'],
    cruzarCalibre: true,
  },
  tiposEmpaqueGuia: {
    clave: 'tiposEmpaqueGuia',
    grupo: 'catalogos',
    tabla: 'PLANTA_TiposEmpaqueGuia',
    origen: { tipo: 'cultivo', catalogo: 'tiposEmpaqueGuia' },
    alcance: 'cultivo',
    titulo: 'Tipos Empaque Guía',
    singular: 'tipo de empaque guía',
    genero: 'o',
    descripcion: 'Tipos de empaque que se muestran en la guía, cada uno con su tipo de empaque.',
    buscarPlaceholder: 'Código, nombre o tipo de empaque',
    campos: [
      { campo: 'codigo', etiqueta: 'Código', tipo: 'texto', maxLength: 20, requerido: true },
      { campo: 'nombre', etiqueta: 'Nombre', tipo: 'texto', maxLength: 100 },
      { campo: 'codigoTipoEmpaque', etiqueta: 'Tipo de empaque', tipo: 'select', requerido: true, fuente: { origen: 'cultivo', catalogo: 'tiposEmpaque', valor: 'codigo', etiqueta: ['codigo', 'descripcion'] }, muestra: [{ etiqueta: 'Categoría', campo: 'categoria' }, { etiqueta: 'Calibre', calibre: true }] },
    ],
    columnas: ['codigo', 'nombre', 'TipoEmpaque', 'categoria', 'nombreCalibre'],
    etiquetas: { TipoEmpaque: 'Tipo de empaque', categoria: 'Categoría', nombreCalibre: 'Calibre' },
    campoUnico: 'codigo',
    campoNombre: ['nombre', 'codigo'],
    filtros: ['TipoEmpaque', 'categoria', 'nombreCalibre'],
    cruzarCalibre: true,
  },
  destinos: {
    clave: 'destinos',
    grupo: 'catalogos',
    tabla: '',
    origen: { tipo: 'paises' },
    alcance: 'ninguno',
    soloLectura: true,
    titulo: 'Destinos - Maestro',
    singular: 'destino',
    genero: 'o',
    descripcion: 'Países de destino que vienen de la apimaestra (solo lectura).',
    buscarPlaceholder: 'País o nacionalidad',
    campos: [],
    columnas: ['id', 'pais', 'nacionalidad'],
    etiquetas: { id: 'Código', pais: 'País', nacionalidad: 'Nacionalidad' },
    campoUnico: '',
    campoNombre: ['pais'],
    filtros: [],
  },
  calibres: {
    clave: 'calibres',
    grupo: 'catalogos',
    tabla: '',
    origen: { tipo: 'calibres' },
    alcance: 'ninguno',
    soloLectura: true,
    titulo: 'Calibres - Maestro',
    singular: 'calibre',
    genero: 'o',
    descripcion: 'Calibres de la campaña que vienen de la apimaestra (solo lectura).',
    buscarPlaceholder: 'Calibre',
    campos: [],
    columnas: ['id', 'calibre'],
    etiquetas: { id: 'Código', calibre: 'Calibre' },
    campoUnico: '',
    campoNombre: ['calibre'],
    filtros: [],
  },
  transportes: {
    clave: 'transportes',
    grupo: 'catalogos',
    tabla: '',
    origen: { tipo: 'transportes' },
    alcance: 'ninguno',
    soloLectura: true,
    titulo: 'Transportes - Maestro',
    singular: 'transporte',
    genero: 'o',
    descripcion: 'Tipos de transporte que vienen de la apimaestra (solo lectura).',
    buscarPlaceholder: 'Transporte',
    campos: [],
    columnas: ['id', 'transporte'],
    etiquetas: { id: 'Código', transporte: 'Transporte' },
    campoUnico: '',
    campoNombre: ['transporte'],
    filtros: [],
  },
};

export const CATALOGOS = { ...OPERATIVOS, ...NUEVOS } as Record<CatalogoKey, ConfigCatalogo>;

const texto = (valor: unknown): string => String(valor ?? '').trim();
const esVerdadero = (valor: unknown): boolean =>
  typeof valor === 'string' ? ['1', 'true', 'si', 'sí'].includes(valor.trim().toLowerCase()) : valor === true || valor === 1;

/** Etiqueta de una columna o campo. */
export function etiquetaDe(config: ConfigCatalogo, campo: string): string {
  return config.campos.find((c) => c.campo === campo)?.etiqueta ?? config.etiquetas?.[campo] ?? campo;
}

/**
 * Arma un registro con los datos del catálogo (todo como texto) y el estado como verdadero/falso.
 * Los maestros de solo lectura no traen estado: se toman como activos.
 */
export function armarRegistro(config: ConfigCatalogo, fila: Record<string, any>, posicion = 0): RegistroCatalogo {
  const registro: RegistroCatalogo = {
    id: Number(fila['id'] ?? 0),
    clave: texto(fila['id']) || String(posicion),
    activo: fila['activo'] === undefined ? true : esVerdadero(fila['activo']),
  };
  for (const campo of new Set([...config.campos.map((c) => c.campo), ...config.columnas, 'calibreId'])) registro[campo] = texto(fila[campo]);
  return registro;
}

/** Texto que se muestra de un campo (en los selects de opciones fijas, la etiqueta de la opción). */
export function valorMostrado(config: ConfigCatalogo, registro: RegistroCatalogo, campo: string): string {
  const def = config.campos.find((c) => c.campo === campo);
  const valor = texto(registro[campo]);
  if (def?.tipo === 'select' && def.opciones) return def.opciones.find((o) => o.value === valor)?.label ?? (valor || '—');
  return valor || '—';
}

/** Nombre del registro para los mensajes ("PÉREZ GÓMEZ JUAN"). */
export function nombreDe(config: ConfigCatalogo, registro: RegistroCatalogo): string {
  return config.campoNombre.map((c) => texto(registro[c])).filter(Boolean).join(' ') || texto(registro[config.campoUnico]) || texto(registro['clave']);
}

/** Lo que se agrega a cada fila al guardar según el alcance del catálogo: idproyecto, codigoCultivo o nada. */
export function extraDeAlcance(config: ConfigCatalogo, idProyecto: string, codigoCultivo: string): Record<string, string> {
  if (config.alcance === 'proyecto') return { idproyecto: texto(idProyecto) };
  if (config.alcance === 'cultivo') return { codigoCultivo: texto(codigoCultivo) };
  return {};
}

/** Arma lo que espera el servidor para guardar (texto JSON de una lista de una). */
export function registroAJson(config: ConfigCatalogo, id: number, valores: Record<string, string>, activo: boolean, extra: Record<string, string>): string {
  const fila: Record<string, unknown> = { id, ...extra };
  for (const c of config.campos) fila[c.campo] = texto(valores[c.campo]);
  fila['activo'] = activo;
  return JSON.stringify([fila]);
}
