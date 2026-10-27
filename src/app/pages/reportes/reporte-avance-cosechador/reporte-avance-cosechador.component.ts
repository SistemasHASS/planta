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
import { LucideCamera, LucideDownload, LucideRefreshCcw, LucideWifiOff } from '@lucide/angular';
import { SearchMultiSelectComponent } from '../../../shared/components/search-multi-select/search-multi-select.component';
import { SearchSelectComponent, SearchSelectOption } from '../../../shared/components/search-select/search-select.component';
import { Campania } from '../../../shared/interfaces/catalogo.interface';
import { ConnectivityService } from '../../../shared/services/connectivity.service';
import { FeedbackModalService } from '../../../shared/services/feedback-modal.service';
import { LoadingService } from '../../../shared/services/loading.service';
import { ThemeService } from '../../../shared/services/theme.service';
import {
  AvanceCosechadorDia,
  AvanceCosechadorFila,
  EmpresaMaestro,
  ReporteAvanceCosechadorData,
  ReporteAvanceCosechadorFiltrosData,
  ReporteAvanceCosechadorPeticion,
  ReportesApiService,
} from '../../../shared/services/reportes-api.service';
import { PaginatorComponent } from '../../../shared/components/paginator/paginator.component';
import { crearPaginacion } from '../../../shared/utils/paginacion';
import { nowPeruDate } from '../../../shared/utils/date-time.util';
import { abrirOCompartirArchivo, descargarArchivo, esDispositivoMovil } from '../../../shared/utils/archivo';
import { aplicarTemaGraficos, colorFondoCaptura, colorGrillaGrafico } from '../../../shared/utils/highcharts-tema';

/** Empresa que se selecciona por defecto (Berry Harvest S.A.). */
const RUC_POR_DEFECTO = '20610773274';

const texto = (v: unknown): string => String(v ?? '').trim();
const numero = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const formatear = (v: number): string => new Intl.NumberFormat('es-PE', { maximumFractionDigits: 0 }).format(v);
const COLOR_BLANCA = '#64748b';
const COLOR_VERDE = '#22c55e';
const COLOR_DESCARTE = '#2563eb';

/**
 * Avance por cosechador (Administrador / Monitor): jarra blanca, jarra verde y descarte por cosechador y por dia.
 * La empresa sale del maestro externo (get_empresas) y su RUC va al SP; no se toma del token.
 * Pantalla solo online: no guarda nada en Dexie.
 */
