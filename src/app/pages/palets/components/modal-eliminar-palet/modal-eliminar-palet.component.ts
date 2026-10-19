import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { LucideCircleAlert, LucideTrash2, LucideX } from '@lucide/angular';
import { portalToBody } from '../../../../shared/utils/portal';

export interface InfoEliminar {
  titulo: string;
  /** Datos principales de lo que se va a eliminar (etiqueta y valor). */
  resumen: { etiqueta: string; valor: string }[];
  /** Titulo de la lista de abajo (por ejemplo "Composiciones"). Sin titulo no se muestra la lista. */
  listaTitulo?: string;
  lista?: { titulo: string; detalle: string }[];
  listaVacia?: string;
}

/** Detalle de lo que se va a eliminar (palet o composicion) antes de pedir la confirmacion final. Solo muestra y avisa. */
@Component({
  selector: 'app-modal-eliminar-palet',
  imports: [LucideCircleAlert, LucideTrash2, LucideX],
  templateUrl: './modal-eliminar-palet.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModalEliminarPaletComponent {
  constructor() {
    portalToBody();
  }

  readonly info = input<InfoEliminar | null>(null);

  readonly cancelar = output<void>();
  readonly confirmar = output<void>();
}
