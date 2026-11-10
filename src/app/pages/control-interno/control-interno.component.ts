import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideFileSpreadsheet, LucideInbox, LucideSearch, LucideWifiOff } from '@lucide/angular';
import { SearchMultiSelectComponent } from '../../shared/components/search-multi-select/search-multi-select.component';
import { SearchSelectOption } from '../../shared/components/search-select/search-select.component';
import { PaginatorComponent } from '../../shared/components/paginator/paginator.component';
import { CatalogosRepository } from '../../shared/dexiedb/repository/catalogos.repository';
import { Configuracion } from '../../shared/interfaces/administracion.interface';
import { AdministracionApiService } from '../../shared/services/administracion-api.service';
import { AuthService } from '../../shared/services/auth.service';
import { CatalogosApiService } from '../../shared/services/catalogos-api.service';
import { ConnectivityService } from '../../shared/services/connectivity.service';
import { FeedbackModalService } from '../../shared/services/feedback-modal.service';
import { LoadingService } from '../../shared/services/loading.service';
import { abrirOCompartirArchivo, descargarArchivo, esDispositivoMovil } from '../../shared/utils/archivo';
import { nowPeruDate } from '../../shared/utils/date-time.util';
import { crearPaginacion } from '../../shared/utils/paginacion';

const texto = (valor: unknown): string => String(valor ?? '').trim();
const numero = (valor: unknown): number => {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
};

/** Un producto (formato + tipo de empaque + categoría) que sale como columna: sus cajas y los kilos de pago. */
interface Columna {
  clave: string;
  formato: string;
  tipoEmpaque: string;
  /** Categoría y calibre en una sola línea. */
  categoriaCalibre: string;
  /** Tiene cajas en el periodo pero la matriz de compatibilidad no lo tiene. */
  fueraDeMatriz: boolean;
}

/** Una jornada de un empacador. */
interface Fila {
  clave: string;
  fecha: string;
  acopio: string;
  anotadores: string;
  dni: string;
  empacador: string;
  cajas: Record<string, number>;
  kilos: Record<string, number>;
  total: number;
  totalKilos: number;
}

interface Planta {
  codigo: string;
  nombre: string;
}

/**
 * Excel de control interno (solo administrador, solo en línea y solo con el parámetro Flujo_Empaque activo): el total de cajas y los kilos de pago
 * de cada empacador en el periodo, por jornada y por producto. Sale solo quien tuvo movimiento. La vista previa se arma aquí con lo que responde el
 * servidor y el Excel lo arma la API con los mismos filtros.
 */
