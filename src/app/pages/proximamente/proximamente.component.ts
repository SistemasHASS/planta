import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

/** Pantalla provisional de los modulos que todavia no se portan desde la aplicacion anterior. */
@Component({
  selector: 'app-proximamente',
  template: `
    <section class="w-full p-4 sm:p-6">
      <div class="rounded-2xl border border-dashed border-app-border2 bg-app-surface p-8 text-center">
        <h1 class="text-xl font-extrabold text-app-heading">{{ titulo }}</h1>
        <p class="mt-2 text-sm text-app-muted">Este módulo se está migrando desde la aplicación anterior.</p>
      </div>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProximamenteComponent {
  readonly titulo = String(inject(ActivatedRoute).snapshot.data['titulo'] ?? 'Módulo');
}
