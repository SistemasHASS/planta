import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/** Valor del filtro de estado que recibe el SP Listar: '' = todos, '1' = activos, '0' = inactivos. */
export type EstadoFiltro = '' | '1' | '0';

/** Filtro Activos / Inactivos / Todos para las listas de los catalogos. */
@Component({
  selector: 'app-estado-filter',
  templateUrl: './estado-filter.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EstadoFilterComponent {
  readonly value = input<EstadoFiltro>('');
  readonly changed = output<EstadoFiltro>();

  readonly opciones: { value: EstadoFiltro; label: string }[] = [
    { value: '1', label: 'Activos' },
    { value: '0', label: 'Inactivos' },
    { value: '', label: 'Todos' },
  ];
}
