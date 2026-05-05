export interface Formato {
  id: number;
  codigo: string;
  descripcion: string;
  nombre?: string;
  pesoPorCaja: number;
  limiteCajasPorPalet: number;
  activo: boolean;
  bd?: number;
}

export interface Variedad {
  id: number;
  codigo: string;
  nombre: string;
  procedencia: string;
  esEnsayo: boolean;
  activo: boolean;
  bd?: number;
}

export interface Cliente {
  id: number;
  codigo: string;
  razonSocial: string;
  activo: boolean;
  bd?: number;
}

export interface Destino {
  id: number;
  codigo: string;
  nombre: string;
  pais: string;
  activo: boolean;
  bd?: number;
}

export interface Consignatario {
  id: number;
  codigo: string;
  razonSocial: string;
  nombre: string;
  activo: boolean;
  bd?: number;
}

export interface TipoEmpaque {
  id: number;
  codigo: string;
  descripcion: string;
  activo: boolean;
  bd?: number;
}

export interface Calibre {
  id: number;
  codigo?: string;
  nombre: string;
  activo: boolean;
  bd?: number;
}

export interface Campania {
  Id: number;
  Nombre: string;
  FechaInicio: string | null;
  FechaFin: string | null;
  Activa: boolean;
  FechaCreacion: string;
  bd?: number;
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
  codigo?: string;
  nombre: string;
  activo: boolean;
  fechaCreacion?: string;
  bd?: number;
}

export interface Presentacion {
  id: number;
  nombre: string;
  descripcion?: string;
  activo: boolean;
  fechaCreacion?: string;
  bd?: number;
}

export interface TipoCaja {
  id: number;
  codigo?: string;
  nombre: string;
  activo: boolean;
  fechaCreacion?: string;
  bd?: number;
}

export interface TipoClamshell {
  id: number;
  codigo?: string;
  nombre: string;
  activo: boolean;
  fechaCreacion?: string;
  bd?: number;
}

export interface LugarProduccion {
  id: number;
  codigo: string;
  nombre: string;
  descripcion: string;
  activo: boolean;
  bd?: number;
}

export interface CodigoRancho {
  Id: number;
  Codigo: string;
  LugarProduccionId: number;
  ConsignatarioId: number;
  Activo: boolean;
  bd?: number;
}

export interface Transporte {
  id: number;
  codigo?: string;
  nombre: string;
  descripcion?: string;
  activo: boolean;
  fechaCreacion?: string;
  bd?: number;
}

export interface Categoria {
  id: number;
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
  nombreCompleto: string;
  documentoIdentidad: string;
  licenciaConducir?: string;
  activo: boolean;
  fechaCreacion?: string;
  bd?: number;
}

export interface Vehiculo {
  id: number;
  placaPrincipal: string;
  placaRemolque?: string;
  marca?: string;
  certificadoInscripcion?: string;
  activo: boolean;
  fechaCreacion?: string;
  bd?: number;
}

export interface Transportista{
  id: number;
  razonSocial: string;
  ruc: string;
  activo: boolean;
  fechaCreacion?: string;
  bd?: number;
}

export interface Supervisor{
  id: number;
  dni: string;
  nombreCompleto: string;
  celular?: string;
  activo: boolean;
  fechaCreacion?: string;
  bd?: number;
}

export interface PersonalLogistico{
  id: number;
  dni: string;
  nombreCompleto: string;
  celular?: string;
  activo: boolean;
  fechaCreacion?: string;
  bd?: number;
}

export interface Acopio{
  id: number;
  codigo: string;
  nombre: string;
  serieGuia: string;
  activo: boolean;
  fechaCreacion?: string;
  bd?: number;
}