/**
 * Formato y tipo de empaque que el anotador eligió en cada línea de la recolección (solo se guarda la elección, no los catálogos).
 * Clave = usuario|idJornada|claveLinea ("L12" línea manual o "M3-2" curo de máquina). Se agrega en la versión 8 de la base local.
 */
export const RECOLECCION_SCHEMA_V8 = {
  jornadaLineaRecoleccion: 'clave,usuario,idJornada',
};
