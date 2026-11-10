import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, OnDestroy, OnInit, computed, effect, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import * as Highcharts from 'highcharts';
import { LucideInbox, LucideSearch, LucideSettings, LucideWifiOff } from '@lucide/angular';
import { SearchMultiSelectComponent } from '../../shared/components/search-multi-select/search-multi-select.component';
import { SearchSelectOption } from '../../shared/components/search-select/search-select.component';
import { PaginatorComponent } from '../../shared/components/paginator/paginator.component';
import { CatalogosRepository } from '../../shared/dexiedb/repository/catalogos.repository';
import { Configuracion } from '../../shared/interfaces/administracion.interface';
import { Usuario } from '../../shared/interfaces/auth.interface';
import { AdministracionApiService } from '../../shared/services/administracion-api.service';
import { AuthService } from '../../shared/services/auth.service';
import { CatalogosApiService } from '../../shared/services/catalogos-api.service';
import { ConnectivityService } from '../../shared/services/connectivity.service';
import { FeedbackModalService } from '../../shared/services/feedback-modal.service';
import { LoadingService } from '../../shared/services/loading.service';
import { ThemeService } from '../../shared/services/theme.service';
import { aplicarTemaGraficos, colorGrillaGrafico } from '../../shared/utils/highcharts-tema';
import { nowPeruDate } from '../../shared/utils/date-time.util';
import { crearPaginacion } from '../../shared/utils/paginacion';
import { permisos } from '../../shared/utils/permisos';

const texto = (valor: unknown): string => String(valor ?? '').trim();
const numero = (valor: unknown): number => {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
};
const redondear = (valor: number): number => Math.round(valor * 100) / 100;

/** Un empacador del día con sus kilos y la meta de tarea del proceso en el que más trabajó. */
interface Empacador {
  clave: string;
  acopio: string;
  dni: string;
  nombre: string;
  /** 'MAQUINA' si su proceso dominante es de máquina; 'MANUAL' si es línea manual. */
  grupo: 'MAQUINA' | 'MANUAL';
  proceso: string;
  /** Kilos por tarea de su proceso; null si no está configurado. */
  meta: number | null;
  cajas: number;
  kgPago: number;
  kgReal: number;
  /** Tareas completas (kg de pago / meta). */
  tareas: number;
  /** Kilos que pasan de las tareas completas. */
  sobran: number;
  /** Avance hacia la siguiente tarea, 0–99. */
  avance: number;
  cumple: boolean;
}

interface Planta {
  codigo: string;
  nombre: string;
}

const COLOR_REAL = '#4f46e5';
const COLOR_PAGO = '#eb6834';
const KG = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Escala "bonita" para el eje Y: devuelve el paso y el máximo redondeado hacia arriba. */
function escalaY(maximo: number): { paso: number; tope: number } {
  const objetivo = Math.max(maximo, 1) / 5;
  const potencia = Math.pow(10, Math.floor(Math.log10(objetivo)));
  const fraccion = objetivo / potencia;
  const paso = (fraccion <= 1 ? 1 : fraccion <= 2 ? 2 : fraccion <= 5 ? 5 : 10) * potencia;
  return { paso, tope: Math.ceil(maximo / paso) * paso || paso };
}

/**
 * Historial de kilos de los empacadores en un día (administrador y anotador; solo en línea y solo con Flujo_Empaque activo): kilos reales (lo que
 * pesaron las cajas) frente a kilos de pago (según la tabla Kilos de pago), y cuánto de la tarea del proceso llevan. El anotador ve su acopio;
 * el administrador, todos o el que elija. Sin meta configurada no hay tarea y los kilos de pago sin configurar valen 0.
 */
