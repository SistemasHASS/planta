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
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import html2canvas from 'html2canvas';
import { firstValueFrom } from 'rxjs';
import { ConnectivityService } from '../../../../shared/services/connectivity.service';
import { ProcesoService } from '../../../../shared/services/proceso.service';
import { CatalogosRepository } from '../../../../shared/dexiedb/repository/catalogos.repository';
import { AuthService } from '../../../../shared/services/auth.service';
import { AlertService } from '../../../../shared/services/alert.service';
import { CatalogoService } from '../../../../shared/services/catalogo.service';
import { Campania } from '../../../../shared/interfaces/catalogo.interface';

Chart.register(...registerables);

type FiltroOpcion = { id: string; nombre: string; selected: boolean; extra?: Record<string, any> | null };
type CampaniaOpcion = { id: string; nombre: string; extra?: Campania | null };

type PesoPorSemana = { semana: string; pesoKg: number };
type PesoPorEmpaque = { tipo: string; pesoKg: number };
type SegmentoVariedad = { variedadId: string; variedad: string; codigoCultivo: string; pesoKg: number; porcentaje: number };
type SegmentoDriscolls = { tipo: string; porcentaje: number; pesoKg: number };

type DashboardCampania = {
  kpis: { totalCajas: number; totalPesoKg: number };
  pesoPorSemana: PesoPorSemana[];
  pesoPorEmpaque: PesoPorEmpaque[];
  detalleVariedad: SegmentoVariedad[];
  driscollsVsPublicas: SegmentoDriscolls[];
};

