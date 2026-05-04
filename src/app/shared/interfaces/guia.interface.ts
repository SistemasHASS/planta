export interface GuiaRemision {
  Id: number;
  Serie: string | null;
  Numero: number | null;
  NumeroViaje: number | null;
  ProcesoId: number;
  DestinatarioId: number | null;
  TransportistaId: number | null;
  ConductorId: number | null;
  VehiculoId: number | null;
  Precinto: string | null;
  CantidadPalets: number;
  TotalCajas: number;
  PesoTotal: number;
  Parihuelas: number | null;
  Estado: string;
  EsReposicion: boolean;
  Observaciones: string | null;
  FechaEmision: string | null;
  FechaCreacion: string;
  FechaCierre: string | null;
  DestinatarioNombre: string | null;
  TransportistaNombre: string | null;
  ConductorNombre: string | null;
  PlacaPrincipal: string | null;
  detallePalets?: DetallePaletGuia[];
}

export interface DetallePaletGuia {
  Id: number;
  PaletId: number;
  NumeroPalet: number | null;
  CantidadCajas: number;
  PesoTotal: number;
  PaletEstado: string;
}
