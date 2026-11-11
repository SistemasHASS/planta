import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { LucideBoxes, LucidePencilLine, LucideRefreshCcw } from '@lucide/angular';
import { PaginatorComponent } from '../../../../shared/components/paginator/paginator.component';
import { ConnectivityService } from '../../../../shared/services/connectivity.service';
import { JornadasAnotadorApiService } from '../../../../shared/services/jornadas-anotador-api.service';
import { LoadingService } from '../../../../shared/services/loading.service';
import { crearPaginacion } from '../../../../shared/utils/paginacion';
import { CorregirProduccionModalComponent } from '../corregir-produccion-modal/corregir-produccion-modal.component';
import { Fila, esActivo, texto } from '../../jornada.utils';

interface Tarjeta {
  clave: string;
  cajas: number;
  kg: number;
  empacadores: number;
  formato: string;
  /** Tipo de empaque — categoría — calibre, como se ve en el resto de la pantalla. */
  detalle: string;
}

interface EmpacadorFila {
  dni: string;
  nombre: string;
  linea: string;
  puesto: string;
  recogidas: number;
  cajas: number;
  kg: number;
  /** Alguna de sus anotaciones fue corregida desde esta pantalla o el historial. */
  corregida: boolean;
}

const numero = (v: unknown): number => Number(v) || 0;

/** Un ítem es formato + tipo de empaque + categoría + calibre. */
const claveItem = (f: Fila): string => [f['formatoId'], f['tipoEmpaqueId'], texto(f['categoriaNombre']), texto(f['calibreNombre'])].join('|');

/**
 * Pestaña "Producción": lo que registró el anotador en el proceso de la jornada (el SP trae solo lo suyo). Se filtra por formato y tipo de empaque (tarjetas) y por empacador (buscador).
 * Desde el lápiz de un empacador se corrigen sus anotaciones (una por vuelta); la base no deja bajar cajas que ya están en un palet.
 */
