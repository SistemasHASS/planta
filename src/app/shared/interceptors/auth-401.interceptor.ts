import { HttpErrorResponse, HttpInterceptorFn } from "@angular/common/http";
import { inject } from "@angular/core";
import { AuthService } from "../services/auth.service";
import { Router } from "@angular/router";
import { catchError, throwError } from "rxjs";


export const auth401Interceptor: HttpInterceptorFn = (req, next) => {
    // TODO: Implementar interceptor para manejar errores 401
    const auth = inject(AuthService);
    const router = inject(Router);
    return next(req).pipe(
        catchError((error: unknown) => {
            if (error instanceof HttpErrorResponse && error.status === 401) {
                if (router.url !== '/login') {
                    auth.logout();
                    router.navigate(['/login'], { queryParams: { reason: 'session_expired' } });
                }
            }
            return throwError(() => error);

        })
    );
}