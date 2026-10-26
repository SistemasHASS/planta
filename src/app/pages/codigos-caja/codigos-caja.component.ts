import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideFileSpreadsheet, LucideInbox, LucidePackage, LucideRefreshCcw, LucideSearch, LucideWifiOff, LucideX } from '@lucide/angular';
import { PaginatorComponent } from '../../shared/components/paginator/paginator.component';
import { SearchSelectComponent, SearchSelectOption } from '../../shared/components/search-select/search-select.component';
import { CatalogosRepository } from '../../shared/dexiedb/repository/catalogos.repository';
import { AdministracionApiService } from '../../shared/services/administracion-api.service';
import { ConnectivityService } from '../../shared/services/connectivity.service';
import { FeedbackModalService } from '../../shared/services/feedback-modal.service';
import { AlertaService } from '../../shared/services/alerta.service';
import { AuthService } from '../../shared/services/auth.service';
import { LoadingService } from '../../shared/services/loading.service';
import { abrirOCompartirArchivo, descargarArchivo, esDispositivoMovil } from '../../shared/utils/archivo';
import { crearPaginacion } from '../../shared/utils/paginacion';
import { CodigoCaja, DatoCodigo } from './codigos-caja.interface';

type Fila = Record<string, unknown>;

const texto = (valor: unknown): string => String(valor ?? '').trim();

/** Código y nombre de un dato de la fila (por ejemplo documentoConsignatario + nombreConsignatario). Un código 0 es "sin dato". */
const dato = (fila: Fila, codigo: string, nombre: string): DatoCodigo => {
  const valor = texto(fila[codigo]);
  return { codigo: valor === '0' ? '' : valor, nombre: texto(fila[nombre]) };
};

/** Lo que se muestra de un dato: su nombre o, si no se encontró, el código. */
const mostrar = (d: DatoCodigo): string => d.nombre || d.codigo;

/**
 * Reporte "Códigos caja" (solo administrador, solo en línea): todas las combinaciones de PLANTA_CodigosCaja de la empresa con
 * el nombre de cada dato y la descripción completa, igual que el detalle de la guía. Solo consulta; no guarda nada en el equipo.
 */
