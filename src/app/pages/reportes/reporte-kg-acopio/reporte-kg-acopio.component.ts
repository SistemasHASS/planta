import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as Highcharts from 'highcharts';
import { aplicarTemaGraficos, colorFondoCaptura, colorGrillaGrafico, colorSeparadorGrafico } from '../../../shared/utils/highcharts-tema';
import { ThemeService } from '../../../shared/services/theme.service';
import { LucideCamera, LucideRefreshCcw, LucideWifiOff } from '@lucide/angular';
import { SearchMultiSelectComponent } from '../../../shared/components/search-multi-select/search-multi-select.component';
import { SearchSelectComponent, SearchSelectOption } from '../../../shared/components/search-select/search-select.component';
import { CatalogosRepository } from '../../../shared/dexiedb/repository/catalogos.repository';
import { Campania } from '../../../shared/interfaces/catalogo.interface';
import { Usuario } from '../../../shared/interfaces/auth.interface';
import { AuthService } from '../../../shared/services/auth.service';
import { CatalogosApiService } from '../../../shared/services/catalogos-api.service';
import { ConnectivityService } from '../../../shared/services/connectivity.service';
import { FeedbackModalService } from '../../../shared/services/feedback-modal.service';
import { LoadingService } from '../../../shared/services/loading.service';
import {
  KgAcopioClasificacion,
  KgAcopioItem,
  KgAcopioVariedad,
  ReporteKgAcopioData,
  ReportesApiService,
} from '../../../shared/services/reportes-api.service';
import { abrirOCompartirArchivo, descargarArchivo, esDispositivoMovil } from '../../../shared/utils/archivo';
import { nowPeruDate } from '../../../shared/utils/date-time.util';

const texto = (v: unknown): string => String(v ?? '').trim();
const numero = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const formatearKg = (v: number): string => new Intl.NumberFormat('es-PE', { maximumFractionDigits: 2 }).format(v);
const pastilla = (valor: string): string =>
  `<span style="display:inline-block;padding:3px 8px;border-radius:8px;border:1px solid rgba(15,23,42,.15);background:rgba(255,255,255,.96);color:#0f172a;font-weight:600;font-size:11px">${valor}</span>`;

/** Color de cada clasificacion de envase: 1 descarte, 2 jarra verde, 3 jarra blanca. */
const colorClasificacion = (codigo: unknown, indice: number): string => {
  const c = texto(codigo);
  if (c === '1') return '#2563eb';
  if (c === '2') return '#22c55e';
  if (c === '3') return '#64748b';
  return ['#f97316', '#8b5cf6', '#06b6d4', '#eab308'][indice % 4];
};
const insigniaClasificacion = (codigo: unknown): string => {
  const c = texto(codigo);
  if (c === '1') return 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300';
  if (c === '2') return 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300';
  if (c === '3') return 'bg-slate-200 text-slate-600 dark:bg-slate-500/20 dark:text-slate-300';
  return 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300';
};

interface EmpresaOpcion {
  ruc: string;
  nombre: string;
}

interface FilaDetalle {
  acopio: string;
  nombre: string;
  grupo: number;
  detalle: KgAcopioClasificacion;
}

/**
 * KG de materia prima ingresada a los acopios (Administrador / Monitor): bruto, destaraje y neto de un dia.
 * Pantalla solo online: no guarda nada en Dexie (solo lee la configuracion de Parametros). Graficos con Highcharts.
 */
