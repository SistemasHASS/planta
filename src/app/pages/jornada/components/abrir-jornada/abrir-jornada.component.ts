import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { LucidePlay } from '@lucide/angular';
import { SearchSelectComponent } from '../../../../shared/components/search-select/search-select.component';
import { JornadaStore } from '../../jornada.store';

/** Acopio sin jornada abierta: se elige uno de los procesos ABIERTOS y se abre la jornada. */
@Component({
  selector: 'app-abrir-jornada',
  imports: [SearchSelectComponent, LucidePlay],
  templateUrl: './abrir-jornada.component.html',
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AbrirJornadaComponent {
  protected readonly store = inject(JornadaStore);
}