@Component({
  selector: 'app-historial-kilos',
  imports: [DecimalPipe, FormsModule, RouterLink, PaginatorComponent, SearchMultiSelectComponent, LucideInbox, LucideSearch, LucideSettings, LucideWifiOff],
  templateUrl: './historial-kilos.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HistorialKilosComponent implements OnInit, OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly catalogos = inject(CatalogosRepository);
  private readonly catalogosApi = inject(CatalogosApiService);
  private readonly api = inject(AdministracionApiService);
  private readonly connectivity = inject(ConnectivityService);
  private readonly loading = inject(LoadingService);
  private readonly feedback = inject(FeedbackModalService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly tema = inject(ThemeService);
  private readonly graficoRef = viewChild<ElementRef<HTMLDivElement>>('grafico');
  private chart: Highcharts.Chart | null = null;

  readonly Math = Math;
  readonly colorReal = COLOR_REAL;
  readonly colorPago = COLOR_PAGO;

  readonly online = computed(() => this.connectivity.online());
  readonly usuario = signal<Usuario | null>(null);
  readonly esAdmin = computed(() => permisos.esAdmin(texto(this.usuario()?.idRol).toUpperCase()));

  // Filtros
  readonly fecha = signal(nowPeruDate());
  /** Acopios elegidos (por defecto todos). */
  readonly acopiosElegidos = signal<string[]>([]);
  readonly plantas = signal<Planta[]>([]);
  readonly acopiosOpciones = computed<SearchSelectOption[]>(() => this.plantas().map((p) => ({ value: p.codigo, label: p.nombre ? `${p.codigo} — ${p.nombre}` : p.codigo })));
  /** Procesos elegidos ('manual' / 'maquina'); vacío o los dos = todos. */
  readonly procesosElegidos = signal<string[]>([]);
  readonly procesosOpciones: SearchSelectOption[] = [
    { value: 'manual', label: 'Línea manual' },
    { value: 'maquina', label: 'Máquina' },
  ];
  readonly busqueda = signal('');

  readonly todos = signal<Empacador[]>([]);
  readonly consultado = signal(false);
  /** El parámetro Flujo_Empaque no está activo: la pantalla solo avisa. */
  readonly sinFlujo = signal(false);

  /** Hay empacadores de máquina: solo entonces se separan los bloques Manual / Máquina y el filtro de proceso tiene sentido. */
  readonly hayMaquinas = computed(() => this.todos().some((e) => e.grupo === 'MAQUINA'));
  /** Empacadores según el filtro de proceso (alimenta KPIs y gráfico). */
  readonly filtrados = computed(() => {
    const p = this.procesosElegidos();
    if (p.length === 0 || p.length === this.procesosOpciones.length) return this.todos();
    return this.todos().filter((e) => (p.includes('manual') && e.grupo === 'MANUAL') || (p.includes('maquina') && e.grupo === 'MAQUINA'));
  });

  // KPIs
  readonly totalEmpacadores = computed(() => this.filtrados().length);
  readonly conTarea = computed(() => this.filtrados().filter((e) => e.cumple).length);
  readonly tareasCompletas = computed(() => this.filtrados().reduce((s, e) => s + e.tareas, 0));
  readonly sinPrimera = computed(() => this.filtrados().filter((e) => e.meta !== null && !e.cumple).length);
  readonly kgRealTotal = computed(() => redondear(this.filtrados().reduce((s, e) => s + e.kgReal, 0)));
  readonly kgPagoTotal = computed(() => redondear(this.filtrados().reduce((s, e) => s + e.kgPago, 0)));
  readonly cajasTotal = computed(() => this.filtrados().reduce((s, e) => s + e.cajas, 0));
  /** Metas distintas de los empacadores que se ven, de menor a mayor. */
  readonly metas = computed(() => [...new Set(this.filtrados().map((e) => e.meta).filter((m): m is number => m !== null && m > 0))].sort((a, b) => a - b));
  /** La tarjeta "Meta tarea" solo sale con una única meta y sin máquinas (con máquinas cada proceso tiene la suya). */
  readonly metaUnica = computed(() => (!this.hayMaquinas() && this.metas().length === 1 ? this.metas()[0] : null));
  readonly bloques = computed(() => {
    if (!this.hayMaquinas()) return [];
    return (['MANUAL', 'MAQUINA'] as const).map((g) => {
      const filas = this.todos().filter((e) => e.grupo === g);
      return {
        titulo: g === 'MANUAL' ? 'Línea manual' : 'Máquina',
        empacadores: filas.length,
        cumplen: filas.filter((e) => e.cumple).length,
        cajas: filas.reduce((s, e) => s + e.cajas, 0),
        kgPago: redondear(filas.reduce((s, e) => s + e.kgPago, 0)),
        kgReal: redondear(filas.reduce((s, e) => s + e.kgReal, 0)),
      };
    });
  });

  // Gráfico
  readonly verReal = signal(true);
  readonly verPago = signal(true);
  readonly anchoPantalla = signal(typeof window === 'undefined' ? 1024 : window.innerWidth);
  /** Ancho mínimo del gráfico: cada empacador tiene su espacio y, si no caben, el gráfico se desplaza de derecha a izquierda. */
  readonly anchoGrafico = computed(() => this.filtrados().length * (this.anchoPantalla() < 576 ? 90 : 110));

  constructor() {
    // Se vuelve a dibujar al cambiar los datos, la página, las series visibles o el tema.
    effect(() => {
      const el = this.graficoRef()?.nativeElement;
      const items = this.itemsGrafico();
      const metas = this.metas();
      const real = this.verReal();
      const pago = this.verPago();
      const oscuro = this.tema.esOscuro();
      const todos = this.filtrados();
      this.chart?.destroy();
      this.chart = null;
      if (!el || items.length === 0) return;
      aplicarTemaGraficos(oscuro);
      // La escala sale de todos los empacadores (no solo de la página) para que al pasar de página las barras se comparen.
      const maximo = Math.max(1, ...todos.map((e) => Math.max(real ? e.kgReal : 0, pago ? e.kgPago : 0)), ...(pago ? metas : []));
      this.dibujar(el, items, metas, real, pago, maximo);
    });
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }

  private readonly itemsGrafico = computed(() => this.filtrados());

  private dibujar(el: HTMLElement, items: Empacador[], metas: number[], real: boolean, pago: boolean, maximo: number): void {
    const { tope } = escalaY(maximo);
    const series: Highcharts.SeriesColumnOptions[] = [];
    if (real) series.push({ type: 'column', name: 'Kg reales', color: COLOR_REAL, data: items.map((e) => e.kgReal) });
    if (pago) series.push({ type: 'column', name: 'Kg de pago', color: COLOR_PAGO, data: items.map((e) => e.kgPago) });
    this.chart = Highcharts.chart(el, {
      chart: { type: 'column', style: { fontFamily: 'inherit' } },
      title: { text: undefined },
      credits: { enabled: false },
      legend: { enabled: false },
      xAxis: {
        categories: items.map((e) => e.nombre),
        gridLineWidth: 1,
        gridLineColor: colorGrillaGrafico(),
        labels: { style: { fontSize: '11px' }, formatter: function (this: any) { return this.value.length > 16 ? `${this.value.slice(0, 15)}…` : this.value; } },
      },
      yAxis: {
        title: { text: 'KG' },
        min: 0,
        max: tope,
        labels: { style: { fontSize: '11px' } },
        plotLines: metas.map((m) => ({
          value: m,
          color: '#dc2626',
          width: 2,
          dashStyle: 'Dash' as const,
          zIndex: 5,
          label: { text: `Meta ${m} kg`, align: 'right' as const, style: { color: '#dc2626', fontSize: '10px', fontWeight: '700' }, y: -4 },
        })),
      },
      plotOptions: {
        column: {
          borderRadius: 3,
          borderWidth: 0,
          groupPadding: 0.2,
          pointPadding: 0.04,
          maxPointWidth: 34,
          dataLabels: { enabled: true, style: { fontSize: '10px', fontWeight: '700', textOutline: 'none' }, formatter: function (this: any) { return KG.format(this.y); } },
        },
      },
      tooltip: {
        shared: true,
        outside: true,
        style: { zIndex: 9999 },
        formatter: function (this: any) {
          const i = this.points?.[0]?.point?.index ?? 0;
          const filas = (this.points ?? []).map((p: any) => `<span style="color:${p.color}">●</span> ${p.series.name}: <b>${KG.format(p.y)} kg</b>`);
          const meta = items[i]?.meta;
          return `<b>${items[i]?.nombre ?? ''}</b><br/>${filas.join('<br/>')}${meta ? `<br/>Meta: <b>${meta} kg</b>` : ''}`;
        },
      },
      series,
    });
  }

  // Tabla
  readonly buscados = computed(() => {
    const q = this.busqueda().trim().toLowerCase();
    const base = this.filtrados();
    if (!q) return base;
    return base.filter((e) => e.nombre.toLowerCase().includes(q) || e.dni.toLowerCase().includes(q) || e.acopio.toLowerCase().includes(q) || this.nombreAcopio(e.acopio).toLowerCase().includes(q));
  });
  readonly paginacion = crearPaginacion(() => this.buscados(), 20);

  async ngOnInit(): Promise<void> {
    const alCambiarTamano = () => {
      this.anchoPantalla.set(window.innerWidth);
    };
    window.addEventListener('resize', alCambiarTamano);
    this.destroyRef.onDestroy(() => window.removeEventListener('resize', alCambiarTamano));

    const session = await this.auth.getSession();
    this.usuario.set(session?.user ?? null);
    await this.cargarPlantas();
    this.acopiosElegidos.set(this.plantas().map((p) => p.codigo));
    if (this.online()) await this.consultar();
  }

  /** Las plantas (acopios) de la campaña elegida en Parámetros: dan el filtro del administrador y el nombre del acopio en la tabla. */
  private async cargarPlantas(): Promise<void> {
    try {
      const nro = texto(this.usuario()?.documentoIdentidad);
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

  /** Primer nombre y primer apellido abreviados para el eje del gráfico. */
  private etiqueta(nombre: string): string {
    const partes = nombre.split(/\s+/).filter(Boolean);
    const corto = partes.slice(0, 2).join(' ');
    return corto.length > 14 ? `${corto.slice(0, 13)}…` : corto;
  }

  async consultar(): Promise<void> {
    if (!this.fecha()) {
      this.feedback.warning('Selecciona una fecha.', 'Historial de kilos');
      return;
    }
    if (!this.online()) {
      this.feedback.warning('Necesitas internet para consultar el historial de kilos.', 'Sin conexión');
      return;
    }

    this.loading.show('Consultando historial de kilos...');
    try {
      const elegidos = this.acopiosElegidos();
      const todosAcopios = elegidos.length === 0 || elegidos.length === this.plantas().length;
      const sobre = await this.api.historialKilos({ fecha: this.fecha(), codigoAcopio: todosAcopios ? '' : elegidos.join(',') });
      if (sobre?.error) {
        this.todos.set([]);
        const mensaje = texto(sobre.mensaje);
        if (/flujo de empaque/i.test(mensaje)) this.sinFlujo.set(true);
        else this.feedback.error(mensaje || 'No se pudo consultar el historial de kilos.');
        return;
      }
      this.sinFlujo.set(false);
      const filas = Array.isArray(sobre?.data) ? sobre.data : [];
      this.todos.set(filas.map((f) => this.aEmpacador(f)).sort((a, b) => b.kgPago - a.kgPago || b.kgReal - a.kgReal || a.nombre.localeCompare(b.nombre, 'es')));
      this.consultado.set(true);
      this.paginacion.page.set(1);
    } catch {
      this.todos.set([]);
      this.feedback.error('Error de conexión: no se pudo consultar el historial de kilos.', 'Sin conexión');
    } finally {
      await this.loading.hideAfterMinimum();
    }
  }

  private aEmpacador(f: Record<string, any>): Empacador {
    const metaCruda = f['metaKilos'];
    const meta = metaCruda === null || metaCruda === undefined || numero(metaCruda) <= 0 ? null : numero(metaCruda);
    const kgPago = redondear(numero(f['totalKilosPago']));
    const tareas = meta ? Math.floor(kgPago / meta) : 0;
    const sobran = meta ? redondear(kgPago - tareas * meta) : 0;
    const dni = texto(f['dni']);
    const acopio = texto(f['codigoAcopio']);
    return {
      clave: `${acopio}|${dni}`,
      acopio,
      dni,
      nombre: texto(f['nombreCompleto']) || dni,
      grupo: texto(f['grupo']).toUpperCase() === 'MAQUINA' ? 'MAQUINA' : 'MANUAL',
      proceso: texto(f['tipoProcesoNombre']) || texto(f['tipoProcesoCodigo']),
      meta,
      cajas: numero(f['totalCajas']),
      kgPago,
      kgReal: redondear(numero(f['totalKilosReal'])),
      tareas,
      sobran,
      // floor: nunca marca 100 % si todavía no completó la tarea.
      avance: meta ? Math.min(99, Math.floor((sobran / meta) * 100)) : 0,
      cumple: meta !== null && kgPago >= meta,
    };
  }

  /** Nombre del acopio (si no se encuentra, su código). */
  nombreAcopio(codigo: string): string {
    return this.plantas().find((p) => p.codigo === codigo)?.nombre || codigo;
  }

  cambiarProceso(valor: string[]): void {
    this.procesosElegidos.set(valor);
    this.paginacion.page.set(1);
  }

  cambiarBusqueda(valor: string): void {
    this.busqueda.set(valor);
    this.paginacion.page.set(1);
  }

  /** Prende o apaga una serie del gráfico; nunca quedan las dos apagadas. */
  alternar(serie: 'real' | 'pago'): void {
    const real = this.verReal();
    const pago = this.verPago();
    if (serie === 'real') {
      if (real && !pago) return;
      this.verReal.set(!real);
    } else {
      if (pago && !real) return;
      this.verPago.set(!pago);
    }
  }
}
