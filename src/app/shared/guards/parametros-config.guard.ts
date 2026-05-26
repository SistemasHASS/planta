import { inject } from '@angular/core';
import { CanActivateChildFn, CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { CatalogosRepository } from '../dexiedb/repository/catalogos.repository';

const checkConfiguracion = async (url: string) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const catalogosRepo = inject(CatalogosRepository);

  const normalizedUrl = `/${String(url ?? '').replace(/^#\/?/, '').replace(/^\//, '')}`;

  // Permitir siempre entrar a Parametros/Setup para que el usuario pueda sincronizar/guardar
  if (normalizedUrl.startsWith('/parametros/setup') || normalizedUrl.startsWith('/parametros')) return true;

  // Bypass explícito (si en el futuro se usa el guard sobre otras rutas específicas)
  if (normalizedUrl.includes('allowSetup=1')) return true;

  const u: any = auth.usuario();
  const nro = String(u?.nrodocumento ?? u?.documentoidentidad ?? u?.documentoIdentidad ?? u?.documento ?? '').trim();
  if (!nro) return router.createUrlTree(['/parametros/setup']);

  try {
    const cfg = await catalogosRepo.configuracionRepo.getByField('nrodocumento', nro);
    return cfg ? true : router.createUrlTree(['/parametros/setup']);
  } catch {
    return router.createUrlTree(['/parametros/setup']);
  }
};

export const parametrosConfigGuard: CanActivateFn = async (_route, state) => {
  return checkConfiguracion(state.url);
};

export const parametrosConfigChildGuard: CanActivateChildFn = async (_route, state) => {
  return checkConfiguracion(state.url);
};
