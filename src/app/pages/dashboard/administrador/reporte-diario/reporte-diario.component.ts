import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  computed,
  effect,
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
import { CatalogoService } from '../../../../shared/services/catalogo.service';
import { ProcesoService } from '../../../../shared/services/proceso.service';
import { AlertService } from '../../../../shared/services/alert.service';
import { CatalogosRepository } from '../../../../shared/dexiedb/repository/catalogos.repository';
import { CatalogosOperativosRepository } from '../../../../shared/dexiedb/repository/catalogos-operacionales.repository';
import { ClickOutsideDirective } from '../../../../shared/directives/click-outside.directive';

Chart.register(...registerables);

type AcopioOption = { codigoAcopio: string; acopioNombre: string; selected: boolean };
type VariedadItem = { variedadId: string; variedad: string; cajas: number; kg: number; porcentaje: number };
type AcopioKgDetalleItem = { codigo: string; nombre: string; kg: number };
type AcopioKgItem = { acopio: string; kg: number; detalleTipos?: AcopioKgDetalleItem[] };
type ConsignatarioItem = { consignatarioId: string; destinoId: string; formato: string; consignatario: string; cajas: number; kg: number; porcentaje: number };
type ConsignatarioChartItem = { consignatarioId: string; consignatario: string; cajas: number; kg: number; porcentaje: number };

interface ReporteData {
  kpis: {
    palletsCompletos: number;
    palletsDespachados: number;
    palletsEnProceso: number;
    cajasTotales: number;
    cajasDespachadas: number;
    kgDespachados: number;
    kgTotales: number;
  };
  procesosAbiertos: boolean;
  produccionPorVariedad: VariedadItem[];
  kgPorAcopio: AcopioKgItem[];
  avancePorConsignatario: ConsignatarioItem[];
}