@Component({
  selector: 'app-reporte-campania',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reporte-campania.component.html',
  styleUrl: './reporte-campania.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReporteCampaniaComponent implements OnInit, AfterViewInit, OnDestroy {
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
  readonly destinos = signal<FiltroOpcion[]>([]);
  readonly clientes = signal<FiltroOpcion[]>([]);
  readonly consignatarios = signal<FiltroOpcion[]>([]);
  readonly campanias = signal<CampaniaOpcion[]>([]);

  readonly semanasSeleccionadas = signal<string[]>([]);
  readonly variedadesSeleccionadas = signal<string[]>([]);
  readonly formatosSeleccionados = signal<string[]>([]);
  readonly campaniaSeleccionada = signal<string>('');
  readonly campaniaActual = computed(() =>
    this.campanias().find(c => c.id === this.campaniaSeleccionada()) ?? null
  );
  readonly sidebarMovilAbierto = signal(false);
  readonly dropdownAbierto = signal<'semanas' | 'variedades' | 'formatos' | null>(null);

  readonly busquedaSemanas = signal('');
  readonly busquedaVariedades = signal('');
  readonly busquedaFormatos = signal('');
  readonly busquedaDestinos = signal('');
  readonly busquedaClientes = signal('');
  readonly busquedaConsignatarios = signal('');

  readonly semanasFiltradas = computed(() => this.filtrarOpciones(this.semanas(), this.busquedaSemanas()));
  readonly variedadesFiltradas = computed(() => this.filtrarOpciones(this.variedades(), this.busquedaVariedades()));
  readonly formatosFiltrados = computed(() => this.filtrarOpciones(this.formatos(), this.busquedaFormatos()));
  readonly destinosFiltrados = computed(() => this.filtrarOpciones(this.destinos(), this.busquedaDestinos()));
  readonly clientesFiltrados = computed(() => this.filtrarOpciones(this.clientes(), this.busquedaClientes()));
  readonly consignatariosFiltrados = computed(() => this.filtrarOpciones(this.consignatarios(), this.busquedaConsignatarios()));

  readonly dashboardData = signal<DashboardCampania | null>(null);
  readonly totalKgFormateado = computed(() => this.formatKg(this.dashboardData()?.kpis?.totalPesoKg ?? 0));
  readonly totalVariedadesKg = computed(() =>
    this.dashboardData()?.detalleVariedad.reduce((sum: number, item) => sum + item.pesoKg, 0) ?? 0
  );
  readonly totalVariedadesAporte = computed(() =>
    this.dashboardData()?.detalleVariedad.reduce((sum: number, item) => sum + item.porcentaje, 0) ?? 0
  );
  readonly kpiCajas = computed(() => this.dashboardData()?.kpis?.totalCajas ?? 0);
  readonly kpiPeso = computed(() => this.dashboardData()?.kpis?.totalPesoKg ?? 0);

  private chartSemana?: Chart;
  private chartEmpaque?: Chart;
  private chartSegmento?: Chart;
  private viewReady = false;

  private readonly chartSemanaRef = viewChild<ElementRef<HTMLCanvasElement>>('chartSemana');
  private readonly chartEmpaqueRef = viewChild<ElementRef<HTMLCanvasElement>>('chartEmpaque');
  private readonly chartSegmentoRef = viewChild<ElementRef<HTMLCanvasElement>>('chartSegmento');
  private readonly reportPageRef = viewChild.required<ElementRef<HTMLElement>>('reportPage');

  constructor() {
    effect(() => {
      if (this.onlineSignal()) {
        this.renderCharts(this.dashboardData());
      }
    });

    effect(() => {
      const data = this.dashboardData();
      if (this.viewReady && data) {
        this.renderCharts(data);
      }
    });
  }

  async ngOnInit(): Promise<void> {
    await this.cargarCampanias();
    await this.cargarFiltrosIniciales();
  }

  ngAfterViewInit(): void {
    this.viewReady = true;
    if (this.dashboardData()) {
      this.renderCharts(this.dashboardData());
    }
  }

  ngOnDestroy(): void {
    this.destroyCharts();
  }

  private filtrarOpciones(lista: FiltroOpcion[], termino: string): FiltroOpcion[] {
    const texto = termino.trim().toLowerCase();
    if (!texto) return lista;
    return lista.filter(item => item.nombre.toLowerCase().includes(texto));
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
    const { signal } = mapa[tipo];

    signal.update(actual => {
      if (checked) {
        return actual.includes(id) ? actual : [...actual, id];
      }
      return actual.filter(valor => valor !== id);
    });
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

  toggleSidebarMovil(): void {
    this.sidebarMovilAbierto.update(state => !state);
  }

  cerrarSidebarMovil(): void {
    this.sidebarMovilAbierto.set(false);
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
    const contenedor = this.hostElement.nativeElement.querySelector(`[data-dropdown="${tipo}"]`);
    return contenedor ? contenedor.contains(target) : false;
  }

  @HostListener('window:keydown.escape')
  onEscape(): void {
    this.closeDropdowns();
  }

  async onCampaniaChange(value: string): Promise<void> {
    this.campaniaSeleccionada.set(value);
    if (!value) {
      return;
    }
    await this.cargarFiltrosIniciales();
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
        console.log('121210')
        return;
      }

      const payload = this.construirPayloadFiltros(idProyecto);
      this.alertService.mostrarModalCarga();
      const resp = await firstValueFrom(this.procesoService.obtenerReporteCampaniaDatos(payload));
      const data = this.extraerPayload(resp);

      if (!data || this.esPayloadReporteVacio(data)) {
        this.isLoading.set(false);
        this.mostrarMensajeSinDatosReporte();
        return;
      }

      this.alertService.cerrarModalCarga();
      this.aplicarDatosReporte(data);
    } catch (error) {
      console.error('Error obteniendo datos del reporte de campaña', error);
      this.alertService.showAlert('Error', 'No se pudo obtener los datos del reporte de campaña.', 'error');
    } finally {
      if (mostrarModal) {
        // this.alertService.cerrarModalCarga();
      }
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

    console.log('Validando filtros - Faltantes11:', faltantes);

    if (!faltantes.length) {
      console.log(1);
      return true;
    }

    console.log(2);
    const mensaje = `Selecciona al menos una opción en: ${faltantes.join(', ')}.`;
    this.alertService.showAlertAcept('Filtros incompletos', mensaje, 'warning');
    this.isLoading.set(false);
    return false;
  }

  private limpiarDatosReporte(): void {
    this.dashboardData.set(null);
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
      enlace.download = `reporte-campania-${new Date().toISOString().slice(0, 10)}.png`;
      enlace.href = canvas.toDataURL('image/png');
      enlace.click();
    } catch (error) {
      console.error('Error al capturar el dashboard de campaña', error);
    } finally {
      this.isLoading.set(false);
    }
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
        return;
      }

      const resp = await firstValueFrom(this.procesoService.obtenerFiltrosReporteSemanal(idProyecto));
      const data = this.extraerPayload(resp);
      if (!data) {
        this.mostrarMensajeSinDatos();
        return;
      }

      if (this.esPayloadVacio(data)) {
        this.mostrarMensajeSinDatos();
        return;
      }

      this.aplicarFiltrosIniciales(data);
      await this.aplicarFiltros({ mostrarModal: false });
    } catch (error) {
      console.error('Error obteniendo filtros del reporte de campaña', error);
      this.alertService.showAlert('Error', 'No se pudo obtener los filtros del reporte de campaña.', 'error');
    } finally {
      this.alertService.cerrarModalCarga();
      this.isLoading.set(false);
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

  private mapOpcionesPrincipales(items: any): FiltroOpcion[] {
    const lista = this.normalizarLista(items);
    return lista
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

  private mapOpcionesSecundarias(items: any): FiltroOpcion[] {
    const lista = this.normalizarLista(items);
    return lista
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

  private normalizarLista<T = any>(entrada: any): T[] {
    if (Array.isArray(entrada)) {
      return entrada as T[];
    }
    if (Array.isArray(entrada?.data)) {
      return entrada.data as T[];
    }
    if (Array.isArray(entrada?.lista)) {
      return entrada.lista as T[];
    }
    if (Array.isArray(entrada?.items)) {
      return entrada.items as T[];
    }
    if (Array.isArray(entrada?.[0]?.data)) {
      return entrada[0].data as T[];
    }
    return [];
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

  private construirPayloadFiltros(idProyecto: string): any {
    return {
      idProyecto,
      semanas: this.semanasSeleccionadas(),
      variedades: this.variedadesSeleccionadas(),
      formatos: this.formatosSeleccionados(),
      destinos: this.destinos().filter(d => d.selected).map(d => d.id),
      clientes: this.clientes().filter(c => c.selected).map(c => c.id),
      consignatarios: this.consignatarios().filter(c => c.selected).map(c => c.id),
    };
  }

  private esPayloadReporteVacio(payload: any): boolean {
    return !payload?.kpis || (!payload?.pesoPorSemana?.length && !payload?.detalleVariedad?.length);
  }

  private mostrarMensajeSinDatosReporte(): void {
    this.limpiarDatosReporte();
    this.alertService.showAlertAcept('Sin datos', 'No se encontró información actual para la campaña.', 'info');
  }

  private aplicarDatosReporte(data: any): void {
    const dashboard: DashboardCampania = {
      kpis: data?.kpis || { totalCajas: 0, totalPesoKg: 0 },
      pesoPorSemana: data?.pesoPorSemana || [],
      pesoPorEmpaque: data?.pesoPorTipoProcesoEmpaque || [],
      detalleVariedad: data?.detalleVariedad || [],
      driscollsVsPublicas: data?.driscollsVsPublicas || [],
    };
    this.dashboardData.set(dashboard);
  }

  private renderCharts(data: DashboardCampania | null): void {
    if (!this.viewReady) return;
    if (!data) {
      this.destroyCharts();
      return;
    }

    this.renderSemanaChart(data.pesoPorSemana);
    this.renderEmpaqueChart(data.pesoPorEmpaque);
    this.renderSegmentoChart(data.driscollsVsPublicas);
  }

  private renderSemanaChart(dataset: PesoPorSemana[]): void {
    const canvas = this.chartSemanaRef()?.nativeElement;
    if (!canvas) return;
    this.chartSemana?.destroy();

    const values = dataset.length ? dataset.map(item => item.pesoKg ?? 0) : [0];
    const formatter = (value: number) => this.formatKg(value);
    const labelsPlugin = this.createBarValuePlugin(values, formatter, 'campaniaSemanaLabels');

    this.chartSemana = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: dataset.map((item) => item.semana),
        datasets: [
          {
            data: dataset.map((item) => item.pesoKg),
            backgroundColor: '#2563eb',
            borderRadius: 8,
          },
        ],
      },
      options: this.buildBarOptions('KG por semana'),
      plugins: [labelsPlugin],
    } satisfies ChartConfiguration<'bar'>);
  }

  private renderEmpaqueChart(dataset: PesoPorEmpaque[]): void {
    const canvas = this.chartEmpaqueRef()?.nativeElement;
    if (!canvas) return;
    this.chartEmpaque?.destroy();

    const values = dataset.length ? dataset.map(item => item.pesoKg ?? 0) : [0];
    const formatter = (value: number) => this.formatKg(value);
    const labelsPlugin = this.createBarValuePlugin(values, formatter, 'campaniaEmpaqueLabels');

    this.chartEmpaque = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: dataset.map((item) => item.tipo),
        datasets: [
          {
            data: dataset.map((item) => item.pesoKg),
            backgroundColor: ['#0ea5e9', '#22d3ee', '#34d399'],
            borderRadius: 8,
          },
        ],
      },
      options: this.buildBarOptions('KG por tipo de empaque'),
      plugins: [labelsPlugin],
    } satisfies ChartConfiguration<'bar'>);
  }

  private renderSegmentoChart(dataset: SegmentoDriscolls[]): void {
    const canvas = this.chartSegmentoRef()?.nativeElement;
    if (!canvas) return;
    this.chartSegmento?.destroy();

    const labelsPlugin = this.createDonutLabelsPlugin(dataset);

    this.chartSegmento = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: dataset.map((item) => item.tipo),
        datasets: [
          {
            data: dataset.map((item) => item.porcentaje),
            backgroundColor: ['#2563eb', '#fb923c'],
            borderWidth: 0,
          },
        ],
      },
      options: {
        cutout: '60%',
        plugins: {
          legend: { position: 'bottom' },
        },
      },
      plugins: [labelsPlugin],
    });
  }

  private buildBarOptions(label: string): ChartConfiguration<'bar'>['options'] {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const parsed = typeof ctx.parsed === 'number' ? ctx.parsed : ctx.parsed?.y;
              return `${this.formatKg(parsed ?? 0)} kg`;
            },
          },
        },
        title: {
          display: false,
          text: label,
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: (value) => `${this.formatKg(Number(value))} kg`,
          },
        },
      },
    };
  }

  private destroyCharts(): void {
    this.chartSemana?.destroy();
    this.chartEmpaque?.destroy();
    this.chartSegmento?.destroy();
  }

  private formatKg(value: number): string {
    return new Intl.NumberFormat('es-PE', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value);
  }

  formatPorcentaje(value: number): string {
    return new Intl.NumberFormat('es-PE', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value);
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

  private createDonutLabelsPlugin(items: SegmentoDriscolls[]) {
    return {
      id: 'campaniaDonutLabels',
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
}
