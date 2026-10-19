import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import {
  LucideCircleCheck,
  LucideCircleX,
  LucideClipboardCheck,
  LucideFileText,
  LucideInbox,
  LucideMapPin,
  LucideMoon,
  LucidePackage,
  LucideSun,
  LucideTruck,
  LucideX,
} from '@lucide/angular';
import { formatDateTime } from '../../../../shared/utils/date-time.util';
import { estadoGuiaClass, estadoSunatClass, estadoSunatLabel } from '../../../../shared/utils/estado-sunat';
import { portalToBody } from '../../../../shared/utils/portal';

type Dato = Record<string, any>;

/** Detalle de una guia ya cargada (cabecera, transporte, resumen, inspeccion y lineas de cajas). Solo muestra. */
@Component({
  selector: 'app-modal-ver-detalle-guia',
  imports: [
    LucideCircleCheck,
    LucideCircleX,
    LucideClipboardCheck,
    LucideFileText,
    LucideInbox,
    LucideMapPin,
    LucideMoon,
    LucidePackage,
    LucideSun,
    LucideTruck,
    LucideX,
  ],
  templateUrl: './modal-ver-detalle-guia.component.html',
  styleUrl: './modal-ver-detalle-guia.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModalVerDetalleGuiaComponent {
  constructor() {
    portalToBody();
  }

  readonly guiaDetalle = input<Dato | null>(null);
  readonly cerrar = output<void>();

  readonly estadoSunatClass = estadoSunatClass;
  readonly estadoSunatLabel = estadoSunatLabel;
  readonly estadoGuiaClass = estadoGuiaClass;

  readonly esMotivoOtros = computed(() => this.guiaDetalle()?.['codigoSunatMotivoTraslado'] === '13');
  readonly esTrasladoEntreEstablecimientos = computed(() => this.guiaDetalle()?.['codigoSunatMotivoTraslado'] === '04');

  readonly detalle = computed<Dato[]>(() => {
    const d = this.guiaDetalle()?.['detalle'];
    return Array.isArray(d) ? d : [];
  });

  /** Suma de las cajas de todas las líneas del detalle. */
  readonly totalCajasDetalle = computed(() => this.detalle().reduce((suma, d) => suma + Number(d['cantidadCajas'] ?? 0), 0));

  readonly fechaCreacion = computed(() => this.fecha(this.guiaDetalle()?.['fechaCreacionWeb']));
  readonly fechaEmision = computed(() => this.fecha(this.guiaDetalle()?.['fechaEmision']));

  /** Palets, cajas y peso del resumen. */
  readonly resumen = computed(() => {
    const g = this.guiaDetalle();
    return [
      { etiqueta: 'Palets', valor: g?.['cantidadPalets'] ?? 0 },
      { etiqueta: 'Cajas', valor: g?.['totalCajas'] ?? 0 },
      { etiqueta: 'Peso', valor: `${g?.['pesoTotal'] ?? 0} kg` },
    ];
  });

  readonly inspecciones = computed(() => {
    const g = this.guiaDetalle();
    return [
      { etiqueta: 'Libre de olores', valor: g?.['inspeccionLibreOlores'] },
      { etiqueta: 'Libre de insectos', valor: g?.['inspeccionLibreInsectos'] },
      { etiqueta: 'Libre de mat. extrañas', valor: g?.['inspeccionLibreMateriasExtranas'] },
      { etiqueta: 'Unidad limpia', valor: g?.['inspeccionUnidadLimpia'] },
    ];
  });

  motivoTrasladoLabel(g: Dato): string {
    const codigo = g['codigoSunatMotivoTraslado'] || g['motivoTraslado'] || '';
    const descripcion = g['descripcionMotivoTrasladoCatalogo'] || '';
    return codigo && descripcion ? `${codigo} - ${descripcion}` : codigo || descripcion || '—';
  }

  nombreProcesoNoche(g: Dato): boolean {
    return String(g['nombreProceso'] ?? '').toUpperCase().includes('NOCHE');
  }

  private fecha(valor: unknown): string {
    return valor ? formatDateTime(valor) || 'Sin fecha' : 'Sin fecha';
  }
}
