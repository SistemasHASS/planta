import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideBoxes, LucideCircleCheck, LucideCirclePlus, LucideLayers, LucidePackage, LucidePencilLine, LucideX } from '@lucide/angular';
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
  imports: [FormsModule, SearchSelectComponent, LucideBoxes, LucideCircleCheck, LucideCirclePlus, LucideLayers, LucidePackage, LucidePencilLine, LucideX],
  templateUrl: './modal-cajas-stock.component.html',
  styleUrl: './modal-cajas-stock.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModalCajasStockComponent {
  constructor() {
    portalToBody();
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
