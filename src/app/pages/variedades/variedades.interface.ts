export const texto = (valor: unknown): string => String(valor ?? '').trim();

const esVerdadero = (valor: unknown): boolean => valor === true || valor === 1 || ['1', 'true'].includes(String(valor ?? '').toLowerCase());

/** Fila del listado de variedades. */
export interface VariedadFila {
  /** Identificador único de la fila (para la tabla). */
  clave: string;
  codigo: string;
  idvariedad: string;
  idcultivo: string;
  cultivo: string;
  variedad: string;
  procedencia: string;
  /** true = variedad de ensayo (creada aquí); false = viene del maestro. */
  esEnsayo: boolean;
}

/** Arma la fila con lo que devuelve el servidor. */
export function armarVariedad(fila: Record<string, any>, posicion: number): VariedadFila {
  const idvariedad = texto(fila['idvariedad']);
  const codigo = texto(fila['codigo']) || idvariedad;
  return {
    clave: `${codigo}-${posicion}`,
    codigo,
    idvariedad,
    idcultivo: texto(fila['idcultivo'] ?? fila['codigoCultivo']),
    cultivo: texto(fila['cultivo']),
    variedad: texto(fila['variedad']),
    procedencia: texto(fila['procedencia']),
    esEnsayo: esVerdadero(fila['esEnsayo']),
  };
}
