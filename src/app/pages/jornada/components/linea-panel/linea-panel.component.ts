import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { LucideChevronDown, LucideChevronRight } from '@lucide/angular';
import { JornadaStore } from '../../jornada.store';
import { Fila, nombreLinea } from '../../jornada.utils';

/**
 * Tarjeta plegable de una línea: título, avance de puestos y badge. Lo propio de cada pestaña se proyecta:
 *  - elemento con el atributo `acciones`: va a la derecha de la cabecera;
 *  - el resto del contenido: es el cuerpo, visible solo con la línea desplegada.
 */
@Component({
  selector: 'app-linea-panel',
  imports: [LucideChevronDown, LucideChevronRight],
  templateUrl: './linea-panel.component.html',
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LineaPanelComponent {
  protected readonly store = inject(JornadaStore);
  protected readonly nombreLinea = nombreLinea;

  readonly linea = input.required<Fila>();
  /** La cabecera ocupa todo el ancho disponible (así las acciones quedan pegadas a la derecha). */
  readonly cabeceraFlexible = input(false);
}
