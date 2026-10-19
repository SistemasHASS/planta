import { ROLES } from '../guards/role.guard';

/**
 * Permisos por rol (equivalen al PermissionService de la aplicacion anterior). Reciben el idRol del usuario.
 * Administrador y Logistica operan; solo el Administrador puede reabrir procesos.
 */
const norm = (rol: unknown): string => String(rol ?? '').trim().toUpperCase();
const esAdmin = (rol: unknown): boolean => norm(rol) === ROLES.admin;
const esLogistica = (rol: unknown): boolean => norm(rol) === ROLES.logistica;
const esAdminOLogistica = (rol: unknown): boolean => esAdmin(rol) || esLogistica(rol);

export const permisos = {
  esAdmin,
  esLogistica,
  puedeCrearProceso: esAdminOLogistica,
  puedeCerrarProceso: esAdminOLogistica,
  puedeReabrirProceso: esAdmin,
  puedeCrearPalet: esAdminOLogistica,
  puedeAgregarCajas: esAdminOLogistica,
  puedeCerrarPalet: esAdminOLogistica,
  puedeReabrirPalet: esAdminOLogistica,
  puedeEliminarPalet: esAdminOLogistica,
  puedeEliminarComposicion: esAdminOLogistica,
  puedeCrearGuia: esAdminOLogistica,
  puedeCerrarGuia: esAdminOLogistica,
  puedeAnularGuia: esAdminOLogistica,
  puedeEliminarGuia: esAdminOLogistica,
  puedeGestionarGuiasManuales: (rol: unknown): boolean => esAdminOLogistica(rol) || norm(rol) === ROLES.guiasManuales,
};
