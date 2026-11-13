import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { LucidePlay } from '@lucide/angular';
import { SearchSelectComponent } from '../../../../shared/components/search-select/search-select.component';
import { JornadaStore } from '../../jornada.store';
import { Fila, fecha, texto } from '../../jornada.utils';

/** Jornadas abiertas del acopio (se elige en cuál trabajar) y apertura de una nueva sobre un proceso ABIERTO que aún no tenga jornada. */
@Component({
  selector: 'app-abrir-jornada',
  imports: [SearchSelectComponent, LucidePlay],
  templateUrl: './abrir-jornada.component.html',
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AbrirJornadaComponent {
  protected readonly store = inject(JornadaStore);
  protected readonly fecha = fecha;

  /** Igual que en la pantalla de palets de Logística: "jueves, 12 de noviembre de 2026, 12:46". */
  protected fechaLarga(valor: unknown): string {
    const v = texto(valor);
    if (!v) return '';
    const d = new Date(v);
    return Number.isNaN(d.getTime())
      ? v
      : d.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  protected procesoCerrado(j: Fila): boolean {
    return texto(j['estadoProceso']).toUpperCase() !== 'ABIERTO';
  }
}
