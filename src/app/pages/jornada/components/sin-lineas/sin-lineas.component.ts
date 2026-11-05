import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Aviso cuando el anotador todavía no tomó ninguna línea. */
@Component({
  selector: 'app-sin-lineas',
  template: `
    <p class="rounded-2xl border border-dashed border-app-border2 bg-app-surface p-4 text-sm text-app-muted">
      Toma al menos una línea para ver sus puestos.
    </p>
  `,
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SinLineasComponent {}
