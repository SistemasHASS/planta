export interface Proceso {
  Id: number;
  FechaProceso: string;
  Estado: string;
  AcopioId: number;
  Turno: string;
  CampaniaId: number | null;
  FechaApertura: string;
  FechaCierre: string | null;
  UsuarioAperturaId: number;
  UsuarioCierreId: number | null;
  AcopioCodigo: string;
  AcopioNombre: string;
  UsuarioApertura: string;
  UsuarioCierre: string | null;
  CampaniaNombre: string | null;
  Supervisores: string | null;
  Logisticos: string | null;
}

export interface CrearProcesoRequest {
  fechaProceso: string;
  acopioId: number;
  turno: string;
  usuarioId: number;
  campaniaId?: number | null;
  supervisores?: number[];
  logisticos?: number[];
}

export interface PersonalDisponible {
  Id: number;
  NombreCompleto: string;
  DNI: string | null;
  ocupado: boolean;
}
