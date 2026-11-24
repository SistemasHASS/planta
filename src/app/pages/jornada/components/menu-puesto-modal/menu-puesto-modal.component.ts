import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Fila, nombreLinea } from '../../jornada.utils';
import { portalToBody } from '../../../../shared/utils/portal';

/** Menú de un puesto ocupado: mover, cambiar por otro empacador (escanear) o quitar. */
@Component({
  selector: 'app-menu-puesto-modal',
  templateUrl: './menu-puesto-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MenuPuestoModalComponent {
  constructor() {
    // Fuera del contenedor con scroll de la página: en Safari / iOS la ventana quedaba dentro de él y se veía cortada por el menú superior y el pie.
    portalToBody();
  }

  protected readonly nombreLinea = nombreLinea;

  readonly linea = input.required<Fila>();
  readonly puesto = input.required<number>();
  readonly empacador = input.required<Fila>();

  readonly mover = output<void>();
  readonly cambiar = output<void>();
  readonly quitar = output<void>();
  readonly closed = output<void>();
}
