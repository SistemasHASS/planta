import { ChangeDetectionStrategy, Component, OnInit, computed, inject, output, signal } from '@angular/core';
import { LucideBoxes, LucidePencilLine, LucideX } from '@lucide/angular';
import { JornadasAnotadorApiService } from '../../../../shared/services/jornadas-anotador-api.service';
import { CorregirProduccionModalComponent } from '../corregir-produccion-modal/corregir-produccion-modal.component';
import { Fila, conSigno, correccion, esActivo, etiquetaCorreccion, fechaHora, hora, productoAntes, texto } from '../../jornada.utils';

/**
 * Historial de recolecciones del anotador: a la izquierda sus recolecciones de la jornada y a la derecha el detalle de la elegida.
 * Cada empacador tiene una sola fila por recolección (si se vuelve a registrar, se actualiza esa misma), así que el detalle es una tarjeta por empacador, ordenada por DNI.
 * Solo muestra las recolecciones del propio anotador (el servidor filtra por usuario).
 * Desde el lápiz de un empacador se corrigen sus cajas (misma regla que en Producción: no se pueden quitar cajas que ya están en un palet) y la corrección queda visible en la fila.
 */
@Component({
  selector: 'app-historial-recoleccion-modal',
  imports: [CorregirProduccionModalComponent, LucideBoxes, LucidePencilLine, LucideX],
  templateUrl: './historial-recoleccion-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HistorialRecoleccionModalComponent implements OnInit {
  private readonly jornadasApi = inject(JornadasAnotadorApiService);

  readonly closed = output<void>();

  protected readonly fechaHora = fechaHora;
  protected readonly hora = hora;
  protected readonly conSigno = conSigno;
  protected readonly etiquetaCorreccion = etiquetaCorreccion;
  protected readonly productoAntes = productoAntes;

  /** Fila de cajas que se está corrigiendo. */
  protected readonly editando = signal<Fila | null>(null);

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

  /** Abre la corrección de una fila, con el número y el estado de la recolección elegida (por si la fila no los trae). */
  protected corregir(f: Fila): void {
    const sel = this.seleccionada();
    this.editando.set({
      ...f,
      numeroRecoleccion: f['numeroRecoleccion'] ?? sel?.['numero'],
      estadoRecoleccion: f['estadoRecoleccion'] ?? sel?.['estado'],
    });
  }

  protected corregida(f: Fila): boolean {
    return esActivo(f['corregida']);
  }

  protected corregido(f: Fila): number {
    return correccion(f);
  }

  /** Se guardó una corrección: se cierra la ventana y se vuelven a pedir la lista (totales) y el detalle de la recolección elegida. */
  protected async trasCorregir(): Promise<void> {
    this.editando.set(null);
    const id = Number(this.seleccionada()?.['id']);
    if (!id) return;
    const pedido = ++this.pedido;
    try {
      const [lista, detalle] = await Promise.all([this.jornadasApi.historialRecolecciones(0), this.jornadasApi.historialRecolecciones(id)]);
      if (pedido !== this.pedido) return;
      if (!lista.error) {
        const nueva = lista.data ?? [];
        this.recolecciones.set(nueva);
        const actual = nueva.find((x) => Number(x['id']) === id);
        if (actual) this.seleccionada.set(actual);
      }
      if (detalle.error) throw new Error(detalle.mensaje || 'No se pudo consultar el detalle.');
      this.detalle.set(detalle.data ?? []);
      this.errorDetalle.set('');
    } catch (e) {
      if (pedido === this.pedido) this.errorDetalle.set(e instanceof Error && e.message ? e.message : 'No se pudo consultar el detalle.');
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
