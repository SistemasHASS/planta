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
import { AlertService } from '../../../../shared/services/alert.service';
import { ProcesoService } from '../../../../shared/services/proceso.service';
import { CatalogosRepository } from '../../../../shared/dexiedb/repository/catalogos.repository';
import { ClickOutsideDirective } from '../../../../shared/directives/click-outside.directive';

Chart.register(...registerables);

type AcopioOption = { codigoAcopio: string; acopioNombre: string; selected: boolean };
type EmpresaOrigenOption = { codigo: 'BH' | 'CAO'; nombre: string; selected: boolean };
type OriginSummary = {
  tipoOrigen: 'PROPIO' | 'EXTERNO' | 'SIN_CLASIFICAR';
  esExterno: boolean | null;
  palletsCompletos: number;
  palletsDespachados: number;
  palletsEnProceso: number;
  cajasTotales: number;
  cajasDespachadas: number;
  kgDespachados: number;
  kgTotales: number;
};

interface ReporteData {
  kpis: OriginSummary;
  resumenOrigen: OriginSummary[];
  procesosAbiertos: boolean;
  produccionPorVariedad: any[];
  kgPorAcopio: any[];
  avancePorConsignatario: any[];
}

@Component({
  selector: 'app-reporte-diario-propio-externo',
  standalone: true,
  imports: [CommonModule, FormsModule, ClickOutsideDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './reporte-diario-propio-externo.component.html',
  styleUrl: './reporte-diario-propio-externo.component.scss',
})
export class ReporteDiarioPropioExternoComponent implements AfterViewInit, OnDestroy {
  private readonly connectivity = inject(ConnectivityService);
  private readonly auth = inject(AuthService);
  private readonly catalogoService = inject(CatalogoService);
  private readonly alertService = inject(AlertService);
  private readonly procesoService = inject(ProcesoService);
  private readonly catalogosRepo = inject(CatalogosRepository);

  readonly onlineSignal = computed(() => this.connectivity.isOnline());
  readonly isLoading = signal(false);
  readonly acopiosOpen = signal(false);
  readonly empresasOpen = signal(false);
  readonly empresas = signal<EmpresaOrigenOption[]>([
    { codigo: 'BH', nombre: 'BH', selected: true },
    { codigo: 'CAO', nombre: 'CAO', selected: true },
  ]);
  readonly empresasAplicadas = signal<Array<'BH' | 'CAO'>>(['BH', 'CAO']);
  readonly fechaConsulta = signal(this.formatDateInput(new Date()));
  readonly reporteData = signal<ReporteData | null>(null);
  readonly acopios = signal<AcopioOption[]>([]);
  readonly errorMensaje = signal<string | null>(null);

  private variedadChart?: Chart;
  private acopioChart?: Chart;
  private consignatarioChart?: Chart;
  private readonly chartAcopioRef = viewChild<ElementRef<HTMLCanvasElement>>('chartAcopio');
  private readonly chartConsignatarioRef =
    viewChild<ElementRef<HTMLCanvasElement>>('chartConsignatario');
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

  readonly resumenOrigen = computed(() => this.reporteData()?.resumenOrigen ?? []);
  readonly propio = computed(() =>
    this.resumenOrigen().find((item) => item.tipoOrigen === 'PROPIO'),
  );
  readonly externo = computed(() =>
    this.resumenOrigen().find((item) => item.tipoOrigen === 'EXTERNO'),
  );
  readonly sinClasificar = computed(() =>
    this.resumenOrigen().find((item) => item.tipoOrigen === 'SIN_CLASIFICAR'),
  );
  readonly kpis = computed(() => this.reporteData()?.kpis);
  readonly produccionPorVariedad = computed(() => this.reporteData()?.produccionPorVariedad ?? []);
  readonly produccionPorVariedadComparada = computed(() => {
    const grouped = new Map<string, any>();

    for (const item of this.produccionPorVariedad()) {
      const variedadId = String(item.variedadId ?? '').trim();
      const codigoCultivo = String(item.codigoCultivo ?? '').trim();
      const key = `${codigoCultivo}|${variedadId}`;
      const current = grouped.get(key) ?? {
        key,
        variedadId,
        variedad: String(item.variedad || item.variedadId || '').trim(),
        codigoCultivo,
        bhCajas: 0,
        bhKg: 0,
        caoCajas: 0,
        caoKg: 0,
        sinClasificarCajas: 0,
        sinClasificarKg: 0,
        totalCajas: 0,
        totalKg: 0,
      };
      const cajas = Number(item.cajas ?? 0);
      const kg = Number(item.kg ?? 0);

      if (item.tipoOrigen === 'PROPIO') {
        current.bhCajas += cajas;
        current.bhKg += kg;
      } else if (item.tipoOrigen === 'EXTERNO') {
        current.caoCajas += cajas;
        current.caoKg += kg;
      } else {
        current.sinClasificarCajas += cajas;
        current.sinClasificarKg += kg;
      }

      current.totalCajas += cajas;
      current.totalKg += kg;
      grouped.set(key, current);
    }

    const rows = Array.from(grouped.values());
    const totalKg = rows.reduce((sum, item) => sum + item.totalKg, 0);
    return rows
      .map((item) => ({ ...item, porcentaje: totalKg > 0 ? (item.totalKg * 100) / totalKg : 0 }))
      .sort((a, b) => b.totalKg - a.totalKg);
  });
  readonly kgPorAcopio = computed(() => this.reporteData()?.kgPorAcopio ?? []);
  readonly avancePorConsignatario = computed(
    () => this.reporteData()?.avancePorConsignatario ?? [],
  );
  readonly avancePorConsignatarioComparado = computed(() => {
    const grouped = new Map<string, any>();

    for (const item of this.avancePorConsignatario()) {
      const consignatarioId = String(item.consignatarioId ?? '').trim();
      const destinoId = String(item.destinoId ?? '').trim();
      const formatoId = String(item.formatoId ?? '').trim();
      const key = `${consignatarioId}|${destinoId}|${formatoId}`;
      const current = grouped.get(key) ?? {
        key,
        consignatarioId,
        consignatario: String(item.consignatario || item.consignatarioId || '').trim(),
        destinoId,
        formatoId,
        formato: String(item.formato ?? '').trim(),
        bhCajas: 0,
        bhKg: 0,
        caoCajas: 0,
        caoKg: 0,
        totalCajas: 0,
        totalKg: 0,
      };
      const cajas = Number(item.cajas ?? 0);
      const kg = Number(item.kg ?? 0);

      if (item.tipoOrigen === 'PROPIO') {
        current.bhCajas += cajas;
        current.bhKg += kg;
      } else if (item.tipoOrigen === 'EXTERNO') {
        current.caoCajas += cajas;
        current.caoKg += kg;
      }

      current.totalCajas += cajas;
      current.totalKg += kg;
      grouped.set(key, current);
    }

    const rows = Array.from(grouped.values());
    const totalKg = rows.reduce((sum, item) => sum + item.totalKg, 0);
    return rows
      .map((item) => ({ ...item, porcentaje: totalKg > 0 ? (item.totalKg * 100) / totalKg : 0 }))
      .sort((a, b) => b.totalKg - a.totalKg);
  });
  readonly hayProcesosAbiertos = computed(() => this.reporteData()?.procesosAbiertos ?? false);
  readonly acopiosSeleccionados = computed(() => this.acopios().filter((item) => item.selected));
  readonly empresasSeleccionadas = computed(() => this.empresas().filter((item) => item.selected));
  readonly muestraBh = computed(() => this.empresasAplicadas().includes('BH'));
  readonly muestraCao = computed(() => this.empresasAplicadas().includes('CAO'));
  readonly muestraAmbosOrigenes = computed(() => this.muestraBh() && this.muestraCao());
  readonly variedadColumnCount = computed(
    () =>
      1 +
      (this.muestraBh() ? 2 : 0) +
      (this.muestraCao() ? 2 : 0) +
      (this.muestraAmbosOrigenes() ? 2 : 0) +
      1,
  );
  readonly consignatarioColumnCount = computed(
    () =>
      3 +
      (this.muestraBh() ? 2 : 0) +
      (this.muestraCao() ? 2 : 0) +
      (this.muestraAmbosOrigenes() ? 2 : 0) +
      1,
  );
  readonly empresasLabel = computed(() => {
    const selected = this.empresasSeleccionadas();
    if (selected.length === 0 || selected.length === this.empresas().length) return 'BH y CAO';
    return selected.map((item) => item.nombre).join(' y ');
  });
  readonly acopiosLabel = computed(() => {
    const selected = this.acopiosSeleccionados();
    if (selected.length === 0 || selected.length === this.acopios().length)
      return 'Todos los acopios';
    if (selected.length === 1) return selected[0].acopioNombre || selected[0].codigoAcopio;
    return `${selected.length} acopios seleccionados`;
  });
  readonly totalCajasVariedad = computed(() =>
    this.produccionPorVariedad().reduce((sum, item) => sum + Number(item.cajas ?? 0), 0),
  );
  readonly totalKgVariedad = computed(() =>
    this.produccionPorVariedad().reduce((sum, item) => sum + Number(item.kg ?? 0), 0),
  );

  constructor() {
    effect(() => {
      const data = this.reporteData();
      if (data) this.renderCharts(data);
    });
  }

  async ngOnInit(): Promise<void> {
    await this.inicializar();
  }

  ngAfterViewInit(): void {
    const data = this.reporteData();
    if (data) this.renderCharts(data);
  }

  ngOnDestroy(): void {
    this.destroyCharts();
  }

  async inicializar(): Promise<void> {
    if (!this.onlineSignal()) return;
    this.alertService.mostrarModalCarga();
    try {
      await this.cargarAcopios();
      await this.cargarReporte();
    } finally {
      this.alertService.cerrarModalCarga();
    }
  }

  async aplicarFiltros(): Promise<void> {
    if (!this.validarFiltros()) return;
    this.empresasAplicadas.set(this.empresasSeleccionadas().map((item) => item.codigo));
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
      if (!this.validarFiltros()) return;
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
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#f5f7fa',
      });
      const link = document.createElement('a');
      link.download = `reporte-bh-cao-${this.fechaConsulta()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('Error al capturar el dashboard BH / CAO', error);
    } finally {
      this.isLoading.set(false);
    }
  }

  toggleAcopios(): void {
    this.acopiosOpen.update((value) => !value);
  }
  closeAcopios(): void {
    this.acopiosOpen.set(false);
  }
  toggleEmpresas(): void {
    this.empresasOpen.update((value) => !value);
  }
  closeEmpresas(): void {
    this.empresasOpen.set(false);
  }
  toggleEmpresa(item: EmpresaOrigenOption): void {
    this.empresas.update((list) =>
      list.map((empresa) =>
        empresa.codigo === item.codigo ? { ...empresa, selected: !empresa.selected } : empresa,
      ),
    );
  }
  seleccionarTodasEmpresas(): void {
    this.empresas.update((list) => list.map((item) => ({ ...item, selected: true })));
  }
  limpiarEmpresas(): void {
    this.empresas.update((list) => list.map((item) => ({ ...item, selected: false })));
  }

  toggleAcopio(item: AcopioOption): void {
    this.acopios.update((list) =>
      list.map((acopio) =>
        acopio.codigoAcopio === item.codigoAcopio
          ? { ...acopio, selected: !acopio.selected }
          : acopio,
      ),
    );
  }

  seleccionarTodosAcopios(): void {
    this.acopios.update((list) => list.map((item) => ({ ...item, selected: true })));
  }
  limpiarAcopios(): void {
    this.acopios.update((list) => list.map((item) => ({ ...item, selected: false })));
  }

  consignatarioRowKey(item: any): string {
    return [item.tipoOrigen, item.consignatarioId, item.destinoId, item.formatoId].join('|');
  }

  origenLabel(tipoOrigen: string): string {
    if (tipoOrigen === 'PROPIO') return 'BH';
    if (tipoOrigen === 'EXTERNO') return 'CAO';
    return 'SIN CLASIFICAR';
  }

  private async cargarAcopios(): Promise<void> {
    try {
      const idProyecto = await this.obtenerIdProyecto();
      if (!idProyecto) return;
      const response: any = await firstValueFrom(this.catalogoService.listarAcopios(idProyecto));
      const data = response?.data ?? [];
      this.acopios.set(
        (data as any[])
          .map((item) => ({
            codigoAcopio: String(item?.codigoAcopio ?? item?.codigo ?? '').trim(),
            acopioNombre: String(item?.acopioNombre ?? item?.nombre ?? '').trim(),
            selected: true,
          }))
          .filter((item) => item.codigoAcopio),
      );
    } catch {
      this.acopios.set([]);
    }
  }

  private async cargarReporte(): Promise<void> {
    if (!this.onlineSignal()) return;
    this.isLoading.set(true);
    this.errorMensaje.set(null);

    try {
      const idProyecto = await this.obtenerIdProyecto();
      if (!idProyecto) {
        this.errorMensaje.set('No se encontró una campaña activa en la configuración.');
        this.reporteData.set(null);
        return;
      }

      const selected = this.acopiosSeleccionados();
      const acopios =
        selected.length === this.acopios().length || selected.length === 0
          ? ''
          : selected.map((item) => item.codigoAcopio).join(',');
      const origenes =
        this.empresasAplicadas().length === this.empresas().length
          ? ''
          : this.empresasAplicadas().join(',');
      const response: any = await firstValueFrom(
        this.procesoService.obtenerReporteDiarioPropioExterno(
          this.fechaConsulta(),
          acopios,
          idProyecto,
          origenes,
        ),
      );
      const wrapper = Array.isArray(response) ? response[0] : response;

      if (wrapper?.error) {
        this.errorMensaje.set(wrapper?.mensaje ?? 'No se pudo obtener el reporte BH / CAO.');
        this.reporteData.set(null);
        return;
      }

      this.reporteData.set(wrapper?.data ?? null);
    } catch (error: any) {
      this.errorMensaje.set(
        error?.error?.mensaje ?? 'Error de conexión al obtener el reporte BH / CAO.',
      );
      this.reporteData.set(null);
    } finally {
      this.isLoading.set(false);
    }
  }

  private validarFiltros(): boolean {
    if (this.acopiosSeleccionados().length === 0) {
      this.errorMensaje.set('Selecciona al menos un acopio para consultar el reporte.');
      return false;
    }
    if (this.empresasSeleccionadas().length === 0) {
      this.errorMensaje.set('Selecciona al menos una empresa: BH o CAO.');
      return false;
    }
    return true;
  }

  private renderCharts(data: ReporteData): void {
    this.renderAcopioChart(data.kgPorAcopio);
    this.renderConsignatarioChart(data.avancePorConsignatario);
  }

  private renderAcopioChart(items: any[]): void {
    const canvas = this.chartAcopioRef()?.nativeElement;
    if (!canvas) return;
    this.acopioChart?.destroy();

    const labels = Array.from(new Set(items.map((item) => String(item.acopio ?? ''))));
    const ownValues = labels.map((label) => this.sumBy(items, label, 'PROPIO'));
    const externalValues = labels.map((label) => this.sumBy(items, label, 'EXTERNO'));
    const datasets = [
      { label: 'BH', data: ownValues, backgroundColor: '#2563eb', borderRadius: 5 },
      { label: 'CAO', data: externalValues, backgroundColor: '#f97316', borderRadius: 5 },
    ].filter((dataset) => dataset.data.some((value) => value > 0));
    const values = datasets.flatMap((dataset) => dataset.data);

    this.acopioChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom' },
          tooltip: {
            callbacks: {
              label: (ctx: any) =>
                `${ctx.dataset.label}: ${this.formatKg(Number(ctx.raw ?? 0))} kg`,
            },
          },
        },
        scales: { y: { beginAtZero: true, title: { display: true, text: 'KG' } } },
      },
      plugins: [this.createBarValuePlugin(values, (value) => `${this.formatKg(value)} kg`)],
    });
  }

  private renderConsignatarioChart(items: any[]): void {
    const canvas = this.chartConsignatarioRef()?.nativeElement;
    if (!canvas) return;
    this.consignatarioChart?.destroy();

    const chartItems = this.agruparConsignatariosParaGrafico(items);
    const labels = chartItems.map((item) => item.consignatario);
    const values = chartItems.map((item) => item.kg);
    const totalKg = values.reduce((sum, value) => sum + value, 0);

    const pieLabelsPlugin = {
      id: 'bhCaoPieLabels',
      afterDraw: (chart: any) => {
        const ctx = chart.ctx;
        const meta = chart.getDatasetMeta(0);
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        meta.data.forEach((arc: any, index: number) => {
          const angle = arc.endAngle - arc.startAngle;
          if (angle < 0.25) return;
          const percentage =
            totalKg > 0 ? `${((values[index] / totalKg) * 100).toFixed(1)}%` : '0.0%';
          const radius = arc.outerRadius * 0.62;
          const midAngle = (arc.startAngle + arc.endAngle) / 2;
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
          { data: values, backgroundColor: this.generatePalette(labels.length), borderWidth: 1 },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              generateLabels: (chart: any) =>
                chart.getDatasetMeta(0).data.map((arc: any, index: number) => ({
                  text: `${labels[index]} - ${totalKg > 0 ? ((values[index] * 100) / totalKg).toFixed(1) : '0.0'}%`,
                  fillStyle: chart.data.datasets[0].backgroundColor[index],
                  strokeStyle: '#ffffff',
                  hidden: arc.hidden,
                  index,
                })),
            },
          },
          tooltip: {
            callbacks: {
              label: (ctx: any) =>
                `${labels[ctx.dataIndex]}: ${this.formatKg(values[ctx.dataIndex])} kg (${totalKg > 0 ? ((values[ctx.dataIndex] * 100) / totalKg).toFixed(1) : '0.0'}%)`,
            },
          },
        },
      },
      plugins: [pieLabelsPlugin],
    });
  }

  private agruparConsignatariosParaGrafico(
    items: any[],
  ): Array<{ consignatario: string; kg: number }> {
    const grouped = new Map<string, { consignatario: string; kg: number }>();
    for (const item of items) {
      const key = String(item.consignatarioId || item.consignatario || '').trim();
      if (!key) continue;
      const current = grouped.get(key);
      if (current) {
        current.kg += Number(item.kg ?? 0);
      } else {
        grouped.set(key, {
          consignatario: String(item.consignatario || item.consignatarioId || '').trim(),
          kg: Number(item.kg ?? 0),
        });
      }
    }
    return Array.from(grouped.values())
      .filter((item) => item.kg > 0)
      .sort((a, b) => b.kg - a.kg);
  }

  private createBarValuePlugin(values: number[], formatter: (value: number) => string) {
    return {
      id: 'bhCaoBarValueLabels',
      afterDatasetsDraw: (chart: any) => {
        const { ctx } = chart;
        ctx.save();
        ctx.font = '600 11px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        chart.data.datasets.forEach((dataset: any, datasetIndex: number) => {
          const meta = chart.getDatasetMeta(datasetIndex);
          meta.data.forEach((bar: any, index: number) => {
            const value = Number(dataset.data[index] ?? 0);
            if (value <= 0) return;
            const { x, y } = bar.tooltipPosition();
            const label = formatter(value);
            const metrics = ctx.measureText(label);
            const width = metrics.width + 14;
            const height = 22;
            const top = Math.max(6, y - height - 5);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
            ctx.strokeStyle = 'rgba(15, 23, 42, 0.15)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(x - width / 2, top, width, height, 6);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = '#0f172a';
            ctx.fillText(label, x, top + height / 2);
          });
        });
        ctx.restore();
      },
    };
  }

  private formatKg(value: number): string {
    return new Intl.NumberFormat('es-PE', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value);
  }

  private generatePalette(count: number): string[] {
    const base = [
      '#3b82f6',
      '#ef4444',
      '#22c55e',
      '#f59e0b',
      '#8b5cf6',
      '#06b6d4',
      '#ec4899',
      '#10b981',
    ];
    return Array.from({ length: count }, (_, index) => base[index % base.length]);
  }

  private sumBy(items: any[], acopio: string, tipoOrigen: string): number {
    return items
      .filter((item) => item.acopio === acopio && item.tipoOrigen === tipoOrigen)
      .reduce((sum, item) => sum + Number(item.kg ?? 0), 0);
  }

  private destroyCharts(): void {
    this.variedadChart?.destroy();
    this.acopioChart?.destroy();
    this.consignatarioChart?.destroy();
  }

  private async obtenerIdProyecto(): Promise<string> {
    const usuario: any = this.auth.usuario();
    const documento = String(
      usuario?.nrodocumento ??
        usuario?.documentoidentidad ??
        usuario?.documentoIdentidad ??
        usuario?.documento ??
        '',
    ).trim();
    if (!documento) return '';
    const config = await this.catalogosRepo.configuracionRepo.getByField('nrodocumento', documento);
    return String(config?.idProyecto ?? '').trim();
  }

  private formatDateInput(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
