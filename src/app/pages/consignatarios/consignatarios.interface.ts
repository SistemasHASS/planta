/** Código rancho asignado a un consignatario (así lo devuelve el servidor). */
export interface CodigoRanchoAsignado {
  id: number;
  codigo: string;
}

/** Fila del listado de consignatarios. */
export interface ConsignatarioFila {
  /** Identificador único de la fila (para la tabla). */
  clave: string;
  documento: string;
  nombre: string;
  codigoGrupoCliente: string;
  nombreGrupoCliente: string;
  codigosRancho: CodigoRanchoAsignado[];
}

export const texto = (valor: unknown): string => String(valor ?? '').trim();

/** Arma la fila a partir de lo que devuelve el servidor (los códigos rancho pueden venir como texto JSON). */
export function armarConsignatario(fila: Record<string, any>, posicion: number): ConsignatarioFila {
  let ranchos: unknown = fila['codigosRancho'];
  if (typeof ranchos === 'string') {
    try {
      ranchos = JSON.parse(ranchos);
    } catch {
      ranchos = [];
    }
  }
  const lista = Array.isArray(ranchos) ? ranchos : [];
  return {
    clave: `${texto(fila['documento'])}-${posicion}`,
    documento: texto(fila['documento']),
    nombre: texto(fila['nombre']),
    codigoGrupoCliente: texto(fila['codigoGrupoCliente']),
    nombreGrupoCliente: texto(fila['nombreGrupoCliente']),
    codigosRancho: lista
      .filter((r: any) => r && (r.activo === undefined || r.activo === true || r.activo === 1))
      .map((r: any) => ({ id: Number(r.id), codigo: texto(r.codigo) })),
  };
}
