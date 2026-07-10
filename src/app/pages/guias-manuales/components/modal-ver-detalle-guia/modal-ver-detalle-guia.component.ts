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
  cantidad?: number;
  transactionId_uuid?: string;
  fechaCreacion?: string;
  pesoPorCaja?: number;
  pesoEstimado?: number;
  detalleDescripcion?: string;
  descripcion?: string;
  codigoUnidadMedida?: string;
  unidadMedida?: string;
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
  nombreProceso?: string;
  documentoDestinatario?: string;
  nombreDestinatario?: string;
  puntoPartida?: string;
  puntoLlegada?: string;
  ubigeoPartida?: string;
  ubigeoLlegada?: string;
  fechaEmision?: string | null;
  idTransportista?: number | null;
  razonSocialTransportista?: string;
  idConductor?: number | null;
  nombreConductor?: string;
  apellidoConductor?: string;
  nombreCompletoConductor?: string;
  idVehiculo?: number | null;
  placaPrincipalVehiculo?: string;
  motivoTraslado?: string;
  fechaEntregaBienes?: string | null;
  codigoSunatMotivoTraslado?: string;
  descripcionMotivoTrasladoCatalogo?: string;
  descripcionMotivoTraslado?: string;
  precinto?: string | null;
  inicioTraslado?: string | null;
  observaciones?: string | null;
  estado?: string;
  estadoSunat?: string;
  pesoTotal?: number;
  cantidad?: number;
  usuarioEmision?: string;
  fechaCreacionWeb?: string;
  fechaCierre?: string | null;
  observacionesUsuario?: string | null;
  esReposicion?: boolean;
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

  estadoSunatLabel(estado?: string): string {
    const map: Record<string, string> = {
      PENDIENTE: 'Pendiente',
      ENVIANDO: 'Enviando',
      ENVIADO: 'Enviado',
      ACEPTADO: 'Aceptado',
      ACEPTADO_CON_OBSERVACIONES: 'Aceptado c/obs.',
      RECHAZADO: 'Rechazado',
      ERROR_ENVIO: 'Error envío',
      ANULADO: 'Anulado',
    };
    return map[estado ?? ''] ?? (estado || '—');
  }

  estadoSunatClass(estado?: string): string {
    switch (estado) {
      case 'PENDIENTE': return 'badge-sunat badge-sunat-pendiente';
      case 'ENVIANDO': return 'badge-sunat badge-sunat-enviando';
      case 'ENVIADO': return 'badge-sunat badge-sunat-enviado';
      case 'ACEPTADO': return 'badge-sunat badge-sunat-aceptado';
      case 'ACEPTADO_CON_OBSERVACIONES': return 'badge-sunat badge-sunat-aceptado-obs';
      case 'RECHAZADO': return 'badge-sunat badge-sunat-rechazado';
      case 'ERROR_ENVIO': return 'badge-sunat badge-sunat-error';
      case 'ANULADO': return 'badge-sunat badge-sunat-anulado';
      default: return 'badge-sunat badge-sunat-pendiente';
    }
  }

  onCerrar(): void {
    this.cerrar.emit();
  }
}
