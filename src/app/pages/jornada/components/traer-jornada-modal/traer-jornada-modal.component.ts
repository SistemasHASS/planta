import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Fila, fecha, texto } from '../../jornada.utils';

/** Lo que dejó traer una jornada anterior (para mostrarlo al terminar). */
export interface ResultadoTraer {
  lineasTomadas: number;
  lineasYaMias: number;
  empacadoresAsignados: number;
  omitidos: { tipo: string; detalle: string }[];
}

/**
 * Modal "Traer de jornada anterior": lista las jornadas de los últimos días en las que el anotador tuvo líneas (con cuántas líneas y empacadores
 * tenía al cerrar) para traerlas a la jornada abierta. Solo muestra y avisa: la pantalla Asignar empacadores llama al servidor.
 * Si el anotador ya registró cajas en la jornada abierta (`bloqueado`) no se puede traer nada.
 */
@Component({
  selector: 'app-traer-jornada-modal',
  templateUrl: './traer-jornada-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TraerJornadaModalComponent {
  protected readonly fecha = fecha;
  protected readonly texto = texto;

  readonly cargando = input(false);
  readonly copiando = input(false);
  readonly bloqueado = input(false);
  readonly motivo = input('');
  readonly jornadas = input<Fila[]>([]);
  /** Con valor, el modal muestra lo que pasó en vez de la lista. */
  readonly resultado = input<ResultadoTraer | null>(null);

  readonly traer = output<Fila>();
  readonly closed = output<void>();

  protected detalleDe(j: Fila): Fila[] {
    return Array.isArray(j['detalle']) ? j['detalle'] : [];
  }
}
