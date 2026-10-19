/** Estados SUNAT de una guia de remision: texto para mostrar y color de la etiqueta (daisyUI). */

export function normalizarEstadoSunat(estado?: string | null): string {
  return (estado ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/\s+/g, '_')
    .replace(/[^A-Z0-9_]/g, '');
}

const ETIQUETAS: Record<string, string> = {
  PENDIENTE: 'Pendiente',
  PENDIENTE_DE_ENVIO: 'Pendiente de Envío',
  ENVIANDO: 'Enviando',
  ENVIADO: 'Enviado',
  ENVIADO_A_DECLARAR: 'Enviado a Declarar',
  ACEPTADO: 'Aceptado',
  ACEPTADO_CON_OBSERVACIONES: 'Aceptado c/obs.',
  RECHAZADO: 'Rechazado',
  ERROR: 'Error',
  ERROR_ENVIO: 'Error envío',
  ANULADO: 'Anulado',
  NO_ENVIADO: 'No Enviado',
};

export function estadoSunatLabel(estado?: string | null): string {
  return ETIQUETAS[normalizarEstadoSunat(estado)] ?? (estado || '—');
}

/** Clases daisyUI de la etiqueta del estado SUNAT. */
export function estadoSunatClass(estado?: string | null): string {
  switch (normalizarEstadoSunat(estado)) {
    case 'ENVIANDO':
      return 'badge badge-soft badge-info';
    case 'ENVIADO':
    case 'ENVIADO_A_DECLARAR':
      return 'badge badge-soft badge-primary';
    case 'ACEPTADO':
      return 'badge badge-soft badge-success';
    case 'ACEPTADO_CON_OBSERVACIONES':
      return 'badge badge-soft badge-accent';
    case 'RECHAZADO':
    case 'ERROR':
    case 'ERROR_ENVIO':
      return 'badge badge-soft badge-error';
    case 'ANULADO':
    case 'NO_ENVIADO':
      return 'badge badge-soft badge-neutral';
    default:
      return 'badge badge-soft badge-warning';
  }
}

export function esAceptadaSunat(estado?: string | null): boolean {
  return normalizarEstadoSunat(estado) === 'ACEPTADO';
}

/** Clases daisyUI de la etiqueta del estado de la guia (ABIERTA, CERRADA, ANULADO). */
export function estadoGuiaClass(estado?: string | null): string {
  switch ((estado ?? '').toUpperCase()) {
    case 'ABIERTA':
      return 'badge badge-soft badge-warning';
    case 'ANULADO':
      return 'badge badge-soft badge-error';
    default:
      return 'badge badge-soft badge-success';
  }
}
