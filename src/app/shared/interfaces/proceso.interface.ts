import { PersonalLogistico, Supervisor } from "./catalogo.interface";

export interface Proceso {
  id?: number;
  idProceso: string;
  idProyecto: string;
  codigoAcopio: string;
  acopioNombre: string;
  fechaProceso: string;
  estado: string;
  fechaApertura: string;
  fechaCierre?: string | null;
  turno: string;
  idUsuarioApertura?: string;
  idRolApertura?: string;
  idUsuarioCierre?: string;
  idRolCierre?: string;
  db?:number;
}


export interface DProcesoLogistico{
  id?: number;
  idProceso: string;
  idLogistico: number; 
  fechaCreacion?: string;
  db?:number
}

export interface DProcesoSupervisor{
  id?: number;
  idProceso: string;
  idSupervisor: number;
  fechaCreacion?: string;
  db?:number
}

// supervisores: string | null;
// logisticos: string | null;

export interface CrearProcesoRequest {
  fechaProceso: string;
  codigoAcopio: string;
  turno: string;
  usuarioId: number;
  campaniaId?: number | null;
  supervisores?: Supervisor[];
  logisticos?: PersonalLogistico[];
}
