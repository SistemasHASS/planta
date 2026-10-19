import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideBoxes, LucideCircleCheck, LucideCirclePlus, LucideLayers, LucidePencilLine, LucideX } from '@lucide/angular';
import { SearchSelectComponent, SearchSelectOption } from '../../../../shared/components/search-select/search-select.component';
import { DPalet, Palet } from '../../../../shared/interfaces/palet.interface';
import { portalToBody } from '../../../../shared/utils/portal';

export interface FormCajas {
  consignatarioId: string | number;
  destinoId: number | string;
  formatoId: number;
  tipoEmpaqueId: number;
  calibreId: string;
  categoriaId: number;
  tipoEmpaqueGuiaId: number;
  tipoCajaId: number;
  tipoClamshellId: number;
  presentacionId: number;
  tipoProcesoEmpacadoId: number;
  variedadId: number | string;
  variedadGuiaId: number | string;
  lugarProduccionId: number;
  codigoRanchoId: number;
  transporteId: string;
  cantidadCajas: number;
  esReposicion: boolean;
  esEnsayo: boolean;
}

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
  selector: 'app-modal-cajas',
  imports: [FormsModule, SearchSelectComponent, LucideBoxes, LucideCircleCheck, LucideCirclePlus, LucideLayers, LucidePencilLine, LucideX],
  templateUrl: './modal-cajas.component.html',
  styleUrl: './modal-cajas.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModalCajasComponent {
  constructor() {
    portalToBody();
  }

  readonly visible = input(false);
  readonly palet = input<Palet | null>(null);
  readonly composiciones = input<DPalet[]>([]);
  readonly formCajas = input.required<FormCajas>();
  readonly modoEdicion = input(false);

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
}
