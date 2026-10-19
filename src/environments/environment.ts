/**
 * Configuracion de DESARROLLO (ng serve). En produccion (ng build) Angular usa
 * environment.prod.ts en su lugar (ver fileReplacements en angular.json).
 * No guardar claves ni secretos aqui: todo lo de este archivo termina visible en el navegador.
 */
export const environment = {
  production: false,
  /** URL base de la API (sin / al final). Debe coincidir con el puerto en que corre el backend. */
  apiBaseUrl: 'http://localhost:5100',
};
