/** Fila tal como la devuelve el servidor (las columnas dependen del SP). */
export type Fila = Record<string, any>;

export const texto = (v: unknown): string => String(v ?? '').trim();

/** yyyy-MM-dd... -> dd/MM/yyyy */
export const fecha = (v: unknown): string => {
  const [y, m, d] = texto(v).split('T')[0].split('-');
  return y && m && d ? `${d}/${m}/${y}` : '—';
};

/** Fecha y hora local de un datetime del servidor: dd/MM/yyyy HH:mm */
export const fechaHora = (v: unknown): string => {
  const t = texto(v);
  if (!t) return '—';
  const [dia, hora = ''] = t.split('T');
  return `${fecha(dia)} ${hora.slice(0, 5)}`.trim();
};

/** Los booleanos de SQL Server llegan como true/1/'1'. */
export const esActivo = (v: unknown): boolean => v === true || v === 1 || v === '1';

/** Hora local de un datetime del servidor: HH:mm */
export const hora = (v: unknown): string => {
  const h = texto(v).split('T')[1];
  return h ? h.slice(0, 5) : '—';
};

/** Cuánto se corrigió una fila de cajas desde Producción del día o el historial (con signo: -5 se quitaron 5, +5 se agregaron 5; 0 si nunca se corrigió). */
export const correccion = (f: Fila): number => Number(f['cantidadCorregida']) || 0;

/** 5 -> "+5", -5 -> "−5", 0 -> "0". */
export const conSigno = (n: number): string => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');

/** Texto de la etiqueta de una fila corregida: "corregida −5", "corregida producto" o "corregida −5 · producto" (cambió de formato o tipo de empaque). */
export const etiquetaCorreccion = (f: Fila): string => {
  const partes: string[] = [];
  const c = correccion(f);
  if (c !== 0) partes.push(conSigno(c));
  if (esActivo(f['productoCorregido'])) partes.push('producto');
  return partes.length ? `corregida ${partes.join(' · ')}` : 'corregida';
};

/** Producto que tenía la fila antes de que la corrigieran ("4.4 OZ — CONVENCIONAL — 10MM — 10MM+"), o '' si no se cambió de producto. */
export const productoAntes = (f: Fila): string =>
  esActivo(f['productoCorregido'])
    ? [f['formatoAntesDescripcion'], f['tipoEmpaqueAntesDescripcion'], f['categoriaAntesNombre'], f['calibreAntesNombre']].map(texto).filter(Boolean).join(' — ')
    : '';

/** Una línea puede ser manual ("Línea 3") o un curo de una máquina (Flujo_Empaque activo): "Kato 1 · Curo 2". */
const esCuro = (l: Fila): boolean => !!texto(l['maquinaNombre']) && Number(l['curo']) > 0;

/** Nombre de una línea para mostrar: "Kato 1 · Curo 2" si es un curo de máquina; si no, "Línea N". */
export const nombreLinea = (l: Fila): string => (esCuro(l) ? `${texto(l['maquinaNombre'])} · Curo ${texto(l['curo'])}` : `Línea ${texto(l['numero'])}`);

/** La línea dentro de una frase: "Kato 1 · Curo 2" o "la línea 3". */
export const lineaTexto = (l: Fila): string => (esCuro(l) ? `${texto(l['maquinaNombre'])} · Curo ${texto(l['curo'])}` : `la línea ${texto(l['numero'])}`);

export interface LadosPuestos {
  /** Puestos del lado A: la mitad (redondeada hacia arriba) de los puestos del curo. */
  ladoA: number[];
  /** Puestos del lado B: el resto. */
  ladoB: number[];
}

/** Puestos de un curo repartidos en lado A y lado B (1..n). Devuelve null si la línea no es un curo (se muestra en una sola cuadrícula). */
export const ladosDe = (l: Fila): LadosPuestos | null => {
  if (!esCuro(l)) return null;
  const total = Math.max(0, Number(l['cantidadPuestos']) || 0);
  const mitad = Math.ceil(total / 2);
  const puestos = Array.from({ length: total }, (_, i) => i + 1);
  return { ladoA: puestos.slice(0, mitad), ladoB: puestos.slice(mitad) };
};
