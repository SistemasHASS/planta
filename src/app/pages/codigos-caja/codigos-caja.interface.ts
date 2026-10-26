/** Un dato de la combinación: el código guardado y su nombre ('' si no se encontró en el maestro). */
export interface DatoCodigo {
  codigo: string;
  nombre: string;
}

/**
 * Una combinación de PLANTA_CodigosCaja tal como la devuelve api/administracion/codigos-caja: el servidor ya cruzó la base
 * propia (formato, presentación, tipo de empaque guía, rancho, lugar de producción) y los maestros (consignatario, destino,
 * variedad, transporte y fruta del cultivo).
 */
export interface CodigoCaja {
  id: number;
  codigoItem: string;
  /** Fruta del cultivo del formato (de la campaña en apimaestra); '' si no se encontró. */
  fruta: string;
  codigoCultivo: string;
  consignatario: DatoCodigo;
  destino: DatoCodigo;
  presentacion: DatoCodigo;
  formato: DatoCodigo;
  variedad: DatoCodigo;
  pesoPorCaja: string;
  tipoEmpaqueGuia: DatoCodigo;
  rancho: DatoCodigo;
  /** codigo = código LDP (ej. 04); nombre = descripción del lugar de producción. */
  lugarProduccion: DatoCodigo;
  transporte: DatoCodigo;
  /** Descripción completa, la misma que se arma en el detalle de la guía. */
  descripcion: string;
  /** Texto en minúsculas con todos los datos, para el buscador. */
  busqueda: string;
}
