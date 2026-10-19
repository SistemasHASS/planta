import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { LucideUsers, LucideX } from '@lucide/angular';
import { portalToBody } from '../../../../shared/utils/portal';

export interface FilaPersonal {
  nombreCompleto: string;
  dni: string;
}

/** Ventana que muestra la lista completa de supervisores o de logística de un proceso. Solo lectura. */
@Component({
  selector: 'app-personal-lista-modal',
  imports: [LucideUsers, LucideX],
  templateUrl: './personal-lista-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PersonalListaModalComponent {
  constructor() {
    portalToBody();
  }

  readonly titulo = input.required<string>();
  readonly filas = input.required<FilaPersonal[]>();

  /** Se emite al cerrar la ventana. */
  readonly closed = output<void>();
}
