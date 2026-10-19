import { Injectable, computed, signal } from '@angular/core';

/** Nombres de los temas de daisyUI: 'planta' es el claro (definido en tailwind.config.js) y 'dark' el oscuro. */
export type Tema = 'planta' | 'dark';

const CLAVE = 'planta-tema';

/**
 * Tema claro / oscuro. El tema activo se escribe en <html data-theme="..."> y daisyUI cambia todos sus colores al instante.
 * Se recuerda en el navegador; la primera vez se usa la preferencia del equipo (claro u oscuro).
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly tema = signal<Tema>(this.inicial());
  readonly esOscuro = computed(() => this.tema() === 'dark');

  constructor() {
    this.aplicar(this.tema());
  }

  alternar(): void {
    const siguiente: Tema = this.esOscuro() ? 'planta' : 'dark';
    this.tema.set(siguiente);
    this.aplicar(siguiente);
  }

  private inicial(): Tema {
    try {
      const guardado = localStorage.getItem(CLAVE);
      if (guardado === 'planta' || guardado === 'dark') return guardado;
      if (guardado === 'sunset') return 'dark'; // nombre anterior del tema oscuro
    } catch {
      // Sin acceso al almacenamiento (modo privado, etc.): se usa la preferencia del equipo.
    }
    try {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'planta';
    } catch {
      return 'planta';
    }
  }

  private aplicar(tema: Tema): void {
    document.documentElement.setAttribute('data-theme', tema);
    try {
      localStorage.setItem(CLAVE, tema);
    } catch {
      // No se pudo recordar la eleccion; el tema igual se aplica en esta sesion.
    }
  }
}
