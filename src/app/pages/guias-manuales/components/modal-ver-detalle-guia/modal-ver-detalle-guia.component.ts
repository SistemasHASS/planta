import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { LucideClipboardList, LucideFileText, LucideInbox, LucideMapPin, LucidePackage, LucideTruck, LucideX } from '@lucide/angular';
import { formatDateTime } from '../../../../shared/utils/date-time.util';
import { estadoGuiaClass, estadoSunatClass, estadoSunatLabel } from '../../../../shared/utils/estado-sunat';
import { portalToBody } from '../../../../shared/utils/portal';

type Dato = Record<string, any>;

/** Detalle de una guia manual ya cargada (cabecera, traslado, transporte, resumen e ítems). Solo muestra. */
@Component({
  selector: 'app-modal-ver-detalle-guia-manual',
  imports: [LucideClipboardList, LucideFileText, LucideInbox, LucideMapPin, LucidePackage, LucideTruck, LucideX],
  templateUrl: './modal-ver-detalle-guia.component.html',
  styleUrl: './modal-ver-detalle-guia.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModalVerDetalleGuiaManualComponent {
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

  readonly fechaCreacion = computed(() => this.fecha(this.guiaDetalle()?.['fechaCreacionWeb']));
  readonly fechaEmision = computed(() => this.fecha(this.guiaDetalle()?.['fechaEmision']));

  motivoTrasladoLabel(g: Dato): string {
    const codigo = g['codigoSunatMotivoTraslado'] || g['motivoTraslado'] || '';
    const descripcion = g['descripcionMotivoTrasladoCatalogo'] || '';
    return codigo && descripcion ? `${codigo} - ${descripcion}` : codigo || descripcion || '—';
  }

  private fecha(valor: unknown): string {
    return valor ? formatDateTime(valor) || 'Sin fecha' : 'Sin fecha';
  }
}
