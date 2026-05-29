
export function formatDateTime(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return '';

  const d = value instanceof Date ? value : new Date(value as any);
  if (Number.isNaN(d.getTime())) return '';

  const pad = (n: number) => String(n).padStart(2, '0');

  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  const ss = pad(d.getSeconds());

  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

export function formatDate(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return '';

  const d = value instanceof Date ? value : new Date(value as any);
  if (Number.isNaN(d.getTime())) return '';

  const pad = (n: number) => String(n).padStart(2, '0');

  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());

  return `${yyyy}-${mm}-${dd}`;
}



export function formatDateStandar(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return '';

  const d = value instanceof Date ? value : new Date(value as any);
  if (Number.isNaN(d.getTime())) return '';

  const pad = (n: number) => String(n).padStart(2, '0');

  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());

  return `${yyyy}${mm}${dd}`;
}

export function formatTimeClave(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return '';

  const d = value instanceof Date ? value : new Date(value as any);
  if (Number.isNaN(d.getTime())) return '';

  const pad = (n: number) => String(n).padStart(2, '0');

  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  const ss = pad(d.getSeconds());
  const milliseconds = pad(d.getMilliseconds());

  return `${hh}${mi}${ss}${milliseconds}`;
}