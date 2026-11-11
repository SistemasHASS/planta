import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { LucideMinus, LucidePencilLine, LucidePlus, LucideTriangleAlert, LucideX } from '@lucide/angular';
import { SearchSelectComponent, SearchSelectOption } from '../../../../shared/components/search-select/search-select.component';
import { ConnectivityService } from '../../../../shared/services/connectivity.service';
import { FeedbackModalService } from '../../../../shared/services/feedback-modal.service';
import { JornadasAnotadorApiService } from '../../../../shared/services/jornadas-anotador-api.service';
import { LoadingService } from '../../../../shared/services/loading.service';
import { RecoleccionStore } from '../../recoleccion.store';
import { Fila, conSigno, correccion, esActivo, etiquetaCorreccion, productoAntes, texto } from '../../jornada.utils';

const MAXIMO = 99999;
const MAXIMO_OBSERVACION = 500;

/** Formato y tipo de empaque que se están eligiendo para corregir una anotación (con los tipos que la matriz permite para ese formato). */
interface ProductoEnEdicion {
  formatoId: string;
  tipoEmpaqueId: string;
  tipos: SearchSelectOption[];
}

/**
 * Corregir lo anotado a un empacador: una tarjeta por recolección con su producto, quién anotó y las cajas, que se cambian con el campo o con − / +.
 * Si el anotador se equivocó al elegir, también se puede cambiar el formato y el tipo de empaque (los mismos selects de "Recolección de cajas").
 * Antes de guardar se pide confirmación. Subir las cajas siempre se permite; bajarlas (o pasarlas a otro producto) lo rechaza la base si esas cajas ya están en un palet (el mensaje dice en cuáles).
 */
