
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
  eliminado?:boolean
}

export interface DPalet {
  id:number;
  idPalet:string;
  idProceso?:string;
  idDPalet:string;
  documentoCliente?:string;
  destinoId:string;
  destinoNombre?:string;
  documentoConsignatario:string;
  consignatarioNombre:string;
  formatoId:number;
  formatoNombre?:string;
  tiposEmpaqueId:number;
  calibreId?:string;
  presentacionId:number | null;
  variedadId:string;
  variedadNombre?:string;
  lugarProduccionId:number;
  codigoRanchoId:number;
  cantidadCajas:number;
  tipoCajaId:number;
  tipoClamshellId:number;
  pesoPorCaja:number;
  pesoTotal:number;
  tipoEmpaqueGuiaId:number | null;
  tipoEmpaqueGuiaNombre?:string;
  transporteId:string;
  transporteNombre?:string;
  tipoProcesoEmpacadoId:number | null;
  tipoProcesoEmpacadoNombre?:string;
  esReposicion:boolean;
  variedadGuiaId:string | null;
  esEnsayo:boolean;
  presentacionNombre?:string;
  codigoRanchoNombre?:string;
  lugarProduccionNombre?:string;
  eliminado:boolean|false;
  fechaCreacion?:string;
  bd?:number;
}
