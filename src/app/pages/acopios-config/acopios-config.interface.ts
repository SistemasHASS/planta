/** Un tipo de proceso empacado ya asignado a un acopio (activo = marcado). */
export interface TipoDeAcopio {
  id: number;
  codigo: string;
  nombre: string;
  /** true = es un proceso de máquina. */
  maquina?: boolean;
  activo: boolean;
  /** Kilos de la tarea de un empacador (solo viene con el parámetro Flujo_Empaque activo y si ya se configuró). */
  kilosTarea?: number | null;
}

/** Un acopio con su configuración, tal como lo devuelve el servidor. */
export interface AcopioConfig {
  id: number;
  codigoAcopio: string;
  acopioNombre: string;
  serieGuia: string;
  tiposProcesoEmpacado: TipoDeAcopio[];
}
