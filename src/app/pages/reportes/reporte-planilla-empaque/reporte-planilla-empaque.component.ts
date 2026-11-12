import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideFileSpreadsheet, LucideInbox, LucideSearch, LucideWifiOff } from '@lucide/angular';
import { SearchMultiSelectComponent } from '../../../shared/components/search-multi-select/search-multi-select.component';
import { SearchSelectOption } from '../../../shared/components/search-select/search-select.component';
import { CatalogosRepository } from '../../../shared/dexiedb/repository/catalogos.repository';
import { Configuracion } from '../../../shared/interfaces/administracion.interface';
import { ROLES } from '../../../shared/guards/role.guard';
import { AuthService } from '../../../shared/services/auth.service';
import { CatalogosApiService } from '../../../shared/services/catalogos-api.service';
import { ConnectivityService } from '../../../shared/services/connectivity.service';
import { FeedbackModalService } from '../../../shared/services/feedback-modal.service';
import { LoadingService } from '../../../shared/services/loading.service';
import { ReportesApiService } from '../../../shared/services/reportes-api.service';
import { abrirOCompartirArchivo, descargarArchivo, esDispositivoMovil } from '../../../shared/utils/archivo';
import { nowPeruDate } from '../../../shared/utils/date-time.util';

const texto = (valor: unknown): string => String(valor ?? '').trim();
const numero = (valor: unknown): number => {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
};

type TipoPlanilla = 'produccion' | 'tareo';

interface Planta {
  codigo: string;
  nombre: string;
}

/** Un proceso del rango de fechas (idProceso + planta). */
interface ProcesoPlanilla {
  clave: string;
  idProceso: string;
  codigoAcopio: string;
  acopioNombre: string;
  fecha: string;
  turno: string;
  estado: string;
  totalCajas: number;
  totalEmpacadores: number;
  totalAnotadores: number;
  supervisores: string;
}

interface AnotadorPlanilla {
  idUsuarioAnotador: string;
  nombre: string;
  dni: string;
}

/**
 * Planillas de empaque (administrador y monitor, solo en línea y solo con el parámetro Flujo_Empaque activo): se busca por fecha, se elige el proceso
 * y se genera el Excel de Producción (cajas por recolección) o el de Tareo / asistencia con el formato de la empresa. Si se elige un anotador sale
 * solo lo que él registró; si no, hay una hoja por cada anotador. El Excel lo arma la API.
 */
