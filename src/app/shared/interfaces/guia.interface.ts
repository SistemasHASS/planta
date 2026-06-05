
/** Payload para crear una nueva guía (coincide con PLANTA_GuiasRemision) */
export interface GuiaRemision {
  codigoGuiaRemision?: string;
  transactionId_uuid: string;
  serie?: string;
  numero?: string;
  codigoProceso: string;
  nombreProces?:string;
  documentoDestinatario: string;
  nombreDestinatario?:string;
  puntoPartida: string;
  puntoLlegada?: string;
  fechaEmision?: string | null;
  idTransportista: number | null;
  idConductor: number | null;
  idVehiculo: number | null;
  motivoTraslado: string;
  precinto?: string | null;
  inicioTraslado?: string | null;
  observaciones?: string | null;
  estado: string;
  pesoTotal: number;
  totalCajas: number;
  cantidadPalets: number;
  usuarioEmision: string;
  fechaCreacionWeb: string;
  fechaCierre?: string | null;
  parihuelas?: number | null;
  observacionesUsuario?: string | null;
  esReposicion: boolean;
  inspeccionTemperatura?: number | null;
  inspeccionLibreOlores?: boolean | null;
  inspeccionLibreInsectos?: boolean | null;
  inspeccionLibreMateriasExtranas?: boolean | null;
  inspeccionUnidadLimpia?: boolean | null;
  inspeccionObservaciones?: string | null;
  inspeccionMedidaCorrectiva?: string | null;
  numeroViaje?: number | null;
  snapshotDetalle?: string | null;
  esEnsayo: boolean;
  eliminado?: boolean;
  detallePalets?: GuiaRemisionPalet[] | null;
}

/** Relación guía-palet (coincide con PLANTA_GuiasRemision_Palets) */
export interface GuiaRemisionPalet {
  codigoGuiaRemision: string;
  transactionId_uuid: string;
  codigoPalet: string;
}
