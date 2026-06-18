import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZonelessChangeDetection, isDevMode } from '@angular/core';
import { provideRouter, withComponentInputBinding, withHashLocation } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideServiceWorker } from '@angular/service-worker';
import { appRoutes } from './app.routes';
import { auth401Interceptor } from './shared/interceptors/auth-401.interceptor';
import { auth403Interceptor } from './shared/interceptors/resp-403.interceptor';
import { connectivityInterceptor } from './shared/interceptors/connectivity.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(appRoutes, withHashLocation(), withComponentInputBinding()),
    provideHttpClient(
          withFetch(),
          withInterceptors([connectivityInterceptor, auth401Interceptor, auth403Interceptor])
        ),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ]
};
