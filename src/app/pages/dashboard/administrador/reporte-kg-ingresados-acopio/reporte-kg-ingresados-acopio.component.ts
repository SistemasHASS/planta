import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { Chart, registerables } from 'chart.js';
import html2canvas from 'html2canvas';
import { ConnectivityService } from '../../../../shared/services/connectivity.service';
import { AuthService } from '../../../../shared/services/auth.service';
import { AlertService } from '../../../../shared/services/alert.service';
import { CatalogoService } from '../../../../shared/services/catalogo.service';
import { ProcesoService } from '../../../../shared/services/proceso.service';
import { CatalogosRepository } from '../../../../shared/dexiedb/repository/catalogos.repository';
import { ClickOutsideDirective } from '../../../../shared/directives/click-outside.directive';
import { AdvancedSelectComponent } from '../../../../shared/components/advanced-select/advanced-select.component';

Chart.register(...registerables);

type AcopioOption = { codigoAcopio: string; acopioNombre: string; selected: boolean };
type EmpresaReporteOption = { ruc: string; nombre: string; codigo: 'CAO' | 'BH' };
type KgPorVariedad = {
  variedad: string;
  jarraBlancaKgNeto: number;
  jarraVerdeKgNeto: number;
  descarteKgNeto: number;
  kgNetoTotal: number;
};

interface ReporteData {
  kpis: {
    sociedad: number;
    kgTotales: number;
    kgBrutoTotal: number;
    taraJarrasTotalKg: number;
    taraJavasTotalKg: number;
    taraTotalKg: number;
    kgNetoTotal: number;
    enviosTotales: number;
    detallesTotales: number;
    cantidadEnvases: number;
    cantidadJarrasCalculada: number;
    cantidadJavas: number;
    acopiosTotales: number;
    detallesSinPesoVacio: number;
    fechaDesde: string;
    fechaHasta: string;
  };
  kgPorAcopio: any[];
  kgPorClasificacion: any[];
  kgPorFecha: any[];
  kgPorVariedad: KgPorVariedad[];
}

