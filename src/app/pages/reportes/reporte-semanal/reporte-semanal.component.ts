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
import * as Highcharts from 'highcharts';
import { aplicarTemaGraficos, colorFondoCaptura } from '../../../shared/utils/highcharts-tema';
import { ThemeService } from '../../../shared/services/theme.service';
import {
  LucideCamera,
  LucideFunnel,
  LucideGauge,
  LucideMapPin,
  LucidePackage,
  LucideRefreshCcw,
  LucideSlidersHorizontal,
  LucideTruck,
  LucideUsers,
  LucideWifiOff,
} from '@lucide/angular';
import { SearchMultiSelectComponent } from '../../../shared/components/search-multi-select/search-multi-select.component';
import { SearchSelectComponent, SearchSelectOption } from '../../../shared/components/search-select/search-select.component';
import { CatalogosRepository } from '../../../shared/dexiedb/repository/catalogos.repository';
import { Usuario } from '../../../shared/interfaces/auth.interface';
import { AuthService } from '../../../shared/services/auth.service';
import { ConnectivityService } from '../../../shared/services/connectivity.service';
import { FeedbackModalService } from '../../../shared/services/feedback-modal.service';
import { LoadingService } from '../../../shared/services/loading.service';
import { MaestrosApiService } from '../../../shared/services/maestros-api.service';
import {
  ReporteSemanalData,
  ReporteSemanalFiltros,
  ReporteSemanalOpcion,
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

const COLORES_DIA = ['#3b82f6', '#22c55e', '#ef4444', '#8b5cf6', '#ec4899', '#f59e0b', '#06b6d4'];
const COLORES_TIPO = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6'];
const COLORES_SEGMENTO = ['#3b82f6', '#8d6e63', '#22c55e', '#f59e0b'];

type ListaFiltro = 'semanas' | 'variedades' | 'formatos' | 'destinos' | 'clientes' | 'consignatarios';

/**
 * Reporte Semanal (Administrador / Monitor): peso por dia, por tipo de empaque, por variedad y Driscoll's vs publicas.
 * Pantalla solo online: no guarda nada en Dexie (solo lee catalogos para completar nombres). Graficos con Highcharts.
 */
@Component({
  selector: 'app-reporte-semanal',
  imports: [
    DecimalPipe,
    SearchMultiSelectComponent,
    SearchSelectComponent,
    LucideCamera,
    LucideFunnel,
    LucideGauge,
    LucideMapPin,
    LucidePackage,
    LucideRefreshCcw,
    LucideSlidersHorizontal,
    LucideTruck,
    LucideUsers,
    LucideWifiOff,
  ],
  templateUrl: './reporte-semanal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReporteSemanalComponent implements OnInit, OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly tema = inject(ThemeService);
  private readonly connectivity = inject(ConnectivityService);
  private readonly catalogosRepo = inject(CatalogosRepository);
  private readonly maestros = inject(MaestrosApiService);
  private readonly reportesApi = inject(ReportesApiService);
  private readonly loading = inject(LoadingService);
  private readonly feedback = inject(FeedbackModalService);

  readonly online = this.connectivity.online;
  readonly usuario = signal<Usuario | null>(null);
  readonly isLoading = signal(false);
  readonly filtrosAvanzados = signal(false);

  readonly campanias = signal<SearchSelectOption[]>([]);
  readonly campaniaId = signal('');

  /** Opciones (ya con nombre) y seleccion de cada filtro. */
  readonly opciones = signal<Record<ListaFiltro, SearchSelectOption[]>>(this.vacias());
  readonly seleccion = signal<Record<ListaFiltro, string[]>>(this.vaciasSeleccion());

  /** Texto de busqueda de las listas del panel lateral (destinos, clientes y consignatarios). */
  readonly busqueda = signal<Record<'destinos' | 'clientes' | 'consignatarios', string>>({ destinos: '', clientes: '', consignatarios: '' });
  readonly destinosFiltrados = computed(() => this.filtrarLista('destinos'));
  readonly clientesFiltrados = computed(() => this.filtrarLista('clientes'));
  readonly consignatariosFiltrados = computed(() => this.filtrarLista('consignatarios'));

  readonly datos = signal<ReporteSemanalData | null>(null);

  readonly kpiCajas = computed(() => numero(this.datos()?.kpis?.totalCajas));
  readonly kpiPeso = computed(() => numero(this.datos()?.kpis?.totalPesoKg));
  readonly detalleVariedad = computed(() => this.datos()?.detalleVariedad ?? []);
  readonly driscolls = computed(() => this.datos()?.driscollsVsPublicas ?? []);
  readonly totalPesoVariedad = computed(() => this.detalleVariedad().reduce((s, v) => s + numero(v.pesoKg), 0));

  private readonly chartDiaRef = viewChild<ElementRef<HTMLDivElement>>('chartDia');
  private readonly chartTipoRef = viewChild<ElementRef<HTMLDivElement>>('chartTipo');
  private readonly chartSegmentoRef = viewChild<ElementRef<HTMLDivElement>>('chartSegmento');
  private readonly reportPageRef = viewChild<ElementRef<HTMLElement>>('reportPage');

  private chartDia: Highcharts.Chart | null = null;
  private chartTipo: Highcharts.Chart | null = null;
  private chartSegmento: Highcharts.Chart | null = null;

  constructor() {
    effect(() => {
      const data = this.datos();
      aplicarTemaGraficos(this.tema.esOscuro()); // al cambiar de tema se vuelven a dibujar
      if (data) this.renderCharts(data);
    });
  }

  async ngOnInit(): Promise<void> {
    const session = await this.auth.getSession();
    this.usuario.set(session?.user ?? null);
    if (!this.online()) return;
    await this.cargarCampanias();
    await this.cargarFiltros();
  }

  ngOnDestroy(): void {
    this.chartDia?.destroy();
    this.chartTipo?.destroy();
    this.chartSegmento?.destroy();
  }

  // ───────── Filtros ─────────

  private vacias(): Record<ListaFiltro, SearchSelectOption[]> {
    return { semanas: [], variedades: [], formatos: [], destinos: [], clientes: [], consignatarios: [] };
  }

  private vaciasSeleccion(): Record<ListaFiltro, string[]> {
    return { semanas: [], variedades: [], formatos: [], destinos: [], clientes: [], consignatarios: [] };
  }

  private filtrarLista(lista: 'destinos' | 'clientes' | 'consignatarios'): SearchSelectOption[] {
    const termino = this.busqueda()[lista].trim().toLowerCase();
    const opciones = this.opciones()[lista];
    return termino ? opciones.filter((o) => o.label.toLowerCase().includes(termino)) : opciones;
  }

  buscar(lista: 'destinos' | 'clientes' | 'consignatarios', termino: string): void {
    this.busqueda.update((b) => ({ ...b, [lista]: termino }));
  }

  estaMarcado(lista: ListaFiltro, valor: string): boolean {
    return this.seleccion()[lista].includes(valor);
  }

  alternarOpcion(lista: ListaFiltro, valor: string): void {
    const actual = this.seleccion()[lista];
    this.cambiarSeleccion(lista, actual.includes(valor) ? actual.filter((v) => v !== valor) : [...actual, valor]);
  }

  marcarTodos(lista: ListaFiltro): void {
    this.cambiarSeleccion(lista, this.opciones()[lista].map((o) => o.value));
  }

  limpiar(lista: ListaFiltro): void {
    this.cambiarSeleccion(lista, []);
  }

  cambiarSeleccion(lista: ListaFiltro, valores: string[]): void {
    this.seleccion.update((s) => ({ ...s, [lista]: valores }));
  }

  /** Campañas de apimaestra; por defecto la configurada en Parametros o, si no hay, la mas reciente. */
  private async cargarCampanias(): Promise<void> {
    try {
      const lista = await this.maestros.campanias();
      const opciones = lista
        .map((c) => ({ value: texto(c.idproyecto), label: texto(c.descripcion) || texto(c.idproyecto) }))
        .filter((o) => o.value);
      this.campanias.set(opciones);

      const nro = texto(this.usuario()?.documentoIdentidad);
      const cfg = nro ? await this.catalogosRepo.configuracionRepo.getByField('nrodocumento', nro) : undefined;
      const configurada = texto(cfg?.idProyecto);
      const mayor = opciones.map((o) => o.value).sort((a, b) => a.localeCompare(b, 'es', { numeric: true })).pop() ?? '';
      this.campaniaId.set(opciones.some((o) => o.value === configurada) ? configurada : mayor);
    } catch (error) {
      console.error('Error obteniendo campañas', error);
      this.feedback.error('No se pudo obtener el listado de campañas.');
    }
  }

  async cambiarCampania(opcion: SearchSelectOption | null): Promise<void> {
    this.campaniaId.set(opcion?.value ?? '');
    if (this.campaniaId()) await this.cargarFiltros();
  }

  /** Trae las opciones de los filtros de la campaña, selecciona todo y consulta el reporte. */
  private async cargarFiltros(): Promise<void> {
    const idProyecto = this.campaniaId();
    if (!idProyecto) {
      this.feedback.warning('No se encontró una campaña para consultar.', 'Configuración requerida');
      return;
    }
    this.loading.show('Cargando filtros...');
    try {
      const sobre = await this.reportesApi.reporteSemanalFiltros(idProyecto);
      if (sobre.error || !sobre.data) {
        this.vaciar();
        this.feedback.error(sobre.mensaje ?? 'No se pudo obtener los filtros del reporte semanal.');
        return;
      }
      const filtros = sobre.data as ReporteSemanalFiltros;
      const hayAlgo = (Object.keys(this.vacias()) as ListaFiltro[]).some((k) => (filtros[k] ?? []).length > 0);
      if (!hayAlgo) {
        this.vaciar();
        this.feedback.warning('No se encontró información actual para la campaña.', 'Sin datos');
        return;
      }
      await this.aplicarOpciones(filtros);
    } catch (error) {
      console.error('Error obteniendo filtros del reporte semanal', error);
      this.feedback.error('No se pudo obtener los filtros del reporte semanal.');
      return;
    } finally {
      this.loading.hide();
    }
    await this.consultar();
  }

  /**
   * El SP devuelve codigos sin nombre para variedad, destino y consignatario: se cruzan con los catalogos guardados en el equipo
   * (variedad por codigo, destino por id, consignatario por documento), igual que la aplicacion anterior.
   */
  private async aplicarOpciones(filtros: ReporteSemanalFiltros): Promise<void> {
    const [variedades, destinos, consignatarios] = await Promise.all([
      this.catalogosRepo.variedadesRepo.getAll(),
      this.catalogosRepo.destinosRepo.getAll(),
      this.catalogosRepo.consignatariosRepo.getAll(),
    ]);
    const variedadPorCodigo = new Map(variedades.map((v) => [texto(v.codigo), texto(v.variedad)]));
    const destinoPorId = new Map(destinos.map((d) => [texto(d.id), texto(d.pais)]));
    const consignatarioPorDoc = new Map(consignatarios.map((c) => [texto(c.documento), texto(c.nombre)]));

    const mapear = (lista: ReporteSemanalOpcion[] | undefined, nombres?: Map<string, string>): SearchSelectOption[] =>
      (lista ?? [])
        .map((o) => {
          const id = texto(o.id);
          return { value: id, label: texto(o.nombre) || nombres?.get(id) || id };
        })
        .filter((o) => o.value);

    const opciones: Record<ListaFiltro, SearchSelectOption[]> = {
      semanas: mapear(filtros.semanas),
      variedades: mapear(filtros.variedades, variedadPorCodigo),
      formatos: mapear(filtros.formatos),
      destinos: mapear(filtros.destinos, destinoPorId),
      clientes: mapear(filtros.clientes),
      consignatarios: mapear(filtros.consignatarios, consignatarioPorDoc),
    };
    this.opciones.set(opciones);
    // Todo seleccionado por defecto.
    this.seleccion.set({
      semanas: opciones.semanas.map((o) => o.value),
      variedades: opciones.variedades.map((o) => o.value),
      formatos: opciones.formatos.map((o) => o.value),
      destinos: opciones.destinos.map((o) => o.value),
      clientes: opciones.clientes.map((o) => o.value),
      consignatarios: opciones.consignatarios.map((o) => o.value),
    });
  }

  private vaciar(): void {
    this.opciones.set(this.vacias());
    this.seleccion.set(this.vaciasSeleccion());
    this.datos.set(null);
  }

  // ───────── Consulta ─────────

  private validarSeleccion(): boolean {
    const etiquetas: Record<ListaFiltro, string> = {
      semanas: 'Semana',
      variedades: 'Variedad',
      formatos: 'Formato',
      destinos: 'Destinos',
      clientes: 'Clientes',
      consignatarios: 'Consignatarios',
    };
    const faltantes = (Object.keys(etiquetas) as ListaFiltro[]).filter((k) => this.seleccion()[k].length === 0).map((k) => etiquetas[k]);
    if (!this.campaniaId()) faltantes.unshift('Campaña');
    if (faltantes.length === 0) return true;
    this.feedback.warning(`Selecciona al menos una opción en: ${faltantes.join(', ')}.`, 'Filtros incompletos');
    return false;
  }

  async consultar(): Promise<void> {
    if (!this.online() || !this.validarSeleccion()) return;
    this.isLoading.set(true);
    this.loading.show('Consultando reporte...');
    try {
      // Si estan todas las opciones elegidas se envia lista vacia ("todos"), como la aplicacion anterior.
      const lista = (k: ListaFiltro): string[] => (this.seleccion()[k].length === this.opciones()[k].length ? [] : this.seleccion()[k]);
      const sobre = await this.reportesApi.reporteSemanal({
        idProyecto: this.campaniaId(),
        semanas: lista('semanas'),
        variedades: lista('variedades'),
        formatos: lista('formatos'),
        destinos: lista('destinos'),
        clientes: lista('clientes'),
        consignatarios: lista('consignatarios'),
      });
      if (sobre.error || !sobre.data) {
        this.datos.set(null);
        this.feedback.error(sobre.mensaje ?? 'No se pudo obtener los datos del reporte semanal.');
        return;
      }
      if (this.estaVacio(sobre.data)) {
        this.datos.set(null);
        this.feedback.warning('No se encontró información para los filtros seleccionados.', 'Sin datos');
        return;
      }
      this.datos.set(await this.completarNombres(sobre.data));
    } catch (error) {
      console.error('Error obteniendo datos del reporte semanal', error);
      this.datos.set(null);
      this.feedback.error('No se pudo obtener los datos del reporte semanal.');
    } finally {
      this.loading.hide();
      this.isLoading.set(false);
    }
  }

  async aplicarFiltros(): Promise<void> {
    this.filtrosAvanzados.set(false);
    await this.consultar();
  }

  async actualizar(): Promise<void> {
    await this.cargarFiltros();
  }

  private estaVacio(d: ReporteSemanalData): boolean {
    const sinFilas = !d.pesoPorDiaSemana?.length && !d.pesoPorTipoProcesoEmpaque?.length && !d.detalleVariedad?.length && !d.driscollsVsPublicas?.length;
    return sinFilas && numero(d.kpis?.totalCajas) === 0 && numero(d.kpis?.totalPesoKg) === 0;
  }

  /** El detalle por variedad llega solo con el codigo: se completa el nombre desde los catalogos del equipo. */
  private async completarNombres(d: ReporteSemanalData): Promise<ReporteSemanalData> {
    const variedades = await this.catalogosRepo.variedadesRepo.getAll();
    const porCodigo = new Map(variedades.map((v) => [texto(v.codigo), texto(v.variedad)]));
    return {
      ...d,
      detalleVariedad: (d.detalleVariedad ?? []).map((v) => ({
        ...v,
        variedad: texto(v.variedad) || porCodigo.get(texto(v.variedadId)) || texto(v.variedadId),
      })),
    };
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
      const nombre = `reporte-semanal-${nowPeruDate()}.png`;
      if (esDispositivoMovil()) abrirOCompartirArchivo(blob, nombre);
      else descargarArchivo(blob, nombre);
    } catch (error) {
      console.error('Error al capturar el dashboard', error);
      this.feedback.error('No se pudo capturar el dashboard.');
    } finally {
      await this.loading.hideAfterMinimum();
      this.isLoading.set(false);
    }
  }

  // ───────── Graficos (Highcharts) ─────────

  private renderCharts(d: ReporteSemanalData): void {
    this.chartDia?.destroy();
    this.chartTipo?.destroy();
    this.chartSegmento?.destroy();
    const dia = this.chartDiaRef()?.nativeElement;
    const tipo = this.chartTipoRef()?.nativeElement;
    const segmento = this.chartSegmentoRef()?.nativeElement;
    if (dia) {
      this.chartDia = this.columnas(dia, (d.pesoPorDiaSemana ?? []).map((i) => ({ nombre: texto(i.dia) || 'Sin día', valor: numero(i.pesoKg) })), COLORES_DIA);
    }
    if (tipo) {
      this.chartTipo = this.columnas(tipo, (d.pesoPorTipoProcesoEmpaque ?? []).map((i) => ({ nombre: texto(i.tipo) || 'Sin tipo', valor: numero(i.pesoKg) })), COLORES_TIPO);
    }
    if (segmento) {
      this.chartSegmento = this.dona(segmento, (d.driscollsVsPublicas ?? []).map((i) => ({ nombre: texto(i.tipo) || 'Sin tipo', kg: numero(i.pesoKg), porcentaje: numero(i.porcentaje) })));
    }
  }

  /** Barras con el peso sobre cada una (pastilla blanca), un color por barra. */
  private columnas(el: HTMLElement, items: { nombre: string; valor: number }[], colores: string[]): Highcharts.Chart {
    return Highcharts.chart(el, {
      chart: { type: 'column', style: { fontFamily: 'inherit' } },
      title: { text: undefined },
      credits: { enabled: false },
      legend: { enabled: false },
      xAxis: { categories: items.map((i) => i.nombre), labels: { style: { fontSize: '11px' } } },
      yAxis: { title: { text: 'KG' }, min: 0, maxPadding: 0.12 },
      plotOptions: {
        column: {
          borderRadius: 4,
          colorByPoint: true,
          colors: colores,
          dataLabels: {
            enabled: true,
            useHTML: true,
            allowOverlap: true,
            style: { textOutline: 'none' },
            formatter: function (this: Highcharts.Point) { return pastilla(`${formatearKg(this.y ?? 0)} kg`); },
          },
        },
      },
      tooltip: {
        outside: true,
        style: { zIndex: 9999 },
        formatter: function (this: any) { return `<b>${this.key}</b><br/>${formatearKg(this.y)} kg`; },
      },
      series: [{ type: 'column', name: 'Peso (kg)', data: items.map((i) => i.valor) }],
    });
  }

  private dona(el: HTMLElement, items: { nombre: string; kg: number; porcentaje: number }[]): Highcharts.Chart {
    return Highcharts.chart(el, {
      chart: { type: 'pie', style: { fontFamily: 'inherit' } },
      title: { text: undefined },
      credits: { enabled: false },
      tooltip: {
        outside: true,
        style: { zIndex: 9999 },
        pointFormatter: function (this: Highcharts.Point) { return `${formatearKg(Number((this.options as any).kg ?? 0))} kg (${this.y}%)`; },
      },
      plotOptions: {
        pie: {
          innerSize: '50%',
          borderWidth: 0,
          showInLegend: true,
          dataLabels: { enabled: true, format: '{point.y}%', distance: -28, style: { fontSize: '12px', color: '#ffffff', textOutline: '2px rgba(0,0,0,.55)' } },
        },
      },
      legend: { verticalAlign: 'bottom', itemStyle: { fontSize: '11px' } },
      series: [{ type: 'pie', name: 'Porcentaje', data: items.map((i, idx) => ({ name: i.nombre, y: i.porcentaje, kg: i.kg, color: COLORES_SEGMENTO[idx % COLORES_SEGMENTO.length] })) }],
    });
  }
}
