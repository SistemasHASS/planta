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
