import { ChangeDetectionStrategy, Component, OnInit, computed, inject, output, signal } from '@angular/core';
import { LucideBoxes, LucideX } from '@lucide/angular';
import { JornadasAnotadorApiService } from '../../../../shared/services/jornadas-anotador-api.service';
import { Fila, fechaHora, hora, texto } from '../../jornada.utils';

/**
 * Historial de recolecciones del anotador: a la izquierda sus recolecciones de la jornada y a la derecha el detalle de la elegida.
 * Cada empacador tiene una sola fila por recolección (si se vuelve a registrar, se actualiza esa misma), así que el detalle es una tarjeta por empacador, ordenada por DNI.
 * Solo muestra las recolecciones del propio anotador (el servidor filtra por usuario).
 */
@Component({
  selector: 'app-historial-recoleccion-modal',
  imports: [LucideBoxes, LucideX],
  templateUrl: './historial-recoleccion-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HistorialRecoleccionModalComponent implements OnInit {
  private readonly jornadasApi = inject(JornadasAnotadorApiService);

  readonly closed = output<void>();

  protected readonly fechaHora = fechaHora;
  protected readonly hora = hora;

  protected readonly recolecciones = signal<Fila[]>([]);
  protected readonly cargandoLista = signal(true);
  protected readonly errorLista = signal('');

  protected readonly seleccionada = signal<Fila | null>(null);
  protected readonly detalle = signal<Fila[]>([]);
  protected readonly cargandoDetalle = signal(false);
  protected readonly errorDetalle = signal('');

  /** Texto del buscador (nombre o DNI). */
  protected readonly busqueda = signal('');

  /** Filas que coinciden con el buscador (el servidor ya las manda ordenadas por DNI). */
  protected readonly filas = computed(() => {
    const q = this.busqueda().trim().toLowerCase();
    if (!q) return this.detalle();
    return this.detalle().filter((f) => `${texto(f['numeroDocumento'])} ${texto(f['nombreCompleto'])}`.toLowerCase().includes(q));
  });

  /** Total de cajas de la recolección elegida y de lo que se ve con el buscador. */
  protected readonly totalCajas = computed(() => this.detalle().reduce((suma, f) => suma + (Number(f['cantidadCajas']) || 0), 0));
  protected readonly totalFiltrado = computed(() => this.filas().reduce((suma, f) => suma + (Number(f['cantidadCajas']) || 0), 0));

  /** Evita que una respuesta lenta pise el detalle de otra recolección elegida después. */
  private pedido = 0;

  async ngOnInit(): Promise<void> {
    try {
      const r = await this.jornadasApi.historialRecolecciones(0);
      if (r.error) throw new Error(r.mensaje || 'No se pudo consultar el historial.');
      const lista = r.data ?? [];
      this.recolecciones.set(lista);
      // Se abre con la recolección en curso; si no hay, con la más reciente.
      const inicial = lista.find((x) => texto(x['estado']) === 'ABIERTA') ?? lista[0];
      if (inicial) await this.elegir(inicial);
    } catch (e) {
      this.errorLista.set(e instanceof Error && e.message ? e.message : 'No se pudo consultar el historial.');
    } finally {
      this.cargandoLista.set(false);
    }
  }

  protected async elegir(recoleccion: Fila): Promise<void> {
    if (this.seleccionada() === recoleccion && !this.errorDetalle()) return;
    const pedido = ++this.pedido;
    this.seleccionada.set(recoleccion);
    this.detalle.set([]);
    this.busqueda.set('');
    this.errorDetalle.set('');
    this.cargandoDetalle.set(true);
    try {
      const r = await this.jornadasApi.historialRecolecciones(Number(recoleccion['id']));
      if (pedido !== this.pedido) return;
      if (r.error) throw new Error(r.mensaje || 'No se pudo consultar el detalle.');
      this.detalle.set(r.data ?? []);
    } catch (e) {
      if (pedido !== this.pedido) return;
      this.errorDetalle.set(e instanceof Error && e.message ? e.message : 'No se pudo consultar el detalle.');
    } finally {
      if (pedido === this.pedido) this.cargandoDetalle.set(false);
    }
  }

  protected abierta(r: Fila): boolean {
    return texto(r['estado']) === 'ABIERTA';
  }

  /** "Tipo de empaque · categoría · calibre" sin dejar huecos si algún dato no existe. */
  protected tipoEmpaque(f: Fila): string {
    return [f['tipoEmpaqueDescripcion'], f['categoriaNombre'], f['calibreNombre']].map(texto).filter(Boolean).join(' — ') || '—';
  }
}
