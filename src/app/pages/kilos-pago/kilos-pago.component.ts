import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideInbox, LucideRefreshCcw, LucideSave, LucideScale, LucideSearch, LucideWifiOff, LucideX } from '@lucide/angular';
import { CatalogosRepository } from '../../shared/dexiedb/repository/catalogos.repository';
import { AdministracionApiService } from '../../shared/services/administracion-api.service';
import { ConnectivityService } from '../../shared/services/connectivity.service';
import { FeedbackModalService } from '../../shared/services/feedback-modal.service';
import { LoadingService } from '../../shared/services/loading.service';

const texto = (valor: unknown): string => String(valor ?? '').trim();
const dos = (n: number): string => n.toFixed(2);

/** Máximo que acepta la base (decimal 10,2 con tope en 99999.99). */
const KILOS_MAXIMO = 99999.99;

interface FilaKilos {
  clave: string;
  formatoId: number;
  tipoEmpaqueId: number;
  formatoCodigo: string;
  formatoDescripcion: string;
  tipoEmpaqueCodigo: string;
  tipoEmpaqueDescripcion: string;
  categoriaId: number;
  categoriaCodigo: string;
  categoriaDescripcion: string;
  /** El código del calibre es su id. */
  calibreId: string;
  /** Nombre del calibre: el de la apimaestra que está en el equipo o, si no está, el guardado. */
  calibreDescripcion: string;
  pesoReal: number;
  /** Kilos de pago guardados (0 si todavía no se configuró). */
  kilosPago: number;
}

/**
 * Kilos de pago por formato, tipo de empaque y categoría (solo administrador, solo en línea y solo con el parámetro Flujo_Empaque activo):
 * los kilos que se le cuentan al empacador por cada caja. El peso real sale del formato; lo que todavía no se configuró se muestra en 0.00.
 * La categoría y el calibre son los del empaque; el nombre del calibre se cruza con los calibres guardados en el equipo y se manda al guardar.
 */
