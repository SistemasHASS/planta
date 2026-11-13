import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { LucideUsers, LucideX } from '@lucide/angular';
import { ReportesApiService } from '../../../shared/services/reportes-api.service';
import { portalToBody } from '../../../shared/utils/portal';

const texto = (valor: unknown): string => String(valor ?? '').trim();
const numero = (valor: unknown): number => {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
};

/** Una asignación del empacador a un puesto (PLANTA_ListarHistoricoEmpacadorDetalle). */
interface Asignacion {
  id: number;
  idJornada: number;
  estadoJornada: string;
  fechaProceso: string;
  turno: string;
  acopio: string;
  ubicacion: string;
  puesto: number;
  anotador: string;
  estado: string;
  fechaAsignado: string;
  fechaLiberado: string;
  cajas: number;
}

/** Datos del empacador y filtros con los que se abrió el detalle. */
export interface EmpacadorHistorico {
  numeroDocumento: string;
  nombreCompleto: string;
  fechaDesde: string;
  fechaHasta: string;
  codigoAcopio: string;
}

/**
 * Detalle del histórico de un empacador: cada vez que se le asignó un puesto (jornada, proceso, planta, línea o curo, puesto, anotador y cajas).
 * Si cambió de puesto, de línea o de jornada salen varias filas, de la más reciente a la más antigua.
 */
@Component({
  selector: 'app-historico-empacador-detalle-modal',
  imports: [DecimalPipe, LucideUsers, LucideX],
  templateUrl: './historico-empacador-detalle-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HistoricoEmpacadorDetalleModalComponent implements OnInit {
  constructor() {
    portalToBody();
  }

  private readonly api = inject(ReportesApiService);

  readonly empacador = input.required<EmpacadorHistorico>();
  readonly closed = output<void>();

  readonly cargando = signal(true);
  readonly error = signal('');
  readonly asignaciones = signal<Asignacion[]>([]);
  readonly totalCajas = computed(() => this.asignaciones().reduce((s, a) => s + a.cajas, 0));
  readonly totalJornadas = computed(() => new Set(this.asignaciones().map((a) => a.idJornada)).size);

  async ngOnInit(): Promise<void> {
    const e = this.empacador();
    try {
      const sobre = await this.api.historicoEmpacadorDetalle({ numeroDocumento: e.numeroDocumento, fechaDesde: e.fechaDesde, fechaHasta: e.fechaHasta, codigoAcopio: e.codigoAcopio });
      if (sobre?.error) {
        this.error.set(texto(sobre.mensaje) || 'No se pudo consultar el histórico del empacador.');
        return;
      }
      const filas = Array.isArray(sobre?.data) ? sobre.data : [];
      this.asignaciones.set(
        filas.map<Asignacion>((f) => ({
          id: numero(f['id']),
          idJornada: numero(f['idJornada']),
          estadoJornada: texto(f['estadoJornada']),
          fechaProceso: texto(f['fechaProceso']),
          turno: texto(f['turno']),
          acopio: texto(f['acopioNombre']) || texto(f['codigoAcopio']),
          ubicacion: f['esMaquina'] ? `${texto(f['maquina'])} · Curo ${numero(f['curo'])}` : `Línea ${numero(f['numeroLinea'])}`,
          puesto: numero(f['puesto']),
          anotador: texto(f['anotador']),
          estado: texto(f['estado']),
          fechaAsignado: texto(f['fechaAsignado']),
          fechaLiberado: texto(f['fechaLiberado']),
          cajas: numero(f['cajas']),
        })),
      );
    } catch {
      this.error.set('Error de conexión: no se pudo consultar el histórico del empacador.');
    } finally {
      this.cargando.set(false);
    }
  }

  /** AAAA-MM-DD → DD/MM/AAAA */
  fechaCorta(valor: string): string {
    const t = texto(valor).slice(0, 10).split('-');
    return t.length === 3 ? `${t[2]}/${t[1]}/${t[0]}` : texto(valor);
  }

  /** AAAA-MM-DDTHH:mm:ss → DD/MM/AAAA HH:mm (la hora ya viene en hora local de la planta). */
  fechaHora(valor: string): string {
    const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(texto(valor));
    return m ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}` : '—';
  }
}
