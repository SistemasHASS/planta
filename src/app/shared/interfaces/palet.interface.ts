
// export interface Palets {
//   Id: number;
//   Numero: number;
//   NumeroPalet: number | null;
//   Estado: string;
//   CantidadCajas: number;
//   PesoTotal: number;
//   PorcentajeAvance: number;
//   FormatoId: number | null;
//   ProcesoId: number;
//   AcopioId: number;
//   FechaCreacion: string;
//   FechaCierre: string | null;
//   Observaciones: string | null;
//   MedidaCorrectiva: string | null;
//   FormatoDescripcion: string | null;
//   LimiteCajasPorPalet: number | null;
//   AcopioCodigo: string;
//   AcopioNombre: string;
//   Turno: string;
//   NumeroViaje: number | null;
//   PrimeraComposicionFecha: string | null;
// }

export interface Palet{
  id: number;
  idPalet:string,
  idProceso: string;
  numeroPalet?: number | null
  codigoAcopio: string,
  acopioNombre: string;
  formatoId?: number | 0,
  estado: string,
  cantidadCajas: number | 0,
  pesoTotal: number | 0,
  porcentajeAvance: number | 0,
  fechaApertura: string
  fechaCierre?: string | '',
  observaciones?: string,
  medidaCorrectiva?: string, 
  formatoDescripcion?: string | null;
  limiteCajasPorPalet?: number | null;
  turno?: string;
  numeroViaje?: number | null;
  primeraComposicionFecha?: string | null;
  fechaCreacion?: string,
  modo?:string
  bd?:number
}

export interface Composicion {
  Id: number;
  PaletId: number;
  ClienteId: number;
  ConsignatarioId: number;
  DestinoId: number;
  FormatoId: number;
  TipoEmpaqueId: number;
  CalibreId: number | null;
  VariedadId: number;
  LugarProduccionId: number;
  CodigoRanchoId: number;
  TransporteId: number | null;
  CantidadCajas: number;
  PesoPorCaja: number;
  PesoTotal: number;
  EsReposicion: boolean;
  EsEnsayo: boolean;
  FechaCreacion: string;
  ClienteNombre: string;
  ConsignatarioNombre: string;
  DestinoNombre: string;
  FormatoNombre: string;
  TipoEmpaqueNombre: string;
  TipoEmpaqueGuiaNombre: string | null;
  TipoProcesoEmpacadoCodigo: string | null;
  Presentacion: string | null;
  CalibreNombre: string | null;
  VariedadNombre: string;
  LugarProduccionCodigo: string;
  LDP: string | null;
  CodigoRancho: string;
  TransporteNombre: string | null;
  EditablePorTipo: boolean;
  GuiaBloqueanteId: number | null;
}

export interface AgregarComposicionRequest {
  paletId: number;
  consignatarioId: number;
  destinoId: number;
  formatoId: number;
  tipoEmpaqueId: number;
  calibreId?: number | null;
  clienteId?: number | null;
  categoriaId?: number | null;
  tipoEmpaqueGuiaId?: number | null;
  tipoCajaId?: number | null;
  tipoClamshellId?: number | null;
  presentacionId?: number | null;
  tipoProcesoEmpacadoId?: number | null;
  variedadId: number;
  variedadGuiaId?: number | null;
  lugarProduccionId: number;
  codigoRanchoId: number;
  transporteId?: number | null;
  cantidadCajas: number;
  pesoPorCaja: number;
  pesoTotal: number;
  esReposicion?: boolean;
  esEnsayo?: boolean;
  usuarioId: number;
}
