import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideEye, LucideSearch, LucideUsers, LucideWifiOff } from '@lucide/angular';
import { PaginatorComponent } from '../../../shared/components/paginator/paginator.component';
import { SearchMultiSelectComponent } from '../../../shared/components/search-multi-select/search-multi-select.component';
import { SearchSelectOption } from '../../../shared/components/search-select/search-select.component';
import { CatalogosRepository } from '../../../shared/dexiedb/repository/catalogos.repository';
import { ROLES } from '../../../shared/guards/role.guard';
import { Configuracion } from '../../../shared/interfaces/administracion.interface';
import { AuthService } from '../../../shared/services/auth.service';
import { CatalogosApiService } from '../../../shared/services/catalogos-api.service';
import { ConnectivityService } from '../../../shared/services/connectivity.service';
import { FeedbackModalService } from '../../../shared/services/feedback-modal.service';
import { LoadingService } from '../../../shared/services/loading.service';
import { ReportesApiService } from '../../../shared/services/reportes-api.service';
import { nowPeruDate } from '../../../shared/utils/date-time.util';
import { crearPaginacion } from '../../../shared/utils/paginacion';
import { EmpacadorHistorico, HistoricoEmpacadorDetalleModalComponent } from './historico-empacador-detalle-modal.component';

const texto = (valor: unknown): string => String(valor ?? '').trim();
const numero = (valor: unknown): number => {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
};

interface Planta {
  codigo: string;
  nombre: string;
}

/** Un empacador que fue asignado a un puesto en el rango de fechas. */
interface EmpacadorFila {
  numeroDocumento: string;
  nombreCompleto: string;
  totalAsignaciones: number;
  totalJornadas: number;
  totalCajas: number;
  ultimaAsignacion: string;
  ultimoAcopio: string;
}

/**
 * Histórico de empacadores (administrador, monitor y anotador, solo en línea): lista de todos los empacadores que fueron asignados a un puesto en un rango de
 * fechas de proceso. Con doble clic en uno (o el botón de la fila) se abre su detalle: jornada, proceso, planta, línea o curo, puesto, anotador y cajas.
 * El anotador ve solo los de su acopio; administrador y monitor eligen las plantas (vacío = todas).
 */
