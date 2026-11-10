import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Fila, nombreLinea } from '../../jornada.utils';

/** Menú de un puesto ocupado: mover, cambiar por otro empacador (escanear) o quitar. */
@Component({
  selector: 'app-menu-puesto-modal',
  templateUrl: './menu-puesto-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MenuPuestoModalComponent {
  protected readonly nombreLinea = nombreLinea;

  readonly linea = input.required<Fila>();
  readonly puesto = input.required<number>();
  readonly empacador = input.required<Fila>();

  readonly mover = output<void>();
  readonly cambiar = output<void>();
  readonly quitar = output<void>();
  readonly closed = output<void>();
}
