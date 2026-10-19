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
import { BhResumenOrigen, ReporteBhData, ReportesApiService } from '../../../shared/services/reportes-api.service';
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

const PALETA = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899', '#10b981'];
const COLOR_BH = '#2563eb';
const COLOR_CAO = '#f97316';

type Origen = 'BH' | 'CAO';

/** Fila comparativa: lo producido por BH (propio) y CAO (externo) para una misma variedad o consignatario. */
interface FilaComparada {
  key: string;
  nombre: string;
  destino: string;
  formato: string;
  bhCajas: number;
  bhKg: number;
  caoCajas: number;
  caoKg: number;
  totalCajas: number;
  totalKg: number;
  porcentaje: number;
}

/**
 * Reporte Diario BH / CAO (Administrador / Monitor): produccion de empaque del dia separada por origen
 * (BH = lugar de produccion propio, CAO = externo). Pantalla solo online: no guarda nada en Dexie.
 * Solo existe para empresas con el parametro REPORTE_BH activo. Graficos con Highcharts.
 */
@Component({
  selector: 'app-reporte-bh',
  imports: [DecimalPipe, FormsModule, SearchMultiSelectComponent, LucideCamera, LucideRefreshCcw, LucideWifiOff],
  templateUrl: './reporte-bh.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReporteBhComponent implements OnInit, OnDestroy {
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
  readonly idProyecto = signal('');
  readonly isLoading = signal(false);
  readonly errorMensaje = signal<string | null>(null);
  readonly fechaConsulta = signal(nowPeruDate());

  readonly acopiosOptions = signal<SearchSelectOption[]>([]);
  readonly acopiosSeleccionados = signal<string[]>([]);
  readonly empresaOptions: SearchSelectOption[] = [
    { value: 'BH', label: 'BH' },
    { value: 'CAO', label: 'CAO' },
  ];
  readonly empresasSeleccionadas = signal<string[]>(['BH', 'CAO']);
  /** Origenes con los que se pidio el reporte mostrado (las columnas dependen de esto, no de la seleccion sin aplicar). */
  readonly empresasAplicadas = signal<Origen[]>(['BH', 'CAO']);
  readonly reporteData = signal<ReporteBhData | null>(null);

  readonly muestraBh = computed(() => this.empresasAplicadas().includes('BH'));
  readonly muestraCao = computed(() => this.empresasAplicadas().includes('CAO'));
  readonly muestraAmbos = computed(() => this.muestraBh() && this.muestraCao());

  readonly kpis = computed(() => this.reporteData()?.kpis ?? null);
  readonly hayProcesosAbiertos = computed(() => this.reporteData()?.procesosAbiertos ?? false);
  private readonly resumen = computed<BhResumenOrigen[]>(() => this.reporteData()?.resumenOrigen ?? []);
  readonly propio = computed(() => this.resumen().find((r) => r.tipoOrigen === 'PROPIO') ?? null);
  readonly externo = computed(() => this.resumen().find((r) => r.tipoOrigen === 'EXTERNO') ?? null);
  readonly sinClasificar = computed(() => this.resumen().find((r) => r.tipoOrigen === 'SIN_CLASIFICAR') ?? null);

  readonly variedades = computed(() =>
    this.comparar(
      (this.reporteData()?.produccionPorVariedad ?? []).map((i) => ({
        tipoOrigen: i.tipoOrigen, cajas: i.cajas, kg: i.kg,
        key: `${texto(i.codigoCultivo)}|${texto(i.variedadId)}`,
        nombre: texto(i.variedad) || texto(i.variedadId), destino: '', formato: '',
      })),
    ),
  );
  readonly consignatarios = computed(() =>
    this.comparar(
      (this.reporteData()?.avancePorConsignatario ?? []).map((i) => ({
        tipoOrigen: i.tipoOrigen, cajas: i.cajas, kg: i.kg,
        key: `${texto(i.consignatarioId)}|${texto(i.destinoId)}|${texto(i.formatoId)}`,
        nombre: texto(i.consignatario) || texto(i.consignatarioId), destino: texto(i.destino) || texto(i.destinoId), formato: texto(i.formato),
      })),
    ),
  );
  readonly totalCajas = computed(() => this.variedades().reduce((s, v) => s + v.totalCajas, 0));
  readonly totalKg = computed(() => this.variedades().reduce((s, v) => s + v.totalKg, 0));

  readonly columnasVariedad = computed(() => 2 + (this.muestraBh() ? 2 : 0) + (this.muestraCao() ? 2 : 0) + (this.muestraAmbos() ? 2 : 0));
  readonly columnasConsignatario = computed(() => 4 + (this.muestraBh() ? 2 : 0) + (this.muestraCao() ? 2 : 0) + (this.muestraAmbos() ? 2 : 0));

  readonly fechaFormateada = computed(() => {
    const [y, m, d] = this.fechaConsulta().split('-').map(Number);
    if (!y || !m || !d) return '—';
    return new Intl.DateTimeFormat('es-PE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(y, m - 1, d));
  });

  private readonly chartAcopioRef = viewChild<ElementRef<HTMLDivElement>>('chartAcopio');
  private readonly chartConsignatarioRef = viewChild<ElementRef<HTMLDivElement>>('chartConsignatario');
  private readonly reportPageRef = viewChild<ElementRef<HTMLElement>>('reportPage');

  private chartAcopio: Highcharts.Chart | null = null;
  private chartConsignatario: Highcharts.Chart | null = null;

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
    const nro = texto(this.usuario()?.documentoIdentidad);
    const cfg = nro ? await this.catalogosRepo.configuracionRepo.getByField('nrodocumento', nro) : undefined;
    this.idProyecto.set(texto(cfg?.idProyecto));
    if (!this.idProyecto()) {
      this.errorMensaje.set('No se encontró una campaña configurada. Ve a Parámetros y elige una.');
      return;
    }
    this.loading.show('Cargando reporte...');
    try {
      await this.cargarAcopios();
    } finally {
      this.loading.hide();
    }
    await this.consultar();
  }

  ngOnDestroy(): void {
    this.chartAcopio?.destroy();
    this.chartConsignatario?.destroy();
  }

  // ───────── Datos ─────────

  async cargarAcopios(): Promise<void> {
    if (!this.online() || !this.idProyecto()) return;
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

  private validar(): boolean {
    if (this.acopiosSeleccionados().length === 0) {
      this.feedback.warning('Selecciona al menos un acopio para consultar el reporte.', 'Validación');
      return false;
    }
    if (this.empresasSeleccionadas().length === 0) {
      this.feedback.warning('Selecciona al menos una empresa: BH o CAO.', 'Validación');
      return false;
    }
    return true;
  }

  async consultar(): Promise<void> {
    if (!this.online() || !this.idProyecto()) return;
    this.isLoading.set(true);
    this.errorMensaje.set(null);
    this.loading.show('Consultando reporte...');
    try {
      const origenes = this.empresasSeleccionadas().length === this.empresaOptions.length ? '' : this.empresasSeleccionadas().join(',');
      const todos = this.acopiosSeleccionados().length === this.acopiosOptions().length;
      const sobre = await this.reportesApi.reporteDiarioPropioExterno({
        fecha: this.fechaConsulta(),
        idProyecto: this.idProyecto(),
        acopios: todos ? '' : this.acopiosSeleccionados().join(','),
        origenes,
      });
      if (sobre.error) {
        this.errorMensaje.set(sobre.mensaje ?? 'No se pudo obtener el reporte BH / CAO.');
        this.reporteData.set(null);
        return;
      }
      const data = sobre.data as ReporteBhData;
      if (!data || Array.isArray(data)) {
        this.reporteData.set(null);
        return;
      }
      this.empresasAplicadas.set(this.empresasSeleccionadas().filter((e): e is Origen => e === 'BH' || e === 'CAO'));
      this.reporteData.set(await this.completarNombres(data));
    } catch (error: any) {
      console.error('Error cargando el reporte BH / CAO', error);
      this.errorMensaje.set(error?.error?.mensaje ?? error?.error?.message ?? 'Error de conexión al obtener el reporte BH / CAO.');
      this.reporteData.set(null);
    } finally {
      this.loading.hide();
      this.isLoading.set(false);
    }
  }

  /** El SP trae codigos: variedad por codigo, consignatario por documento, destino por id y acopio por codigo, desde los catalogos del equipo. */
  private async completarNombres(data: ReporteBhData): Promise<ReporteBhData> {
    const [variedades, consignatarios, destinos] = await Promise.all([
      this.catalogosRepo.variedadesRepo.getAll(),
      this.catalogosRepo.consignatariosRepo.getAll(),
      this.catalogosRepo.destinosRepo.getAll(),
    ]);
    const variedadPorCodigo = new Map(variedades.map((v) => [texto(v.codigo), texto(v.variedad)]));
    const consignatarioPorDoc = new Map(consignatarios.map((c) => [texto(c.documento), texto(c.nombre)]));
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
        consignatario: texto(c.consignatario) || consignatarioPorDoc.get(texto(c.consignatarioId)) || texto(c.consignatarioId),
        destino: destinoPorId.get(texto(c.destinoId)) || texto(c.destinoId),
      })),
    };
  }

  /** Une las filas de BH y CAO que comparten llave y calcula el % sobre el total general. */
  private comparar(items: { tipoOrigen: string; cajas: number; kg: number; key: string; nombre: string; destino: string; formato: string }[]): FilaComparada[] {
    const mapa = new Map<string, FilaComparada>();
    for (const i of items) {
      const f = mapa.get(i.key) ?? { key: i.key, nombre: i.nombre, destino: i.destino, formato: i.formato, bhCajas: 0, bhKg: 0, caoCajas: 0, caoKg: 0, totalCajas: 0, totalKg: 0, porcentaje: 0 };
      const cajas = numero(i.cajas);
      const kg = numero(i.kg);
      if (i.tipoOrigen === 'PROPIO') { f.bhCajas += cajas; f.bhKg += kg; }
      else if (i.tipoOrigen === 'EXTERNO') { f.caoCajas += cajas; f.caoKg += kg; }
      f.totalCajas += cajas;
      f.totalKg += kg;
      mapa.set(i.key, f);
    }
    const filas = Array.from(mapa.values());
    const total = filas.reduce((s, f) => s + f.totalKg, 0);
    return filas.map((f) => ({ ...f, porcentaje: total > 0 ? (f.totalKg * 100) / total : 0 })).sort((a, b) => b.totalKg - a.totalKg);
  }

  async aplicarFiltros(): Promise<void> {
    if (!this.validar()) return;
    await this.consultar();
  }

  async actualizar(): Promise<void> {
    this.loading.show('Actualizando...');
    try {
      await this.cargarAcopios();
    } finally {
      this.loading.hide();
    }
    if (!this.validar()) return;
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
      const nombre = `reporte-bh-cao-${this.fechaConsulta()}.png`;
      if (esDispositivoMovil()) abrirOCompartirArchivo(blob, nombre);
      else descargarArchivo(blob, nombre);
    } catch (error) {
      console.error('Error al capturar el dashboard BH / CAO', error);
      this.feedback.error('No se pudo capturar el dashboard.');
    } finally {
      await this.loading.hideAfterMinimum();
      this.isLoading.set(false);
    }
  }

  // ───────── Graficos (Highcharts) ─────────

  private renderCharts(data: ReporteBhData): void {
    this.renderAcopio(data);
    this.renderConsignatario(data);
  }

  /** Columnas agrupadas por planta: BH (azul) y CAO (naranja), con el peso sobre cada barra. */
  private renderAcopio(data: ReporteBhData): void {
    const el = this.chartAcopioRef()?.nativeElement;
    if (!el) return;
    this.chartAcopio?.destroy();

    const items = data.kgPorAcopio ?? [];
    const plantas = Array.from(new Set(items.map((i) => texto(i.acopio))));
    const suma = (planta: string, origen: string): number =>
      items.filter((i) => texto(i.acopio) === planta && i.tipoOrigen === origen).reduce((s, i) => s + numero(i.kg), 0);

    const series: Highcharts.SeriesColumnOptions[] = [
      { type: 'column', name: 'BH', color: COLOR_BH, data: plantas.map((p) => suma(p, 'PROPIO')) },
      { type: 'column', name: 'CAO', color: COLOR_CAO, data: plantas.map((p) => suma(p, 'EXTERNO')) },
    ].filter((s) => s.data.some((v) => v > 0)) as Highcharts.SeriesColumnOptions[];

    this.chartAcopio = Highcharts.chart(el, {
      chart: { type: 'column', style: { fontFamily: 'inherit' } },
      title: { text: undefined },
      credits: { enabled: false },
      xAxis: { categories: plantas, labels: { style: { fontSize: '11px' } } },
      yAxis: { title: { text: 'KG' }, min: 0, maxPadding: 0.12 },
      legend: { enabled: true, verticalAlign: 'bottom', itemStyle: { fontSize: '11px' } },
      plotOptions: {
        column: {
          borderRadius: 4,
          dataLabels: {
            enabled: true,
            useHTML: true,
            allowOverlap: true,
            style: { textOutline: 'none' },
            formatter: function (this: Highcharts.Point) { return (this.y ?? 0) > 0 ? pastilla(`${formatearKg(this.y ?? 0)} kg`) : ''; },
          },
        },
      },
      tooltip: {
        shared: true,
        outside: true,
        style: { zIndex: 9999 },
        formatter: function (this: any) {
          const filas = (this.points ?? []).map((p: any) => `<span style="color:${p.color}">●</span> ${p.series.name}: <b>${formatearKg(p.y)} kg</b>`);
          return `<b>${this.points?.[0]?.point?.category ?? this.x}</b><br/>${filas.join('<br/>')}`;
        },
      },
      series,
    });
  }

  private renderConsignatario(data: ReporteBhData): void {
    const el = this.chartConsignatarioRef()?.nativeElement;
    if (!el) return;
    this.chartConsignatario?.destroy();

    const mapa = new Map<string, { nombre: string; kg: number }>();
    for (const i of data.avancePorConsignatario ?? []) {
      const key = texto(i.consignatarioId) || texto(i.consignatario);
      if (!key) continue;
      const actual = mapa.get(key);
      if (actual) actual.kg += numero(i.kg);
      else mapa.set(key, { nombre: texto(i.consignatario) || key, kg: numero(i.kg) });
    }
    const lista = Array.from(mapa.values()).filter((i) => i.kg > 0).sort((a, b) => b.kg - a.kg);
    const total = lista.reduce((s, i) => s + i.kg, 0);
    const porcentaje = (v: number): string => (total > 0 ? ((v * 100) / total).toFixed(1) : '0.0');

    this.chartConsignatario = Highcharts.chart(el, {
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
          borderRadius: 4,
          showInLegend: true,
          dataLabels: { enabled: true, distance: 12, style: { fontSize: '11px', textOutline: 'none' }, formatter: function (this: any) { return `${porcentaje(this.y ?? 0)}%`; } },
        },
      },
      legend: { verticalAlign: 'bottom', maxHeight: 90, itemStyle: { fontSize: '11px' } },
      responsive: { rules: [{ condition: { maxWidth: 480 }, chartOptions: { plotOptions: { pie: { dataLabels: { enabled: false } } } } }] },
      series: [{ type: 'pie', name: 'KG', data: lista.map((i, idx) => ({ name: i.nombre, y: i.kg, color: PALETA[idx % PALETA.length] })) }],
    });
  }
}
