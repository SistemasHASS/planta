
/** Payload para crear una nueva guía (coincide con PLANTA_GuiasRemision) */
export interface GuiaRemision {
  codigoGuiaRemision?: string;
  transactionId_uuid: string;
  serie?: string;
  numero?: string;
  codigoProceso: string;
  nombreProceso?:string;
  documentoDestinatario: string;
  nombreDestinatario?:string;
  puntoPartida: string;
  puntoLlegada?: string;
  ubigeoPartida?: string;
  ubigeoLlegada?: string;
  fechaEmision?: string | null;
  idTransportista: number | null;
  razonSocialTransportista?:string;
  idConductor: number | null;
  nombreConductor?: string;
  apellidoConductor?: string;
  nombreCompletoConductor?: string;
  idVehiculo: number | null;
  placaPrincipalVehiculo?: string;
  motivoTraslado: string;
  descripcionMotivoTraslado?: string | null;
  precinto?: string | null;
  fechaEntregaBienes?: string | null;
  inicioTraslado?: string | null;
  observaciones?: string | null;
  estado: string;
  estadoSunat?: string;
  codigoEstadoSunat?: string;
  pdfFileUrl?: string | null;
  xmlFileSignUrl?: string | null;
  xmlFileSunatUrl?: string | null;
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
  multiple?: number;
  eliminado?: boolean;
  sincroniza?: string;
  detallePalets?: GuiaRemisionPalet[] | null;
}

/** Relación guía-palet (coincide con PLANTA_GuiasRemision_Palets) */
export interface GuiaRemisionPalet {
  codigoGuiaRemision: string;
  transactionId_uuid: string;
  codigoPalet: string;
}
