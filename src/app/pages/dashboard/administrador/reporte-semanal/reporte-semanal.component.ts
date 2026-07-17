import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  WritableSignal,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Chart, registerables } from 'chart.js';
import html2canvas from 'html2canvas';
import { ConnectivityService } from '../../../../shared/services/connectivity.service';
import { ProcesoService } from '../../../../shared/services/proceso.service';
import { CatalogosRepository } from '../../../../shared/dexiedb/repository/catalogos.repository';
import { AuthService } from '../../../../shared/services/auth.service';
import { AlertService } from '../../../../shared/services/alert.service';
import { firstValueFrom } from 'rxjs';
import { CatalogoService } from '../../../../shared/services/catalogo.service';
import { Campania } from '../../../../shared/interfaces/catalogo.interface';

Chart.register(...registerables);

type FiltroOpcion = { id: string; nombre: string; selected: boolean; extra?: Record<string, any> | null };
type CampaniaOpcion = { id: string; nombre: string; extra?: Campania | null };

@Component({
  selector: 'app-reporte-semanal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './reporte-semanal.component.html',
  styleUrl: './reporte-semanal.component.scss',
})
export class ReporteSemanalComponent implements AfterViewInit, OnDestroy, OnInit {
  private readonly connectivity = inject(ConnectivityService);
  private readonly hostElement = inject(ElementRef<HTMLElement>);
  private readonly procesoService = inject(ProcesoService);
  private readonly catalogosRepo = inject(CatalogosRepository);
  private readonly catalogoService = inject(CatalogoService);
  private readonly auth = inject(AuthService);
  private readonly alertService = inject(AlertService);

  readonly onlineSignal = computed(() => this.connectivity.isOnline());
  readonly isLoading = signal(false);

  readonly semanas = signal<FiltroOpcion[]>([]);
  readonly variedades = signal<FiltroOpcion[]>([]);
  readonly formatos = signal<FiltroOpcion[]>([]);

  readonly semanasSeleccionadas = signal<string[]>(this.obtenerSeleccionInicial(this.semanas));
  readonly variedadesSeleccionadas = signal<string[]>(this.obtenerSeleccionInicial(this.variedades));
  readonly formatosSeleccionados = signal<string[]>(this.obtenerSeleccionInicial(this.formatos));
  readonly sidebarMovilAbierto = signal(false);
  readonly dropdownAbierto = signal<'semanas' | 'variedades' | 'formatos' | null>(null);

  readonly busquedaSemanas = signal('');
  readonly busquedaVariedades = signal('');
  readonly busquedaFormatos = signal('');

  readonly semanasFiltradas = computed(() => this.filtrarOpciones(this.semanas(), this.busquedaSemanas()));
  readonly variedadesFiltradas = computed(() => this.filtrarOpciones(this.variedades(), this.busquedaVariedades()));
  readonly formatosFiltrados = computed(() => this.filtrarOpciones(this.formatos(), this.busquedaFormatos()));

  readonly destinos = signal<FiltroOpcion[]>([]);

  readonly clientes = signal<FiltroOpcion[]>([]);

  readonly consignatarios = signal<FiltroOpcion[]>([]);
  readonly campanias = signal<CampaniaOpcion[]>([]);
  readonly campaniaSeleccionada = signal<string>('');
  readonly campaniaActual = computed(() =>
    this.campanias().find(c => c.id === this.campaniaSeleccionada()) ?? null
  );

  readonly kpiCajas = signal(0);
  readonly kpiPeso = signal(0);

  readonly pesoPorDiaSemana = signal<{ dia: string; peso: number }[]>([]);
  readonly pesoPorTipoProcesoEmpaque = signal<{ tipo: string; peso: number }[]>([]);
  readonly produccionPorVariedad = signal<{ variedad: string; variedadId?: string; peso: number; porcentaje: number }[]>([]);
  readonly driscollsVsPublicas = signal<{ tipo: string; porcentaje: number; peso: number }[]>([]);

  readonly totalPesoVariedad = computed(() =>
    this.produccionPorVariedad().reduce((sum, v) => sum + v.peso, 0)
  );

  readonly totalPorcentajeVariedad = computed(() =>
    this.produccionPorVariedad().reduce((sum, v) => sum + v.porcentaje, 0)
  );

  readonly busquedaDestinos = signal('');
  readonly busquedaClientes = signal('');
  readonly busquedaConsignatarios = signal('');