@Component({
  selector: 'app-reporte-diario',
  standalone: true,
  imports: [CommonModule, FormsModule, ClickOutsideDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './reporte-diario.component.html',
  styleUrl: './reporte-diario.component.scss',
})
export class ReporteDiarioComponent implements AfterViewInit, OnDestroy {
  private readonly connectivity = inject(ConnectivityService);
  private readonly auth = inject(AuthService);
  private readonly catalogoService = inject(CatalogoService);
  private readonly procesoService = inject(ProcesoService);
  private readonly alertService = inject(AlertService);
  private readonly catalogosRepo = inject(CatalogosRepository);
  private readonly catalogosOperativosRepo = inject(CatalogosOperativosRepository);

  readonly onlineSignal = computed(() => this.connectivity.isOnline());

  readonly isLoading = signal(false);
  readonly acopiosOpen = signal(false);
  readonly acopios = signal<AcopioOption[]>([]);
  readonly fechaConsulta = signal(this.formatDateInput(new Date()));
  readonly reporteData = signal<ReporteData | null>(null);
  readonly errorMensaje = signal<string | null>(null);

  private variedadChart?: Chart;
  private acopioChart?: Chart;
  private consignatarioChart?: Chart;

  private readonly chartVariedadRef = viewChild<ElementRef<HTMLCanvasElement>>('chartVariedad');
  private readonly chartAcopioRef = viewChild<ElementRef<HTMLCanvasElement>>('chartAcopio');
  private readonly chartConsignatarioRef = viewChild<ElementRef<HTMLCanvasElement>>('chartConsignatario');
  private readonly reportPageRef = viewChild<ElementRef<HTMLElement>>('reportPage');

  readonly fechaFormateada = computed(() => {
    const parts = this.fechaConsulta().split('-').map(Number);
    const date = new Date(parts[0], parts[1] - 1, parts[2]);
    return new Intl.DateTimeFormat('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date);
  });

  readonly hayProcesosAbiertos = computed(() => this.reporteData()?.procesosAbiertos ?? false);

  readonly acopiosSeleccionados = computed(() => this.acopios().filter(a => a.selected));

  readonly acopiosLabel = computed(() => {
    const seleccionados = this.acopiosSeleccionados();
    if (seleccionados.length === 0) return 'Todos los acopios';
    if (seleccionados.length === 1) return seleccionados[0].acopioNombre || seleccionados[0].codigoAcopio;
    if (seleccionados.length === this.acopios().length) return 'Todos los acopios';
    return `${seleccionados.length} acopios seleccionados`;
  });

  readonly kpiPalletsEnProceso = computed(() => this.reporteData()?.kpis.palletsEnProceso ?? 0);
  readonly kpiPalletsCompletos = computed(() => this.reporteData()?.kpis.palletsCompletos ?? 0);
  readonly kpiPalletsDespachados = computed(() => this.reporteData()?.kpis.palletsDespachados ?? 0);
  readonly kpiCajasDespachadas = computed(() => this.reporteData()?.kpis.cajasDespachadas ?? 0);
  readonly kpiCajasTotales = computed(() => this.reporteData()?.kpis.cajasTotales ?? 0);
  readonly kpiKgDespachados = computed(() => this.reporteData()?.kpis.kgDespachados ?? 0);
  readonly kpiKgTotales = computed(() => this.reporteData()?.kpis.kgTotales ?? 0);

  readonly produccionPorVariedad = computed(() => this.reporteData()?.produccionPorVariedad ?? []);
  readonly kgPorAcopio = computed(() => this.reporteData()?.kgPorAcopio ?? []);
  readonly avancePorConsignatario = computed(() => this.reporteData()?.avancePorConsignatario ?? []);

  readonly totalCajasVariedad = computed(() =>
    this.produccionPorVariedad().reduce((sum, v) => sum + v.cajas, 0)
  );

  readonly totalKgVariedad = computed(() =>
    this.produccionPorVariedad().reduce((sum, v) => sum + v.kg, 0)
  );

  readonly totalPorcentajeVariedad = computed(() =>
    this.produccionPorVariedad().reduce((sum, v) => sum + v.porcentaje, 0)
  );

  constructor() {
    effect(() => {
      const data = this.reporteData();
      console.log('2222',data)
      if (data) {
        this.renderCharts(data);
      }
    });
  }

  async capturarDashboard(): Promise<void> {
    const elemento = this.reportPageRef()?.nativeElement;
    if (!elemento) {
      return;
    }

    try {
      this.isLoading.set(true);
      const canvas = await html2canvas(elemento, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#f5f7fa',
      });
      const enlace = document.createElement('a');
      enlace.download = `reporte-diario-${new Date().toISOString().slice(0, 10)}.png`;
      enlace.href = canvas.toDataURL('image/png');
      enlace.click();
    } catch (error) {
      console.error('Error al capturar el dashboard diario', error);
    } finally {
      this.isLoading.set(false);
    }
  }

  async ngOnInit(): Promise<void> {
    await this.cargarAcopios();
    await this.cargarReporte();
  }

  ngAfterViewInit(): void {
    const data = this.reporteData();
    if (data) {
      this.renderCharts(data);
    }
  }

  ngOnDestroy(): void {
    this.destroyCharts();
  }

  private formatDateInput(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private getNroDocumentoFromUsuario(): string {
    const u: any = this.auth.usuario();
    const v =
      u?.nrodocumento ?? u?.documentoidentidad ?? u?.documentoIdentidad ?? u?.documento ?? '';
    return String(v ?? '').trim();
  }

  private async obtenerIdProyecto(): Promise<string> {
    try {
      const nro = this.getNroDocumentoFromUsuario();
      const cfg = await this.catalogosRepo.configuracionRepo.getByField('nrodocumento', nro);
      return String(cfg?.idProyecto ?? '').trim();
    } catch {
      return '';
    }
  }

  async cargarAcopios(): Promise<void> {
    this.alertService.mostrarModalCarga()
    if (!this.onlineSignal()) {
      this.alertService.cerrarModalCarga()
      return
    };

    try {
      const idProyecto = await this.obtenerIdProyecto();
      if (!idProyecto) {
        const dexie = await this.catalogosOperativosRepo.acopiosRepo.getAll();
        this.acopios.set(this.normalizarAcopios(dexie));
        this.alertService.cerrarModalCarga()
        return;
      }

      const resp: any = await firstValueFrom(this.catalogoService.listarAcopios(idProyecto));
      const data = resp?.data ?? [];
      if (resp?.error) {
        console.warn('Error listando acopios:', resp?.mensaje);
        const dexie = await this.catalogosOperativosRepo.acopiosRepo.getAll();
        this.acopios.set(this.normalizarAcopios(dexie));
        this.alertService.cerrarModalCarga()
        return;
      }

      this.acopios.set(this.normalizarAcopios(data));
      this.alertService.cerrarModalCarga()
    } catch (error) {
      console.error('Error cargando acopios', error);
      try {
        const dexie = await this.catalogosOperativosRepo.acopiosRepo.getAll();
        this.acopios.set(this.normalizarAcopios(dexie));
        
      } catch {
        this.acopios.set([]);
        this.alertService.cerrarModalCarga()
      }
      this.alertService.cerrarModalCarga()
    }
  }

  private normalizarAcopios(lista: any[]): AcopioOption[] {
    const arr = (lista ?? []).map(a => ({
      codigoAcopio: String(a?.codigoAcopio ?? a?.codigo ?? '').trim(),
      acopioNombre: String(a?.acopioNombre ?? a?.nombre ?? '').trim(),
      selected: true,
    }));
    return arr.filter(a => a.codigoAcopio);
  }

  toggleAcopios(): void {
    this.acopiosOpen.update(v => !v);
  }

  closeAcopios(): void {
    this.acopiosOpen.set(false);
  }

  consignatarioRowKey(item: ConsignatarioItem): string {
    return [
      item.consignatarioId,
      item.destinoId,
      item.formato,
    ].map(value => String(value ?? '').trim()).join('|');
  }

  toggleAcopio(item: AcopioOption): void {
    this.acopios.update(list =>
      list.map(a => (a.codigoAcopio === item.codigoAcopio ? { ...a, selected: !a.selected } : a))
    );
  }

  seleccionarTodosAcopios(): void {
    this.acopios.update(list => list.map(a => ({ ...a, selected: true })));
  }

  limpiarAcopios(): void {
    this.acopios.update(list => list.map(a => ({ ...a, selected: false })));
  }

  private validarAcopiosSeleccionados(): boolean {
    if (this.acopiosSeleccionados().length === 0) {
      this.alertService.showAlert('Selecciona acopios', 'Debes elegir al menos un acopio para consultar el reporte.', 'warning');
      return false;
    }
    return true;
  }

  async aplicarFiltros(): Promise<void> {
    if (!this.validarAcopiosSeleccionados()) {
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
    if (!this.validarAcopiosSeleccionados()) {
      return;
    }
    this.alertService.mostrarModalCarga();
    try {
      await this.cargarAcopios();
      await this.cargarReporte();
    } finally {
      this.alertService.cerrarModalCarga();
    }
  }

  private async cargarReporte(): Promise<void> {
    if (!this.onlineSignal()) return;

    this.isLoading.set(true);
    this.errorMensaje.set(null);

    try {
      const idCampana = await this.obtenerIdProyecto();
      if (!idCampana) {
        this.errorMensaje.set('No se encontró una campaña activa en la configuración.');
        this.reporteData.set(null);
        this.isLoading.set(false);
        return;
      }

      const fecha = this.fechaConsulta();
      const seleccionados = this.acopiosSeleccionados();
      const acopiosParam = seleccionados.length === this.acopios().length || seleccionados.length === 0
        ? ''
        : seleccionados.map(a => a.codigoAcopio).join(',');

      const resp: any = await firstValueFrom(
        this.procesoService.obtenerReporteDiario(fecha, acopiosParam, idCampana)
      );

      if (Array.isArray(resp) && resp.length > 0) {
        const wrapper = resp[0];
        if (wrapper?.error) {
          this.errorMensaje.set(wrapper?.mensaje ?? 'Error al obtener el reporte');
          this.reporteData.set(null);
          return;
        }
        this.reporteData.set(wrapper?.data ?? null);
        return;
      }

      if (resp?.error) {
        this.errorMensaje.set(resp?.mensaje ?? 'Error al obtener el reporte');
        this.reporteData.set(null);
        return;
      }

      this.reporteData.set(resp?.data ?? null);
    } catch (error: any) {
      console.error('Error cargando reporte', error);
      this.errorMensaje.set(error?.error?.mensaje ?? 'Error de conexi\u00f3n al obtener el reporte');
      this.reporteData.set(null);
    } finally {
      this.isLoading.set(false);
    }
  }

  private renderCharts(data: ReporteData): void {
    this.renderVariedadChart(data.produccionPorVariedad);
    this.renderAcopioChart(data.kgPorAcopio);
    this.renderConsignatarioChart(data.avancePorConsignatario);
  }

  private destroyCharts(): void {
    this.variedadChart?.destroy();
    this.acopioChart?.destroy();
    this.consignatarioChart?.destroy();
    this.variedadChart = undefined;
    this.acopioChart = undefined;
    this.consignatarioChart = undefined;
  }

  private renderVariedadChart(items: VariedadItem[]): void {
    const canvas = this.chartVariedadRef()?.nativeElement;
    if (!canvas) return;
    this.variedadChart?.destroy();

    const labels = items.map(i => i.variedad);
    const values = items.map(i => i.kg);
    const colors = this.generatePalette(labels.length);
    const formatKg = (value: number) =>
      new Intl.NumberFormat('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value);
    const barLabelsPlugin = this.createBarValuePlugin(values, formatKg, 'variedadValueLabels');

    this.variedadChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            data: values,
            backgroundColor: colors,
            borderRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, title: { display: true, text: 'KG' } },
        },
      },
      plugins: [barLabelsPlugin],
    });
  }

  private renderAcopioChart(items: AcopioKgItem[]): void {
    const canvas = this.chartAcopioRef()?.nativeElement;
    if (!canvas) return;
    this.acopioChart?.destroy();

    const labels = items.map(i => i.acopio);
    const values = items.map(i => i.kg);
    const formatKg = (value: number) =>
      new Intl.NumberFormat('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value);
    const tieneDetalleMultiple = items.some(item => (item.detalleTipos ?? []).filter(det => Number(det.kg ?? 0) > 0).length > 1);

    if (tieneDetalleMultiple) {
      this.renderAcopioStackedChart(canvas, items, labels, values, formatKg);
      return;
    }

    const barLabelsPlugin = this.createBarValuePlugin(values, formatKg, 'acopioValueLabels');

    this.acopioChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            data: values,
            backgroundColor: '#2563eb',
            borderRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, title: { display: true, text: 'KG' } },
        },
      },
      plugins: [barLabelsPlugin],
    });
  }

  private renderAcopioStackedChart(
    canvas: HTMLCanvasElement,
    items: AcopioKgItem[],
    labels: string[],
    totals: number[],
    formatKg: (value: number) => string
  ): void {
    const tipos = this.getTiposProcesoAcopio(items);
    const colors = this.generatePalette(Math.max(tipos.length, 1));
    const barLabelsPlugin = this.createStackedTotalLabelsPlugin(totals, formatKg);
    const stackedLabelsPlugin = this.createSimpleStackedSegmentLabelsPlugin(items, formatKg);

    this.acopioChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: tipos.map((tipo, index) => ({
          label: tipo.nombre || tipo.codigo,
          data: items.map(item => {
            const detalle = (item.detalleTipos ?? []).find(det => det.codigo === tipo.codigo);
            return Number(detalle?.kg ?? 0);
          }),
          backgroundColor: colors[index % colors.length],
          borderRadius: 6,
          stack: 'kgPorAcopio',
        })),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'bottom',
          },
          tooltip: {
            callbacks: {
              label: (ctx: any) => `${ctx.dataset.label}: ${formatKg(Number(ctx.raw ?? 0))} kg`,
              footer: (ctx: any) => {
                const index = ctx?.[0]?.dataIndex;
                const total = Number(totals[index] ?? 0);
                return `Total: ${formatKg(total)} kg`;
              },
            },
          },
        },
        scales: {
          x: { stacked: true },
          y: { stacked: true, beginAtZero: true, title: { display: true, text: 'KG' } },
        },
      },
      plugins: [barLabelsPlugin, stackedLabelsPlugin],
    });
  }

  private getTiposProcesoAcopio(items: AcopioKgItem[]): AcopioKgDetalleItem[] {
    const tipos = new Map<string, AcopioKgDetalleItem>();

    for (const item of items) {
      for (const detalle of item.detalleTipos ?? []) {
        const codigo = String(detalle.codigo ?? '').trim();
        const kg = Number(detalle.kg ?? 0);
        if (!codigo || kg <= 0 || tipos.has(codigo)) {
          continue;
        }
        tipos.set(codigo, {
          codigo,
          nombre: String(detalle.nombre || codigo).trim(),
          kg: 0,
        });
      }
    }

    return Array.from(tipos.values());
  }

  private createStackedTotalLabelsPlugin(
    totals: number[],
    formatter: (value: number) => string
  ) {
    return {
      id: 'acopioStackedTotalLabels',
      afterDatasetsDraw: (chart: any) => {
        const { ctx } = chart;

        ctx.save();
        ctx.font = '600 12px "Inter", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        totals.forEach((total, dataIndex) => {
          if (!Number.isFinite(total) || total <= 0) {
            return;
          }

          let topBar: any = null;
          for (let datasetIndex = chart.data.datasets.length - 1; datasetIndex >= 0; datasetIndex--) {
            const value = Number(chart.data.datasets[datasetIndex]?.data?.[dataIndex] ?? 0);
            if (value <= 0) {
              continue;
            }
            topBar = chart.getDatasetMeta(datasetIndex)?.data?.[dataIndex];
            break;
          }

          if (!topBar) {
            return;
          }

          const props = topBar.getProps(['x', 'y'], true);
          const label = `${formatter(total)} kg`;
          const metrics = ctx.measureText(label);
          const paddingX = 10;
          const paddingY = 4;
          const labelWidth = metrics.width + paddingX * 2;
          const labelHeight = 16 + paddingY * 2;
          const top = Math.max(6, props.y - labelHeight - 6);

          ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
          ctx.strokeStyle = 'rgba(15, 23, 42, 0.15)';
          ctx.lineWidth = 1;
          this.drawRoundedRect(ctx, props.x - labelWidth / 2, top, labelWidth, labelHeight, 8);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#0f172a';
          ctx.fillText(label, props.x, top + labelHeight / 2);
        });

        ctx.restore();
      },
    };
  }

  private createSimpleStackedSegmentLabelsPlugin(
    items: AcopioKgItem[],
    formatter: (value: number) => string
  ) {
    return {
      id: 'acopioSimpleStackedSegmentLabels',
      afterDatasetsDraw: (chart: any) => {
        const { ctx } = chart;
        if (chart.data.datasets.length <= 1) {
          return;
        }

        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffffff';

        chart.data.datasets.forEach((dataset: any, datasetIndex: number) => {
          const meta = chart.getDatasetMeta(datasetIndex);
          meta.data.forEach((bar: any, dataIndex: number) => {
            const value = Number(dataset.data[dataIndex] ?? 0);
            const detalleCount = (items[dataIndex]?.detalleTipos ?? []).filter(det => Number(det.kg ?? 0) > 0).length;
            if (value <= 0 || detalleCount <= 1) {
              return;
            }

            const props = bar.getProps(['x', 'y', 'base', 'width'], true);
            const height = Math.abs(props.base - props.y);
            const width = Number(props.width ?? 0);
            if (height < 18 || width < 52) {
              return;
            }

            const centerY = props.y + height / 2;
            const codigo = String(dataset.label ?? '').trim();
            const kgLabel = `${formatter(value)} kg`;

            ctx.font = '600 11px "Inter", sans-serif';
            if (height < 38) {
              ctx.fillText(codigo, props.x, centerY);
              return;
            }

            ctx.fillText(codigo, props.x, centerY - 7);
            ctx.font = '500 10px "Inter", sans-serif';
            ctx.fillText(kgLabel, props.x, centerY + 8);
          });
        });

        ctx.restore();
      },
    };
  }

  private renderConsignatarioChart(items: ConsignatarioItem[]): void {
    const canvas = this.chartConsignatarioRef()?.nativeElement;
    if (!canvas) return;
    this.consignatarioChart?.destroy();

    const chartItems = this.agruparConsignatariosParaGrafico(items);
    const labels = chartItems.map(i => i.consignatario);
    const values = chartItems.map(i => i.kg);
    const colors = this.generatePalette(labels.length);
    const totalKg = values.reduce((acc, val) => acc + val, 0);

    const pieLabelsPlugin = {
      id: 'pieLabels',
      afterDraw: (chart: any) => {
        const { ctx } = chart;
        const meta = chart.getDatasetMeta(0);
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        meta.data.forEach((arc: any, index: number) => {
          const sliceAngle = arc.endAngle - arc.startAngle;
          if (sliceAngle < 0.25) {
            return;
          }

          const item = chartItems[index];
          const value = values[index];
          const percentage = item?.porcentaje != null
            ? `${item.porcentaje}%`
            : `${((value / totalKg) * 100).toFixed(1)}%`;

          const midAngle = (arc.startAngle + arc.endAngle) / 2;
          const radius = arc.outerRadius * 0.62;
          const x = arc.x + Math.cos(midAngle) * radius;
          const y = arc.y + Math.sin(midAngle) * radius;

          ctx.font = 'bold 11px sans-serif';
          ctx.lineWidth = 3;
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.65)';
          ctx.strokeText(percentage, x, y);
          ctx.fillStyle = '#ffffff';
          ctx.fillText(percentage, x, y);
        });

        ctx.restore();
      },
    };

    this.consignatarioChart = new Chart(canvas, {
      type: 'pie',
      data: {
        labels,
        datasets: [
          {
            data: values,
            backgroundColor: colors,
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              generateLabels: (chart: any) => {
                const dataset = chart.data.datasets[0];
                const chartLabels = chart.data.labels as string[];
                return chart.getDatasetMeta(0).data.map((arc: any, index: number) => {
                  const item = chartItems[index];
                  const value = values[index];
                  const percentage = item?.porcentaje != null
                    ? `${item.porcentaje}%`
                    : `${(totalKg > 0 ? (value / totalKg) * 100 : 0).toFixed(1)}%`;
                  const label = chartLabels[index] ?? '';
                  return {
                    text: `${label} - ${percentage}`,
                    fillStyle: dataset.backgroundColor[index],
                    strokeStyle: '#ffffff',
                    hidden: arc.hidden,
                    index,
                  };
                });
              },
            },
          },
          tooltip: {
            callbacks: {
              label: (ctx: any) => {
                const item = chartItems[ctx.dataIndex];
                return `${item?.consignatario}: ${item?.kg} kg (${item?.porcentaje}%)`;
              },
            },
          },
        },
      },
      plugins: [pieLabelsPlugin],
    });
  }

  private agruparConsignatariosParaGrafico(items: ConsignatarioItem[]): ConsignatarioChartItem[] {
    const grouped = new Map<string, ConsignatarioChartItem>();

    for (const item of items) {
      const key = String(item.consignatarioId || item.consignatario || '').trim();
      if (!key) {
        continue;
      }

      const consignatario = String(item.consignatario || item.consignatarioId || '').trim();
      const current = grouped.get(key);
      if (current) {
        current.cajas += Number(item.cajas ?? 0);
        current.kg += Number(item.kg ?? 0);
      } else {
        grouped.set(key, {
          consignatarioId: key,
          consignatario,
          cajas: Number(item.cajas ?? 0),
          kg: Number(item.kg ?? 0),
          porcentaje: 0,
        });
      }
    }

    const result = Array.from(grouped.values()).sort((a, b) => b.kg - a.kg);
    const totalKg = result.reduce((sum, item) => sum + item.kg, 0);

    return result.map(item => ({
      ...item,
      porcentaje: totalKg > 0 ? Math.round((item.kg * 1000) / totalKg) / 10 : 0,
    }));
  }

  private generatePalette(count: number): string[] {
    const base = [
      '#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6',
      '#06b6d4', '#ec4899', '#10b981', '#6366f1', '#f97316',
    ];
    const colors: string[] = [];
    for (let i = 0; i < count; i++) {
      colors.push(base[i % base.length]);
    }
    return colors;
  }

  private createBarValuePlugin(
    values: number[],
    formatter: (value: number) => string,
    pluginId: string
  ) {
    return {
      id: pluginId,
      afterDatasetsDraw: (chart: any) => {
        const { ctx } = chart;
        const meta = chart.getDatasetMeta(0);
        if (!meta?.data?.length) {
          return;
        }

        ctx.save();
        ctx.font = '600 12px "Inter", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        meta.data.forEach((bar: any, index: number) => {
          const value = values[index];
          if (!Number.isFinite(value) || value <= 0) {
            return;
          }

          const label = `${formatter(value)} kg`;
          const { x, y } = bar.tooltipPosition();
          const metrics = ctx.measureText(label);
          const paddingX = 10;
          const paddingY = 4;
          const labelWidth = metrics.width + paddingX * 2;
          const labelHeight = 16 + paddingY * 2;
          const top = Math.max(6, y - labelHeight - 6);

          ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
          ctx.strokeStyle = 'rgba(15, 23, 42, 0.15)';
          ctx.lineWidth = 1;
          this.drawRoundedRect(ctx, x - labelWidth / 2, top, labelWidth, labelHeight, 8);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#0f172a';
          ctx.fillText(label, x, top + labelHeight / 2);
        });

        ctx.restore();
      },
    };
  }

  private drawRoundedRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number
  ): void {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
}
