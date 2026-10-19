/** Una serie de guía de remisión electrónica (GRE), tal como la devuelve el servidor. */
export interface SerieGre {
  id: number;
  serie: string;
  numero: string;
  tipoDocumento: string;
  /** true = la serie está desactivada. */
  eliminado: boolean;
}