  readonly destinosFiltrados = computed(() =>
    this.filtrarOpciones(this.destinos(), this.busquedaDestinos())
  );

  readonly clientesFiltrados = computed(() =>
    this.filtrarOpciones(this.clientes(), this.busquedaClientes())
  );

  readonly consignatariosFiltrados = computed(() =>
    this.filtrarOpciones(this.consignatarios(), this.busquedaConsignatarios())
  );

  private filtrarOpciones(lista: FiltroOpcion[], termino: string): FiltroOpcion[] {
    const texto = termino.trim().toLowerCase();
    if (!texto) return lista;
    return lista.filter(item => item.nombre.toLowerCase().includes(texto));
  }

  private pesoDiaChart?: Chart;
  private pesoTipoChart?: Chart;
  private prodVarChart?: Chart;

  private readonly chartPesoDiaRef = viewChild<ElementRef<HTMLCanvasElement>>('chartPesoDia');
  private readonly chartPesoTipoRef = viewChild<ElementRef<HTMLCanvasElement>>('chartPesoTipo');
  private readonly chartProdVarRef = viewChild<ElementRef<HTMLCanvasElement>>('chartProdVar');
  private readonly reportPageRef = viewChild.required<ElementRef<HTMLElement>>('reportPage');

  constructor() {
    effect(() => {
      if (this.onlineSignal()) {
        this.renderCharts();
      }
    });

    effect(() => {
      this.pesoPorDiaSemana();
      this.pesoPorTipoProcesoEmpaque();
      this.produccionPorVariedad();
      this.driscollsVsPublicas();
      this.renderCharts();
    });
  }

  async ngOnInit(): Promise<void> {
    await this.cargarCampanias();
    await this.cargarFiltrosIniciales();
  }

  ngAfterViewInit(): void {
    this.renderCharts();
  }

  ngOnDestroy(): void {
    this.destroyCharts();
  }

  async aplicarFiltros(options?: { mostrarModal?: boolean }): Promise<void> {
    const mostrarModal = options?.mostrarModal ?? true;
    this.isLoading.set(true);
    this.sidebarMovilAbierto.set(false);

    if (mostrarModal) {
      // this.alertService.mostrarModalCarga();
    }

    try {
      const idProyecto = this.campaniaSeleccionada();
      if (!idProyecto) {
        this.alertService.showAlert('Configuración requerida', 'No se encontró una campaña activa.', 'warning');
        this.limpiarDatosReporte();
        this.isLoading.set(false);
        return;
      }

      if (!this.validarSeleccionFiltros()) {
        this.isLoading.set(false);
        return;
      }

      const payload = this.construirPayloadFiltros(idProyecto);
      this.alertService.mostrarModalCarga()
      const resp = await firstValueFrom(this.procesoService.obtenerReporteSemanalDatos(payload));
      const data = this.extraerPayload(resp);

      if (!data || this.esPayloadReporteVacio(data)) {
        this.isLoading.set(false);
        this.mostrarMensajeSinDatosReporte();
        return;
      }

      this.alertService.cerrarModalCarga();
      this.aplicarDatosReporte(data);
    } catch (error) {
      console.error('Error obteniendo datos del reporte semanal', error);
      this.alertService.showAlert('Error', 'No se pudo obtener los datos del reporte semanal.', 'error');
    }finally{
      this.isLoading.set(false);
    }
  }

  async actualizar(): Promise<void> {
    await this.aplicarFiltros();
  }

  private validarSeleccionFiltros(): boolean {
    const faltantes: string[] = [];

    if (!this.campaniaSeleccionada()) {
      faltantes.push('Campaña');
    }

    if (!this.semanasSeleccionadas().length) {
      faltantes.push('Semana');
    }
    if (!this.variedadesSeleccionadas().length) {
      faltantes.push('Variedad');
    }
    if (!this.formatosSeleccionados().length) {
      faltantes.push('Formato');
    }

    if (!this.destinos().some(d => d.selected)) {
      faltantes.push('Destinos');
    }
    if (!this.clientes().some(c => c.selected)) {
      faltantes.push('Clientes');
    }
    if (!this.consignatarios().some(c => c.selected)) {
      faltantes.push('Consignatarios');
    }

    if (!faltantes.length) {
      return true;
    }

    const mensaje = `Selecciona al menos una opción en: ${faltantes.join(', ')}.`;
    this.alertService.showAlertAcept('Filtros incompletos', mensaje, 'warning');
    this.isLoading.set(false);
    return false;
  }

