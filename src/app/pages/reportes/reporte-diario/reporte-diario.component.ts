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
import { aplicarTemaGraficos, colorFondoCaptura } from '../../../shared/utils/highcharts-tema';
import { ThemeService } from '../../../shared/services/theme.service';
import { LucideCamera, LucideRefreshCcw, LucideWifiOff } from '@lucide/angular';
import { SearchMultiSelectComponent } from '../../../shared/components/search-multi-select/search-multi-select.component';
import { SearchSelectOption } from '../../../shared/components/search-select/search-select.component';
import { CatalogosRepository } from '../../../shared/dexiedb/repository/catalogos.repository';
import { Usuario } from '../../../shared/interfaces/auth.interface';
import { AuthService } from '../../../shared/services/auth.service';
import { CatalogosApiService } from '../../../shared/services/catalogos-api.service';
import { ConnectivityService } from '../../../shared/services/connectivity.service';
import { FeedbackModalService } from '../../../shared/services/feedback-modal.service';
import { LoadingService } from '../../../shared/services/loading.service';
import {
  ReporteDiarioAcopio,
  ReporteDiarioConsignatario,
  ReporteDiarioData,
  ReporteDiarioVariedad,
  ReportesApiService,
} from '../../../shared/services/reportes-api.service';
import { abrirOCompartirArchivo, descargarArchivo, esDispositivoMovil } from '../../../shared/utils/archivo';
import { nowPeruDate } from '../../../shared/utils/date-time.util';

const texto = (v: unknown): string => String(v ?? '').trim();
const numero = (v: unknown): number => Number(v ?? 0) || 0;

const PALETA = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899', '#10b981', '#6366f1', '#f97316'];