@Component({
  selector: 'app-historico-empacador',
  imports: [DecimalPipe, FormsModule, PaginatorComponent, SearchMultiSelectComponent, HistoricoEmpacadorDetalleModalComponent, LucideEye, LucideSearch, LucideUsers, LucideWifiOff],
  templateUrl: './historico-empacador.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HistoricoEmpacadorComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly catalogos = inject(CatalogosRepository);
  private readonly catalogosApi = inject(CatalogosApiService);
  private readonly api = inject(ReportesApiService);
  private readonly connectivity = inject(ConnectivityService);
  private readonly loading = inject(LoadingService);
  private readonly feedback = inject(FeedbackModalService);

  readonly online = computed(() => this.connectivity.online());
  readonly esAnotador = signal(false);
  readonly desde = signal(this.haceDias(6));
  readonly hasta = signal(nowPeruDate());
  /** Códigos de las plantas elegidas (vacío = todas las plantas). */
  readonly plantasElegidas = signal<string[]>([]);
  readonly plantas = signal<Planta[]>([]);
  readonly plantasOpciones = computed<SearchSelectOption[]>(() => this.plantas().map((p) => ({ value: p.codigo, label: p.nombre ? `${p.codigo} — ${p.nombre}` : p.codigo })));

  readonly empacadores = signal<EmpacadorFila[]>([]);
  /** Ya se buscó al menos una vez (para distinguir "no se buscó" de "no hay empacadores"). */
  readonly consultado = signal(false);
  readonly busqueda = signal('');
  readonly filtrados = computed(() => {
    const q = this.busqueda().trim().toLowerCase();
    return q ? this.empacadores().filter((e) => e.nombreCompleto.toLowerCase().includes(q) || e.numeroDocumento.includes(q)) : this.empacadores();
  });
  protected readonly paginacion = crearPaginacion(() => this.filtrados(), 10);

  /** Empacador cuyo detalle está abierto (con los filtros con los que se buscó). */
  readonly detalle = signal<EmpacadorHistorico | null>(null);
  /** Filtros con los que se hizo la última búsqueda: el detalle usa los mismos aunque después se cambien los campos. */
  private filtrosUsados = { fechaDesde: '', fechaHasta: '', codigoAcopio: '' };

  async ngOnInit(): Promise<void> {
    await this.cargarPlantas();
  }

  /** AAAA-MM-DD de hace n días (el rango por defecto es la última semana). */
  private haceDias(n: number): string {
    const [y, m, d] = nowPeruDate().split('-').map(Number);
    const f = new Date(y, m - 1, d - n);
    return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`;
  }

  /** Las plantas (acopios) de la campaña elegida en Parámetros; el anotador no elige: usa su acopio. */
  private async cargarPlantas(): Promise<void> {
    try {
      const session = await this.auth.getSession();
      if (texto(session?.user?.idRol).toUpperCase() === ROLES.anotador) {
        this.esAnotador.set(true);
        return;
      }
      const nro = texto(session?.user?.documentoIdentidad);
      const cfg: Configuracion | null = nro ? ((await this.catalogos.configuracionRepo.getByField('nrodocumento', nro)) ?? null) : null;
      const idProyecto = texto(cfg?.idProyecto);
      if (!idProyecto || !this.online()) return;
      const sobre = await this.catalogosApi.acopios(idProyecto);
      const filas = !sobre?.error && Array.isArray(sobre?.data) ? sobre.data : [];
      this.plantas.set(filas.map((f) => ({ codigo: texto(f['codigoAcopio']), nombre: texto(f['acopioNombre']) })).filter((p) => p.codigo));
    } catch {
      this.plantas.set([]);
    }
  }

  /** AAAA-MM-DD → DD/MM/AAAA */
  fechaCorta(valor: string): string {
    const t = texto(valor).slice(0, 10).split('-');
    return t.length === 3 ? `${t[2]}/${t[1]}/${t[0]}` : texto(valor);
  }

  /** AAAA-MM-DDTHH:mm:ss → DD/MM/AAAA HH:mm */
  fechaHora(valor: string): string {
    const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(texto(valor));
    return m ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}` : '—';
  }

  /** Buscar o filtrar por texto cambia la lista: se vuelve a la primera página. */
  alBuscarTexto(valor: string): void {
    this.busqueda.set(valor);
    this.paginacion.page.set(1);
  }

  async buscar(): Promise<void> {
    if (!this.desde() || !this.hasta()) {
      this.feedback.warning('Indica la fecha de inicio y la de fin.', 'Histórico empacador');
      return;
    }
    if (this.desde() > this.hasta()) {
      this.feedback.warning('La fecha de inicio no puede ser posterior a la de fin.', 'Histórico empacador');
      return;
    }
    if (!this.online()) {
      this.feedback.warning('Necesitas internet para consultar el histórico.', 'Sin conexión');
      return;
    }

    // Todas elegidas o ninguna = todas las plantas (se manda vacío); si no, los códigos separados por coma.
    const elegidas = this.plantasElegidas();
    const todas = elegidas.length === 0 || elegidas.length === this.plantas().length;
    const filtros = { fechaDesde: this.desde(), fechaHasta: this.hasta(), codigoAcopio: todas ? '' : elegidas.join(',') };

    this.loading.show('Buscando empacadores...');
    try {
      const sobre = await this.api.historicoEmpacadores(filtros);
      if (sobre?.error) {
        this.empacadores.set([]);
        this.feedback.error(texto(sobre.mensaje) || 'No se pudo consultar el histórico.');
        return;
      }
      this.filtrosUsados = filtros;
      const filas = Array.isArray(sobre?.data) ? sobre.data : [];
      this.empacadores.set(
        filas.map<EmpacadorFila>((f) => ({
          numeroDocumento: texto(f['numeroDocumento']),
          nombreCompleto: texto(f['nombreCompleto']),
          totalAsignaciones: numero(f['totalAsignaciones']),
          totalJornadas: numero(f['totalJornadas']),
          totalCajas: numero(f['totalCajas']),
          ultimaAsignacion: texto(f['ultimaAsignacion']),
          ultimoAcopio: texto(f['ultimoAcopio']),
        })),
      );
      this.paginacion.page.set(1);
      this.consultado.set(true);
    } catch {
      this.empacadores.set([]);
      this.feedback.error('Error de conexión: no se pudo consultar el histórico.', 'Sin conexión');
    } finally {
      await this.loading.hideAfterMinimum();
    }
  }

  /** Abre el detalle del empacador (doble clic en la fila o botón Ver). */
  abrirDetalle(e: EmpacadorFila): void {
    this.detalle.set({ numeroDocumento: e.numeroDocumento, nombreCompleto: e.nombreCompleto, ...this.filtrosUsados });
  }
}