  private construirPayloadFiltros(idProyecto: string): {
    idProyecto: string;
    semanas: string[];
    variedades: string[];
    formatos: string[];
    destinos: string[];
    clientes: string[];
    consignatarios: string[];
  } {
    const semanas = this.semanasSeleccionadas().length === this.semanas().length ? [] : this.semanasSeleccionadas();
    const variedades = this.variedadesSeleccionadas().length === this.variedades().length ? [] : this.variedadesSeleccionadas();
    const formatos = this.formatosSeleccionados().length === this.formatos().length ? [] : this.formatosSeleccionados();
    const destinos = this.destinos().every(d => d.selected) ? [] : this.destinos().filter(d => d.selected).map(d => d.id);
    const clientes = this.clientes().every(c => c.selected) ? [] : this.clientes().filter(c => c.selected).map(c => c.id);
    const consignatarios = this.consignatarios().every(c => c.selected) ? [] : this.consignatarios().filter(c => c.selected).map(c => c.id);

    return {
      idProyecto,
      semanas,
      variedades,
      formatos,
      destinos,
      clientes,
      consignatarios,
    };
  }

  private esPayloadReporteVacio(data: any): boolean {
    const arraysVacios = ['pesoPorDiaSemana', 'pesoPorTipoProcesoEmpaque', 'detalleVariedad', 'driscollsVsPublicas']
      .every(key => !Array.isArray(data?.[key]) || data[key].length === 0);

    const kpisVacios = !data?.kpis || (
      Number(data?.kpis?.totalCajas ?? 0) === 0 &&
      Number(data?.kpis?.totalPesoKg ?? data?.kpis?.totalPeso ?? 0) === 0
    );

    return arraysVacios && kpisVacios;
  }

  private mostrarMensajeSinDatosReporte(): void {
    this.limpiarDatosReporte();
    this.alertService.showAlertAcept('Sin datos', 'No se encontró información para los filtros seleccionados.', 'info');
  }

  private limpiarDatosReporte(): void {
    this.kpiCajas.set(0);
    this.kpiPeso.set(0);
    this.pesoPorDiaSemana.set([]);
    this.pesoPorTipoProcesoEmpaque.set([]);
    this.produccionPorVariedad.set([]);
    this.driscollsVsPublicas.set([]);
  }

  private aplicarDatosReporte(data: any): void {
    const kpis = data?.kpis ?? {};
    this.kpiCajas.set(this.toNumber(kpis?.totalCajas));
    this.kpiPeso.set(this.toNumber(kpis?.totalPesoKg ?? kpis?.totalPeso));

    this.pesoPorDiaSemana.set(
      (data?.pesoPorDiaSemana ?? []).map((item: any) => ({
        dia: this.normalizarNombre(item?.dia, 'Sin día'),
        peso: this.toNumber(item?.pesoKg ?? item?.peso),
      }))
    );

    this.pesoPorTipoProcesoEmpaque.set(
      (data?.pesoPorTipoProcesoEmpaque ?? []).map((item: any) => ({
        tipo: this.normalizarNombre(item?.tipo, 'Sin tipo'),
        peso: this.toNumber(item?.pesoKg ?? item?.peso),
      }))
    );

    this.produccionPorVariedad.set(
      (data?.detalleVariedad ?? []).map((item: any) => ({
        variedad: this.normalizarNombre(item?.variedad, item?.variedadId ?? ''),
        variedadId: String(item?.variedadId ?? ''),
        peso: this.toNumber(item?.pesoKg ?? item?.peso),
        porcentaje: this.toNumber(item?.porcentaje),
      }))
    );

    this.driscollsVsPublicas.set(
      (data?.driscollsVsPublicas ?? []).map((item: any) => ({
        tipo: this.normalizarNombre(item?.tipo, 'Sin tipo'),
        porcentaje: this.toNumber(item?.porcentaje),
        peso: this.toNumber(item?.pesoKg ?? item?.peso),
      }))
    );
  }

