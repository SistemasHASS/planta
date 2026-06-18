
export interface Destinatario{
  id: number;
  idCliente: number;
  documentoFiscal: string;
  documento: string;
  nombre: string;
  domicilioFiscal: string;
  puntoLlegada: string;
  activo: boolean;
  fechaCreacion: string;
  bd?: number;
}
export interface TipoProcesoEmpacado {
  id: number;
  idproyecto: string;
  codigo: string;
  nombre: string;
  activo: boolean;
  fechaCreacion: string;
  bd?: number;
}

export interface Fundo {
  id: number;
  codigoFundo: string;
  empresa: number;
  fundo: string;
  nombreFundo: string;
}

export interface Cultivo {
  id: number;
  empresa: number;
  cultivo: number;
  codigo: string;
  descripcion: string;
  estado: number;
}

export interface Campania {
  idproyecto: string;
  descripcion: string;
  fecha_inicio: string;
  fecha_fin: string;
  ruc: string;
  estado: number;
  codcultivo: string;
  codigoSpring: string;
  aplicacion: string;
  idfundo: string;
  fruta: string;
}


export interface Formato {
  id: number;
  codigoCultivo: string,
  codigo: string,
  descripcion: string,
  pesoPorCaja: number,
  limiteCajasPorPalet: number,
  activo:boolean,
  fechaCreacion: string,
  bd?: number;
}

export interface Variedad {
  id: string;
  cultivo: string;
  idcultivo: string;
  codigo: string;
  idvariedad: string;
  variedad: string
  procedencia: string;
  esEnsayo: boolean;
  eliminado?: boolean;
  bd?: number;
}

export interface Cliente {
  id: number;
  codigo: string;
  nombre: string;
  activo: boolean;
  fechaCreacion: string;
  bd: number;
}

export interface Destino {
  id: string;
  pais: string;
  nacionalidad: string;
}

export interface Consignatario {
  id: number;
  documento: string;
  nombre: string;
  codigoGrupoCliente: string;
  nombreGrupoCliente: string;
  codigosRancho: CodigoRancho[];
  bd?:number;
}

export interface TipoEmpaque {
  id: number;
  codigoCultivo: string;
  codigoCategoria:string;
  nombreCategoria: string;
  nombreCalibre?: string;
  codigo: string;
  descripcion: string;
  activo: boolean;
  fechaCreacion: string;
  bd?: number;
}

export interface Calibre {
  id: string;
  calibre: string;
  idCultivo: string;
}

export interface TipoProcesoEmpacado {
  Id: number;
  Codigo: string;
  Nombre: string;
  Descripcion?: string;
  Activo: boolean;
}

export interface TipoEmpaqueGuia {
  id: number;
  codigoCultivo: string;
  codigo: string;
  nombre: string;
  codigoTipoEmpaque: string;
  nombreTipoEmpaque: string;
  nombreCategoria?: string;
  nombreCalibre?: string;
  activo: boolean;
  fechaCreacion: string;
  bd?: number;
}

export interface Presentacion {
  id: number;
  codigo: string;
  nombre?: string;
  activo: boolean;
  fechaCreacion?: string;
  bd?: number;
}

export interface TipoCaja {
  id: number;
  codigoCultivo:string;
  codigo:string;
  nombre:string;
  activo:boolean;
  fechaCreacion:string;
  bd?: number;
}

export interface TipoClamshell {
  id: string;
  codigoCultivo: string;
  codigo: string;
  nombre: string;
  activo: boolean;
  fechaCreacion: string;
  bd?: number;
}

export interface LugarProduccion {
  id: number;
  idproyecto: string;
  codigo: string;
  descripcion: string;
  activo: boolean;
  fechaCreacion: string;
  bd?: number;
}

export interface LugarProduccionConfig {
  id: number;
  idproyecto: string;
  idCodigoRancho: number;
  idLugaresDeProduccion: number;
  activo: boolean;
  fechaCreacion: string;
  bd?: number;
}

export interface CodigoRancho {
  id: number;
  codigo: string;
  activo: boolean;
  fechaCreacion: string;
  bd?: number;
}

export interface CodigoCaja {
  id: number;
  codigoItem: string;
  documentoConsignatario: string;
  idDestino: string;
  codigoFormato: string;
  codigoVariedad: string;
  idTipoEmpaqueGuia: number;
  codigoRancho: string;
  idLugarProduccion: number;
  idPresentacion: number | null;
  pesoPorCaja: number;
  idTransporte: string;
  fechaCreacion: string;
  bd?: number;
}

export interface Transporte {
  id: string;
  transporte: string;
  factorTEUtoPallet: string;
}

export interface Categoria {
  id: number;
  calibreId: string;
  calibreNombre: string;
  codigoCultivo: string;
  codigo: string;
  nombre: string;
  descripcion: string;
  activo: boolean;
  fechaCreacion: string;
  bd?: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}


// Categoria Operativos 

export interface Conductor {
  id: number;
  idproyecto: string;
  documentoIdentidad: string;
  licenciaConducir?: string;
  nombreCompleto: string;
  activo: boolean;
  fechaCreacion: string;
  bd?: number;
}

export interface Vehiculo {
  id: number;
  idproyecto: string;
  placaPrincipal: string;
  placaRemolque?: string;
  marca?: string;
  certificadoInscripcion?: string;
  activo: boolean;
  fechaCreacion: string;
  bd?: number;
}

export interface Transportista {
  id: number;
  idproyecto: string;
  ruc_Transportistas: string;
  razonSocial: string;
  activo: boolean;
  fechaCreacion: string;
  bd?: number;
}

export interface Supervisor {
  id: number;
  idproyecto: string;
  dni: string;
  nombreCompleto: string;
  celular: string;
  activo: boolean;
  fechaCreacion: string;
  ocupado?: boolean;
  bd?: number;
}

export interface PersonalLogistico {
  id: number;
  idproyecto:string;
  dni:string;
  nombreCompleto:string;
  celular:string;
  activo:boolean;
  fechaCreacion:string;
  ocupado?: boolean;
  bd?: number;
}

export interface Acopio {
  id: number;
  idempresa: string;
  ruc: string;
  codigoAcopio: string;
  acopioNombre: string;
  serieGuia: string;
  bd?: number;
}

export interface AcopioDetalle{
  id: number;
  codigoAcopio: string;
  codigoTipoProcesoEmpacado: string;
  nombreTipoProcesoEmpacado: string;
  fechaCreacion: string;
  activo?: boolean;
  bd?: number;
}
