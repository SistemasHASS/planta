import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { formatDate } from '../../../../shared/utils/datetime.utils';

export interface GuiaDetalleItem {
  id?: number;
  codigoGuiaRemision?: string;
  idempresa?: string;
  ruc?: string;
  idProyecto?: string;
  codigoAcopio?: string;
  codigoPalet?: string;
  codigoDPalet?: string;
  codigoItem?: string;
  codigoTipoProcesoEmpacado?: string;
  cantidadCajas?: number;
  transactionId_uuid?: string;
  fechaCreacion?: string;
  pesoPorCaja?: number;
  detalleDescripcion?: string;
  nombreTipoProcesoEmpacado?: string;
  nombreConsignatario?: string;
  nombreDestino?: string;
  nombrePresentacion?: string;
  nombreFormato?: string;
  nombreVariedad?: string;
  nombreTipoEmpaqueGuia?: string;
  nombreCodigoRancho?: string;
  nombreLugarProduccion?: string;
  nombreTransporte?: string;
}

export interface GuiaDetalleData {
  id?: number;
  idempresa?: string;
  ruc?: string;
  idProyecto?: string;
  codigoAcopio?: string;
  codigoGuiaRemision?: string;
  serie?: string;
  numero?: string;
  codigoProceso?: string;
  nombreProces?: string;
  documentoDestinatario?: string;
  nombreDestinatario?: string;
  puntoPartida?: string;
  puntoLlegada?: string;
  fechaEmision?: string | null;
  idTransportista?: number | null;
  razonSocialTransportista?: string;
  idConductor?: number | null;
  nombreConductor?: string;
  idVehiculo?: number | null;
  placaPrincipalVehiculo?: string;
  motivoTraslado?: string;
  precinto?: string | null;
  inicioTraslado?: string | null;
  observaciones?: string | null;
  estado?: string;
  pesoTotal?: number;
  totalCajas?: number;
  cantidadPalets?: number;
  usuarioEmision?: string;
  fechaCreacionWeb?: string;
  fechaCierre?: string | null;
  parihuelas?: number | null;
  observacionesUsuario?: string | null;
  esReposicion?: boolean;
  inspeccionTemperatura?: number | null;
  inspeccionLibreOlores?: boolean | null;
  inspeccionLibreInsectos?: boolean | null;
  inspeccionLibreMateriasExtranas?: boolean | null;
  inspeccionUnidadLimpia?: boolean | null;
  inspeccionObservaciones?: string | null;
  inspeccionMedidaCorrectiva?: string | null;
  numeroViaje?: number | null;
  snapshotDetalle?: string | null;
  esEnsayo?: boolean;
  transactionId_uuid?: string;
  fechaCreacion?: string;
  usuarioCre?: string;
  usuarioMod?: string;
  fechaModificacion?: string;
  detalle?: GuiaDetalleItem[];
}

@Component({
  selector: 'app-modal-ver-detalle-guia',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './modal-ver-detalle-guia.component.html',
  styleUrl: './modal-ver-detalle-guia.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModalVerDetalleGuiaComponent {
  @Input() guiaDetalle: GuiaDetalleData | null = null;
  @Output() cerrar = new EventEmitter<void>();

  readonly isLoading = signal(false);

  readonly guia = computed(() => this.guiaDetalle ?? null);

  readonly detallePalets = computed<GuiaDetalleItem[]>(() => {
    const d = this.guiaDetalle?.detalle;
    if (!d) return [];
    return Array.isArray(d) ? d : [];
  });

  readonly tieneDetalle = computed(() => this.detallePalets().length > 0);

  readonly fechaCreacionFmt = computed(() => {
    const g = this.guiaDetalle;
    if (!g?.fechaCreacionWeb) return 'Sin fecha';
    return formatDate(g.fechaCreacionWeb) || 'Sin fecha';
  });

  readonly fechaEmisionFmt = computed(() => {
    const g = this.guiaDetalle;
    if (!g?.fechaEmision) return 'Sin fecha';
    return formatDate(g.fechaEmision) || 'Sin fecha';
  });

  onCerrar(): void {
    this.cerrar.emit();
  }
}