@Component({
  selector: 'app-control-interno',
  imports: [DecimalPipe, FormsModule, PaginatorComponent, SearchMultiSelectComponent, LucideFileSpreadsheet, LucideInbox, LucideSearch, LucideWifiOff],
  templateUrl: './control-interno.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ControlInternoComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly catalogos = inject(CatalogosRepository);
  private readonly catalogosApi = inject(CatalogosApiService);
  private readonly api = inject(AdministracionApiService);
  private readonly connectivity = inject(ConnectivityService);
  private readonly loading = inject(LoadingService);
  private readonly feedback = inject(FeedbackModalService);

  readonly online = computed(() => this.connectivity.online());
  readonly desde = signal(nowPeruDate());
  readonly hasta = signal(nowPeruDate());
  /** Códigos de las plantas elegidas (vacío = todas las plantas). */
  readonly plantasElegidas = signal<string[]>([]);
  readonly plantas = signal<Planta[]>([]);
  readonly plantasOpciones = computed<SearchSelectOption[]>(() => this.plantas().map((p) => ({ value: p.codigo, label: p.nombre ? `${p.codigo} — ${p.nombre}` : p.codigo })));

  readonly columnas = signal<Columna[]>([]);
  readonly filas = signal<Fila[]>([]);
  /** Ya se consultó al menos una vez (para distinguir "no se consultó" de "no hubo movimiento"). */
  readonly consultado = signal(false);
  /** El parámetro Flujo_Empaque no está activo: la pantalla solo avisa. */
  readonly sinFlujo = signal(false);

  readonly paginacion = crearPaginacion(() => this.filas(), 50);

  readonly empacadores = computed(() => new Set(this.filas().map((f) => f.dni)).size);
  readonly totalCajas = computed(() => this.filas().reduce((s, f) => s + f.total, 0));
  readonly totalKilos = computed(() => this.filas().reduce((s, f) => s + f.totalKilos, 0));
  /** Totales por producto (todas las filas, no solo la página que se ve). */
  readonly sumas = computed(() => {
    const cajas: Record<string, number> = {};
    const kilos: Record<string, number> = {};
    for (const f of this.filas()) {
      for (const c of this.columnas()) {
        cajas[c.clave] = (cajas[c.clave] ?? 0) + (f.cajas[c.clave] ?? 0);
        kilos[c.clave] = (kilos[c.clave] ?? 0) + (f.kilos[c.clave] ?? 0);
      }
    }
    return { cajas, kilos };
  });
  readonly hayFueraDeMatriz = computed(() => this.columnas().some((c) => c.fueraDeMatriz));

  async ngOnInit(): Promise<void> {
    await this.cargarPlantas();
  }

  /** Las plantas (acopios) de la campaña elegida en Parámetros. */
  private async cargarPlantas(): Promise<void> {
    try {
      const session = await this.auth.getSession();
      const nro = texto(session?.user?.documentoIdentidad);
      const cfg: Configuracion | null = nro ? ((await this.catalogos.configuracionRepo.getByField('nrodocumento', nro)) ?? null) : null;
      const idProyecto = texto(cfg?.idProyecto);
      if (!idProyecto || !this.online()) return;
      const sobre = await this.catalogosApi.acopios(idProyecto);
      const filas = !sobre?.error && Array.isArray(sobre?.data) ? sobre.data : [];
      this.plantas.set(filas.map((f) => ({ codigo: texto(f['codigoAcopio']), nombre: texto(f['acopioNombre']) })).filter((p) => p.codigo));
    } catch {
      this.plantas.set([]);
    }
  }

  /** AAAA-MM-DD → DD/MM/AAAA */
  fecha(valor: string): string {
    const t = texto(valor).slice(0, 10).split('-');
    return t.length === 3 ? `${t[2]}/${t[1]}/${t[0]}` : texto(valor);
  }

  /** Revisa las fechas; devuelve el mensaje si algo está mal. */
  private problemaConRango(): string | null {
    if (!this.desde() || !this.hasta()) return 'Indica la fecha de inicio y la de fin.';
    if (this.desde() > this.hasta()) return 'La fecha de inicio no puede ser posterior a la de fin.';
    return null;
  }

  private cuerpo() {
    // Todas elegidas o ninguna = todas las plantas (se manda vacío); si no, los códigos separados por coma.
    const elegidas = this.plantasElegidas();
    const todas = elegidas.length === 0 || elegidas.length === this.plantas().length;
    return { fechaDesde: this.desde(), fechaHasta: this.hasta(), codigoAcopio: todas ? '' : elegidas.join(',') };
  }

  async consultar(): Promise<void> {
    const problema = this.problemaConRango();
    if (problema) {
      this.feedback.warning(problema, 'Excel de control interno');
      return;
    }
    if (!this.online()) {
      this.feedback.warning('Necesitas internet para consultar el control interno.', 'Sin conexión');
      return;
    }

    this.loading.show('Consultando control interno...');
    try {
      const sobre = await this.api.controlInterno(this.cuerpo());
      if (sobre?.error) {
        this.columnas.set([]);
        this.filas.set([]);
        const mensaje = texto(sobre.mensaje);
        if (/flujo de empaque/i.test(mensaje)) this.sinFlujo.set(true);
        else this.feedback.error(mensaje || 'No se pudo consultar el control interno.');
        return;
      }
      this.sinFlujo.set(false);
      const data = sobre?.data ?? { columnas: [], detalle: [] };

      const columnas = (Array.isArray(data.columnas) ? data.columnas : []).map<Columna>((c) => ({
        clave: texto(c['clave']),
        formato: texto(c['formato']),
        tipoEmpaque: texto(c['tipoEmpaque']),
        categoriaCalibre: [texto(c['categoria']), texto(c['calibre'])].filter(Boolean).join(' · '),
        fueraDeMatriz: !!c['fueraDeMatriz'],
      }));

      // Una fila por jornada + empacador; lo único que puede tener varios valores es el anotador.
      const porClave = new Map<string, Fila & { anotadoresSet: Set<string> }>();
      for (const d of Array.isArray(data.detalle) ? data.detalle : []) {
        const clave = `${d['idJornada']}|${texto(d['dni'])}`;
        let fila = porClave.get(clave);
        if (!fila) {
          fila = { clave, fecha: texto(d['fecha']), acopio: texto(d['codigoAcopio']), anotadores: '', anotadoresSet: new Set(), dni: texto(d['dni']), empacador: texto(d['empacador']), cajas: {}, kilos: {}, total: 0, totalKilos: 0 };
          porClave.set(clave, fila);
        }
        fila.anotadoresSet.add(texto(d['anotador']) || '(sin anotador)');
        const producto = `${d['formatoId']}-${d['tipoEmpaqueId']}-${d['categoriaId']}`;
        const cajas = numero(d['cajas']);
        const kilos = numero(d['kilos']);
        fila.cajas[producto] = (fila.cajas[producto] ?? 0) + cajas;
        fila.kilos[producto] = (fila.kilos[producto] ?? 0) + kilos;
        fila.total += cajas;
        fila.totalKilos += kilos;
      }

      const filas = [...porClave.values()].map<Fila>(({ anotadoresSet, ...fila }) => ({
        ...fila,
        anotadores: [...anotadoresSet].sort((a, b) => a.localeCompare(b, 'es')).join(', '),
        totalKilos: Math.round(fila.totalKilos * 100) / 100,
      }));
      filas.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.acopio.localeCompare(b.acopio, 'es') || a.empacador.localeCompare(b.empacador, 'es'));

      this.columnas.set(columnas);
      this.filas.set(filas);
      this.consultado.set(true);
      this.paginacion.page.set(1);
    } catch {
      this.columnas.set([]);
      this.filas.set([]);
      this.feedback.error('Error de conexión: no se pudo consultar el control interno.', 'Sin conexión');
    } finally {
      await this.loading.hideAfterMinimum();
    }
  }

  /** Excel que arma la API con los mismos filtros. */
  async exportarExcel(): Promise<void> {
    const problema = this.problemaConRango();
    if (problema) {
      this.feedback.warning(problema, 'Excel de control interno');
      return;
    }
    if (!this.online()) {
      this.feedback.warning('Necesitas internet para exportar el Excel.', 'Sin conexión');
      return;
    }

    this.loading.show('Generando Excel...');
    try {
      const blob = await this.api.exportarControlInterno(this.cuerpo());
      await this.loading.hideAfterMinimum();
      const nombre = `control_interno_${this.desde().replace(/-/g, '')}_${this.hasta().replace(/-/g, '')}${this.cuerpo().codigoAcopio ? `_${this.cuerpo().codigoAcopio.replace(/,/g, '-')}` : ''}.xlsx`;

      if (esDispositivoMovil()) {
        // Android / iOS: el archivo llegó después de esperar a la API, así que solo se puede abrir desde un toque de la persona.
        this.feedback.open('success', {
          title: 'Excel listo',
          message: 'El Excel de control interno está listo. Toque "Abrir Excel" para verlo o compartirlo.',
          actionText: 'Cerrar',
          secondaryAction: { text: 'Abrir Excel', handler: () => abrirOCompartirArchivo(blob, nombre) },
        });
      } else {
        descargarArchivo(blob, nombre);
      }
    } catch (error: unknown) {
      await this.loading.hideAfterMinimum();
      const mensaje = await this.mensajeDeError(error, 'Error al exportar el Excel.');
      if (/flujo de empaque/i.test(mensaje)) this.sinFlujo.set(true);
      else this.feedback.warning(mensaje, 'Excel de control interno');
    }
  }

  /** Mensaje del servidor ({ message }) aunque la respuesta llegue como Blob. */
  private async mensajeDeError(error: unknown, defecto: string): Promise<string> {
    const cuerpo = (error as { error?: unknown } | null)?.error;
    if (cuerpo instanceof Blob) {
      try {
        return JSON.parse(await cuerpo.text())?.message ?? defecto;
      } catch {
        return defecto;
      }
    }
    return (cuerpo as { message?: string } | null)?.message ?? defecto;
  }
}
