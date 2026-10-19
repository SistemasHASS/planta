import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideCircleCheck, LucideX } from '@lucide/angular';
import { Palet } from '../../../../shared/interfaces/palet.interface';
import { portalToBody } from '../../../../shared/utils/portal';

/** Pregunta si el palet tiene observaciones antes de cerrarlo. Solo muestra y avisa; el cierre lo hace la pantalla Palets. */
@Component({
  selector: 'app-modal-cerrar-palet',
  imports: [FormsModule, LucideCircleCheck, LucideX],
  templateUrl: './modal-cerrar-palet.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModalCerrarPaletComponent {
  constructor() {
    portalToBody();
  }

  readonly visible = input(false);
  readonly palet = input<Palet | null>(null);
  readonly tieneObs = input(false);
  readonly observaciones = input('');
  readonly medida = input('');

  readonly cerrar = output<void>();
  readonly confirmar = output<void>();
  readonly tieneObsChange = output<boolean>();
  readonly observacionesChange = output<string>();
  readonly medidaChange = output<string>();
}
