import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding, withHashLocation } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { appRoutes } from './app.routes';
import { auth401Interceptor } from './shared/interceptors/auth-401.interceptor';
import { auth403Interceptor } from './shared/interceptors/resp-403.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(appRoutes, withHashLocation(), withComponentInputBinding()),
    provideHttpClient(
          withFetch(),
          withInterceptors([auth401Interceptor, auth403Interceptor])
        ),
  ]
};