@Component({
  selector: 'app-corregir-produccion-modal',
  imports: [LucideMinus, LucidePencilLine, LucidePlus, LucideTriangleAlert, LucideX, SearchSelectComponent],
  templateUrl: './corregir-produccion-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CorregirProduccionModalComponent {
  private readonly api = inject(JornadasAnotadorApiService);
  private readonly feedback = inject(FeedbackModalService);
  private readonly connectivity = inject(ConnectivityService);
  private readonly loading = inject(LoadingService);
  protected readonly recoleccion = inject(RecoleccionStore);

  /** Anotaciones del empacador (una fila por recolección). */
  readonly filas = input.required<Fila[]>();

  readonly closed = output<void>();
  /** Se guardó una corrección: la pantalla vuelve a pedir la producción. */
  readonly guardado = output<void>();

  /** Lo que el anotador escribió y todavía no guardó, por id de anotación. */
  protected readonly borradores = signal<Record<number, string>>({});
  /** Anotaciones cuyo producto se está cambiando (formato y tipo elegidos), por id. */
  protected readonly productos = signal<Record<number, ProductoEnEdicion>>({});
  /** Anotación que espera la confirmación del anotador. */
  protected readonly pendiente = signal<Fila | null>(null);
  /** Motivo de la corrección que el anotador escribe en la confirmación (obligatorio). */
  protected readonly observacion = signal('');
  protected readonly maximoObservacion = MAXIMO_OBSERVACION;

  protected readonly conSigno = conSigno;
  protected readonly etiquetaCorreccion = etiquetaCorreccion;
  protected readonly productoAntes = productoAntes;

  protected readonly nombre = computed(() => texto(this.filas()[0]?.['nombreCompleto']));
  protected readonly iniciales = computed(() =>
    this.nombre().split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase(),
  );
  protected readonly ubicacion = computed(() => {
    const ultima = this.filas()[this.filas().length - 1];
    return ultima ? `${texto(ultima['lineaNombre'])} · Puesto ${ultima['puesto'] ?? '—'}` : '';
  });
  protected readonly totalCajas = computed(() => this.filas().reduce((suma, f) => suma + (Number(f['cantidadCajas']) || 0), 0));

  private id(f: Fila): number {
    return Number(f['id']);
  }

  protected valor(f: Fila): string {
    return this.borradores()[this.id(f)] ?? String(f['cantidadCajas']);
  }

  private fijar(f: Fila, valor: string): void {
    this.borradores.update((b) => ({ ...b, [this.id(f)]: valor }));
  }

  /** Solo dígitos y sin ceros a la izquierda: no entra la "e", signos, puntos ni un 0 (mínimo 1). También limpia lo que se pegue. */
  protected escribir(f: Fila, evento: Event): void {
    const el = evento.target as HTMLInputElement;
    const limpio = el.value.replace(/\D/g, '').replace(/^0+/, '');
    if (el.value !== limpio) el.value = limpio;
    this.fijar(f, limpio);
  }

  /** Corta la tecla antes de que se escriba: solo números (y 0 nunca como primer dígito). */
  protected filtrarTecla(e: KeyboardEvent): void {
    if (e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1) return;
    const el = e.target as HTMLInputElement;
    if (!/\d/.test(e.key) || (e.key === '0' && el.value.length === 0)) e.preventDefault();
  }

  protected sumar(f: Fila, paso: number): void {
    const actual = this.cantidad(f) ?? Number(f['cantidadCajas']);
    this.fijar(f, String(Math.min(MAXIMO, Math.max(1, actual + paso))));
  }

  /** Cantidad escrita si es un entero entre 1 y 99999; si no, null. */
  protected cantidad(f: Fila): number | null {
    const v = this.valor(f).trim();
    if (!/^\d+$/.test(v)) return null;
    const n = Number(v);
    return n >= 1 && n <= MAXIMO ? n : null;
  }

  /** Cuánto cambia respecto a lo guardado (0 si no hay cambio o el valor no sirve). */
  protected diferencia(f: Fila): number {
    const n = this.cantidad(f);
    return n === null ? 0 : n - Number(f['cantidadCajas']);
  }

  protected invalida(f: Fila): boolean {
    return this.cantidad(f) === null;
  }

  // ---- Formato y tipo de empaque ----

  /** Está abierto el cambio de producto de esta anotación. */
  protected editandoProducto(f: Fila): ProductoEnEdicion | null {
    return this.productos()[this.id(f)] ?? null;
  }

  /** Abre los dos selects con el formato y el tipo que tiene hoy la anotación. */
  protected async abrirProducto(f: Fila): Promise<void> {
    if (this.editandoProducto(f)) return;
    if (!this.connectivity.online()) {
      this.feedback.error('No hay conexión a internet');
      return;
    }
    this.loading.show('Cargando formatos...');
    try {
      await this.recoleccion.asegurarFormatos();
      const formatoId = texto(f['formatoId']);
      const tipos = await this.recoleccion.tiposEmpaqueDeFormato(formatoId);
      this.productos.update((p) => ({ ...p, [this.id(f)]: { formatoId, tipoEmpaqueId: texto(f['tipoEmpaqueId']), tipos } }));
    } catch (e) {
      this.feedback.error(e instanceof Error && e.message ? e.message : 'No se pudieron consultar los formatos.');
    } finally {
      this.loading.hide();
    }
  }

  protected cancelarProducto(f: Fila): void {
    this.productos.update((p) => {
      const { [this.id(f)]: _quitado, ...resto } = p;
      return resto;
    });
  }

  /** Cambia el formato: se piden los tipos de empaque que la matriz permite para él y se vuelve a elegir el tipo. */
  protected async elegirFormato(f: Fila, opcion: SearchSelectOption): Promise<void> {
    const actual = this.editandoProducto(f);
    if (!actual || opcion.value === actual.formatoId) return;
    if (!opcion.value) {
      this.productos.update((p) => ({ ...p, [this.id(f)]: { formatoId: '', tipoEmpaqueId: '', tipos: [] } }));
      return;
    }
    if (!this.connectivity.online()) {
      this.feedback.error('No hay conexión a internet');
      return;
    }
    this.loading.show('Cargando tipos de empaque...');
    try {
      const tipos = await this.recoleccion.tiposEmpaqueDeFormato(opcion.value);
      this.productos.update((p) => ({ ...p, [this.id(f)]: { formatoId: opcion.value, tipoEmpaqueId: '', tipos } }));
      if (tipos.length === 0) this.feedback.warning('La matriz de compatibilidad no tiene tipos de empaque para este formato.', 'Sin tipos de empaque');
    } catch (e) {
      this.feedback.error(e instanceof Error && e.message ? e.message : 'No se pudieron consultar los tipos de empaque.');
    } finally {
      this.loading.hide();
    }
  }

  protected elegirTipo(f: Fila, opcion: SearchSelectOption): void {
    const actual = this.editandoProducto(f);
    if (!actual) return;
    this.productos.update((p) => ({ ...p, [this.id(f)]: { ...actual, tipoEmpaqueId: opcion.value } }));
  }

  /** Formato y tipo elegidos si son distintos de los que tiene la anotación; si no, null. */
  private productoNuevo(f: Fila): { formatoId: number; tipoEmpaqueId: number } | null {
    const e = this.editandoProducto(f);
    if (!e || !e.formatoId || !e.tipoEmpaqueId) return null;
    if (e.formatoId === texto(f['formatoId']) && e.tipoEmpaqueId === texto(f['tipoEmpaqueId'])) return null;
    return { formatoId: Number(e.formatoId), tipoEmpaqueId: Number(e.tipoEmpaqueId) };
  }

  protected productoCambiado(f: Fila): boolean {
    return this.productoNuevo(f) !== null;
  }

  /** Abrió el cambio de producto pero falta elegir el formato o el tipo. */
  protected productoIncompleto(f: Fila): boolean {
    const e = this.editandoProducto(f);
    return !!e && (!e.formatoId || !e.tipoEmpaqueId);
  }

  /** "Formato — tipo — categoría — calibre" del producto elegido (para el aviso de confirmación). */
  protected productoElegido(f: Fila): string {
    const e = this.editandoProducto(f);
    if (!e) return '';
    const formato = this.recoleccion.opcionesFormato().find((o) => o.value === e.formatoId)?.label ?? '';
    const tipo = e.tipos.find((o) => o.value === e.tipoEmpaqueId)?.label ?? '';
    return [formato, tipo].filter(Boolean).join(' — ');
  }

  // ---- Guardar ----

  protected puedeGuardar(f: Fila): boolean {
    return !this.invalida(f) && !this.productoIncompleto(f) && (this.diferencia(f) !== 0 || this.productoCambiado(f));
  }

  protected formato(f: Fila): string {
    return texto(f['formatoDescripcion']) || '—';
  }

  protected detalle(f: Fila): string {
    return [f['tipoEmpaqueDescripcion'], f['categoriaNombre'], f['calibreNombre']].map(texto).filter(Boolean).join(' — ');
  }

  /** Cuánto se corrigió esta anotación antes (con signo) y si alguna vez se corrigió. */
  protected corregido(f: Fila): number {
    return correccion(f);
  }

  protected corregida(f: Fila): boolean {
    return esActivo(f['corregida']);
  }

  protected abierta(f: Fila): boolean {
    return texto(f['estadoRecoleccion']) === 'ABIERTA';
  }

  protected pedirConfirmacion(f: Fila): void {
    if (!this.puedeGuardar(f)) return;
    this.observacion.set('');
    this.pendiente.set(f);
  }

  protected cancelarConfirmacion(): void {
    this.pendiente.set(null);
    this.observacion.set('');
  }

  protected escribirObservacion(evento: Event): void {
    this.observacion.set((evento.target as HTMLTextAreaElement).value);
  }

  protected async confirmar(): Promise<void> {
    const f = this.pendiente();
    if (!f) return;
    const n = this.cantidad(f);
    if (n === null || !this.puedeGuardar(f)) {
      this.pendiente.set(null);
      return;
    }
    const observaciones = this.observacion().trim();
    this.pendiente.set(null);
    if (!this.connectivity.online()) {
      this.feedback.error('No hay conexión a internet');
      return;
    }
    const nuevo = this.productoNuevo(f);
    const producto = nuevo ? { ...nuevo, calibreNombre: this.recoleccion.calibreDe(String(nuevo.tipoEmpaqueId)) } : undefined;
    this.loading.show('Guardando corrección...');
    try {
      const r = await this.api.corregirCajas(this.id(f), n, observaciones, producto);
      if (r.error) throw new Error(r.mensaje || 'No se pudo guardar la corrección.');
      this.borradores.update((b) => {
        const { [this.id(f)]: _quitado, ...resto } = b;
        return resto;
      });
      this.cancelarProducto(f);
      this.guardado.emit();
    } catch (e) {
      // Si la base rechazó (ej. ya están en palets) lo escrito se deja para que el anotador lo vea y lo corrija.
      this.feedback.error(e instanceof Error && e.message ? e.message : 'No se pudo guardar la corrección.');
    } finally {
      await this.loading.hideAfterMinimum();
    }
  }
}
