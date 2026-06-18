import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { ConnectivityService } from '../services/connectivity.service';
import { AlertService } from '../services/alert.service';
import { environment } from '../../../environments/environment';

/** Cache del último health check (timestamp y resultado). */
let lastHealthCheck = 0;
let lastHealthOk = true;
const HEALTH_CACHE_MS = 15_000;
const HEALTH_TIMEOUT_MS = 2_000;
const HEALTH_URL = `${environment.apiUrl}/health`;

/** Ping rápido al backend con timeout corto. */
async function pingBackend(): Promise<boolean> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
  try {
    const res = await fetch(HEALTH_URL, {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Interceptor con circuit breaker + health check previo.
 *
 * 1. Si está en cooldown → cancela SILENCIOSAMENTE (evita spam).
 * 2. Si navigator.onLine es false → alerta + cooldown.
 * 3. Si internet está OK pero health check no está cacheado → ping a /health (2s timeout).
 *    - Si el backend NO responde → alerta + cooldown + cancela petición.
 *    - Si responde OK → deja pasar la petición real.
 * 4. Si la petición real falla igual (caso edge) → activa cooldown y alerta.
 */
export const connectivityInterceptor: HttpInterceptorFn = (req, next) => {
  const connectivity = inject(ConnectivityService);
  const alertService = inject(AlertService);

  // Circuit breaker: si ya falló recientemente, bloquear sin alerta
  if (connectivity.isInCooldown) {
    return throwError(() =>
      new HttpErrorResponse({
        error: 'Request blocked by connectivity cooldown',
        status: 0,
        statusText: 'Offline (cooldown)',
        url: req.url,
      })
    );
  }

  // Bloqueo previo: el navegador sabe que no hay red
  if (!navigator.onLine) {
    connectivity.forceStatus(false);
    connectivity.triggerCooldown();
    alertService.showAlert(
      'Sin conexión',
      'No tienes conexión a internet. La acción no puede completarse.',
      'warning'
    );
    return throwError(() =>
      new HttpErrorResponse({
        error: 'No internet connection',
        status: 0,
        statusText: 'Offline',
        url: req.url,
      })
    );
  }

  // Cache hit: health check reciente y OK → dejar pasar directo
  if (Date.now() - lastHealthCheck <= HEALTH_CACHE_MS && lastHealthOk) {
    return next(req).pipe(
      catchError((error: unknown) => {
        if (error instanceof HttpErrorResponse && error.status === 0) {
          connectivity.forceStatus(false);
          connectivity.triggerCooldown();
          lastHealthCheck = 0; // invalidar cache
          alertService.showAlert(
            'Error de conexión',
            'No se pudo contactar al servidor. Se ha detectado modo offline.',
            'error'
          );
        }
        return throwError(() => error);
      })
    );
  }

  // Health check previo antes de enviar la petición real
  return from(pingBackend()).pipe(
    switchMap((isHealthy) => {
      lastHealthCheck = Date.now();
      lastHealthOk = isHealthy;

      if (!isHealthy) {
        connectivity.forceStatus(false);
        connectivity.triggerCooldown();
        alertService.showAlert(
          'Servidor no disponible',
          'El servidor no responde. Se ha activado modo offline. Intenta más tarde.',
          'error'
        );
        return throwError(() =>
          new HttpErrorResponse({
            error: 'Backend unavailable',
            status: 0,
            statusText: 'Offline (backend down)',
            url: req.url,
          })
        );
      }

      // Backend saludable: dejar pasar la petición real
      return next(req).pipe(
        catchError((error: unknown) => {
          if (error instanceof HttpErrorResponse && error.status === 0) {
            connectivity.forceStatus(false);
            connectivity.triggerCooldown();
            lastHealthCheck = 0;
            alertService.showAlert(
              'Error de conexión',
              'No se pudo contactar al servidor. Se ha detectado modo offline.',
              'error'
            );
          }
          return throwError(() => error);
        })
      );
    })
  );
};
