import { HttpErrorResponse, HttpInterceptorFn, HttpHandlerFn, HttpRequest } from "@angular/common/http";
import { inject } from "@angular/core";
import { EMPTY, catchError, from, switchMap, throwError } from "rxjs";
import { environment } from "../../../environments/environment";
import { AuthService, SessionExpiredError } from "../services/auth.service";

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);

  if (
    !req.url.startsWith(environment.apiBaseUrl) ||
    req.url.includes("/api/auth/login") ||
    req.url.includes("/api/auth/refresh")
  ) {
    return next(req);
  }

  return from(auth.ensureAccessTokenForOnlineRequest()).pipe(
    switchMap((token) => sendWithToken(req, token, next, auth)),
    catchError((error: unknown) =>
      error instanceof SessionExpiredError ? EMPTY : throwError(() => error),
    ),
  );
};

function sendWithToken(
  req: HttpRequest<unknown>,
  token: string | null,
  next: HttpHandlerFn,
  auth: AuthService,
) {
  const authorized = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(authorized).pipe(
    catchError((error: unknown) => {
      // Solo se reintenta una vez para cubrir tokens revocados antes de expirar.
      if (!(error instanceof HttpErrorResponse) || error.status !== 401 || req.headers.has("X-Auth-Retry")) {
        return throwError(() => error);
      }

      return from(auth.forceRefreshAccessToken()).pipe(
        switchMap((renewedToken) =>
          next(authorized.clone({
            setHeaders: {
              Authorization: `Bearer ${renewedToken}`,
              "X-Auth-Retry": "1",
            },
          })),
        ),
      );
    }),
  );
}