const formatearKg = (v: number): string =>
  new Intl.NumberFormat('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(v);

/**
 * Reporte Diario (Administrador / Monitor): produccion de empaque del dia, consolidada por variedad, acopio y
 * consignatario. Pantalla solo online: no guarda nada en Dexie, solo lee la campania ya configurada en Parametros.
 * Graficos con Highcharts.
 */
@Component({
  selector: 'app-reporte-diario',
  imports: [DecimalPipe, FormsModule, SearchMultiSelectComponent, LucideCamera, LucideRefreshCcw, LucideWifiOff],
  templateUrl: './reporte-diario.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReporteDiarioComponent implements OnInit, OnDestroy {
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
  readonly idProyecto = signal<string>('');

  readonly isLoading = signal(false);
  readonly errorMensaje = signal<string | null>(null);
  readonly fechaConsulta = signal(nowPeruDate());
  readonly acopiosOptions = signal<SearchSelectOption[]>([]);
  readonly acopiosSeleccionados = signal<string[]>([]);
  readonly reporteData = signal<ReporteDiarioData | null>(null);

  private readonly chartAcopioRef = viewChild<ElementRef<HTMLDivElement>>('chartAcopio');
  private readonly chartConsignatarioRef = viewChild<ElementRef<HTMLDivElement>>('chartConsignatario');
  private readonly reportPageRef = viewChild<ElementRef<HTMLElement>>('reportPage');

  private chartAcopio: Highcharts.Chart | null = null;
  private chartConsignatario: Highcharts.Chart | null = null;

  readonly fechaFormateada = computed(() => {
    const [y, m, d] = this.fechaConsulta().split('-').map(Number);
    if (!y || !m || !d) return '—';
    return new Intl.DateTimeFormat('es-PE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(y, m - 1, d));
  });

  readonly hayProcesosAbiertos = computed(() => this.reporteData()?.procesosAbiertos ?? false);
  readonly kpis = computed(() => this.reporteData()?.kpis ?? null);
  readonly produccionPorVariedad = computed<ReporteDiarioVariedad[]>(() => this.reporteData()?.produccionPorVariedad ?? []);
  readonly kgPorAcopio = computed<ReporteDiarioAcopio[]>(() => this.reporteData()?.kgPorAcopio ?? []);
  readonly avancePorConsignatario = computed<ReporteDiarioConsignatario[]>(() => this.reporteData()?.avancePorConsignatario ?? []);

  readonly totalCajasVariedad = computed(() => this.produccionPorVariedad().reduce((s, v) => s + numero(v.cajas), 0));
  readonly totalKgVariedad = computed(() => this.produccionPorVariedad().reduce((s, v) => s + numero(v.kg), 0));

  readonly acopiosLabel = computed(() => {
    const total = this.acopiosOptions().length;
    const sel = this.acopiosSeleccionados().length;
    if (sel === 0 || sel === total) return 'Todos los acopios';
    if (sel === 1) return this.acopiosOptions().find((o) => o.value === this.acopiosSeleccionados()[0])?.label ?? '1 acopio';
    return `${sel} acopios seleccionados`;
  });

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
    await this.cargarProyecto();
    if (!this.idProyecto()) {
      this.errorMensaje.set('No se encontró una campaña configurada. Ve a Parámetros y elige una.');
      return;
    }
    await this.cargarAcopios();
    await this.cargarReporte();
  }

  ngOnDestroy(): void {
    this.chartAcopio?.destroy();
    this.chartConsignatario?.destroy();
  }

  private async cargarProyecto(): Promise<void> {
    const nro = texto(this.usuario()?.documentoIdentidad);
    const cfg = nro ? await this.catalogosRepo.configuracionRepo.getByField('nrodocumento', nro) : undefined;
    this.idProyecto.set(texto(cfg?.idProyecto));
  }

  async cargarAcopios(): Promise<void> {
    if (!this.online()) return;
    try {
      const sobre = await this.catalogosApi.acopios(this.idProyecto());
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

  async cargarReporte(): Promise<void> {
    if (!this.online()) return;
    this.isLoading.set(true);
    this.errorMensaje.set(null);
    try {
      const todos = this.acopiosSeleccionados().length === 0 || this.acopiosSeleccionados().length === this.acopiosOptions().length;
      const acopiosParam = todos ? '' : this.acopiosSeleccionados().join(',');
      const sobre = await this.reportesApi.reporteDiario(this.fechaConsulta(), this.idProyecto(), acopiosParam);
      if (sobre.error) {
        this.errorMensaje.set(sobre.mensaje ?? 'Error al obtener el reporte');
        this.reporteData.set(null);
        return;
      }
      const data = sobre.data as ReporteDiarioData;
      this.reporteData.set(data && !Array.isArray(data) ? await this.completarNombres(data) : null);
    } catch (error) {
      console.error('Error cargando reporte diario', error);
      this.errorMensaje.set('Error de conexión al obtener el reporte');
      this.reporteData.set(null);
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * El SP devuelve codigos (variedad, consignatario, destino, acopio): los nombres se cruzan con los catalogos guardados en el equipo
   * (solo lectura; el reporte no guarda nada en Dexie). Misma llave que la aplicacion anterior: variedad por codigo,
   * consignatario por documento, destino por id.
   */
  private async completarNombres(data: ReporteDiarioData): Promise<ReporteDiarioData> {
    const [variedades, consignatarios, destinos] = await Promise.all([
      this.catalogosRepo.variedadesRepo.getAll(),
      this.catalogosRepo.consignatariosRepo.getAll(),
      this.catalogosRepo.destinosRepo.getAll(),
    ]);
    const variedadPorCodigo = new Map(variedades.map((v) => [texto(v.codigo), texto(v.variedad)]));
    const consignatarioPorDocumento = new Map(consignatarios.map((c) => [texto(c.documento), texto(c.nombre)]));
    const destinoPorId = new Map(destinos.map((d) => [texto(d.id), texto(d.pais)]));
    const acopioPorCodigo = new Map(this.acopiosOptions().map((a) => [a.value, a.label]));

    return {
      ...data,
      produccionPorVariedad: (data.produccionPorVariedad ?? []).map((v) => ({
        ...v,
        variedad: texto(v.variedad) || variedadPorCodigo.get(texto(v.variedadId)) || texto(v.variedadId),
      })),
      kgPorAcopio: (data.kgPorAcopio ?? []).map((a) => ({ ...a, acopio: acopioPorCodigo.get(texto(a.acopio)) || texto(a.acopio) })),
      avancePorConsignatario: (data.avancePorConsignatario ?? []).map((c) => ({
        ...c,
        consignatario: texto(c.consignatario) || consignatarioPorDocumento.get(texto(c.consignatarioId)) || texto(c.consignatarioId),
        destino: destinoPorId.get(texto(c.destinoId)) || texto(c.destinoId),
      })),
    };
  }

  async aplicarFiltros(): Promise<void> {
    if (this.acopiosSeleccionados().length === 0) {
      this.feedback.warning('Selecciona al menos un acopio para consultar el reporte.', 'Validación');
      return;
    }
    this.loading.show('Consultando reporte...');
    try {
      await this.cargarReporte();
    } finally {
      this.loading.hide();
    }
  }

  async actualizar(): Promise<void> {
    this.loading.show('Actualizando...');
    try {
      await this.cargarAcopios();
      await this.cargarReporte();
    } finally {
      this.loading.hide();
    }
  }

  async capturarDashboard(): Promise<void> {
    const elemento = this.reportPageRef()?.nativeElement;
    if (!elemento) return;
    this.isLoading.set(true);
    this.loading.show('Generando captura...');
    try {
      // html2canvas-pro (compatible con html2canvas) entiende los colores oklch() que usa daisyUI.
      const html2canvas = (await import('html2canvas-pro')).default;
      const canvas = await html2canvas(elemento, { scale: 2, useCORS: true, backgroundColor: colorFondoCaptura() });
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('No se pudo generar la imagen');
      const nombre = `reporte-diario-${this.fechaConsulta()}.png`;
      if (esDispositivoMovil()) abrirOCompartirArchivo(blob, nombre);
      else descargarArchivo(blob, nombre);
    } catch (error) {
      console.error('Error al capturar el dashboard diario', error);
      this.feedback.error('No se pudo capturar el dashboard.');
    } finally {
      await this.loading.hideAfterMinimum();
      this.isLoading.set(false);
    }
  }

  consignatarioRowKey(item: ReporteDiarioConsignatario): string {
    return [item.consignatarioId, item.destinoId, item.formato].map(texto).join('|');
  }

  // ───────── Graficos (Highcharts) ─────────

  private renderCharts(data: ReporteDiarioData): void {
    this.renderAcopioChart(data.kgPorAcopio ?? []);
    this.renderConsignatarioChart(data.avancePorConsignatario ?? []);
  }

  private renderAcopioChart(items: ReporteDiarioAcopio[]): void {
    const el = this.chartAcopioRef()?.nativeElement;
    if (!el) return;

    const tipos = this.obtenerTiposProcesoAcopio(items);
    const categorias = items.map((i) => i.acopio);
    const esApilado = tipos.length > 1;
    // Un acopio solo rotula sus segmentos si tiene mas de un tipo de proceso con kg (igual que la aplicacion anterior).
    const tiposConKg = items.map((i) => (i.detalleTipos ?? []).filter((d) => numero(d.kg) > 0).length);

    const series: Highcharts.SeriesColumnOptions[] = esApilado
      ? tipos.map((tipo, idx) => ({
          type: 'column',
          name: tipo.nombre || tipo.codigo,
          color: PALETA[idx % PALETA.length],
          data: items.map((item) => numero((item.detalleTipos ?? []).find((d) => d.codigo === tipo.codigo)?.kg)),
        }))
      : [{ type: 'column', name: 'KG', color: '#2563eb', data: items.map((i) => numero(i.kg)), showInLegend: false }];

    this.chartAcopio?.destroy();
    this.chartAcopio = Highcharts.chart(el, {
      chart: { type: 'column', style: { fontFamily: 'inherit' } },
      title: { text: undefined },
      credits: { enabled: false },
      xAxis: { categories: categorias, labels: { style: { fontSize: '11px' } } },
      yAxis: {
        title: { text: 'KG' },
        maxPadding: 0.12,
        // Total del acopio sobre cada barra (en pastilla blanca).
        stackLabels: {
          enabled: true,
          allowOverlap: true,
          useHTML: true,
          y: -4,
          style: { fontSize: '11px', textOutline: 'none' },
          formatter: function (this: any) {
            return this.total > 0
              ? `<span style="display:inline-block;padding:3px 8px;border-radius:8px;border:1px solid rgba(15,23,42,.15);background:rgba(255,255,255,.96);color:#0f172a;font-weight:600">${formatearKg(this.total)} kg</span>`
              : '';
          },
        },
      },
      legend: { enabled: esApilado, verticalAlign: 'bottom', itemStyle: { fontSize: '11px' } },
      plotOptions: {
        column: {
          stacking: 'normal',
          borderRadius: 4,
          dataLabels: {
            enabled: esApilado,
            style: { fontSize: '10px', fontWeight: '600', color: '#ffffff', textOutline: 'none' },
            formatter: function (this: any) {
              const alto = Number(this.point?.shapeArgs?.height ?? 0);
              const ancho = Number(this.point?.shapeArgs?.width ?? 0);
              if (!this.y || tiposConKg[this.point.index] <= 1 || alto < 18 || ancho < 52) return undefined;
              return alto < 38 ? this.series.name : `${this.series.name}<br/>${formatearKg(this.y)} kg`;
            },
          },
        },
      },
      // outside: el tooltip se dibuja fuera del grafico y queda por encima de los totales (que son HTML).
      tooltip: {
        shared: true,
        outside: true,
        style: { zIndex: 9999 },
        formatter: function (this: any) {
          const filas = (this.points ?? []).map((p: any) => `<span style="color:${p.color}">●</span> ${p.series.name}: <b>${formatearKg(p.y)} kg</b>`);
          const total = (this.points ?? []).reduce((s: number, p: any) => s + (p.y ?? 0), 0);
          const categoria = this.points?.[0]?.point?.category ?? this.x;
          return `<b>${categoria}</b><br/>${filas.join('<br/>')}${filas.length > 1 ? `<br/>Total: <b>${formatearKg(total)} kg</b>` : ''}`;
        },
      },
      series,
    });
  }

  private renderConsignatarioChart(items: ReporteDiarioConsignatario[]): void {
    const el = this.chartConsignatarioRef()?.nativeElement;
    if (!el) return;

    const agrupados = this.agruparConsignatarios(items);
    const data = agrupados.map((item, idx) => ({ name: item.consignatario, y: item.kg, porcentaje: item.porcentaje, color: PALETA[idx % PALETA.length] }));

    this.chartConsignatario?.destroy();
    this.chartConsignatario = Highcharts.chart(el, {
      chart: { type: 'pie', style: { fontFamily: 'inherit' } },
      title: { text: undefined },
      credits: { enabled: false },
      tooltip: { pointFormatter: function (this: Highcharts.Point) { return `${formatearKg(this.y ?? 0)} kg (${(this.options as any).porcentaje}%)`; } },
      plotOptions: {
        pie: {
          borderRadius: 4,
          dataLabels: { enabled: true, format: '{point.percentage:.1f}%', distance: 12, style: { fontSize: '11px', textOutline: 'none' } },
          showInLegend: true,
        },
      },
      legend: { verticalAlign: 'bottom', maxHeight: 90, itemStyle: { fontSize: '11px' } },
      // En pantallas chicas no se rotulan las porciones (el porcentaje queda en la leyenda de la tabla y en el tooltip).
      responsive: { rules: [{ condition: { maxWidth: 480 }, chartOptions: { plotOptions: { pie: { dataLabels: { enabled: false } } } } }] },
      series: [{ type: 'pie', name: 'KG', data }],
    });
  }

  private obtenerTiposProcesoAcopio(items: ReporteDiarioAcopio[]) {
    const mapa = new Map<string, { codigo: string; nombre: string }>();
    for (const item of items) {
      for (const detalle of item.detalleTipos ?? []) {
        const codigo = texto(detalle.codigo);
        if (!codigo || numero(detalle.kg) <= 0 || mapa.has(codigo)) continue;
        mapa.set(codigo, { codigo, nombre: texto(detalle.nombre) || codigo });
      }
    }
    return Array.from(mapa.values());
  }

  private agruparConsignatarios(items: ReporteDiarioConsignatario[]) {
    const mapa = new Map<string, { consignatarioId: string; consignatario: string; kg: number }>();
    for (const item of items) {
      const key = texto(item.consignatarioId) || texto(item.consignatario);
      if (!key) continue;
      const actual = mapa.get(key);
      if (actual) actual.kg += numero(item.kg);
      else mapa.set(key, { consignatarioId: key, consignatario: texto(item.consignatario) || key, kg: numero(item.kg) });
    }
    const lista = Array.from(mapa.values()).sort((a, b) => b.kg - a.kg);
    const totalKg = lista.reduce((s, i) => s + i.kg, 0);
    return lista.map((i) => ({ ...i, porcentaje: totalKg > 0 ? Math.round((i.kg * 1000) / totalKg) / 10 : 0 }));
  }
}
