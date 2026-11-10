import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideBoxes, LucideCircleCheck, LucideCirclePlus, LucideLayers, LucidePackage, LucidePencilLine, LucideRefreshCcw, LucideX } from '@lucide/angular';
import { SearchSelectComponent, SearchSelectOption } from '../../../../shared/components/search-select/search-select.component';
import { DPalet, Palet } from '../../../../shared/interfaces/palet.interface';
import { StockCajaProceso } from '../../../../shared/services/palets-api.service';
import { portalToBody } from '../../../../shared/utils/portal';

export type { FormCajas } from '../modal-cajas/modal-cajas.component';
import type { FormCajas } from '../modal-cajas/modal-cajas.component';

type Fila = Record<string, any>;

/** Convierte filas de un catalogo en opciones del buscador: valor = campo id, texto = primer campo con contenido. */
function opciones(filas: Fila[] | null | undefined, idField: string, labelFields: string[] = ['descripcion', 'nombre']): SearchSelectOption[] {
  return (filas ?? []).map((f) => {
    const partes = labelFields.map((c) => String(f?.[c] ?? '').trim()).filter(Boolean);
    const label = partes[0] ? partes.join(' — ') : String(f?.[idField] ?? '').trim();
    return { label, value: String(f?.[idField] ?? '').trim() };
  });
}

const valorTexto = (v: unknown): string | null => {
  const t = String(v ?? '').trim();
  return t && t !== '0' ? t : null;
};

/**
 * Formulario para agregar o editar una linea de cajas de un palet. Solo muestra y avisa: la cascada de la matriz
 * de compatibilidad (consignatario → destino → formato → empaque → caja → clamshell) la maneja la pantalla Palets.
 */