@Component({
  selector: 'app-codigos-caja',
  imports: [FormsModule, NgTemplateOutlet, PaginatorComponent, SearchSelectComponent, LucideFileSpreadsheet, LucideInbox, LucidePackage, LucideRefreshCcw, LucideSearch, LucideWifiOff, LucideX],
  templateUrl: './codigos-caja.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CodigosCajaComponent implements OnInit {
  private readonly administracionApi = inject(AdministracionApiService);
  private readonly connectivity = inject(ConnectivityService);
  private readonly loading = inject(LoadingService);
  private readonly feedback = inject(FeedbackModalService);
  private readonly alertService = inject(AlertaService);
  private readonly auth = inject(AuthService);
  private readonly catalogosRepo = inject(CatalogosRepository);

  readonly online = computed(() => this.connectivity.online());

  readonly codigos = signal<CodigoCaja[]>([]);
  readonly filtroTexto = signal('');
  /** Cultivo elegido (codigoCultivo). Al abrir la pantalla es el de Parámetros. */
  readonly filtroCultivo = signal('');
  readonly filtroConsignatario = signal('');

  readonly cultivoOpciones = computed<SearchSelectOption[]>(() => [
    { value: '', label: 'Todos los cultivos' },
    ...this.unicos(this.codigos().map((c) => ({ value: c.codigoCultivo, label: c.fruta || c.codigoCultivo }))),
  ]);

  readonly consignatarioOpciones = computed<SearchSelectOption[]>(() => [
    { value: '', label: 'Todos los consignatarios' },
    ...this.unicos(this.codigos().map((c) => ({ value: c.consignatario.codigo, label: mostrar(c.consignatario) }))),
  ]);

  /** Combinaciones que cumplen el cultivo, el consignatario y lo escrito (busca en todas las columnas). */
  readonly codigosFiltrados = computed(() => {
    const buscado = this.filtroTexto().trim().toLowerCase();
    const cultivo = this.filtroCultivo();
    const consignatario = this.filtroConsignatario();
    return this.codigos().filter((c) => {
      if (cultivo && c.codigoCultivo !== cultivo) return false;
      if (consignatario && c.consignatario.codigo !== consignatario) return false;
      return !buscado || c.busqueda.includes(buscado);
    });
  });
  readonly paginacion = crearPaginacion(() => this.codigosFiltrados(), 25);

  /** Para la plantilla: nombre del dato o su código. */
  readonly mostrar = mostrar;

  async ngOnInit(): Promise<void> {
    // Por defecto se filtra por el cultivo que la persona eligió en Parámetros (puede cambiarlo o ver todos).
    const cultivo = await this.cultivoDeParametros();
    await this.cargar();
    if (cultivo) this.filtroCultivo.set(cultivo);
  }

  /** codigoCultivo guardado en Parámetros por el usuario (vacío si no hay configuración). */
  private async cultivoDeParametros(): Promise<string> {
    try {
      const documento = texto((await this.auth.getSession())?.user.documentoIdentidad);
      if (!documento) return '';
      const configuracion = await this.catalogosRepo.configuracionRepo.getByField('nrodocumento', documento);
      return texto(configuracion?.codigoCultivo);
    } catch {
      return '';
    }
  }

  /** Pide al servidor las combinaciones y las muestra (no guarda nada en el equipo). */
  async cargar(): Promise<void> {
    if (!this.online()) {
      this.codigos.set([]);
      this.feedback.error('Error de conexión: necesitas internet para ver los códigos caja.', 'Sin conexión');
      return;
    }

    this.loading.show('Cargando códigos caja...');
    try {
      const sobre = await this.administracionApi.codigosCaja();
      if (sobre?.error) {
        this.codigos.set([]);
        this.feedback.error(sobre.mensaje || 'No se pudieron obtener los códigos caja.');
        return;
      }
      const filas = Array.isArray(sobre?.data) ? (sobre.data as Fila[]) : [];
      this.codigos.set(filas.map((fila) => this.aCodigo(fila)));
      this.paginacion.page.set(1);
    } catch {
      this.codigos.set([]);
      this.feedback.error('Error de conexión: no se pudieron obtener los códigos caja.', 'Sin conexión');
    } finally {
      await this.loading.hideAfterMinimum();
    }
  }

  /**
   * Excel que arma la API con lo que se ve en la tabla: se envían los id de todas las filas filtradas (todas las páginas).
   * La API vuelve a leer los datos con la empresa del token y solo deja esas filas.
   */
  async exportarExcel(): Promise<void> {
    const ids = this.codigosFiltrados().map((c) => c.id);
    if (ids.length === 0) {
      this.alertService.showAlert('Información', 'No hay códigos caja para exportar.', 'warning');
      return;
    }
    if (!this.online()) {
      this.feedback.warning('Necesitas internet para exportar el Excel.', 'Sin conexión');
      return;
    }

    this.loading.show('Generando Excel...');
    try {
      const blob = await this.administracionApi.exportarCodigosCaja(ids);
      await this.loading.hideAfterMinimum();
      const nombre = `codigos-caja-${new Date().toISOString().slice(0, 10)}.xlsx`;

      if (esDispositivoMovil()) {
        // Android / iOS: el archivo llegó después de esperar a la API, así que solo se puede abrir desde un toque de la persona.
        this.feedback.open('success', {
          title: 'Excel listo',
          message: 'El Excel de códigos caja está listo. Toque "Abrir Excel" para verlo o compartirlo.',
          actionText: 'Cerrar',
          secondaryAction: { text: 'Abrir Excel', handler: () => abrirOCompartirArchivo(blob, nombre) },
        });
      } else {
        descargarArchivo(blob, nombre);
      }
    } catch (error: unknown) {
      console.error('Error exportando Excel:', error);
      await this.loading.hideAfterMinimum();
      const mensaje = await this.mensajeDeError(error, 'Error al exportar el Excel.');
      this.alertService.showAlert('Información', mensaje, 'warning');
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

  cambiarTexto(valor: string): void {
    this.filtroTexto.set(valor);
    this.paginacion.page.set(1);
  }

  cambiarCultivo(valor: unknown): void {
    this.filtroCultivo.set(texto(valor));
    this.paginacion.page.set(1);
  }

  cambiarConsignatario(valor: unknown): void {
    this.filtroConsignatario.set(texto(valor));
    this.paginacion.page.set(1);
  }

  private aCodigo(fila: Fila): CodigoCaja {
    const codigo: Omit<CodigoCaja, 'busqueda'> = {
      id: Number(fila['id'] ?? 0),
      codigoItem: texto(fila['codigoItem']),
      fruta: texto(fila['fruta']),
      codigoCultivo: texto(fila['codigoCultivo']),
      consignatario: dato(fila, 'documentoConsignatario', 'nombreConsignatario'),
      destino: dato(fila, 'idDestino', 'nombreDestino'),
      presentacion: dato(fila, 'idPresentacion', 'nombrePresentacion'),
      formato: dato(fila, 'codigoFormato', 'nombreFormato'),
      variedad: dato(fila, 'codigoVariedad', 'nombreVariedad'),
      pesoPorCaja: texto(fila['pesoPorCaja']),
      tipoEmpaqueGuia: dato(fila, 'idTipoEmpaqueGuia', 'nombreTipoEmpaqueGuia'),
      rancho: dato(fila, 'idCodigoRancho', 'codigoRancho'),
      lugarProduccion: dato(fila, 'codigoLugarProduccion', 'nombreLugarProduccion'),
      transporte: dato(fila, 'idTransporte', 'nombreTransporte'),
      descripcion: texto(fila['descripcion']),
    };
    const datos = [codigo.consignatario, codigo.destino, codigo.presentacion, codigo.formato, codigo.variedad, codigo.tipoEmpaqueGuia, codigo.rancho, codigo.lugarProduccion, codigo.transporte];
    const busqueda = [codigo.codigoItem, codigo.fruta, codigo.pesoPorCaja, codigo.descripcion, ...datos.flatMap((d) => [d.codigo, d.nombre])]
      .join(' ')
      .toLowerCase();
    return { ...codigo, busqueda };
  }

  /** Opciones sin repetir, ordenadas por su texto. */
  private unicos(opciones: SearchSelectOption[]): SearchSelectOption[] {
    const vistos = new Map<string, SearchSelectOption>();
    for (const opcion of opciones) {
      const valor = texto(opcion.value);
      if (valor && !vistos.has(valor)) vistos.set(valor, { value: valor, label: opcion.label });
    }
    return [...vistos.values()].sort((a, b) => String(a.label).localeCompare(String(b.label), 'es'));
  }
}
