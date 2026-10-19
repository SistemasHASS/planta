import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, from, switchMap, throwError } from 'rxjs';
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

  return from(connectivity.checkConnection()).pipe(
    switchMap((online) => {
      if (!online) {
        showOfflineWarning(connectivity, feedback);
        return throwError(() => buildOfflineError(req.url));
      }

      return next(req).pipe(
        catchError((error: unknown) => {
          if (error instanceof HttpErrorResponse && error.status === 0) {
            showOfflineWarning(connectivity, feedback);
          }

          return throwError(() => error);
        })
      );
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