@Component({
  selector: 'app-produccion-dia',
  imports: [CorregirProduccionModalComponent, PaginatorComponent, LucideBoxes, LucidePencilLine, LucideRefreshCcw],
  templateUrl: './produccion-dia.component.html',
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProduccionDiaComponent implements OnInit {
  private readonly api = inject(JornadasAnotadorApiService);
  private readonly connectivity = inject(ConnectivityService);
  private readonly loading = inject(LoadingService);

  protected readonly filas = signal<Fila[]>([]);
  protected readonly cargando = signal(true);
  protected readonly error = signal('');

  /** Tarjeta elegida ('' = todos los formatos) y texto del buscador. */
  protected readonly clave = signal('');
  protected readonly busqueda = signal('');

  /** DNI del empacador cuyas anotaciones se están corrigiendo. */
  protected readonly editando = signal<string | null>(null);

  protected readonly fmt = (n: number): string => n.toFixed(2);

  /** Tarjetas por ítem: formato, tipo de empaque, categoría y calibre . */
  protected readonly tarjetas = computed<Tarjeta[]>(() => {
    const mapa = new Map<string, Tarjeta & { dnis: Set<string> }>();
    for (const f of this.filas()) {
      const clave = claveItem(f);
      const detalle = [f['tipoEmpaqueDescripcion'], f['categoriaNombre'], f['calibreNombre']].map(texto).filter(Boolean).join(' — ');
      const t = mapa.get(clave) ?? { clave, cajas: 0, kg: 0, empacadores: 0, formato: texto(f['formatoDescripcion']), detalle, dnis: new Set<string>() };
      t.cajas += numero(f['cantidadCajas']);
      t.kg += numero(f['pesoTotal']);
      t.dnis.add(texto(f['numeroDocumento']));
      t.empacadores = t.dnis.size;
      mapa.set(clave, t);
    }
    return [...mapa.values()].sort((a, b) => a.formato.localeCompare(b.formato) || a.detalle.localeCompare(b.detalle));
  });

  protected readonly totalTarjeta = computed(() => {
    const dnis = new Set(this.filas().map((f) => texto(f['numeroDocumento'])));
    return {
      cajas: this.filas().reduce((s, f) => s + numero(f['cantidadCajas']), 0),
      kg: this.filas().reduce((s, f) => s + numero(f['pesoTotal']), 0),
      empacadores: dnis.size,
    };
  });

  /** La tarjeta elegida sigue valiendo solo si existe. */
  protected readonly claveActiva = computed(() => (this.tarjetas().some((t) => t.clave === this.clave()) ? this.clave() : ''));

  /** Tabla: un renglón por empacador con lo que se ve según tarjeta y buscador. */
  protected readonly empacadores = computed<EmpacadorFila[]>(() => {
    const clave = this.claveActiva();
    const q = this.busqueda().trim().toLowerCase();
    const mapa = new Map<string, EmpacadorFila & { ultimo: number }>();
    for (const f of this.filas()) {
      if (clave && claveItem(f) !== clave) continue;
      const dni = texto(f['numeroDocumento']);
      const e = mapa.get(dni) ?? { dni, nombre: texto(f['nombreCompleto']), linea: '', puesto: '', recogidas: 0, cajas: 0, kg: 0, corregida: false, ultimo: 0 };
      e.recogidas += 1;
      e.corregida ||= esActivo(f['corregida']);
      e.cajas += numero(f['cantidadCajas']);
      e.kg += numero(f['pesoTotal']);
      // Línea y puesto de la anotación más reciente.
      if (numero(f['id']) >= e.ultimo) {
        e.ultimo = numero(f['id']);
        e.linea = texto(f['lineaNombre']);
        e.puesto = f['puesto'] == null ? '—' : String(f['puesto']);
      }
      mapa.set(dni, e);
    }
    return [...mapa.values()]
      .filter((e) => !q || `${e.nombre} ${e.dni}`.toLowerCase().includes(q))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  });

  protected readonly paginacion = crearPaginacion(() => this.empacadores(), 10);

  /** Elegir otra tarjeta o buscar cambia la lista: se vuelve a la primera página. */
  protected elegirTarjeta(clave: string): void {
    this.clave.set(clave);
    this.paginacion.page.set(1);
  }

  protected buscar(valor: string): void {
    this.busqueda.set(valor);
    this.paginacion.page.set(1);
  }

  /** Anotaciones del empacador que se está corrigiendo por vuelta. */
  protected readonly filasEditando = computed(() => {
    const dni = this.editando();
    if (!dni) return [];
    return this.filas()
      .filter((f) => texto(f['numeroDocumento']) === dni)
      .sort((a, b) => numero(a['numeroRecoleccion']) - numero(b['numeroRecoleccion']) || numero(a['id']) - numero(b['id']));
  });

  ngOnInit(): Promise<void> {
    return this.cargar();
  }

  protected async cargar(): Promise<void> {
    if (!this.connectivity.online()) {
      this.error.set('No hay conexión a internet.');
      this.cargando.set(false);
      return;
    }
    this.cargando.set(true);
    this.error.set('');
    try {
      const r = await this.api.produccionDia();
      if (r.error) throw new Error(r.mensaje || 'No se pudo consultar la producción.');
      this.filas.set(r.data ?? []);
      // Si el empacador que se corregía ya no tiene anotaciones, se cierra la ventana.
      if (this.editando() && this.filasEditando().length === 0) this.editando.set(null);
    } catch (e) {
      this.error.set(e instanceof Error && e.message ? e.message : 'No se pudo consultar la producción.');
    } finally {
      this.cargando.set(false);
    }
  }

  /** Botón Actualizar: misma consulta, con el modal de loading. */
  protected async actualizar(): Promise<void> {
    if (this.cargando()) return;
    this.loading.show('Actualizando producción...');
    try {
      await this.cargar();
    } finally {
      await this.loading.hideAfterMinimum();
    }
  }
}
