import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { GlobalErrorService } from '../services/global-error.service';

export const auth403Interceptor: HttpInterceptorFn = (req,next) => {
    const globalError = inject(GlobalErrorService);

    return next(req).pipe(
        catchError((error: unknown) => {
            if (error instanceof HttpErrorResponse && error.status === 403) {
                const message =
                    (error.error && (error.error.message || error.error.mensaje)) ||
                    error.message ||
                    'No tienes permisos para realizar esta acción';
                globalError.emitForbidden(String(message));
            }
            return throwError(() => error);
        })
    );
};