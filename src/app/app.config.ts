import { ApplicationConfig,isDevMode,provideZoneChangeDetection } from '@angular/core';
import { provideRouter,withHashLocation } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { routes } from './app.routes';
import { provideServiceWorker } from '@angular/service-worker';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { providePrimeNG } from 'primeng/config';
import Lara from '@primeng/themes/lara';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes,withHashLocation()), 
    provideHttpClient(),
    provideAnimations(),
    provideAnimationsAsync(),
    providePrimeNG({
      theme: {
        preset: Lara,
        options: {
          // Aquí puedes ajustar opciones como `cssLayer`, `darkModeSelector`, etc.
          prefix: 'p',
          darkModeSelector: 'system',
          cssLayer: false
        }
      }
    }),
    provideServiceWorker('ngsw-worker.js', {
        enabled: !isDevMode(),
        registrationStrategy: 'registerWhenStable:30000'
    })]
};
