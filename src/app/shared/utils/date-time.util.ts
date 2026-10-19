const PERU_TIME_ZONE = 'America/Lima';

function partsForPeru(date = new Date()): Record<string, string> {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: PERU_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  return formatter.formatToParts(date).reduce<Record<string, string>>((acc, part) => {
    if (part.type !== 'literal') {
      acc[part.type] = part.value;
    }

    return acc;
  }, {});
}

export function nowPeruDateTime(): string {
  const parts = partsForPeru();
  return `${parts['year']}-${parts['month']}-${parts['day']}T${parts['hour']}:${parts['minute']}:${parts['second']}`;
}

export function nowPeruDate(): string {
  const parts = partsForPeru();
  return `${parts['year']}-${parts['month']}-${parts['day']}`;
}

export function nowPeruTime(): string {
  const parts = partsForPeru();
  return `${parts['hour']}:${parts['minute']}:${parts['second']}`;
}

/** "2026-03-05 14:30:00" con la hora del equipo (formato que guarda la base de datos para fechas de palets). */
export function formatDateTime(value: unknown): string {
  if (value === null || value === undefined || value === '') return '';
  const d = value instanceof Date ? value : new Date(value as string | number);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** "hhmmssSSS": se pega al id del proceso para armar el id del palet. */
export function formatTimeClave(value: unknown): string {
  if (value === null || value === undefined || value === '') return '';
  const d = value instanceof Date ? value : new Date(value as string | number);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}${p(d.getMilliseconds())}`;
}

/** "2026-03-05" con la fecha del equipo (vacio si el valor no es una fecha). */
export function formatDate(value: unknown): string {
  if (value === null || value === undefined || value === '') return '';
  const d = value instanceof Date ? value : new Date(value as string | number);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** "2026-03-05T14:30:00.123" con la hora del equipo (sin zona horaria), como la guardaba la aplicacion anterior. */
export function toLocalISOString(date: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  const ms = String(date.getMilliseconds()).padStart(3, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}T${p(date.getHours())}:${p(date.getMinutes())}:${p(date.getSeconds())}.${ms}`;
}