@Component({
  selector: 'app-reporte-kg-acopio',
  imports: [DecimalPipe, FormsModule, SearchMultiSelectComponent, SearchSelectComponent, LucideCamera, LucideRefreshCcw, LucideWifiOff],
  templateUrl: './reporte-kg-acopio.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReporteKgAcopioComponent implements OnInit, OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly tema = inject(ThemeService);
  private readonly connectivity = inject(ConnectivityService);
  private readonly catalogosRepo = inject(CatalogosRepository);
  private readonly catalogosApi = inject(CatalogosApiService);
  private readonly reportesApi = inject(ReportesApiService);
  private readonly loading = inject(LoadingService);
  private readonly feedback = inject(FeedbackModalService);

  readonly online = this.connectivity.online;
  readonly usuario = signal<Usuario | null>(null);
  readonly isLoading = signal(false);
  readonly errorMensaje = signal<string | null>(null);
  readonly fechaConsulta = signal(nowPeruDate());

  readonly empresas = signal<EmpresaOpcion[]>([]);
  readonly empresaRuc = signal('');
  readonly campaniasPorRuc = signal<Record<string, Campania[]>>({});
  readonly campaniaId = signal('');
  readonly acopiosOptions = signal<SearchSelectOption[]>([]);
  readonly acopiosSeleccionados = signal<string[]>([]);
  readonly reporteData = signal<ReporteKgAcopioData | null>(null);

  /** Idproyecto configurado en Parametros (campaña por defecto) y fundo configurado (respaldo del codigo de fundo). */
  private proyectoConfigurado = '';
  private fundoConfigurado = '';

  readonly mostrarEmpresa = computed(() => this.empresas().length > 1);
  readonly empresaOpciones = computed<SearchSelectOption[]>(() => this.empresas().map((e) => ({ value: e.ruc, label: e.nombre })));
  readonly campaniaOpciones = computed<SearchSelectOption[]>(() =>
    (this.campaniasPorRuc()[this.empresaRuc()] ?? []).map((c) => ({ value: texto(c.idproyecto), label: `${texto(c.idproyecto)} - ${texto(c.descripcion)}` })),
  );

  readonly kpis = computed(() => this.reporteData()?.kpis ?? null);
  readonly kgPorAcopio = computed<KgAcopioItem[]>(() => this.reporteData()?.kgPorAcopio ?? []);
  readonly kgPorClasificacion = computed<KgAcopioClasificacion[]>(() => this.reporteData()?.kgPorClasificacion ?? []);
  readonly kgPorVariedad = computed<KgAcopioVariedad[]>(() => this.reporteData()?.kgPorVariedad ?? []);

  readonly filasDetalle = computed<FilaDetalle[]>(() =>
    this.kgPorAcopio().flatMap((a, grupo) =>
      (a.detalleClasificaciones ?? []).map((detalle) => ({ acopio: texto(a.acopio), nombre: this.nombreAcopio(a), grupo, detalle })),
    ),
  );
  readonly totalesVariedad = computed(() =>
    this.kgPorVariedad().reduce(
      (t, v) => ({
        blanca: t.blanca + numero(v.jarraBlancaKgNeto),
        verde: t.verde + numero(v.jarraVerdeKgNeto),
        descarte: t.descarte + numero(v.descarteKgNeto),
        total: t.total + numero(v.kgNetoTotal),
      }),
      { blanca: 0, verde: 0, descarte: 0, total: 0 },
    ),
  );

  readonly fechaFormateada = computed(() => {
    const [y, m, d] = this.fechaConsulta().split('-').map(Number);
    if (!y || !m || !d) return '—';
    return new Intl.DateTimeFormat('es-PE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(y, m - 1, d));
  });

  private readonly chartAcopioRef = viewChild<ElementRef<HTMLDivElement>>('chartAcopio');
  private readonly chartClasificacionRef = viewChild<ElementRef<HTMLDivElement>>('chartClasificacion');
  private readonly reportPageRef = viewChild<ElementRef<HTMLElement>>('reportPage');

  private chartAcopio: Highcharts.Chart | null = null;
  private chartClasificacion: Highcharts.Chart | null = null;

  constructor() {
    effect(() => {
      const data = this.reporteData();
      aplicarTemaGraficos(this.tema.esOscuro()); // al cambiar de tema se vuelven a dibujar
      if (data) this.renderCharts(data);
    });
  }

  async ngOnInit(): Promise<void> {
    const session = await this.auth.getSession();
    this.usuario.set(session?.user ?? null);
    if (!this.online()) return;
    this.loading.show('Cargando reporte...');
    try {
      await this.cargarEmpresasYCampanias();
      await this.cargarAcopios();
    } finally {
      this.loading.hide();
    }
    if (this.campaniaId()) await this.consultar();
  }

  ngOnDestroy(): void {
    this.chartAcopio?.destroy();
    this.chartClasificacion?.destroy();
  }

  nombreAcopio(a: KgAcopioItem): string {
    const codigo = texto(a.acopio);
    return this.acopiosOptions().find((o) => o.value === codigo)?.label || texto(a.nombreAcopio) || codigo || 'Sin acopio';
  }

  insignia(codigo: unknown): string {
    return insigniaClasificacion(codigo);
  }

  // ───────── Filtros ─────────

  /** Empresa propia y, si el parametro REPORTE_KG_INGRESADOS_EXTERNO lo permite, la externa; con sus campañas. */
  private async cargarEmpresasYCampanias(): Promise<void> {
    const u = this.usuario();
    const rucPropio = texto(u?.ruc);
    const nro = texto(u?.documentoIdentidad);
    const cfg = nro ? await this.catalogosRepo.configuracionRepo.getByField('nrodocumento', nro) : undefined;
    this.proyectoConfigurado = texto(cfg?.idProyecto);
    this.fundoConfigurado = texto(cfg?.idFundo);

    const opciones: EmpresaOpcion[] = rucPropio ? [{ ruc: rucPropio, nombre: texto(u?.razonSocial) || 'Empresa activa' }] : [];
    try {
      const externo = await this.reportesApi.kgAcopioRucExterno();
      if (externo && externo !== rucPropio) opciones.push({ ruc: externo, nombre: `Empresa externa (${externo})` });
    } catch (error) {
      console.error('Error consultando la empresa externa', error);
    }
    this.empresas.set(opciones);

    const porRuc: Record<string, Campania[]> = {};
    for (const e of opciones) {
      try {
        porRuc[e.ruc] = await this.reportesApi.kgAcopioCampanias(e.ruc);
      } catch (error) {
        console.error('Error obteniendo campañas', error);
        porRuc[e.ruc] = [];
      }
    }
    this.campaniasPorRuc.set(porRuc);
    this.empresaRuc.set(opciones[0]?.ruc ?? '');
    this.elegirCampaniaPorDefecto();
  }

  /** Al abrir: la campaña configurada en Parametros si pertenece a la empresa; si no, solo si hay una unica. */
  private elegirCampaniaPorDefecto(): void {
    const ids = (this.campaniasPorRuc()[this.empresaRuc()] ?? []).map((c) => texto(c.idproyecto)).filter(Boolean);
    this.campaniaId.set(ids.includes(this.proyectoConfigurado) ? this.proyectoConfigurado : ids.length === 1 ? ids[0] : '');
  }

  /** Al cambiar de empresa se limpia la campaña y sus acopios (el usuario elige otra); el reporte mostrado se conserva hasta filtrar. */
  async cambiarEmpresa(opcion: SearchSelectOption | null): Promise<void> {
    this.empresaRuc.set(opcion?.value ?? '');
    this.campaniaId.set('');
    this.acopiosOptions.set([]);
    this.acopiosSeleccionados.set([]);
  }

  async cambiarCampania(opcion: SearchSelectOption | null): Promise<void> {
    this.campaniaId.set(opcion?.value ?? '');
    this.acopiosOptions.set([]);
    this.acopiosSeleccionados.set([]);
    await this.cargarAcopios();
  }

  async cargarAcopios(): Promise<void> {
    const idProyecto = this.campaniaId();
    if (!this.online() || !idProyecto) return;
    try {
      const sobre = await this.catalogosApi.acopios(idProyecto);
      const filas = !sobre.error && Array.isArray(sobre.data) ? sobre.data : [];
      const opciones = filas
        .map((a) => ({ value: texto(a['codigoAcopio']), label: texto(a['acopioNombre']) || texto(a['codigoAcopio']) }))
        .filter((o) => o.value);
      this.acopiosOptions.set(opciones);
      this.acopiosSeleccionados.set(opciones.map((o) => o.value));
    } catch (error) {
      console.error('Error cargando acopios', error);
      this.feedback.error('No se pudieron cargar los acopios.');
    }
  }

  /** Codigo de fundo de la campaña; si no lo trae, el del fundo configurado en Parametros. */
  private async obtenerCodFundo(): Promise<string> {
    const campania = (this.campaniasPorRuc()[this.empresaRuc()] ?? []).find((c) => texto(c.idproyecto) === this.campaniaId());
    const deCampania = texto(campania?.idfundo);
    if (deCampania) return deCampania;
    const fundo = this.fundoConfigurado ? await this.catalogosRepo.fundoRepo.getByField('id', this.fundoConfigurado as any) : undefined;
    return texto(fundo?.codigoFundo);
  }

  // ───────── Consulta ─────────

  async consultar(): Promise<void> {
    if (!this.online()) return;
    this.isLoading.set(true);
    this.errorMensaje.set(null);
    this.loading.show('Consultando reporte...');
    try {
      const idProyecto = this.campaniaId();
      const codFundo = await this.obtenerCodFundo();
      if (!idProyecto || !codFundo) {
        this.reporteData.set(null);
        this.errorMensaje.set('No se encontró la campaña o el fundo configurado para el usuario.');
        return;
      }
      const todos = this.acopiosSeleccionados().length === 0 || this.acopiosSeleccionados().length === this.acopiosOptions().length;
      const sobre = await this.reportesApi.reporteKgAcopio({
        ruc: this.empresaRuc(),
        fecha: this.fechaConsulta(),
        idProyecto,
        codFundo,
        acopios: todos ? '' : this.acopiosSeleccionados().join(','),
      });
      const vacio = !sobre.data || (Array.isArray(sobre.data) && sobre.data.length === 0);
      if (sobre.error || vacio) {
        this.reporteData.set(null);
        this.errorMensaje.set(sobre.mensaje ?? 'No se pudo obtener el reporte de KG ingresados.');
        return;
      }
      this.reporteData.set(sobre.data as ReporteKgAcopioData);
    } catch (error: any) {
      console.error('Error obteniendo el reporte de KG ingresados', error);
      this.reporteData.set(null);
      this.errorMensaje.set(error?.error?.mensaje ?? error?.error?.message ?? 'Error de conexión al obtener el reporte.');
    } finally {
      this.loading.hide();
      this.isLoading.set(false);
    }
  }

  async aplicarFiltros(): Promise<void> {
    if (!this.campaniaId()) {
      this.feedback.warning('Selecciona una campaña para consultar el reporte.', 'Validación');
      return;
    }
    if (this.acopiosSeleccionados().length === 0) {
      this.feedback.warning('Selecciona al menos un acopio para consultar el reporte.', 'Validación');
      return;
    }
    await this.consultar();
  }

  async actualizar(): Promise<void> {
    if (!this.campaniaId()) {
      this.feedback.warning('Selecciona una campaña para consultar el reporte.', 'Validación');
      return;
    }
    this.loading.show('Actualizando...');
    try {
      await this.cargarAcopios();
    } finally {
      this.loading.hide();
    }
    await this.consultar();
  }

  // ───────── Captura ─────────

  async capturarDashboard(): Promise<void> {
    const elemento = this.reportPageRef()?.nativeElement;
    if (!elemento) return;
    this.isLoading.set(true);
    this.loading.show('Generando captura...');
    try {
      const html2canvas = (await import('html2canvas-pro')).default;
      const canvas = await html2canvas(elemento, { scale: 2, useCORS: true, backgroundColor: colorFondoCaptura() });
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('No se pudo generar la imagen');
      const nombre = `reporte-kg-acopio-${this.fechaConsulta()}.png`;
      if (esDispositivoMovil()) abrirOCompartirArchivo(blob, nombre);
      else descargarArchivo(blob, nombre);
    } catch (error) {
      console.error('Error al capturar el reporte de KG ingresados', error);
      this.feedback.error('No se pudo capturar el dashboard.');
    } finally {
      await this.loading.hideAfterMinimum();
      this.isLoading.set(false);
    }
  }

  // ───────── Graficos (Highcharts) ─────────

  private renderCharts(d: ReporteKgAcopioData): void {
    this.renderAcopio(d.kgPorAcopio ?? []);
    this.renderClasificacion(d.kgPorClasificacion ?? []);
  }

  /** Barras apiladas por acopio (un color por clasificacion) con el total neto sobre cada barra. */
  private renderAcopio(items: KgAcopioItem[]): void {
    const el = this.chartAcopioRef()?.nativeElement;
    if (!el) return;
    this.chartAcopio?.destroy();

    const clasificaciones = new Map<string, string>();
    for (const item of items) {
      for (const d of item.detalleClasificaciones ?? []) {
        const clave = texto(d.clasificacionEnvase) || texto(d.descripcion) || 'SIN';
        if (!clasificaciones.has(clave)) clasificaciones.set(clave, texto(d.descripcion) || 'Sin clasificación');
      }
    }

    const series: Highcharts.SeriesColumnOptions[] = Array.from(clasificaciones.entries()).map(([clave, nombre], idx) => ({
      type: 'column',
      name: nombre,
      color: colorClasificacion(clave, idx),
      data: items.map((i) => numero((i.detalleClasificaciones ?? []).find((d) => (texto(d.clasificacionEnvase) || texto(d.descripcion) || 'SIN') === clave)?.kgNeto)),
    }));

    const nombres = items.map((i) => this.nombreAcopio(i));
    const totales = items.map((i) => numero(i.kgNeto));
    // Segmentos con poca altura: no caben con texto, se resumen dentro del cuadro del total (igual que la aplicacion anterior).
    const ALTO_MIN = 28;
    let chicosPorBarra: string[][] = items.map(() => []);

    this.chartAcopio = Highcharts.chart(el, {
      chart: {
        type: 'column',
        style: { fontFamily: 'inherit' },
        events: {
          // Con el grafico ya dibujado se sabe la altura real de cada segmento: los delgados se listan en el cuadro del total.
          render: function (this: Highcharts.Chart) {
            const grafico = this;
            const nuevo = items.map((_, i) =>
              grafico.series
                .map((serie) => serie.points[i])
                .filter((punto) => punto && numero(punto.y) > 0 && Number((punto.shapeArgs as any)?.height ?? ALTO_MIN) < ALTO_MIN)
                .map((punto) => `${punto.series.name}: ${formatearKg(numero(punto.y))} kg`),
            );
            if (JSON.stringify(nuevo) !== JSON.stringify(chicosPorBarra)) {
              chicosPorBarra = nuevo;
              setTimeout(() => { if (grafico.renderer) grafico.redraw(false); }, 0);
            }
          },
        },
      },
      title: { text: undefined },
      credits: { enabled: false },
      xAxis: { categories: nombres, gridLineWidth: 1, gridLineColor: colorGrillaGrafico(), labels: { style: { fontSize: '11px' } } },
      yAxis: {
        title: { text: 'KG' },
        reversedStacks: false,
        maxPadding: 0.18,
        labels: { formatter: function (this: any) { return formatearKg(this.value); }, style: { fontSize: '11px' } },
        stackLabels: {
          enabled: true,
          allowOverlap: true,
          useHTML: true,
          y: -4,
          style: { fontSize: '11px', textOutline: 'none' },
          formatter: function (this: any) {
            if (!(this.total > 0)) return '';
            const chicos = chicosPorBarra[this.x] ?? [];
            const detalle = chicos.map((c) => `<div style="font-size:10px;font-weight:600">${c}</div>`).join('');
            return `<div style="padding:3px 8px;border-radius:6px;border:1px solid rgba(15,23,42,.18);background:rgba(255,255,255,.96);color:#0f172a;text-align:center;white-space:nowrap"><div style="font-size:11px;font-weight:700">Total neto: ${formatearKg(this.total)} kg</div>${detalle}</div>`;
          },
        },
      },
      legend: { enabled: true, verticalAlign: 'bottom', squareSymbol: false, symbolWidth: 32, symbolHeight: 12, symbolRadius: 0, itemStyle: { fontSize: '11px', fontWeight: '400' } },
      plotOptions: {
        column: {
          stacking: 'normal',
          borderRadius: 2,
          borderWidth: 0,
          groupPadding: 0.1,
          pointPadding: 0,
          dataLabels: {
            enabled: true,
            style: { fontSize: '10px', fontWeight: '700', color: '#ffffff', textOutline: 'none' },
            formatter: function (this: any) {
              const alto = Number(this.point?.shapeArgs?.height ?? 0);
              if (!this.y || alto < ALTO_MIN) return undefined;
              return `${String(this.series.name).toUpperCase()}<br/>${formatearKg(this.y)} kg`;
            },
          },
        },
      },
      tooltip: {
        shared: true,
        outside: true,
        style: { zIndex: 9999 },
        formatter: function (this: any) {
          const filas = (this.points ?? []).map((p: any) => `<span style="color:${p.color}">●</span> ${p.series.name}: <b>${formatearKg(p.y)} kg</b>`);
          const categoria = this.points?.[0]?.point?.category ?? this.x;
          return `<b>${categoria}</b><br/>${filas.join('<br/>')}<br/>Total neto: <b>${formatearKg(totales[this.points?.[0]?.point?.index ?? 0] ?? 0)} kg</b>`;
        },
      },
      series,
    });
  }

  private renderClasificacion(items: KgAcopioClasificacion[]): void {
    const el = this.chartClasificacionRef()?.nativeElement;
    if (!el) return;
    this.chartClasificacion?.destroy();

    const total = items.reduce((s, i) => s + numero(i.kgNeto), 0);
    const data = items.map((i, idx) => ({
      name: texto(i.descripcion) || 'Sin clasificación',
      y: numero(i.kgNeto),
      color: colorClasificacion(i.clasificacionEnvase, idx),
    }));
    const porcentaje = (v: number): string => (total > 0 ? ((v * 100) / total).toFixed(1) : '0.0');

    this.chartClasificacion = Highcharts.chart(el, {
      chart: { type: 'pie', style: { fontFamily: 'inherit' } },
      title: { text: undefined },
      credits: { enabled: false },
      tooltip: {
        outside: true,
        style: { zIndex: 9999 },
        pointFormatter: function (this: Highcharts.Point) { return `${formatearKg(this.y ?? 0)} kg (${porcentaje(this.y ?? 0)}%)`; },
      },
      plotOptions: {
        pie: {
          innerSize: '50%',
          borderWidth: 1,
          borderColor: colorSeparadorGrafico(),
          showInLegend: true,
          dataLabels: { enabled: true, distance: -30, style: { fontSize: '12px', fontWeight: '700', color: '#ffffff', textOutline: 'none' }, formatter: function (this: any) { return this.percentage >= 3 ? `${porcentaje(this.y ?? 0)}%` : ''; } },
        },
      },
      legend: {
        verticalAlign: 'bottom',
        squareSymbol: false,
        symbolWidth: 32,
        symbolHeight: 12,
        symbolRadius: 0,
        itemStyle: { fontSize: '11px', fontWeight: '400' },
        labelFormatter: function (this: any) { return `${this.name} - ${porcentaje(this.y ?? 0)}% (${formatearKg(this.y ?? 0)} kg)`; },
      },
      series: [{ type: 'pie', name: 'KG neto', data }],
    });
  }
}
