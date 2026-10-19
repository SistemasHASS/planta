/**
 * Nombres de las tablas de autenticacion (IndexedDB).
 * Las tablas de negocio (catalogos, procesos, palets, guias...) se declaran en schema/ y sus repositorios usan el mismo nombre.
 */
export const DB_TABLES = {
  sessions: 'sessions',
  offlineOwner: 'offlineOwner',
} as const;
