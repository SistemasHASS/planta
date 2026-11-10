import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { LucideChevronDown, LucideChevronRight } from '@lucide/angular';
import { JornadaStore } from '../../jornada.store';
import { Fila, nombreLinea, texto } from '../../jornada.utils';

/** Tarjeta "Mis líneas": el anotador toma o suelta las líneas donde va a trabajar. */
@Component({
  selector: 'app-mis-lineas',
  imports: [LucideChevronDown, LucideChevronRight, NgTemplateOutlet],
  templateUrl: './mis-lineas.component.html',
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MisLineasComponent {
  protected readonly store = inject(JornadaStore);
  protected readonly nombreLinea = nombreLinea;

  /** Líneas manuales (las de siempre). */
  protected readonly manuales = computed(() => this.store.lineas().filter((l) => !texto(l['maquinaNombre'])));

  /** Máquinas con sus curos (cada curo es una línea que se toma). Solo hay con el parámetro Flujo_Empaque activo. */
  protected readonly maquinas = computed(() => {
    const porMaquina = new Map<string, Fila[]>();
    for (const l of this.store.lineas()) {
      const nombre = texto(l['maquinaNombre']);
      if (nombre) porMaquina.set(nombre, [...(porMaquina.get(nombre) ?? []), l]);
    }
    return [...porMaquina].map(([nombre, curos]) => ({ nombre, curos }));
  });

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