@Component({
  selector: 'app-reporte-kg-ingresados-acopio',
  standalone: true,
  imports: [CommonModule, FormsModule, ClickOutsideDirective, AdvancedSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './reporte-kg-ingresados-acopio.component.html',
  styleUrl: './reporte-kg-ingresados-acopio.component.scss',
})
export class ReporteKgIngresadosAcopioComponent implements AfterViewInit, OnDestroy {
  private readonly connectivity = inject(ConnectivityService);
  private readonly auth = inject(AuthService);
  private readonly alertService = inject(AlertService);
  private readonly catalogoService = inject(CatalogoService);
  private readonly procesoService = inject(ProcesoService);
  private readonly catalogosRepo = inject(CatalogosRepository);

  readonly onlineSignal = computed(() => this.connectivity.isOnline());
  readonly isLoading = signal(false);
  readonly fechaConsulta = signal(this.formatDateInput(new Date()));
  readonly acopios = signal<AcopioOption[]>([]);
  readonly acopiosOpen = signal(false);
  readonly empresas = signal<EmpresaReporteOption[]>([]);
  readonly empresaSeleccionada = signal('');
  readonly campanias = signal<any[]>([]);
  readonly campaniasPorEmpresa = signal<Record<string, any[]>>({});
  readonly campaniaSeleccionada = signal('');
  readonly reporteData = signal<ReporteData | null>(null);
  readonly errorMensaje = signal<string | null>(null);

  private acopioChart?: Chart;
  private clasificacionChart?: Chart;
  private readonly reportPageRef = viewChild<ElementRef<HTMLElement>>('reportPage');
  private readonly chartAcopioRef = viewChild<ElementRef<HTMLCanvasElement>>('chartAcopio');
  private readonly chartClasificacionRef = viewChild<ElementRef<HTMLCanvasElement>>('chartClasificacion');

  readonly mostrarSelectorEmpresa = computed(() => this.empresas().length > 1);
  readonly acopiosSeleccionados = computed(() => this.acopios().filter((item) => item.selected));
  readonly acopiosLabel = computed(() => {
    const selected = this.acopiosSeleccionados();
    if (selected.length === 0 || selected.length === this.acopios().length) return 'Todos los acopios';
    if (selected.length === 1) return selected[0].acopioNombre || selected[0].codigoAcopio;
    return `${selected.length} acopios seleccionados`;
  });
  readonly kpis = computed(() => this.reporteData()?.kpis);
  readonly kgPorAcopio = computed(() => this.reporteData()?.kgPorAcopio ?? []);
  readonly kgPorClasificacion = computed(() => this.reporteData()?.kgPorClasificacion ?? []);
  readonly kgPorVariedad = computed(() => this.reporteData()?.kgPorVariedad ?? []);
  readonly totalesPorVariedad = computed(() => this.kgPorVariedad().reduce((totales, item) => ({
    jarraBlancaKgNeto: totales.jarraBlancaKgNeto + Number(item.jarraBlancaKgNeto ?? 0),
    jarraVerdeKgNeto: totales.jarraVerdeKgNeto + Number(item.jarraVerdeKgNeto ?? 0),
    descarteKgNeto: totales.descarteKgNeto + Number(item.descarteKgNeto ?? 0),
    kgNetoTotal: totales.kgNetoTotal + Number(item.kgNetoTotal ?? 0),
  }), {
    jarraBlancaKgNeto: 0,
    jarraVerdeKgNeto: 0,
    descarteKgNeto: 0,
    kgNetoTotal: 0,
  }));
  readonly fechaFormateada = computed(() => {
    const parts = this.fechaConsulta().split('-').map(Number);
    return new Intl.DateTimeFormat('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date(parts[0], parts[1] - 1, parts[2]));
  });

  constructor() {}

  async ngOnInit(): Promise<void> {
    await this.inicializar();
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.renderCharts(), 0);
  }

  ngOnDestroy(): void {
    this.acopioChart?.destroy();
    this.clasificacionChart?.destroy();
  }

  async inicializar(): Promise<void> {
    if (!this.onlineSignal()) return;
    this.alertService.mostrarModalCarga();
    try {
      await this.cargarEmpresasYCampanias();
      await this.cargarAcopios();
      await this.cargarReporte();
    } finally {
      this.alertService.cerrarModalCarga();
    }
  }

  async aplicarFiltros(): Promise<void> {
    if (this.acopiosSeleccionados().length === 0) {
      this.errorMensaje.set('Selecciona al menos un acopio para consultar el reporte.');
      return;
    }
    this.alertService.mostrarModalCarga();
    try {
      await this.cargarReporte();
    } finally {
      this.alertService.cerrarModalCarga();
    }
  }

  async actualizar(): Promise<void> {
    this.alertService.mostrarModalCarga();
    try {
      await this.cargarAcopios();
      await this.cargarReporte();
    } finally {
      this.alertService.cerrarModalCarga();
    }
  }

  async capturarDashboard(): Promise<void> {
    const element = this.reportPageRef()?.nativeElement;
    if (!element) return;
    try {
      this.isLoading.set(true);
      const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: '#f5f7fa' });
      const link = document.createElement('a');
      link.download = `reporte-kg-acopio-${this.fechaConsulta()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } finally {
      this.isLoading.set(false);
    }
  }

  toggleAcopios(): void { this.acopiosOpen.update((value) => !value); }
  closeAcopios(): void { this.acopiosOpen.set(false); }

  toggleAcopio(item: AcopioOption): void {
    this.acopios.update((list) => list.map((acopio) =>
      acopio.codigoAcopio === item.codigoAcopio
        ? { ...acopio, selected: !acopio.selected }
        : acopio,
    ));
  }

  seleccionarTodosAcopios(): void {
    this.acopios.update((list) => list.map((item) => ({ ...item, selected: true })));
  }

  limpiarAcopios(): void {
    this.acopios.update((list) => list.map((item) => ({ ...item, selected: false })));
  }

  acopioRowClass(codigo: unknown): string {
    const index = this.kgPorAcopio().findIndex((item) => String(item.acopio ?? '') === String(codigo ?? ''));
    return index % 2 === 0 ? 'acopio-row-even' : 'acopio-row-odd';
  }

  clasificacionClass(value: unknown): string {
    const codigo = String(value ?? '').trim();
    if (codigo === '1') return 'classification-blue';
    if (codigo === '2') return 'classification-green';
    if (codigo === '3') return 'classification-gray';
    return 'classification-default';
  }

  nombreAcopio(codigo: unknown): string {
    const codigoTexto = String(codigo ?? '').trim();
    return this.acopios().find((item) => item.codigoAcopio === codigoTexto)?.acopioNombre || codigoTexto || 'Sin acopio';
  }

  private async cargarEmpresasYCampanias(): Promise<void> {
    const usuario: any = this.auth.usuario();
    const currentRuc = String(usuario?.ruc ?? '').trim();
    const razonSocial = String(usuario?.razonSocial ?? 'Empresa activa').trim();
    const documento = String(usuario?.nrodocumento ?? usuario?.documentoidentidad ?? usuario?.documentoIdentidad ?? usuario?.documento ?? '').trim();
    const config: any = documento
      ? await this.catalogosRepo.configuracionRepo.getByField('nrodocumento', documento)
      : null;
    const response: any = await firstValueFrom(this.catalogoService.listarParametros());
    const parametros = Array.isArray(response) ? response[0]?.data ?? [] : response?.data ?? [];
    const externo = (parametros as any[]).find((parametro) =>
      String(parametro?.idparametro ?? '').trim().toUpperCase() === 'REPORTE_KG_INGRESADOS_EXTERNO'
      && parametro?.activo
      && String(parametro?.valor ?? '').trim()
      && String(parametro.valor).trim() !== currentRuc
    );

    const opciones: EmpresaReporteOption[] = currentRuc
      ? [{ ruc: currentRuc, nombre: razonSocial, codigo: 'BH' }]
      : [];
    const rucExterno = String(externo?.valor ?? '').trim();
    if (rucExterno) {
      opciones.push({ ruc: rucExterno, nombre: `Empresa externa (${rucExterno}) (CAO)`, codigo: 'CAO' });
    }

    this.empresas.set(opciones);
    const rucInicial = opciones[0]?.ruc ?? '';
    this.empresaSeleccionada.set(rucInicial);

    const campaniasPorEmpresa: Record<string, any[]> = {};
    for (const empresa of opciones) {
      campaniasPorEmpresa[empresa.ruc] = await this.obtenerCampaniasPorRuc(empresa.ruc);
    }
    this.campaniasPorEmpresa.set(campaniasPorEmpresa);
    const campaniasIniciales = campaniasPorEmpresa[rucInicial] ?? [];
    this.campanias.set(campaniasIniciales);
    const proyectoPreferido = String(config?.idProyecto ?? '').trim();
    this.campaniaSeleccionada.set(
      campaniasIniciales.some((item: any) => String(item?.idproyecto ?? '').trim() === proyectoPreferido)
        ? proyectoPreferido
        : campaniasIniciales.length === 1 ? String(campaniasIniciales[0]?.idproyecto ?? '').trim() : '',
    );
  }

  private async obtenerCampaniasPorRuc(ruc: string): Promise<any[]> {
    if (!ruc) return [];
    const response: any = await firstValueFrom(this.catalogoService.listarCampaniasPorRuc(ruc));
    const data = Array.isArray(response) ? response[0]?.data ?? response : response?.data ?? response ?? [];
    return Array.isArray(data) ? data : [];
  }

  cambiarEmpresa(ruc: string): void {
    this.empresaSeleccionada.set(ruc);
    this.campanias.set(this.campaniasPorEmpresa()[ruc] ?? []);
    this.campaniaSeleccionada.set('');
  }

  cambiarCampania(idProyecto: string): void {
    this.campaniaSeleccionada.set(idProyecto);
  }

  private async cargarAcopios(): Promise<void> {
    const idProyecto = (await this.obtenerContexto()).idProyecto;
    if (!idProyecto) return;
    const response: any = await firstValueFrom(this.catalogoService.listarAcopios(idProyecto));
    const data = response?.data ?? [];
    this.acopios.set((data as any[]).map((item) => ({
      codigoAcopio: String(item?.codigoAcopio ?? item?.codigo ?? '').trim(),
      acopioNombre: String(item?.acopioNombre ?? item?.nombre ?? '').trim(),
      selected: true,
    })).filter((item) => item.codigoAcopio));
  }

  private async cargarReporte(): Promise<void> {
    if (!this.onlineSignal()) return;
    this.isLoading.set(true);
    this.errorMensaje.set(null);
    try {
      const contexto = await this.obtenerContexto();
      if (!contexto.idProyecto || !contexto.codFundo) {
        this.errorMensaje.set('No se encontró la campaña o el fundo configurado para el usuario.');
        this.reporteData.set(null);
        return;
      }
      const selected = this.acopiosSeleccionados();
      const acopios = selected.length === this.acopios().length || selected.length === 0
        ? ''
        : selected.map((item) => item.codigoAcopio).join(',');
      const response: any = await firstValueFrom(this.procesoService.obtenerReporteKgIngresadosAcopio({
        ruc: this.empresaSeleccionada(),
        fechaDesde: this.fechaConsulta(),
        fechaHasta: this.fechaConsulta(),
        idProyecto: contexto.idProyecto,
        codFundo: contexto.codFundo,
        acopios,
      }));
      const wrapper = Array.isArray(response) ? response[0] : response;
      if (wrapper?.error) {
        this.errorMensaje.set(wrapper?.mensaje ?? 'No se pudo obtener el reporte de KG ingresados.');
        this.reporteData.set(null);
        return;
      }
      const reporte = wrapper?.data as ReporteData | null;
      this.reporteData.set(reporte);
      setTimeout(() => this.renderCharts(), 0);
    } catch (error: any) {
      this.errorMensaje.set(error?.error?.mensaje ?? 'Error de conexión al obtener el reporte.');
      this.reporteData.set(null);
    } finally {
      this.isLoading.set(false);
    }
  }

  private async obtenerIdProyecto(): Promise<string> {
    const contexto = await this.obtenerContexto();
    return contexto.idProyecto;
  }

  private async obtenerContexto(): Promise<{ idProyecto: string; codFundo: string }> {
    const usuario: any = this.auth.usuario();
    const documento = String(usuario?.nrodocumento ?? usuario?.documentoidentidad ?? usuario?.documentoIdentidad ?? usuario?.documento ?? '').trim();
    if (!documento) return { idProyecto: '', codFundo: '' };

    const config: any = await this.catalogosRepo.configuracionRepo.getByField('nrodocumento', documento);
    const idProyecto = String(this.campaniaSeleccionada() || config?.idProyecto || '').trim();
    if (!idProyecto) return { idProyecto: '', codFundo: '' };

    const campania = this.campanias().find((item: any) => String(item?.idproyecto ?? '').trim() === idProyecto);
    const codigoFundo = String(campania?.idfundo ?? '').trim();
    if (codigoFundo) return { idProyecto, codFundo: codigoFundo };

    const fundo: any = await this.catalogosRepo.fundoRepo.getByField('id', config?.idFundo);
    return { idProyecto, codFundo: String(fundo?.codigoFundo ?? '').trim() };
  }

  private renderCharts(): void {
    const data = this.reporteData();
    if (!data) return;
    this.renderAcopioChart(data.kgPorAcopio ?? []);
    this.renderClasificacionChart(data.kgPorClasificacion ?? []);
  }

  private getClasificacionColor(value: unknown, index: number): string {
    const codigo = String(value ?? '').trim();
    if (codigo === '1') return '#2563eb';
    if (codigo === '2') return '#22c55e';
    if (codigo === '3') return '#64748b';
    return ['#f97316', '#8b5cf6', '#06b6d4', '#eab308'][index % 4];
  }

  private renderAcopioChart(items: any[]): void {
    const canvas = this.chartAcopioRef()?.nativeElement;
    if (!canvas) return;
    this.acopioChart?.destroy();
    const fontFamily = "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    const pixelRatio = Math.min(Math.max(window.devicePixelRatio || 1, 2), 3);

    const acopioNames = items.map((item) => this.nombreAcopio(item.acopio));
    const labels = acopioNames.map((name) => name.length > 22 ? `${name.slice(0, 21)}…` : name);
    const clasificaciones = new Map<string, string>();
    for (const item of items) {
      for (const detalle of item.detalleClasificaciones ?? []) {
        const key = String(detalle.clasificacionEnvase ?? detalle.descripcion ?? 'SIN').trim();
        if (key && !clasificaciones.has(key)) {
          clasificaciones.set(key, String(detalle.descripcion ?? 'Sin clasificación').trim());
        }
      }
    }

    const datasets = Array.from(clasificaciones.entries()).map(([key, nombre], index) => ({
      label: nombre,
      data: items.map((item) => {
        const detalle = (item.detalleClasificaciones ?? []).find(
          (value: any) => String(value.clasificacionEnvase ?? value.descripcion ?? 'SIN').trim() === key,
        );
        return Number(detalle?.kgNeto ?? 0);
      }),
      backgroundColor: this.getClasificacionColor(key, index),
      borderRadius: 4,
      stack: 'kgPorAcopio',
    }));
    const totals = items.map((item) => Number(item.kgNeto ?? 0));
    const smallSegmentDetails = totals.map(() => [] as string[]);

    const amountLabelsPlugin = {
      id: 'kgAcopioClassificationLabels',
      afterDatasetsDraw: (chart: any) => {
        const { ctx } = chart;
        smallSegmentDetails.forEach((details) => details.length = 0);
        ctx.save();
        ctx.font = `600 11px ${fontFamily}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        chart.data.datasets.forEach((dataset: any, datasetIndex: number) => {
          const meta = chart.getDatasetMeta(datasetIndex);
          meta.data.forEach((bar: any, dataIndex: number) => {
            const value = Number(dataset.data[dataIndex] ?? 0);
            if (value <= 0) return;
            const props = bar.getProps(['x', 'y', 'base'], true);
            const height = Math.abs(Number(props.base) - Number(props.y));
            const label = `${this.formatKg(value)} kg`;
            const classification = String(dataset.label ?? 'Clasificación');

            if (height >= 28) {
              const centerY = (Number(props.y) + Number(props.base)) / 2;
              ctx.fillStyle = '#ffffff';
              ctx.font = `700 10px ${fontFamily}`;
              ctx.fillText(classification, props.x, centerY - 7);
              ctx.font = `600 10px ${fontFamily}`;
              ctx.fillText(label, props.x, centerY + 8);
            } else {
              // Los segmentos muy delgados no tienen espacio para texto. Se
              // agregan al resumen de su barra para mostrarlos sin cruces.
              smallSegmentDetails[dataIndex].push(`${classification}: ${label}`);
            }
          });
        });

        totals.forEach((total, dataIndex) => {
          if (total <= 0) return;
          let topBar: any = null;
          for (let datasetIndex = chart.data.datasets.length - 1; datasetIndex >= 0; datasetIndex--) {
            const value = Number(chart.data.datasets[datasetIndex]?.data?.[dataIndex] ?? 0);
            if (value <= 0) continue;
            topBar = chart.getDatasetMeta(datasetIndex)?.data?.[dataIndex];
            break;
          }
          if (!topBar) return;

          const props = topBar.getProps(['x', 'y'], true);
          const lines = [`Total neto: ${this.formatKg(total)} kg`, ...smallSegmentDetails[dataIndex]];
          const firstLineHeight = 18;
          const detailLineHeight = 16;
          const height = firstLineHeight + Math.max(0, lines.length - 1) * detailLineHeight + 8;
          ctx.font = `600 11px ${fontFamily}`;
          const width = Math.max(...lines.map((line) => ctx.measureText(line).width)) + 14;
          const top = Math.max(Number(chart.chartArea?.top ?? 6) + 2, Number(props.y) - height - 5);
          const left = Math.max(
            Number(chart.chartArea?.left ?? 0) + 2,
            Math.min(Number(props.x) - width / 2, Number(chart.chartArea?.right ?? width) - width - 2),
          );
          ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
          ctx.strokeStyle = 'rgba(15, 23, 42, 0.18)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(left, top, width, height, 6);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#0f172a';
          ctx.font = `700 11px ${fontFamily}`;
          ctx.fillText(lines[0], left + width / 2, top + 13);
          ctx.font = `600 10px ${fontFamily}`;
          lines.slice(1).forEach((line, index) => {
            ctx.fillText(line, left + width / 2, top + firstLineHeight + 7 + index * detailLineHeight);
          });
        });

        ctx.restore();
      },
    };

    this.acopioChart = new Chart(canvas, {
      type: 'bar',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        devicePixelRatio: pixelRatio,
        plugins: {
          legend: {
            display: true,
            position: 'bottom',
            labels: { font: { family: fontFamily, size: 12 } },
          },
          tooltip: {
            callbacks: {
              title: (contexts: any[]) => acopioNames[contexts?.[0]?.dataIndex ?? 0] ?? '',
              label: (ctx: any) => `${ctx.dataset.label}: ${this.formatKg(Number(ctx.raw ?? 0))} kg`,
              footer: (contexts: any[]) => {
                const index = contexts?.[0]?.dataIndex ?? 0;
                return `Total neto: ${this.formatKg(totals[index] ?? 0)} kg`;
              },
            },
          },
        },
        scales: {
          x: { stacked: true, ticks: { font: { family: fontFamily, size: 11 } } },
          y: {
            stacked: true,
            beginAtZero: true,
            grace: '42%',
            ticks: { font: { family: fontFamily, size: 11 } },
            title: { display: true, text: 'KG', font: { family: fontFamily, size: 12, weight: 600 } },
          },
        },
      },
      plugins: [amountLabelsPlugin],
    });
  }

  private renderClasificacionChart(items: any[]): void {
    const canvas = this.chartClasificacionRef()?.nativeElement;
    if (!canvas) return;
    this.clasificacionChart?.destroy();
    const fontFamily = "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    const pixelRatio = Math.min(Math.max(window.devicePixelRatio || 1, 2), 3);

    const labels = items.map((item) => String(item.descripcion ?? 'Sin clasificación'));
    const values = items.map((item) => Number(item.kgNeto ?? 0));
    const colors = items.map((item, index) => this.getClasificacionColor(item.clasificacionEnvase, index));
    const totalKg = values.reduce((sum, value) => sum + value, 0);

    const percentageLabelsPlugin = {
      id: 'classificationPercentageLabels',
      afterDraw: (chart: any) => {
        const ctx = chart.ctx;
        const meta = chart.getDatasetMeta(0);
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `700 12px ${fontFamily}`;
        meta.data.forEach((arc: any, index: number) => {
          const angle = arc.endAngle - arc.startAngle;
          if (angle < 0.18) return;
          const percentage = totalKg > 0 ? `${((values[index] * 100) / totalKg).toFixed(1)}%` : '0.0%';
          const radius = arc.innerRadius + (arc.outerRadius - arc.innerRadius) * 0.5;
          const middle = (arc.startAngle + arc.endAngle) / 2;
          const x = arc.x + Math.cos(middle) * radius;
          const y = arc.y + Math.sin(middle) * radius;
          ctx.fillStyle = '#ffffff';
          ctx.fillText(percentage, x, y);
        });
        ctx.restore();
      },
    };

    this.clasificacionChart = new Chart(canvas, {
      type: 'doughnut',
      data: { labels, datasets: [{ data: values, backgroundColor: colors, borderWidth: 1 }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        devicePixelRatio: pixelRatio,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              font: { family: fontFamily, size: 12 },
              generateLabels: (chart: any) => chart.getDatasetMeta(0).data.map((arc: any, index: number) => ({
                text: `${labels[index]} - ${totalKg > 0 ? ((values[index] * 100) / totalKg).toFixed(1) : '0.0'}% (${this.formatKg(values[index])} kg)`,
                fillStyle: colors[index % colors.length],
                strokeStyle: '#ffffff',
                hidden: arc.hidden,
                index,
              })),
            },
          },
          tooltip: {
            callbacks: {
              label: (ctx: any) => `${ctx.label}: ${this.formatKg(Number(ctx.raw ?? 0))} kg (${totalKg > 0 ? ((Number(ctx.raw ?? 0) * 100) / totalKg).toFixed(1) : '0.0'}%)`,
            },
          },
        },
      },
      plugins: [percentageLabelsPlugin],
    });
  }

  private formatKg(value: number): string {
    return new Intl.NumberFormat('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value);
  }

  private formatDateInput(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}