  private toNumber(value: any): number {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
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

          const labelText = `${formatter(value)} kg`;
          const { x, y } = bar.tooltipPosition();
          const paddingX = 10;
          const paddingY = 4;
          const metrics = ctx.measureText(labelText);
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
          ctx.fillText(labelText, x, top + labelHeight / 2);
        });

        ctx.restore();
      },
    };
  }

  private createDonutLabelsPlugin(items: { tipo: string; porcentaje: number }[]) {
    return {
      id: 'donutLabels',
      afterDraw: (chart: any) => {
        const { ctx } = chart;
        const meta = chart.getDatasetMeta(0);
        if (!meta?.data?.length) {
          return;
        }

        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        meta.data.forEach((arc: any, index: number) => {
          const sliceAngle = arc.endAngle - arc.startAngle;
          if (sliceAngle < 0.25) {
            return;
          }

          const item = items[index];
          const label = `${item?.porcentaje?.toFixed(1) ?? 0}%`;
          const midAngle = (arc.startAngle + arc.endAngle) / 2;
          const radius = arc.outerRadius * 0.65;
          const x = arc.x + Math.cos(midAngle) * radius;
          const y = arc.y + Math.sin(midAngle) * radius;

          ctx.font = 'bold 11px "Inter", sans-serif';
          ctx.lineWidth = 3;
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
          ctx.strokeText(label, x, y);
          ctx.fillStyle = '#ffffff';
          ctx.fillText(label, x, y);
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
  ) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  async capturarDashboard(): Promise<void> {
    const elemento = this.reportPageRef().nativeElement;
    if (!elemento) return;

    try {
      this.isLoading.set(true);
      const canvas = await html2canvas(elemento, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#f5f7fa',
      });
      const enlace = document.createElement('a');
      enlace.download = `reporte-semanal-${new Date().toISOString().slice(0, 10)}.png`;
      enlace.href = canvas.toDataURL('image/png');
      enlace.click();
    } catch (error) {
      console.error('Error al capturar el dashboard:', error);
    } finally {
      this.isLoading.set(false);
    }
  }

  toggleSidebarMovil(): void {
    this.sidebarMovilAbierto.update((state) => !state);
  }

  cerrarSidebarMovil(): void {
    this.sidebarMovilAbierto.set(false);
  }

  toggleDropdown(tipo: 'semanas' | 'variedades' | 'formatos'): void {
    this.dropdownAbierto.update(actual => (actual === tipo ? null : tipo));
  }

  closeDropdowns(): void {
    this.dropdownAbierto.set(null);
  }

  onSeleccionPrincipalChange(
    tipo: 'semanas' | 'variedades' | 'formatos',
    id: string,
    checked: boolean
  ): void {
    const mapa = this.obtenerMapaSeleccionPrincipal();
    const { signal, opciones } = mapa[tipo];

    signal.update((actual) => {
      if (checked) {
        return actual.includes(id) ? actual : [...actual, id];
      }
      return actual.filter(valor => valor !== id);
    });

    if (!signal().length) {
      signal.set([]);
    }
    // Opcionalmente podríamos interpretar "sin selección" como "todas" más adelante.
  }

  seleccionarTodosPrincipales(tipo: 'semanas' | 'variedades' | 'formatos'): void {
    const mapa = this.obtenerMapaSeleccionPrincipal();
    const { signal, opciones } = mapa[tipo];
    signal.set(opciones().map(o => o.id));
  }

  limpiarSeleccionPrincipales(tipo: 'semanas' | 'variedades' | 'formatos'): void {
    const mapa = this.obtenerMapaSeleccionPrincipal();
    mapa[tipo].signal.set([]);
  }

  toggleTodosPrincipales(tipo: 'semanas' | 'variedades' | 'formatos', seleccionar: boolean): void {
    if (seleccionar) {
      this.seleccionarTodosPrincipales(tipo);
    } else {
      this.limpiarSeleccionPrincipales(tipo);
    }
  }

  resumenSeleccion(tipo: 'semanas' | 'variedades' | 'formatos'): string {
    const mapa = this.obtenerMapaSeleccionPrincipal();
    const seleccionadas = mapa[tipo].signal();
    const opciones = mapa[tipo].opciones();

    if (!seleccionadas.length || seleccionadas.length === opciones.length) {
      return 'Todos';
    }

    if (seleccionadas.length === 1) {
      const item = opciones.find(o => o.id === seleccionadas[0]);
      return item?.nombre ?? '1 seleccionado';
    }

    return `${seleccionadas.length} seleccionados`;
  }

  estaTodoSeleccionado(tipo: 'semanas' | 'variedades' | 'formatos'): boolean {
    const mapa = this.obtenerMapaSeleccionPrincipal();
    return mapa[tipo].signal().length === mapa[tipo].opciones().length;
  }

  toggleOpcion(lista: 'destinos' | 'clientes' | 'consignatarios', item: FiltroOpcion): void {
    const signalMap = {
      destinos: this.destinos,
      clientes: this.clientes,
      consignatarios: this.consignatarios,
    };
    signalMap[lista].update(list =>
      list.map(i => (i.id === item.id ? { ...i, selected: !i.selected } : i))
    );
  }

  seleccionarTodos(lista: 'destinos' | 'clientes' | 'consignatarios'): void {
    const signalMap = {
      destinos: this.destinos,
      clientes: this.clientes,
      consignatarios: this.consignatarios,
    };
    signalMap[lista].update(list => list.map(i => ({ ...i, selected: true })));
  }

  limpiarTodos(lista: 'destinos' | 'clientes' | 'consignatarios'): void {
    const signalMap = {
      destinos: this.destinos,
      clientes: this.clientes,
      consignatarios: this.consignatarios,
    };
    signalMap[lista].update(list => list.map(i => ({ ...i, selected: false })));
  }

  private renderCharts(): void {
    this.destroyCharts();
    this.renderPesoDiaChart();
    this.renderPesoTipoChart();
    this.renderProdVarChart();
  }

  private renderPesoDiaChart(): void {
    const canvas = this.chartPesoDiaRef()?.nativeElement;
    if (!canvas) return;

    const data = this.pesoPorDiaSemana();
    const labels = data.length ? data.map(d => d.dia ?? 'Sin día') : ['Sin datos'];
    const values = data.length ? data.map(d => d.peso ?? 0) : [0];
    const colors = ['#3b82f6', '#22c55e', '#ef4444', '#8b5cf6', '#ec4899', '#f59e0b'];
    const formatter = (value: number) => new Intl.NumberFormat('es-PE', { maximumFractionDigits: 2 }).format(value);
    const labelsPlugin = this.createBarValuePlugin(values, formatter, 'pesoDiaLabels');

    this.pesoDiaChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Peso (kg)',
          data: values,
          backgroundColor: colors.slice(0, labels.length),
          borderRadius: 6,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } },
      },
      plugins: [labelsPlugin],
    });
  }

  private renderPesoTipoChart(): void {
    const canvas = this.chartPesoTipoRef()?.nativeElement;
    if (!canvas) return;

    const data = this.pesoPorTipoProcesoEmpaque();
    const labels = data.length ? data.map(d => d.tipo ?? 'Sin tipo') : ['Sin datos'];
    const values = data.length ? data.map(d => d.peso ?? 0) : [0];
    const colors = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6'];
    const formatter = (value: number) => new Intl.NumberFormat('es-PE', { maximumFractionDigits: 2 }).format(value);
    const labelsPlugin = this.createBarValuePlugin(values, formatter, 'pesoTipoLabels');

    this.pesoTipoChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Peso (kg)',
          data: values,
          backgroundColor: colors.slice(0, labels.length),
          borderRadius: 6,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } },
      },
      plugins: [labelsPlugin],
    });
  }

  private renderProdVarChart(): void {
    const canvas = this.chartProdVarRef()?.nativeElement;
    if (!canvas) return;

    const data = this.driscollsVsPublicas();
    const labels = data.length ? data.map(d => d.tipo ?? 'Sin tipo') : ['Sin datos'];
    const values = data.length ? data.map(d => d.porcentaje ?? 0) : [0];
    const colors = ['#3b82f6', '#8d6e63'];
    const donutLabelsPlugin = this.createDonutLabelsPlugin(data);

    this.prodVarChart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: colors.slice(0, labels.length),
          borderWidth: 0,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' } },
      },
      plugins: [donutLabelsPlugin],
    });
  }

  private destroyCharts(): void {
    this.pesoDiaChart?.destroy();
    this.pesoTipoChart?.destroy();
    this.prodVarChart?.destroy();
  }

  private obtenerSeleccionInicial(listaSignal: () => FiltroOpcion[]): string[] {
    const preseleccion = listaSignal().filter(item => item.selected).map(item => item.id);
    return preseleccion.length ? preseleccion : listaSignal().map(item => item.id);
  }

  private obtenerMapaSeleccionPrincipal(): Record<
    'semanas' | 'variedades' | 'formatos',
    { signal: WritableSignal<string[]>; opciones: () => FiltroOpcion[] }
  > {
    return {
      semanas: { signal: this.semanasSeleccionadas, opciones: this.semanas },
      variedades: { signal: this.variedadesSeleccionadas, opciones: this.variedades },
      formatos: { signal: this.formatosSeleccionados, opciones: this.formatos },
    };
  }

  private async cargarFiltrosIniciales(): Promise<void> {
    if (!this.onlineSignal()) {
      return;
    }

    this.alertService.mostrarModalCarga();

    try {
      this.isLoading.set(true);
      const idProyecto = this.campaniaSeleccionada();
      if (!idProyecto) {
        this.alertService.showAlert('Configuración requerida', 'No se encontró un proyecto activo en la configuración.', 'warning');
        this.limpiarDatosReporte();
        this.isLoading.set(false);
        return;
      }

      const resp = await firstValueFrom(this.procesoService.obtenerFiltrosReporteSemanal(idProyecto));
      const data = this.extraerPayload(resp);
      if (!data) {
        this.mostrarMensajeSinDatos();
        this.isLoading.set(false);
        return;
      }

      if (this.esPayloadVacio(data)) {
        this.mostrarMensajeSinDatos();
        this.isLoading.set(false);
        return;
      }

      this.aplicarFiltrosIniciales(data);
      await this.aplicarFiltros({ mostrarModal: false });
      this.alertService.cerrarModalCarga();
      this.isLoading.set(false);
    } catch (error) {
      this.alertService.cerrarModalCarga();
      this.isLoading.set(false);
      console.error('Error obteniendo filtros del reporte semanal', error);
      this.alertService.showAlert('Error', 'No se pudo obtener los filtros del reporte semanal.', 'error');
    }
  }

  private aplicarFiltrosIniciales(payload: any): void {
    const semanas = this.mapOpcionesPrincipales(payload?.semanas);
    const variedades = this.mapOpcionesPrincipales(payload?.variedades);
    const formatos = this.mapOpcionesPrincipales(payload?.formatos);

    this.semanas.set(semanas);
    this.semanasSeleccionadas.set(semanas.map(o => o.id));
    this.variedades.set(variedades);
    this.variedadesSeleccionadas.set(variedades.map(o => o.id));
    this.formatos.set(formatos);
    this.formatosSeleccionados.set(formatos.map(o => o.id));

    const destinos = this.mapOpcionesSecundarias(payload?.destinos);
    const clientes = this.mapOpcionesSecundarias(payload?.clientes);
    const consignatarios = this.mapOpcionesSecundarias(payload?.consignatarios);

    this.destinos.set(destinos);
    this.clientes.set(clientes);
    this.consignatarios.set(consignatarios);
  }

  async onCampaniaChange(value: string): Promise<void> {
    this.campaniaSeleccionada.set(value);
    if (!value) {
      return;
    }
    await this.cargarFiltrosIniciales();
  }

  private mapOpcionesPrincipales(items: any[] | undefined): FiltroOpcion[] {
    return (items ?? [])
      .map((item: any) => {
        const id = this.toId(item?.id);
        if (!id) {
          return null;
        }
        const nombre = this.normalizarNombre(item?.nombre, id);
        return { id, nombre, selected: true, extra: item } as FiltroOpcion;
      })
      .filter((item): item is FiltroOpcion => Boolean(item));
  }

  private mapOpcionesSecundarias(items: any[] | undefined): FiltroOpcion[] {
    return (items ?? [])
      .map((item: any) => {
        const id = this.toId(item?.id);
        if (!id) {
          return null;
        }
        const nombre = this.normalizarNombre(item?.nombre, id);
        return { id, nombre, selected: true, extra: item } as FiltroOpcion;
      })
      .filter((item): item is FiltroOpcion => Boolean(item));
  }

  private normalizarNombre(nombre: any, fallback: string): string {
    const text = String(nombre ?? '').trim();
    return text || fallback;
  }

  private toId(value: any): string {
    if (value === null || value === undefined) {
      return '';
    }
    const id = String(value).trim();
    return id;
  }

  private extraerPayload(resp: any): any | null {
    const wrapper = Array.isArray(resp) ? resp[0] : resp;
    if (!wrapper) {
      this.alertService.showAlert('Error', 'Respuesta vacía al obtener los filtros.', 'error');
      return null;
    }

    if (wrapper?.error) {
      this.alertService.showAlert('Error', wrapper?.mensaje ?? 'Error al obtener los filtros.', 'error');
      return null;
    }

    return wrapper?.data ?? null;
  }

  private esPayloadVacio(payload: any): boolean {
    const claves = ['semanas', 'variedades', 'formatos', 'destinos', 'clientes', 'consignatarios'];
    return !claves.some(key => Array.isArray(payload?.[key]) && payload[key].length > 0);
  }

  private mostrarMensajeSinDatos(): void {
    this.limpiarFiltros();
    this.limpiarDatosReporte();
    this.alertService.showAlertAcept('Sin datos', 'No se encontró información actual para la campaña.', 'info');
  }

  private limpiarFiltros(): void {
    this.semanas.set([]);
    this.variedades.set([]);
    this.formatos.set([]);
    this.destinos.set([]);
    this.clientes.set([]);
    this.consignatarios.set([]);

    this.semanasSeleccionadas.set([]);
    this.variedadesSeleccionadas.set([]);
    this.formatosSeleccionados.set([]);
  }

  private async obtenerIdProyecto(): Promise<string> {
    const nro = this.getNroDocumentoFromUsuario();
    try {
      const cfg = await this.catalogosRepo.configuracionRepo.getByField('nrodocumento', nro);
      return String(cfg?.idProyecto ?? '').trim();
    } catch {
      return '';
    }
  }

  private async cargarCampanias(): Promise<void> {
    let registros: Campania[] = [];
    try {
      const resp = await firstValueFrom(this.catalogoService.listarCampanias());
      registros = this.procesarLista(resp);
    } catch (error) {
      console.error('Error obteniendo campañas', error);
      this.alertService.showAlert('Error', 'No se pudo obtener el listado de campañas.', 'error');
      registros = (await this.catalogosRepo.campaniaRepo.getAll()) ?? [];
    }

    const opciones: CampaniaOpcion[] = [];
    for (const item of registros ?? []) {
      const id = this.toId(item?.idproyecto);
      if (!id) {
        continue;
      }
      opciones.push({
        id,
        nombre: this.normalizarNombre(item?.descripcion, id),
        extra: item,
      });
    }

    this.campanias.set(opciones);
    await this.establecerCampaniaPorDefecto();
  }

  private async establecerCampaniaPorDefecto(): Promise<void> {
    const lista = this.campanias();
    if (!lista.length) {
      this.campaniaSeleccionada.set('');
      return;
    }

    const configurada = await this.obtenerIdProyecto();
    if (configurada && lista.some(c => c.id === configurada)) {
      this.campaniaSeleccionada.set(configurada);
      return;
    }

    const mayor = lista.reduce((max, actual) => {
      if (!max) {
        return actual.id;
      }
      return this.compararIdCampania(actual.id, max) > 0 ? actual.id : max;
    }, lista[0]?.id ?? '');

    this.campaniaSeleccionada.set(mayor);
  }

  private compararIdCampania(a: string, b: string): number {
    const numA = Number(a);
    const numB = Number(b);
    const esNumA = Number.isFinite(numA);
    const esNumB = Number.isFinite(numB);

    if (esNumA && esNumB) {
      return numA - numB;
    }

    return a.localeCompare(b);
  }

  private procesarLista(resp: any): Campania[] {
    if (!resp) {
      return [];
    }

    if (Array.isArray(resp)) {
      return resp as Campania[];
    }

    if (Array.isArray(resp?.data)) {
      return resp.data as Campania[];
    }

    if (Array.isArray(resp[0]?.data)) {
      return resp[0].data as Campania[];
    }

    return [];
  }

  private getNroDocumentoFromUsuario(): string {
    const u: any = this.auth.usuario();
    const v =
      u?.nrodocumento ?? u?.documentoidentidad ?? u?.documentoIdentidad ?? u?.documento ?? '';
    return String(v ?? '').trim();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    const target = event.target as Node;

    if (!this.hostElement.nativeElement.contains(target)) {
      this.closeDropdowns();
      return;
    }

    if (this.dropdownAbierto() && !this.esClickDentroDropdown(target)) {
      this.closeDropdowns();
    }
  }

  private esClickDentroDropdown(target: Node): boolean {
    const tipo = this.dropdownAbierto();
    if (!tipo) {
      return false;
    }

    const selector = `[data-dropdown="${tipo}"]`;
    const dropdownContenedor = this.hostElement.nativeElement.querySelector(selector);
    return dropdownContenedor?.contains(target) ?? false;
  }
}