@Component({
  selector: 'app-modal-cajas-stock',
  imports: [FormsModule, SearchSelectComponent, LucideBoxes, LucideCircleCheck, LucideCirclePlus, LucideLayers, LucidePackage, LucidePencilLine, LucideRefreshCcw, LucideX],
  templateUrl: './modal-cajas-stock.component.html',
  styleUrl: './modal-cajas-stock.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModalCajasStockComponent {
  private ultimoSinStock = '';

  constructor() {
    portalToBody();
    effect(() => {
      const a = this.analisisStock();
      const clave = a.estado === 'sinStock' && this.visible() && !this.modoEdicion() && this.stockCajas() !== null ? `${this.formCajas().formatoId}-${this.formCajas().tipoEmpaqueGuiaId}` : '';
      if (clave && clave !== this.ultimoSinStock) this.sinStock.emit({ formato: a.formato, guia: a.guia });
      this.ultimoSinStock = clave;
    });
  }

  readonly visible = input(false);
  readonly palet = input<Palet | null>(null);
  readonly composiciones = input<DPalet[]>([]);
  readonly formCajas = input.required<FormCajas>();
  readonly modoEdicion = input(false);
  /** Stock de cajas del proceso. null = el parametro Flujo_Empaque no esta activo: no se muestra la barra. */
  readonly stockCajas = input<StockCajaProceso[] | null>(null);

  readonly tiposProcesoEmpacadoModal = input<Fila[]>([]);
  readonly consignatarios = input<Fila[]>([]);
  readonly filteredDestinos = input<Fila[]>([]);
  readonly filteredFormatos = input<Fila[]>([]);
  readonly filteredTiposEmpaqueGuia = input<Fila[]>([]);
  readonly filteredPresentaciones = input<Fila[]>([]);
  readonly filteredTiposCaja = input<Fila[]>([]);
  readonly filteredTiposClamshell = input<Fila[]>([]);
  readonly filteredVariedades = input<Fila[]>([]);
  readonly filteredCodigosRancho = input<Fila[]>([]);
  readonly lugaresProduccion = input<Fila[]>([]);
  readonly transportes = input<Fila[]>([]);
  readonly variedades = input<Fila[]>([]);

  readonly tipoProcesoEmpacadoDisabled = input(false);
  readonly formatoDisabled = input(false);
  readonly tipoEmpaqueGuiaDisabled = input(false);
  readonly presentacionDisabled = input(false);
  readonly tipoCajaDisabled = input(false);
  readonly tipoClamshellDisabled = input(false);
  readonly codigoRanchoDisabled = input(false);

  /** La combinacion de formato y tipo de empaque guia elegida no tiene stock: la pantalla avisa al usuario. */
  readonly sinStock = output<{ formato: string; guia: string }>();

  /** Se pidieron mas cajas de las que hay disponibles para la combinacion elegida (solo al agregar). */
  readonly stockInsuficiente = output<{ formato: string; guia: string; disponible: number; solicitado: number }>();
  readonly actualizarStock = output<void>();
  readonly cerrar = output<void>();
  readonly guardar = output<void>();
  readonly campoChange = output<{ campo: string; valor: any }>();

  readonly titulo = computed(() => (this.modoEdicion() ? 'Editar Cajas del Palet' : 'Agregar Cajas al Palet'));
  readonly textoGuardar = computed(() => (this.modoEdicion() ? 'Guardar Cambios' : 'Agregar Cajas'));
  readonly numeroPalet = computed(() => {
    const p = this.palet();
    return p ? (p.numeroPalet == 0 ? p.id : p.numeroPalet) : '';
  });
  readonly faltantes = computed(() => {
    const p = this.palet();
    return Math.max(0, (p?.limiteCajasPorPalet ?? 0) - (p?.cantidadCajas ?? 0));
  });

  /** Formato que manda: el fijado por las cajas del palet o, si esta vacio, el que se elige en el formulario. */
  readonly formatoStockId = computed(() => {
    const fijado = this.composiciones()[0]?.formatoId;
    return Number(fijado || this.formCajas().formatoId) || null;
  });
  readonly formatoFijado = computed(() => this.composiciones().length > 0);
  /** Palet con formato fijado: solo las combinaciones de ese formato. Palet vacio: todas. Una pastilla por formato y tipo de empaque, igual que la franja de la pantalla. */
  readonly stockVisible = computed(() => {
    const id = this.formatoStockId();
    return (this.stockCajas() ?? []).filter((s) => Number(s.disponibles) > 0 && (!this.formatoFijado() || Number(s.formatoId) === id));
  });
  /**
   * Pastilla de stock que coincide con lo que el usuario va llenando. Con formato y tipo de empaque guia elegidos se compara
   * por formato y por el tipo de empaque de la guia (categoria y calibre solo si ambos lo traen). Cuando la matriz ya dio el
   * tipo de empaque (al elegir el clamshell) se compara por id.
   */
  readonly analisisStock = computed<{ estado: 'coincide' | 'sinStock' | 'ambiguo' | null; stock: StockCajaProceso | null; formato: string; guia: string }>(() => {
    const vacio = { estado: null, stock: null, formato: '', guia: '' } as const;
    const f = this.formCajas();
    const formatoId = Number(f.formatoId) || 0;
    const guiaId = Number(f.tipoEmpaqueGuiaId) || 0;
    if (!formatoId || !guiaId) return vacio;
    const delFormato = this.stockVisible().filter((s) => Number(s.formatoId) === formatoId);
    const tipoEmpaqueId = Number(f.tipoEmpaqueId) || 0;
    if (tipoEmpaqueId) {
      const exacto = delFormato.find((s) => Number(s.tipoEmpaqueId) === tipoEmpaqueId) ?? null;
      return { ...vacio, estado: exacto ? 'coincide' : null, stock: exacto };
    }
    const guia: any = this.filteredTiposEmpaqueGuia().find((g: any) => Number(g?.id ?? g?.Id) === guiaId);
    if (!guia) return vacio;
    const n = (v: unknown) => String(v ?? '').trim().toUpperCase();
    // El SP de guias devuelve TipoEmpaque (descripcion) y categoria; se lee sin importar mayusculas ni el nombre exacto.
    const leer = (obj: any, ...nombres: string[]) => {
      const claves = Object.keys(obj ?? {});
      for (const nombre of nombres) {
        const k = claves.find((c) => c.toLowerCase() === nombre.toLowerCase());
        if (k && n(obj[k])) return n(obj[k]);
      }
      return '';
    };
    const codigo = leer(guia, 'codigoTipoEmpaque');
    let candidatas: StockCajaProceso[];
    if (codigo && delFormato.some((s) => n(s.tipoEmpaqueCodigo))) {
      // Coincidencia exacta: el codigo del tipo de empaque de la guia es el mismo que trae el stock.
      candidatas = delFormato.filter((s) => n(s.tipoEmpaqueCodigo) === codigo);
    } else {
      // Respaldo por texto (si el SP del stock aun no devuelve el codigo).
      const tipo = leer(guia, 'TipoEmpaque', 'nombreTipoEmpaque', 'descripcionTipoEmpaque');
      const categoria = leer(guia, 'categoria', 'nombreCategoria');
      if (!tipo) return vacio;
      candidatas = delFormato.filter((s) => n(s.tipoEmpaqueDescripcion) === tipo);
      if (candidatas.length > 1 && categoria) {
        const porCategoria = candidatas.filter((s) => n(s.categoriaNombre) === categoria);
        if (porCategoria.length) candidatas = porCategoria;
      }
    }
    const formato = String(this.filteredFormatos().find((x: any) => Number(x?.id) === formatoId)?.['descripcion'] ?? delFormato[0]?.formatoDescripcion ?? '').trim();
    const nombreGuia = String(guia?.nombre ?? guia?.Nombre ?? '').trim();
    if (candidatas.length === 1) return { estado: 'coincide', stock: candidatas[0], formato, guia: nombreGuia };
    return { estado: candidatas.length === 0 ? 'sinStock' : 'ambiguo', stock: null, formato, guia: nombreGuia };
  });

  readonly stockCoincide = computed<StockCajaProceso | null>(() => this.analisisStock().stock);

  /** Guardar: al agregar cajas, si piden mas de lo disponible no se envia (la base lo valida igual). Al editar decide la base, que conoce lo ya consumido. */
  confirmar(): void {
    const a = this.analisisStock();
    const solicitado = Number(this.formCajas().cantidadCajas) || 0;
    if (!this.modoEdicion() && a.estado === 'coincide' && a.stock && solicitado > Number(a.stock.disponibles)) {
      this.stockInsuficiente.emit({ formato: a.formato, guia: a.guia, disponible: Number(a.stock.disponibles), solicitado });
      return;
    }
    this.guardar.emit();
  }

  /** Estilo de cada chip: el que coincide con lo elegido resalta y los demas bajan un poco para que el match se note. */
  claseChip(s: StockCajaProceso): string {
    if (this.esCoincidencia(s)) {
      return 'border-sky-500 bg-sky-100 ring-2 ring-sky-500 shadow-md shadow-sky-500/25 dark:border-sky-300 dark:bg-sky-500/20 dark:ring-sky-300 dark:shadow-sky-400/20';
    }
    return 'border-app-border2 bg-app-surface' + (this.stockCoincide() ? ' opacity-50' : '');
  }

  claseNumero(s: StockCajaProceso): string {
    return this.esCoincidencia(s) ? 'bg-sky-500 text-white' : 'bg-tint-sky text-sky-700 dark:text-sky-300';
  }

  esCoincidencia(s: StockCajaProceso): boolean {
    const c = this.stockCoincide();
    return !!c && Number(c.formatoId) === Number(s.formatoId) && Number(c.tipoEmpaqueId) === Number(s.tipoEmpaqueId);
  }

  etiquetaEmpaque(s: StockCajaProceso): string {
    return [s.tipoEmpaqueDescripcion, s.categoriaNombre, s.calibreNombre].map((t) => String(t ?? '').trim()).filter(Boolean).join(' — ');
  }

  readonly optTiposProceso = computed(() => opciones(this.tiposProcesoEmpacadoModal(), 'id'));
  readonly optConsignatarios = computed(() => opciones(this.consignatarios(), 'documento'));
  readonly optDestinos = computed(() => opciones(this.filteredDestinos(), 'id', ['pais']));
  readonly optFormatos = computed(() => opciones(this.filteredFormatos(), 'id', ['descripcion']));
  readonly optTiposEmpaqueGuia = computed(() => opciones(this.filteredTiposEmpaqueGuia(), 'id'));
  readonly optPresentaciones = computed(() => opciones(this.filteredPresentaciones(), 'id'));
  readonly optTiposCaja = computed(() => opciones(this.filteredTiposCaja(), 'id'));
  readonly optTiposClamshell = computed(() => opciones(this.filteredTiposClamshell(), 'id'));
  readonly optVariedades = computed(() => opciones(this.filteredVariedades(), 'codigo', ['variedad']));
  readonly optVariedadesGuia = computed(() => opciones((this.variedades() ?? []).filter((v) => !v['esEnsayo']), 'codigo', ['variedad']));
  readonly optLugares = computed(() => opciones(this.lugaresProduccion(), 'id'));
  readonly optRanchos = computed(() => opciones(this.filteredCodigosRancho(), 'id', ['codigo']));
  readonly optTransportes = computed(() => opciones(this.transportes(), 'id', ['transporte']));

  readonly v = valorTexto;

  elegido(campo: string, opcion: SearchSelectOption): void {
    this.campoChange.emit({ campo, valor: opcion.value });
  }

  cambio(campo: string, valor: unknown): void {
    this.campoChange.emit({ campo, valor });
  }

  /** Cantidad de cajas: entero, minimo 1. Con un valor menor se avisa debajo del campo. */
  readonly errorCantidad = signal('');

  cambioCantidad(valor: unknown): void {
    const vacio = valor === null || valor === undefined || valor === '';
    const n = Number(valor);
    this.errorCantidad.set(!vacio && (!Number.isFinite(n) || n < 1) ? 'El valor mínimo es 1.' : '');
    this.cambio('cantidadCajas', vacio ? 0 : n);
  }

  /** En la cantidad no se permite e, E, +, -, ni decimales. */
  bloquearTeclaCantidad(ev: KeyboardEvent): void {
    if (['e', 'E', '+', '-', '.', ','].includes(ev.key)) ev.preventDefault();
  }
}