@Component({
  selector: 'app-reporte-avance-cosechador',
  imports: [DecimalPipe, FormsModule, PaginatorComponent, SearchMultiSelectComponent, SearchSelectComponent, LucideCamera, LucideDownload, LucideRefreshCcw, LucideWifiOff],
  templateUrl: './reporte-avance-cosechador.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReporteAvanceCosechadorComponent implements OnInit, OnDestroy {
  private readonly tema = inject(ThemeService);
  private readonly connectivity = inject(ConnectivityService);
  private readonly reportesApi = inject(ReportesApiService);
  private readonly loading = inject(LoadingService);
  private readonly feedback = inject(FeedbackModalService);

  readonly online = this.connectivity.online;
  readonly isLoading = signal(false);
  readonly errorMensaje = signal<string | null>(null);

  readonly empresas = signal<EmpresaMaestro[]>([]);
  readonly empresaRuc = signal('');
  readonly campanias = signal<Campania[]>([]);
  readonly campaniaId = signal('');
  readonly fechaDesde = signal(nowPeruDate());
  readonly fechaHasta = signal(nowPeruDate());
  readonly busqueda = signal('');
  readonly grupoOpciones = signal<SearchSelectOption[]>([]);
  readonly cosechadorOpciones = signal<SearchSelectOption[]>([]);
  readonly gruposSeleccionados = signal<string[]>([]);
  readonly cosechadoresSeleccionados = signal<string[]>([]);
  /** Evita que una respuesta vieja de filtros pise a una mas reciente. */
  private versionFiltros = 0;
  readonly reporteData = signal<ReporteAvanceCosechadorData | null>(null);
  /** Filtros con los que se obtuvo el reporte mostrado: el Excel usa estos, no lo que se haya cambiado despues en el formulario. */
  private ultimaPeticion: ReporteAvanceCosechadorPeticion | null = null;

  readonly empresaOpciones = computed<SearchSelectOption[]>(() => {
    const vistos = new Set<string>();
    const opciones: SearchSelectOption[] = [];
    for (const e of this.empresas()) {
      const ruc = texto(e.ruc);
      if (!ruc || vistos.has(ruc)) continue;
      vistos.add(ruc);
      opciones.push({ value: ruc, label: `${texto(e.razonsocial) || texto(e.companyowner) || ruc} (${ruc})` });
    }
    return opciones;
  });
  readonly campaniaOpciones = computed<SearchSelectOption[]>(() =>
    this.campanias().map((c) => ({ value: texto(c.idproyecto), label: `${texto(c.idproyecto)} - ${texto(c.descripcion)}` })),
  );

  readonly kpis = computed(() => this.reporteData()?.kpis ?? null);
  readonly porDia = computed<AvanceCosechadorDia[]>(() => this.reporteData()?.porDia ?? []);
  readonly cosechadores = computed<AvanceCosechadorFila[]>(() => {
    const filas = this.reporteData()?.cosechadores ?? [];
    const q = this.busqueda().trim().toLowerCase();
    return q ? filas.filter((f) => `${f.dni} ${f.nombreCompleto}`.toLowerCase().includes(q)) : filas;
  });
  readonly paginacion = crearPaginacion(() => this.cosechadores(), 15);
  readonly totales = computed(() =>
    this.cosechadores().reduce(
      (t, f) => ({
        blanca: t.blanca + numero(f.jarraBlanca),
        verde: t.verde + numero(f.jarraVerde),
        descarte: t.descarte + numero(f.descarte),
        total: t.total + numero(f.total),
      }),
      { blanca: 0, verde: 0, descarte: 0, total: 0 },
    ),
  );

  private readonly reportPageRef = viewChild<ElementRef<HTMLElement>>('reportPage');
  private readonly chartDiaRef = viewChild<ElementRef<HTMLDivElement>>('chartDia');
  private chartDia: Highcharts.Chart | null = null;

  constructor() {
    effect(() => {
      const dias = this.porDia();
      aplicarTemaGraficos(this.tema.esOscuro()); // al cambiar de tema se vuelve a dibujar
      this.renderChart(dias);
    });
  }

  async ngOnInit(): Promise<void> {
    if (!this.online()) return;
    this.loading.show('Cargando empresas...');
    try {
      const empresas = await this.reportesApi.empresas();
      this.empresas.set(empresas);
      const existe = empresas.some((e) => texto(e.ruc) === RUC_POR_DEFECTO);
      this.empresaRuc.set(existe ? RUC_POR_DEFECTO : texto(empresas[0]?.ruc));
      await this.cargarCampanias();
    } catch (error: any) {
      console.error('Error cargando empresas', error);
      this.errorMensaje.set(error?.error?.mensaje ?? error?.error?.message ?? 'No se pudieron cargar las empresas.');
    } finally {
      this.loading.hide();
    }
  }

  ngOnDestroy(): void {
    this.chartDia?.destroy();
  }

  async cambiarEmpresa(opcion: SearchSelectOption | null): Promise<void> {
    this.empresaRuc.set(opcion?.value ?? '');
    this.reporteData.set(null);
    this.loading.show('Cargando campañas...');
    try {
      await this.cargarCampanias();
    } finally {
      this.loading.hide();
    }
  }

  async cambiarCampania(opcion: SearchSelectOption | null): Promise<void> {
    this.campaniaId.set(opcion?.value ?? '');
    await this.cargarFiltros();
  }

  async cambiarFechaDesde(valor: string): Promise<void> {
    this.fechaDesde.set(valor);
    await this.cargarFiltros();
  }

  async cambiarFechaHasta(valor: string): Promise<void> {
    this.fechaHasta.set(valor);
    await this.cargarFiltros();
  }

  /** Al elegir grupos, los cosechadores disponibles se limitan a esos grupos. */
  async cambiarGrupos(valores: string[]): Promise<void> {
    this.gruposSeleccionados.set(valores);
    await this.cargarFiltros(true);
  }

  /**
   * Trae los grupos y cosechadores con avance en el rango de fechas de la empresa y campaña elegidas.
   * `soloCosechadores`: se eligieron grupos, asi que solo se actualizan los cosechadores.
   */
  private async cargarFiltros(soloCosechadores = false): Promise<void> {
    const version = ++this.versionFiltros;
    const ruc = this.empresaRuc();
    const idProyecto = this.campaniaId();
    const desde = this.fechaDesde();
    const hasta = this.fechaHasta() || desde;
    if (!this.online() || !ruc || !idProyecto || !desde || hasta < desde) {
      this.grupoOpciones.set([]);
      this.cosechadorOpciones.set([]);
      this.gruposSeleccionados.set([]);
      this.cosechadoresSeleccionados.set([]);
      return;
    }
    try {
      const sobre = await this.reportesApi.reporteAvanceCosechadorFiltros({
        ruc,
        idProyecto,
        fechaDesde: desde,
        fechaHasta: hasta,
        grupos: soloCosechadores ? this.gruposSeleccionados() : [],
      });
      if (version !== this.versionFiltros) return;
      const data = sobre.data as ReporteAvanceCosechadorFiltrosData | null;
      if (sobre.error || !data || Array.isArray(data)) {
        this.errorMensaje.set(sobre.mensaje ?? 'No se pudieron cargar los filtros.');
        return;
      }
      if (!soloCosechadores) {
        const grupos = (data.grupos ?? []).map((g) => texto(g.grupo)).filter(Boolean);
        this.grupoOpciones.set(grupos.map((g) => ({ value: g, label: g })));
        this.gruposSeleccionados.set(this.gruposSeleccionados().filter((g) => grupos.includes(g)));
      }
      const cosechadores = (data.cosechadores ?? []).map((c) => ({ value: texto(c.dni), label: `${texto(c.nombreCompleto)} (${texto(c.dni)})` }));
      this.cosechadorOpciones.set(cosechadores);
      this.cosechadoresSeleccionados.set(this.cosechadoresSeleccionados().filter((d) => cosechadores.some((c) => c.value === d)));
    } catch (error: any) {
      if (version !== this.versionFiltros) return;
      console.error('Error obteniendo los filtros', error);
      this.errorMensaje.set(error?.error?.mensaje ?? error?.error?.message ?? 'No se pudieron cargar los filtros.');
    }
  }

  /** Campañas de la empresa elegida; si solo hay una se selecciona sola. */
  private async cargarCampanias(): Promise<void> {
    this.campaniaId.set('');
    this.campanias.set([]);
    this.grupoOpciones.set([]);
    this.cosechadorOpciones.set([]);
    this.gruposSeleccionados.set([]);
    this.cosechadoresSeleccionados.set([]);
    const ruc = this.empresaRuc();
    if (!ruc) return;
    try {
      const lista = await this.reportesApi.avanceCosechadorCampanias(ruc);
      this.campanias.set(lista);
      const ids = lista.map((c) => texto(c.idproyecto)).filter(Boolean);
      if (ids.length === 1) this.campaniaId.set(ids[0]);
      await this.cargarFiltros();
    } catch (error: any) {
      console.error('Error obteniendo campañas', error);
      this.errorMensaje.set(error?.error?.mensaje ?? error?.error?.message ?? 'No se pudieron cargar las campañas.');
    }
  }

  async consultar(): Promise<void> {
    if (!this.online()) return;
    if (!this.empresaRuc()) {
      this.feedback.warning('Selecciona una empresa.', 'Validación');
      return;
    }
    if (!this.campaniaId()) {
      this.feedback.warning('Selecciona una campaña.', 'Validación');
      return;
    }
    if (!this.fechaDesde() || (this.fechaHasta() && this.fechaHasta() < this.fechaDesde())) {
      this.feedback.warning('El rango de fechas no es válido.', 'Validación');
      return;
    }
    this.isLoading.set(true);
    this.errorMensaje.set(null);
    this.loading.show('Consultando reporte...');
    try {
      const peticion: ReporteAvanceCosechadorPeticion = {
        ruc: this.empresaRuc(),
        idProyecto: this.campaniaId(),
        fechaDesde: this.fechaDesde(),
        fechaHasta: this.fechaHasta() || this.fechaDesde(),
        grupos: this.gruposSeleccionados(),
        dniCosechadores: this.cosechadoresSeleccionados(),
      };
      const sobre = await this.reportesApi.reporteAvanceCosechador(peticion);
      const data = sobre.data as ReporteAvanceCosechadorData | null;
      if (sobre.error || !data || Array.isArray(data)) {
        this.reporteData.set(null);
        this.errorMensaje.set(sobre.mensaje ?? 'No se pudo obtener el reporte.');
        return;
      }
      this.ultimaPeticion = peticion;
      this.paginacion.page.set(1);
      this.reporteData.set(data);
    } catch (error: any) {
      console.error('Error obteniendo el avance por cosechador', error);
      this.reporteData.set(null);
      this.errorMensaje.set(error?.error?.mensaje ?? error?.error?.message ?? 'Error de conexión al obtener el reporte.');
    } finally {
      this.loading.hide();
      this.isLoading.set(false);
    }
  }

  // ───────── Captura y Excel ─────────

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
      const nombre = `avance-cosechador-${this.fechaDesde()}_${this.fechaHasta() || this.fechaDesde()}.png`;
      if (esDispositivoMovil()) abrirOCompartirArchivo(blob, nombre);
      else descargarArchivo(blob, nombre);
    } catch (error) {
      console.error('Error al capturar el avance por cosechador', error);
      this.feedback.error('No se pudo capturar el dashboard.');
    } finally {
      await this.loading.hideAfterMinimum();
      this.isLoading.set(false);
    }
  }

  /** Excel que arma la API con los mismos filtros del reporte mostrado. */
  async exportarExcel(): Promise<void> {
    const peticion = this.ultimaPeticion;
    if (!peticion || !this.reporteData()) {
      this.feedback.warning('Consulta el reporte antes de exportar el Excel.', 'Validación');
      return;
    }
    if (!this.online()) {
      this.feedback.warning('Necesitas internet para exportar el Excel.', 'Sin conexión');
      return;
    }
    this.loading.show('Generando Excel...');
    try {
      const blob = await this.reportesApi.exportarAvanceCosechadorExcel(peticion);
      await this.loading.hideAfterMinimum();
      const nombre = `avance-cosechador-${peticion.fechaDesde}_${peticion.fechaHasta}.xlsx`;
      if (esDispositivoMovil()) {
        // Android / iOS: el archivo llego despues de esperar a la API, asi que solo se puede abrir desde un toque de la persona.
        this.feedback.open('success', {
          title: 'Excel listo',
          message: 'El Excel de avance por cosechador está listo. Toque "Abrir Excel" para verlo o compartirlo.',
          actionText: 'Cerrar',
          secondaryAction: { text: 'Abrir Excel', handler: () => abrirOCompartirArchivo(blob, nombre) },
        });
      } else {
        descargarArchivo(blob, nombre);
      }
    } catch (error: unknown) {
      console.error('Error exportando Excel:', error);
      await this.loading.hideAfterMinimum();
      this.feedback.warning(await this.mensajeDeError(error, 'Error al exportar el Excel.'), 'Información');
    }
  }

  /** Mensaje del servidor aunque la respuesta llegue como Blob. */
  private async mensajeDeError(error: unknown, defecto: string): Promise<string> {
    const cuerpo = (error as { error?: unknown } | null)?.error;
    if (cuerpo instanceof Blob) {
      try {
        const json = JSON.parse(await cuerpo.text());
        return json?.mensaje ?? json?.message ?? defecto;
      } catch {
        return defecto;
      }
    }
    const c = cuerpo as { mensaje?: string; message?: string } | null;
    return c?.mensaje ?? c?.message ?? defecto;
  }

  cambiarBusqueda(valor: string): void {
    this.busqueda.set(valor);
    this.paginacion.page.set(1);
  }

  /** Porcentaje de una cantidad sobre el total de jarras. */
  porcentaje(valor: number): number {
    const total = numero(this.kpis()?.total);
    return total > 0 ? (numero(valor) * 100) / total : 0;
  }

  // ───────── Grafico (Highcharts) ─────────

  /** Una columna por tipo (jarra blanca, jarra verde y descarte) en cada dia. */
  private renderChart(dias: AvanceCosechadorDia[]): void {
    const el = this.chartDiaRef()?.nativeElement;
    this.chartDia?.destroy();
    this.chartDia = null;
    if (!el || dias.length === 0) return;

    this.chartDia = Highcharts.chart(el, {
      chart: { type: 'column', style: { fontFamily: 'inherit' } },
      title: { text: undefined },
      credits: { enabled: false },
      xAxis: { categories: dias.map((d) => texto(d.fecha)), gridLineWidth: 1, gridLineColor: colorGrillaGrafico(), labels: { style: { fontSize: '11px' } } },
      yAxis: {
        title: { text: 'Jarras' },
        labels: { formatter: function (this: any) { return formatear(this.value); }, style: { fontSize: '11px' } },
      },
      legend: { enabled: true, verticalAlign: 'bottom', itemStyle: { fontSize: '11px', fontWeight: '400' } },
      plotOptions: {
        column: {
          borderWidth: 0,
          borderRadius: 2,
          groupPadding: 0.15,
          pointPadding: 0.05,
          dataLabels: { enabled: true, style: { fontSize: '11px', fontWeight: '700', textOutline: 'none' }, formatter: function (this: any) { return formatear(this.y); } },
        },
      },
      tooltip: {
        shared: true,
        outside: true,
        style: { zIndex: 9999 },
        formatter: function (this: any) {
          const filas = (this.points ?? []).map((p: any) => `<span style="color:${p.color}">●</span> ${p.series.name}: <b>${formatear(p.y)}</b>`);
          return `<b>${this.points?.[0]?.point?.category ?? this.x}</b><br/>${filas.join('<br/>')}`;
        },
      },
      series: [
        { type: 'column', name: 'Jarra blanca', color: COLOR_BLANCA, data: dias.map((d) => numero(d.jarraBlanca)) },
        { type: 'column', name: 'Jarra verde', color: COLOR_VERDE, data: dias.map((d) => numero(d.jarraVerde)) },
        { type: 'column', name: 'Descarte', color: COLOR_DESCARTE, data: dias.map((d) => numero(d.descarte)) },
      ],
    });
  }
}
