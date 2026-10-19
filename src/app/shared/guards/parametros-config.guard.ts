import { inject } from '@angular/core';
import { CanActivateChildFn, Router } from '@angular/router';
import { CatalogosRepository } from '../dexiedb/repository/catalogos.repository';
import { AuthService } from '../services/auth.service';
import { FeedbackModalService } from '../services/feedback-modal.service';
import { ROLES } from './role.guard';

const normalizar = (valor: unknown): string => String(valor ?? '').trim().toUpperCase();

/**
 * Ninguna pantalla se abre hasta que el usuario haya guardado sus Parametros (fundo, cultivo y campaña), como en la
 * aplicacion anterior. Parametros siempre se puede abrir; si falta la configuracion se vuelve ahi con un aviso.
 * Solo se exige a los roles que pueden abrir Parametros (logistica, admin, monitor y guias manuales).
 */
export const parametrosConfigChildGuard: CanActivateChildFn = async (_route, state) => {
  const ruta = state.url.split(/[?#]/)[0];
  if (ruta.startsWith('/parametros')) return true;

  const auth = inject(AuthService);
  const router = inject(Router);
  const repo = inject(CatalogosRepository);
  const feedback = inject(FeedbackModalService);

  const session = await auth.getSession();
  const rol = normalizar(session?.user.idRol ?? session?.user.rol);
  // Quien no puede abrir Parámetros (por su rol) no puede configurarlos: no se le exige, o se quedaría en un ciclo de redirecciones.
  if (![ROLES.logistica, ROLES.admin, ROLES.monitor, ROLES.guiasManuales].includes(rol as never)) return true;

  const documento = String(session?.user.documentoIdentidad ?? '').trim();
  let configurado = false;
  if (documento) {
    try {
      const cfg = await repo.configuracionRepo.getByField('nrodocumento', documento);
      configurado = !!cfg && !!String(cfg.idProyecto ?? '').trim();
    } catch {
      configurado = false;
    }
  }
  if (configurado) return true;

  feedback.warning('Primero selecciona y guarda tus parámetros para usar el sistema.', 'Configuración requerida');
  return router.parseUrl('/parametros');
};
