import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideArrowLeftRight, LucideInbox, LucidePackageMinus, LucidePackagePlus, LucidePencilLine, LucideSearch, LucideSlidersHorizontal, LucideWifiOff } from '@lucide/angular';
import { PaginatorComponent } from '../../shared/components/paginator/paginator.component';
import { SearchMultiSelectComponent } from '../../shared/components/search-multi-select/search-multi-select.component';
import { SearchSelectOption } from '../../shared/components/search-select/search-select.component';
import { ConnectivityService } from '../../shared/services/connectivity.service';
import { FeedbackModalService } from '../../shared/services/feedback-modal.service';
import { JornadasAnotadorApiService } from '../../shared/services/jornadas-anotador-api.service';
import { LoadingService } from '../../shared/services/loading.service';
import { nowPeruDate } from '../../shared/utils/date-time.util';
import { crearPaginacion } from '../../shared/utils/paginacion';
import { fecha } from '../jornada/jornada.utils';

const texto = (valor: unknown): string => String(valor ?? '').trim();
const numero = (valor: unknown): number => {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
};

type Tipo = 'ENTRADA' | 'CORRECCION' | 'AJUSTE' | 'SALIDA_PALET';

interface Movimiento {
  id: number;
  /** Fecha y hora local ('AAAA-MM-DDTHH:mm:ss'). */
  fecha: string;
  tipo: Tipo;
  proceso: string;
  formato: string;
  tipoEmpaque: string;
  /** Categoría y calibre en una sola línea. */
  categoriaCalibre: string;
  /** Cajas con signo: lo que suma o resta al stock. */
  cajas: number;
  /** Empacador al que pertenecen las cajas (vacío si el movimiento no viene de un registro de cajas). */
  empacador: string;
  empacadorDocumento: string;
  observaciones: string;
  /** En las salidas a palet: cajas del movimiento completo (las `cajas` son solo la parte que cae sobre las cajas del anotador). */
  cajasMovimiento: number;
  numeroPalet: number;
}

interface EtiquetaTipo {
  texto: string;
  clase: string;
}

const ETIQUETAS: Record<Tipo, EtiquetaTipo> = {
  ENTRADA: { texto: 'Entrada', clase: 'bg-blue-600 text-white' },
  CORRECCION: { texto: 'Corrección', clase: 'bg-amber-400 text-amber-950' },
  AJUSTE: { texto: 'Ajuste', clase: 'bg-slate-500 text-white' },
  SALIDA_PALET: { texto: 'Salida palet', clase: 'bg-emerald-600 text-white' },
};

/**
 * Movimientos de stock de las cajas del anotador (solo en línea): entradas, correcciones (con la observación que escribió), ajustes de la edición normal y salidas a palet, de un día,
 * con el empacador de cada movimiento. Las salidas a palet las registra Logística; el SP las atribuye al anotador por orden de llegada. Lo que dice el kardex (PLANTA_Stock_Movimientos), con el signo de cada movimiento.
 */
