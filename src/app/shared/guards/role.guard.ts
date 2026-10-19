import { inject } from '@angular/core';
import { CanActivateChildFn, CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/** Roles de Planta. Deben coincidir con el `idRol` que devuelve el login. */
export const ROLES = {
  admin: 'ADPLA',
  logistica: 'LOPLA',
  monitor: 'MOPLA',
  guiasManuales: 'GMPLA',
  coordinacion: 'COPLA',
  operaciones: 'OPPLA',
} as const;

/** Nombre para mostrar de cada rol (por ejemplo, bajo el nombre del usuario en el menu). */
export const ROLE_LABELS: Record<string, string> = {
  [ROLES.admin]: 'Administrador',
  [ROLES.logistica]: 'Logistica',
  [ROLES.monitor]: 'Monitor',
  [ROLES.guiasManuales]: 'Guias manuales',
  [ROLES.coordinacion]: 'Coordinacion',
  [ROLES.operaciones]: 'Operaciones',
};

const normalizeRole = (value: unknown): string => String(value ?? '').trim().toUpperCase();

/**
 * Guard por rol para una ruta puntual:
 *   { path: 'admin', canActivate: [roleGuard(ROLES.admin)], ... }
 * Si el usuario no tiene el rol, vuelve a /inicio.
 */
export const roleGuard = (...allowed: string[]): CanActivateFn => async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const session = await auth.getSession();
  const role = normalizeRole(session?.user.idRol ?? session?.user.rol);

  return allowed.map(normalizeRole).includes(role) ? true : router.parseUrl('/inicio');
};

/**
 * Guard de las rutas hijas del layout: exige que exista sesion con un rol.
 * Las restricciones por rol de cada pantalla se agregan con roleGuard o con `roles` en el menu.
 */
export const roleChildGuard: CanActivateChildFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const session = await auth.getSession();
  const role = normalizeRole(session?.user.idRol ?? session?.user.rol);

  return role ? true : router.parseUrl('/login');
};
