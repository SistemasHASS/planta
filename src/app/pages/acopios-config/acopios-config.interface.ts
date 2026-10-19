/** Un tipo de proceso empacado ya asignado a un acopio (activo = marcado). */
export interface TipoDeAcopio {
  id: number;
  codigo: string;
  nombre: string;
  activo: boolean;
}

/** Un acopio con su configuración, tal como lo devuelve el servidor. */
export interface AcopioConfig {
  id: number;
  codigoAcopio: string;
  acopioNombre: string;
  serieGuia: string;
  tiposProcesoEmpacado: TipoDeAcopio[];
}
