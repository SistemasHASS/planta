
export function formatDateTime(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;

  const d = value instanceof Date ? value : new Date(value as any);
  if (Number.isNaN(d.getTime())) return null;

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
  if (value === null || value === undefined || value === '') return null;

  const d = value instanceof Date ? value : new Date(value as any);
  if (Number.isNaN(d.getTime())) return null;

  const pad = (n: number) => String(n).padStart(2, '0');

  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());

  return `${yyyy}-${mm}-${dd}`;
}
