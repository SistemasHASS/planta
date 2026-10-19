import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  try {
    const session = await auth.getSession();
    return session ? true : router.parseUrl('/login');
  } catch (error) {
    console.error('No se pudo validar la sesión local:', error);
    return router.parseUrl('/login');
  }
};
