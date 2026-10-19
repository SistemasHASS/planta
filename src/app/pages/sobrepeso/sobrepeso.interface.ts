/** Una regla de sobrepeso, tal como la devuelve el servidor, más los nombres que se cruzan con los catálogos del equipo. */
export interface ReglaSobrepeso {
  id: number;
  documentoConsignatario: string;
  formatoId: string;
  destinoId: string;
  transporteId: string;
  /** Decimal: 0.02 = 2 %. */
  porcentaje: number;
  /** Fechas como aaaa-mm-dd ('' = sin fecha). */
  vigenciaDesde: string;
  vigenciaHasta: string;
  descripcion: string;
  activo: boolean;
  consignatarioNombre: string;
  formatoNombre: string;
  destinoNombre: string;
  transporteNombre: string;
}

/** Arma lo que espera el servidor para guardar una regla (texto JSON de una lista de una). */
export function reglaAJson(regla: ReglaSobrepeso, modo: 'nuevo' | 'editado', idProyecto: string, codigoCultivo: string): string {
  return JSON.stringify([
    {
      id: modo === 'nuevo' ? 0 : regla.id,
      modo,
      idProyecto,
      codigoCultivo,
      documentoConsignatario: regla.documentoConsignatario,
      formatoId: Number(regla.formatoId),
      destinoId: regla.destinoId,
      transporteId: regla.transporteId,
      porcentaje: Number(regla.porcentaje),
      vigenciaDesde: regla.vigenciaDesde || null,
      vigenciaHasta: regla.vigenciaHasta || null,
      descripcion: regla.descripcion ?? '',
      activo: regla.activo,
    },
  ]);
}
