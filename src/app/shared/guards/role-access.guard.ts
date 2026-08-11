import { inject } from '@angular/core';
import { CanActivateChildFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

const normalizeUrl = (url: string): string => {
  const clean = String(url ?? '').split('?')[0].split('#')[0];
  return `/${clean.replace(/^\//, '')}`;
};

export const roleAccessChildGuard: CanActivateChildFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const perfil = auth.perfil();
  const url = normalizeUrl(state.url);

  if (perfil !== 'GUIAS_MANUALES') return true;

  const permitido =
    url.startsWith('/parametros') ||
    url.startsWith('/parametros/setup') ||
    url.startsWith('/guias-manuales');

  return permitido ? true : router.createUrlTree(['/parametros']);
};