@Component({
  selector: 'app-movimientos-stock',
  imports: [DecimalPipe, FormsModule, PaginatorComponent, SearchMultiSelectComponent, LucideArrowLeftRight, LucideInbox, LucidePackageMinus, LucidePackagePlus, LucidePencilLine, LucideSearch, LucideSlidersHorizontal, LucideWifiOff],
  templateUrl: './movimientos-stock.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MovimientosStockComponent implements OnInit {
  private readonly api = inject(JornadasAnotadorApiService);
  private readonly connectivity = inject(ConnectivityService);
  private readonly loading = inject(LoadingService);
  private readonly feedback = inject(FeedbackModalService);

  readonly online = computed(() => this.connectivity.online());
  readonly fecha = signal(nowPeruDate());
  /** Tipos elegidos; vacío o todos = todos. */
  readonly tipos = signal<string[]>([]);
  readonly tiposOpciones: SearchSelectOption[] = [
    { value: 'ENTRADA', label: 'Entradas' },
    { value: 'CORRECCION', label: 'Correcciones' },
    { value: 'AJUSTE', label: 'Ajustes' },
    { value: 'SALIDA_PALET', label: 'Salidas a palet' },
  ];
  readonly busqueda = signal('');

  readonly movimientos = signal<Movimiento[]>([]);
  readonly resumen = signal<Record<string, { movimientos: number; cajas: number }>>({});
  readonly consultado = signal(false);

  readonly buscados = computed(() => {
    const q = this.busqueda().trim().toLowerCase();
    if (!q) return this.movimientos();
    return this.movimientos().filter((m) =>
      [m.formato, m.tipoEmpaque, m.categoriaCalibre, m.empacador, m.empacadorDocumento, m.observaciones, m.proceso].some((v) => v.toLowerCase().includes(q)),
    );
  });
  readonly paginacion = crearPaginacion(() => this.buscados(), 50);

  async ngOnInit(): Promise<void> {
    if (this.online()) await this.consultar();
  }

  /** Texto de una salida a palet sin observación: a qué palet salió y, si el movimiento era más grande, cuánto era en total. */
  detalleSalida(m: Movimiento): string {
    const palet = m.numeroPalet ? `Salió al palet ${m.numeroPalet}` : 'Salió a palet';
    return m.cajasMovimiento > Math.abs(m.cajas) ? `${palet} (el movimiento fue de ${m.cajasMovimiento} cajas; esta es la parte de tus cajas)` : palet;
  }

  /** 'AAAA-MM-DDTHH:mm:ss' -> dd/MM/yyyy */
  fechaCorta(valor: string): string {
    return fecha(valor.slice(0, 10));
  }

  etiqueta(tipo: Tipo): EtiquetaTipo {
    return ETIQUETAS[tipo];
  }

  cambiarBusqueda(valor: string): void {
    this.busqueda.set(valor);
    this.paginacion.page.set(1);
  }

  async consultar(): Promise<void> {
    if (!this.fecha()) {
      this.feedback.warning('Selecciona una fecha.', 'Movimientos de stock');
      return;
    }
    if (!this.online()) {
      this.feedback.warning('Necesitas internet para consultar los movimientos de stock.', 'Sin conexión');
      return;
    }

    this.loading.show('Consultando movimientos...');
    try {
      const sobre = await this.api.movimientosStock({ fecha: this.fecha(), tipos: this.tipos().length === this.tiposOpciones.length ? [] : this.tipos() });
      if (sobre?.error) {
        this.movimientos.set([]);
        this.resumen.set({});
        this.feedback.error(texto(sobre.mensaje) || 'No se pudieron consultar los movimientos de stock.');
        return;
      }
      const data = sobre?.data ?? { resumen: [], movimientos: [] };
      const resumen: Record<string, { movimientos: number; cajas: number }> = {};
      for (const r of Array.isArray(data.resumen) ? data.resumen : []) resumen[texto(r['tipoMovimiento'])] = { movimientos: numero(r['movimientos']), cajas: numero(r['cajas']) };
      this.resumen.set(resumen);
      this.movimientos.set(
        (Array.isArray(data.movimientos) ? data.movimientos : []).map<Movimiento>((m) => ({
          id: numero(m['id']),
          fecha: texto(m['fechaMovimiento']),
          tipo: texto(m['tipoMovimiento']) as Tipo,
          proceso: m['fechaProceso'] ? `${fecha(m['fechaProceso'])} · ${texto(m['turno'])}`.replace(/ · $/, '') : texto(m['idProceso']),
          formato: texto(m['formatoDescripcion']),
          tipoEmpaque: texto(m['tipoEmpaqueDescripcion']),
          categoriaCalibre: [texto(m['categoriaNombre']), texto(m['calibreNombre'])].filter(Boolean).join(' · '),
          cajas: numero(m['cajas']),
          empacador: texto(m['empacador']),
          empacadorDocumento: texto(m['empacadorDocumento']),
          observaciones: texto(m['observaciones']),
          cajasMovimiento: numero(m['cajasMovimiento']),
          numeroPalet: numero(m['numeroPalet']),
        })),
      );
      this.consultado.set(true);
      this.paginacion.page.set(1);
    } catch {
      this.movimientos.set([]);
      this.resumen.set({});
      this.feedback.error('Error de conexión: no se pudieron consultar los movimientos de stock.', 'Sin conexión');
    } finally {
      await this.loading.hideAfterMinimum();
    }
  }
}