@Component({
  selector: 'app-kilos-pago',
  imports: [FormsModule, LucideInbox, LucideRefreshCcw, LucideSave, LucideScale, LucideSearch, LucideWifiOff, LucideX],
  templateUrl: './kilos-pago.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KilosPagoComponent implements OnInit {
  private readonly api = inject(AdministracionApiService);
  private readonly catalogos = inject(CatalogosRepository);
  private readonly connectivity = inject(ConnectivityService);
  private readonly loading = inject(LoadingService);
  private readonly feedback = inject(FeedbackModalService);

  readonly online = computed(() => this.connectivity.online());
  readonly filas = signal<FilaKilos[]>([]);
  /** Lo que se escribió en cada campo de kilos de pago (clave de la fila → texto). */
  readonly textos = signal<Record<string, string>>({});
  readonly filtroTexto = signal('');
  /** El parámetro Flujo_Empaque no está activo: la pantalla solo avisa. */
  readonly sinFlujo = signal(false);

  readonly filasFiltradas = computed(() => {
    const buscado = this.filtroTexto().trim().toLowerCase();
    if (!buscado) return this.filas();
    return this.filas().filter((f) => [f.formatoDescripcion, f.formatoCodigo, f.tipoEmpaqueDescripcion, f.tipoEmpaqueCodigo, f.categoriaDescripcion, f.categoriaCodigo, f.calibreId, f.calibreDescripcion].some((v) => v.toLowerCase().includes(buscado)));
  });

  /** Filas cuyos kilos de pago se cambiaron respecto a lo guardado. */
  readonly cambiadas = computed(() => this.filas().filter((f) => this.cambio(f)));
  readonly hayCambios = computed(() => this.cambiadas().length > 0);

  async ngOnInit(): Promise<void> {
    await this.cargar();
  }

  dos = dos;

  /** Pide al servidor los kilos de pago y los muestra (no guarda nada en el equipo). */
  async cargar(): Promise<void> {
    if (!this.online()) {
      this.filas.set([]);
      return;
    }

    this.loading.show('Cargando kilos de pago...');
    try {
      const sobre = await this.api.kilosPago();
      if (sobre?.error) {
        this.filas.set([]);
        const mensaje = texto(sobre.mensaje);
        // Sin el flujo de empaque activo no es un error: la pantalla solo avisa.
        if (/flujo de empaque/i.test(mensaje)) this.sinFlujo.set(true);
        else this.feedback.error(mensaje || 'No se pudieron obtener los kilos de pago.');
        return;
      }
      this.sinFlujo.set(false);
      const calibres = await this.nombresDeCalibres();
      const filas = (Array.isArray(sobre?.data) ? sobre.data : []).map<FilaKilos>((f) => ({
        clave: `${f['formatoId']}|${f['tipoEmpaqueId']}|${f['categoriaId']}`,
        formatoId: Number(f['formatoId']),
        tipoEmpaqueId: Number(f['tipoEmpaqueId']),
        formatoCodigo: texto(f['formatoCodigo']),
        formatoDescripcion: texto(f['formatoDescripcion']),
        tipoEmpaqueCodigo: texto(f['tipoEmpaqueCodigo']),
        tipoEmpaqueDescripcion: texto(f['tipoEmpaqueDescripcion']),
        categoriaId: Number(f['categoriaId']),
        categoriaCodigo: texto(f['categoriaCodigo']),
        categoriaDescripcion: texto(f['categoriaDescripcion']),
        calibreId: texto(f['calibreId']),
        calibreDescripcion: calibres.get(texto(f['calibreId'])) || texto(f['calibreDescripcion']),
        pesoReal: Number(f['pesoReal']) || 0,
        kilosPago: Number(f['kilosPago']) || 0,
      }));
      this.filas.set(filas);
      this.textos.set(Object.fromEntries(filas.map((f) => [f.clave, dos(f.kilosPago)])));
    } catch {
      this.filas.set([]);
      this.feedback.error('Error de conexión: no se pudieron cargar los kilos de pago.', 'Sin conexión');
    } finally {
      await this.loading.hideAfterMinimum();
    }
  }

  /** Nombres de los calibres (de la apimaestra) que ya están guardados en el equipo: id → nombre. */
  private async nombresDeCalibres(): Promise<Map<string, string>> {
    try {
      const calibres = await this.catalogos.calibresRepo.getAll();
      return new Map(calibres.map((c) => [texto(c.id), texto(c.calibre)] as [string, string]));
    } catch {
      return new Map();
    }
  }

  textoDe(f: FilaKilos): string {
    return this.textos()[f.clave] ?? '';
  }

  /** Lo que se escribe: solo números con hasta 2 decimales (también al pegar). */
  escribir(f: FilaKilos, campo: HTMLInputElement): void {
    let valor = campo.value.replace(',', '.').replace(/[^\d.]/g, '');
    const punto = valor.indexOf('.');
    if (punto >= 0) valor = valor.slice(0, punto + 1) + valor.slice(punto + 1).replace(/\./g, '').slice(0, 2);
    valor = valor.slice(0, 8);
    if (campo.value !== valor) campo.value = valor;
    this.textos.update((actual) => ({ ...actual, [f.clave]: valor }));
  }

  /** Bloquea al teclear lo que no sirve en un número: la "e", signos y letras (las teclas de control y atajos siguen funcionando). */
  soloNumero(e: KeyboardEvent): void {
    if (e.ctrlKey || e.metaKey || e.altKey || e.key.length > 1) return;
    if (!/^[\d.,]$/.test(e.key)) e.preventDefault();
  }

  /** Al salir del campo se deja con 2 decimales (si quedó vacío o en 0 se vuelve a lo guardado). */
  terminar(f: FilaKilos, campo: HTMLInputElement): void {
    const n = Number(this.textoDe(f));
    const valor = n > 0 ? dos(n) : dos(f.kilosPago);
    campo.value = valor;
    this.textos.update((actual) => ({ ...actual, [f.clave]: valor }));
  }

  cambio(f: FilaKilos): boolean {
    const n = Number(this.textos()[f.clave]);
    return Number.isFinite(n) && Math.round(n * 100) !== Math.round(f.kilosPago * 100);
  }

  /** Deja todos los campos como están guardados. */
  descartar(): void {
    this.textos.set(Object.fromEntries(this.filas().map((f) => [f.clave, dos(f.kilosPago)])));
  }

  async guardar(): Promise<void> {
    if (!this.connectivity.online()) {
      this.feedback.warning('Necesitas internet para guardar los cambios.', 'Sin conexión');
      return;
    }

    const cambiadas = this.cambiadas();
    if (cambiadas.length === 0) return;

    const invalida = cambiadas.find((f) => !(Number(this.textoDe(f)) > 0 && Number(this.textoDe(f)) <= KILOS_MAXIMO));
    if (invalida) {
      this.feedback.warning(`Los kilos de pago de ${invalida.formatoDescripcion} (${invalida.tipoEmpaqueDescripcion}) deben ser mayores que 0 y no pasar de 99999.99.`, 'Kilos de pago');
      return;
    }

    const json = JSON.stringify(cambiadas.map((f) => ({ formatoId: f.formatoId, tipoEmpaqueId: f.tipoEmpaqueId, categoriaId: f.categoriaId, calibreDescripcion: f.calibreDescripcion, kilosPago: Number(this.textoDe(f)) })));

    this.loading.show('Guardando kilos de pago...');
    try {
      const respuesta = await this.api.sincronizarKilosPago(json);
      this.loading.hide();
      if (respuesta?.error) {
        this.feedback.error(respuesta.mensaje || 'No se pudieron guardar los kilos de pago.');
        return;
      }
      this.feedback.success(cambiadas.length === 1 ? 'Se guardó 1 cambio.' : `Se guardaron ${cambiadas.length} cambios.`, 'Kilos de pago');
      await this.cargar();
    } catch {
      this.loading.hide();
      this.feedback.error('Ocurrió un error inesperado al guardar.');
    }
  }
}
