import { HttpErrorResponse, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, tap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ConnectivityService } from '../services/connectivity.service';
import { FeedbackModalService } from '../services/feedback-modal.service';

let lastWarningAt = 0;
const WARNING_COOLDOWN_MS = 12_000;

export const connectivityInterceptor: HttpInterceptorFn = (req, next) => {
  const connectivity = inject(ConnectivityService);
  const feedback = inject(FeedbackModalService);

  const isApiRequest = req.url.startsWith(environment.apiBaseUrl);
  const isHealthRequest = req.url.includes('/health');

  if (!isApiRequest || isHealthRequest) {
    return next(req);
  }

  if (connectivity.isInCooldown) {
    return throwError(() => buildOfflineError(req.url));
  }

  // Sin navegador en linea no hay nada que intentar. No se hace un health por peticion: el servicio ya lo consulta
  // cada 30 s y, si la peticion real falla por red (status 0), el catchError lo marca como sin conexion.
  if (!connectivity.hasInternet()) {
    showOfflineWarning(connectivity, feedback);
    return throwError(() => buildOfflineError(req.url));
  }

  return next(req).pipe(
    tap((event) => {
      // Una respuesta real es la mejor prueba de que el servidor responde: se recupera el estado sin esperar al siguiente health.
      if (event instanceof HttpResponse && !connectivity.serverAvailable()) {
        connectivity.forceStatus(true);
      }
    }),
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 0) {
        showOfflineWarning(connectivity, feedback);
      }

      return throwError(() => error);
    })
  );
};

function showOfflineWarning(connectivity: ConnectivityService, feedback: FeedbackModalService): void {
  connectivity.forceOffline();

  if (Date.now() - lastWarningAt < WARNING_COOLDOWN_MS) {
    return;
  }

  lastWarningAt = Date.now();
  feedback.warning('No hay conexion con el servidor. La aplicacion trabajara en modo offline.');
}

function buildOfflineError(url: string | null): HttpErrorResponse {
  return new HttpErrorResponse({
    error: 'Offline mode enabled',
    status: 0,
    statusText: 'Offline',
    url: url ?? undefined
  });
}
