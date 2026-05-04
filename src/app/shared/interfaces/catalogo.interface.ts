export interface Acopio {
  Id: number;
  Codigo: string;
  Nombre: string;
  Activo: boolean;
  FechaCreacion: string;
}

export interface Formato {
  Id: number;
  Codigo: string;
  Descripcion: string;
  Nombre?: string; // Aliased from Descripcion in cascading SP
  PesoPorCaja: number;
  LimiteCajasPorPalet: number;
  Activo: boolean;
}

export interface Variedad {
  Id: number;
  Codigo: string;
  Nombre: string;
  Procedencia: string;
  EsEnsayo: boolean;
  Activo: boolean;
}

export interface Cliente {
  Id: number;
  Codigo: string;
  RazonSocial: string;
  Activo: boolean;
}

export interface Destino {
  Id: number;
  Codigo: string;
  Nombre: string;
  Pais: string;
  Activo: boolean;
}

export interface Consignatario {
  Id: number;
  Codigo: string;
  RazonSocial: string;
  Nombre: string;
  Activo: boolean;
}

export interface TipoEmpaque {
  Id: number;
  Codigo: string;
  Descripcion: string;
  Activo: boolean;
}

export interface Calibre {
  Id: number;
  Codigo?: string;
  Nombre: string;
  Activo: boolean;
}

export interface Campania {
  Id: number;
  Nombre: string;
  FechaInicio: string | null;
  FechaFin: string | null;
  Activa: boolean;
  FechaCreacion: string;
}

export interface TipoProcesoEmpacado {
  Id: number;
  Codigo: string;
  Nombre: string;
  Descripcion?: string; // alias for Nombre in some contexts
  Activo: boolean;
}

export interface TipoEmpaqueGuia {
  Id: number;
  Codigo?: string;
  Nombre: string;
  Activo: boolean;
  FechaCreacion?: string;
}

export interface Presentacion {
  Id: number;
  Nombre: string;
  Descripcion?: string; // actual DB column, aliased as Nombre by SP
  Activo: boolean;
  FechaCreacion?: string;
}

export interface TipoCaja {
  Id: number;
  Codigo?: string;
  Nombre: string;
  Activo: boolean;
  FechaCreacion?: string;
}

export interface TipoClamshell {
  Id: number;
  Codigo?: string;
  Nombre: string;
  Activo: boolean;
  FechaCreacion?: string;
}

export interface LugarProduccion {
  Id: number;
  Codigo: string;
  Nombre: string;
  Descripcion: string;
  Activo: boolean;
}

export interface CodigoRancho {
  Id: number;
  Codigo: string;
  LugarProduccionId: number;
  ConsignatarioId: number;
  Activo: boolean;
}

export interface Transporte {
  Id: number;
  Codigo?: string;
  Nombre: string;
  Descripcion?: string;
  Activo: boolean;
  FechaCreacion?: string;
}

export interface Categoria {
  Id: number;
  Codigo: string;
  Nombre: string;
  Descripcion: string;
  Activo: boolean;
  FechaCreacion: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}
