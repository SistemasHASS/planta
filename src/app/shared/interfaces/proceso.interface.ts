export interface Proceso {
  id: number;
  idProyecto: number;
  acopioId: number;
  acopioNombre: string;
  fechaProceso: string;
  estado: string;
  fechaApertura: string;
  fechaCierre: string | null;
  turno: string;
  idUsuarioApertura: string;
  idRolApertura: string;
  idUsuarioCierre: string;
  idRolCierre: string;
  supervisores: string | null;
  logisticos: string | null;
  db?:number;
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