@Component({
  selector: 'app-reporte-planilla-empaque',
  imports: [DecimalPipe, FormsModule, SearchMultiSelectComponent, LucideFileSpreadsheet, LucideInbox, LucideSearch, LucideWifiOff],
  templateUrl: './reporte-planilla-empaque.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportePlanillaEmpaqueComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly catalogos = inject(CatalogosRepository);
  private readonly catalogosApi = inject(CatalogosApiService);
  private readonly api = inject(ReportesApiService);
  private readonly connectivity = inject(ConnectivityService);
  private readonly loading = inject(LoadingService);
  private readonly feedback = inject(FeedbackModalService);

  readonly online = computed(() => this.connectivity.online());
  /** El anotador ve los procesos de su acopio, abiertos y cerrados; administrador y monitor, solo los cerrados de las plantas que elijan. */
  readonly esAnotador = signal(false);
  readonly desde = signal(nowPeruDate());
  readonly hasta = signal(nowPeruDate());
  /** Códigos de las plantas elegidas (vacío = todas las plantas). */
  readonly plantasElegidas = signal<string[]>([]);
  readonly plantas = signal<Planta[]>([]);
  readonly plantasOpciones = computed<SearchSelectOption[]>(() => this.plantas().map((p) => ({ value: p.codigo, label: p.nombre ? `${p.codigo} — ${p.nombre}` : p.codigo })));

  readonly procesos = signal<ProcesoPlanilla[]>([]);
  /** Ya se buscó al menos una vez (para distinguir "no se buscó" de "no hay procesos"). */
  readonly consultado = signal(false);
  /** El parámetro Flujo_Empaque no está activo: la pantalla solo avisa. */
  readonly sinFlujo = signal(false);

  readonly procesoElegido = signal<ProcesoPlanilla | null>(null);
  readonly anotadores = signal<AnotadorPlanilla[]>([]);
  readonly anotadoresOpciones = computed<SearchSelectOption[]>(() => this.anotadores().map((a) => ({ value: a.idUsuarioAnotador, label: a.dni ? `${a.nombre} — ${a.dni}` : a.nombre })));
  /** idUsuarioAnotador de los elegidos; vacío = todos los anotadores del proceso. */
  readonly anotadoresElegidos = signal<string[]>([]);
  readonly generando = signal<TipoPlanilla | null>(null);

  async ngOnInit(): Promise<void> {
    await this.cargarPlantas();
  }

  /** Las plantas (acopios) de la campaña elegida en Parámetros. */
  private async cargarPlantas(): Promise<void> {
    try {
      const session = await this.auth.getSession();
      if (texto(session?.user?.idRol).toUpperCase() === ROLES.anotador) {
        this.esAnotador.set(true);
        return;
      }
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
  fechaCorta(valor: string): string {
    const t = texto(valor).slice(0, 10).split('-');
    return t.length === 3 ? `${t[2]}/${t[1]}/${t[0]}` : texto(valor);
  }

  async buscar(): Promise<void> {
    if (!this.desde() || !this.hasta()) {
      this.feedback.warning('Indica la fecha de inicio y la de fin.', 'Tareo y Cajas Empaque');
      return;
    }
    if (this.desde() > this.hasta()) {
      this.feedback.warning('La fecha de inicio no puede ser posterior a la de fin.', 'Tareo y Cajas Empaque');
      return;
    }
    if (!this.online()) {
      this.feedback.warning('Necesitas internet para consultar los procesos.', 'Sin conexión');
      return;
    }

    // Todas elegidas o ninguna = todas las plantas (se manda vacío); si no, los códigos separados por coma.
    const elegidas = this.plantasElegidas();
    const todas = elegidas.length === 0 || elegidas.length === this.plantas().length;

    this.loading.show('Buscando procesos...');
    try {
      const sobre = await this.api.procesosPlanillaEmpaque({ fechaDesde: this.desde(), fechaHasta: this.hasta(), codigoAcopio: todas ? '' : elegidas.join(',') });
      this.procesoElegido.set(null);
      this.anotadores.set([]);
      this.anotadoresElegidos.set([]);
      if (sobre?.error) {
        this.procesos.set([]);
        const mensaje = texto(sobre.mensaje);
        if (/flujo de empaque/i.test(mensaje)) this.sinFlujo.set(true);
        else this.feedback.error(mensaje || 'No se pudieron consultar los procesos.');
        return;
      }
      this.sinFlujo.set(false);

      const filas = Array.isArray(sobre?.data) ? sobre.data : [];
      this.procesos.set(
        filas.map<ProcesoPlanilla>((f) => ({
          clave: `${texto(f['codigoAcopio'])}|${texto(f['idProceso'])}`,
          idProceso: texto(f['idProceso']),
          codigoAcopio: texto(f['codigoAcopio']),
          acopioNombre: texto(f['acopioNombre']),
          fecha: texto(f['fechaProceso']),
          turno: texto(f['turno']),
          estado: texto(f['estado']),
          totalCajas: numero(f['totalCajas']),
          totalEmpacadores: numero(f['totalEmpacadores']),
          totalAnotadores: numero(f['totalAnotadores']),
          supervisores: texto(f['supervisores']),
        })),
      );
      this.consultado.set(true);
    } catch {
      this.procesos.set([]);
      this.feedback.error('Error de conexión: no se pudieron consultar los procesos.', 'Sin conexión');
    } finally {
      await this.loading.hideAfterMinimum();
    }
  }

  /** Elige el proceso y trae sus anotadores para poder sacar la planilla de uno solo. */
  async elegirProceso(proceso: ProcesoPlanilla): Promise<void> {
    if (this.procesoElegido()?.clave === proceso.clave) return;
    this.procesoElegido.set(proceso);
    this.anotadores.set([]);
    this.anotadoresElegidos.set([]);
    try {
      const sobre = await this.api.anotadoresPlanillaEmpaque({ codigoAcopio: proceso.codigoAcopio, idProceso: proceso.idProceso });
      // Si mientras tanto se eligió otro proceso, esta respuesta ya no sirve.
      if (this.procesoElegido()?.clave !== proceso.clave) return;
      if (sobre?.error) {
        this.feedback.warning(texto(sobre.mensaje) || 'No se pudieron consultar los anotadores.', 'Tareo y Cajas Empaque');
        return;
      }
      const filas = Array.isArray(sobre?.data) ? sobre.data : [];
      this.anotadores.set(
        filas.map<AnotadorPlanilla>((f) => ({ idUsuarioAnotador: texto(f['idUsuarioAnotador']), nombre: texto(f['nombre']), dni: texto(f['dni']) })).filter((a) => a.idUsuarioAnotador),
      );
    } catch {
      if (this.procesoElegido()?.clave === proceso.clave) this.feedback.error('Error de conexión: no se pudieron consultar los anotadores.', 'Sin conexión');
    }
  }

  /** Todos elegidos o ninguno = todos los anotadores (se manda vacío); si no, los usuarios separados por coma. */
  private cuerpoAnotadores(): string {
    const elegidos = this.anotadoresElegidos();
    return elegidos.length === 0 || elegidos.length === this.anotadores().length ? '' : elegidos.join(',');
  }

  /** produccion_empaque_11-11-2026_DIA_H1106[_APELLIDO].xlsx (el mismo nombre que arma la API). */
  private nombreArchivo(tipo: TipoPlanilla, proceso: ProcesoPlanilla): string {
    // El apellido solo va si se eligió un único anotador.
    const elegidos = this.anotadoresElegidos();
    const anotador = elegidos.length === 1 ? this.anotadores().find((a) => a.idUsuarioAnotador === elegidos[0]) : undefined;
    const apellido = anotador ? (texto(anotador.nombre).split(/\s+/)[0] || 'SIN ANOTADOR').toUpperCase() : '';
    const partes = [tipo === 'produccion' ? 'produccion_empaque' : 'tareo', this.fechaCorta(proceso.fecha).replace(/\//g, '-'), proceso.turno || 'DIA', proceso.codigoAcopio, apellido];
    return `${partes.filter(Boolean).map((p) => p.replace(/[^A-Za-z0-9_-]+/g, '')).join('_')}.xlsx`;
  }

  /** Excel que arma la API con el formato de la empresa. */
  async generar(tipo: TipoPlanilla): Promise<void> {
    const proceso = this.procesoElegido();
    if (!proceso) {
      this.feedback.warning('Elige un proceso.', 'Tareo y Cajas Empaque');
      return;
    }
    if (!this.online()) {
      this.feedback.warning('Necesitas internet para generar el Excel.', 'Sin conexión');
      return;
    }

    const cuerpo = { codigoAcopio: proceso.codigoAcopio, idProceso: proceso.idProceso, idUsuarioAnotador: this.cuerpoAnotadores() };
    this.generando.set(tipo);
    this.loading.show(tipo === 'produccion' ? 'Generando planilla de producción...' : 'Generando tareo...');
    try {
      const blob = tipo === 'produccion' ? await this.api.exportarPlanillaProduccion(cuerpo) : await this.api.exportarPlanillaTareo(cuerpo);
      await this.loading.hideAfterMinimum();
      const nombre = this.nombreArchivo(tipo, proceso);

      if (esDispositivoMovil()) {
        // Android / iOS: el archivo llegó después de esperar a la API, así que solo se puede abrir desde un toque de la persona.
        this.feedback.open('success', {
          title: 'Excel listo',
          message: tipo === 'produccion' ? 'La planilla de producción está lista. Toque "Abrir Excel" para verla o compartirla.' : 'El tareo está listo. Toque "Abrir Excel" para verlo o compartirlo.',
          actionText: 'Cerrar',
          secondaryAction: { text: 'Abrir Excel', handler: () => abrirOCompartirArchivo(blob, nombre) },
        });
      } else {
        descargarArchivo(blob, nombre);
      }
    } catch (error: unknown) {
      await this.loading.hideAfterMinimum();
      const mensaje = await this.mensajeDeError(error, 'Error al generar el Excel.');
      if (/flujo de empaque/i.test(mensaje)) this.sinFlujo.set(true);
      else this.feedback.warning(mensaje, 'Tareo y Cajas Empaque');
    } finally {
      this.generando.set(null);
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
