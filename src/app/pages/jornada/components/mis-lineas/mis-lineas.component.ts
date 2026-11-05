import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { LucideChevronDown, LucideChevronRight } from '@lucide/angular';
import { JornadaStore } from '../../jornada.store';

/** Tarjeta "Mis líneas": el anotador toma o suelta las líneas donde va a trabajar. */
@Component({
  selector: 'app-mis-lineas',
  imports: [LucideChevronDown, LucideChevronRight],
  templateUrl: './mis-lineas.component.html',
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MisLineasComponent {
  protected readonly store = inject(JornadaStore);

  /** Tarjeta desplegada (true) o contraída (false). */
  protected readonly abierto = signal(true);

  /** Al entrar a una pestaña que no necesita elegir líneas se contrae sola; después se puede volver a abrir a mano. */
  readonly contraer = input(false);

  constructor() {
    effect(() => {
      if (this.contraer()) this.abierto.set(false);
    });
  }
}
