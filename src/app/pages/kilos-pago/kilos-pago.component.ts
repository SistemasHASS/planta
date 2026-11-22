import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideInbox, LucidePlus, LucideRefreshCcw, LucideSave, LucideScale, LucideSearch, LucideTrash2, LucideWifiOff, LucideX } from '@lucide/angular';
import { SearchSelectComponent, SearchSelectOption } from '../../shared/components/search-select/search-select.component';
import { CatalogosRepository } from '../../shared/dexiedb/repository/catalogos.repository';
import { AdministracionApiService } from '../../shared/services/administracion-api.service';
import { AuthService } from '../../shared/services/auth.service';
import { CatalogosApiService } from '../../shared/services/catalogos-api.service';
import { ConnectivityService } from '../../shared/services/connectivity.service';
import { FeedbackModalService } from '../../shared/services/feedback-modal.service';
import { LoadingService } from '../../shared/services/loading.service';
import { esActivo } from '../jornada/jornada.utils';

const texto = (valor: unknown): string => String(valor ?? '').trim();
const dos = (n: number): string => n.toFixed(2);

/** Máximo que acepta la base (decimal 10,2 con tope en 99999.99). */
const KILOS_MAXIMO = 99999.99;

interface FilaKilos {
  clave: string;
  formatoId: number;
  tipoEmpaqueGrupoId: number;
  formatoCodigo: string;
  formatoDescripcion: string;
  tipoEmpaqueGrupoCodigo: string;
  tipoEmpaqueGrupoNombre: string;
  pesoReal: number;
  /** Kilos de pago guardados (0 si todavía no se configuró). */
  kilosPago: number;
  /** false = desactivada: ya no se ofrece al anotador (sus kilos siguen contando en lo ya registrado). */
  activo: boolean;
}

/**
 * Kilos de pago por formato y tipo de empaque (solo administrador, solo en línea y solo con el parámetro Flujo_Empaque activo):
 * los kilos que se le cuentan al empacador por cada caja. El peso real sale del formato; lo que todavía no se configuró se muestra en 0.00.
 */
@Component({
  selector: 'app-kilos-pago',
  imports: [FormsModule, SearchSelectComponent, LucideInbox, LucidePlus, LucideRefreshCcw, LucideSave, LucideScale, LucideSearch, LucideTrash2, LucideWifiOff, LucideX],
  templateUrl: './kilos-pago.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KilosPagoComponent implements OnInit {
  private readonly api = inject(AdministracionApiService);
  private readonly catalogosApi = inject(CatalogosApiService);
  private readonly catalogosLocal = inject(CatalogosRepository);
  private readonly auth = inject(AuthService);
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

  // ---- Activar, desactivar y eliminar (lógico) ----
  /** Combinación que se está por eliminar (pide confirmación). */
  readonly porEliminar = signal<FilaKilos | null>(null);
  readonly cambiandoEstado = signal(false);

  // ---- Nueva combinación (formato + tipo de empaque) ----
  readonly nuevaAbierta = signal(false);
  readonly nuevaCargando = signal(false);
  readonly nuevaGuardando = signal(false);
  readonly formatosOpc = signal<SearchSelectOption[]>([]);
  readonly gruposOpc = signal<SearchSelectOption[]>([]);
  readonly nuevoFormato = signal('');
  readonly nuevoGrupo = signal('');
  readonly nuevoKilos = signal('');
  /** Peso real por caja de cada formato del cultivo (formatoId -> kg), para mostrarlo al elegir el formato. */
  readonly pesosFormato = signal<Record<string, number>>({});
  readonly pesoFormatoElegido = computed(() => this.pesosFormato()[this.nuevoFormato()] ?? null);
  /** La combinación elegida ya está en la lista. */
  readonly nuevaYaExiste = computed(() => {
    const clave = `${this.nuevoFormato()}|${this.nuevoGrupo()}`;
    return !!this.nuevoFormato() && !!this.nuevoGrupo() && this.filas().some((f) => f.clave === clave);
  });
  readonly nuevaLista = computed(() => !!this.nuevoFormato() && !!this.nuevoGrupo() && Number(this.nuevoKilos()) > 0 && !this.nuevaYaExiste());

  readonly filasFiltradas = computed(() => {
    const buscado = this.filtroTexto().trim().toLowerCase();
    if (!buscado) return this.filas();
    return this.filas().filter((f) => [f.formatoDescripcion, f.formatoCodigo, f.tipoEmpaqueGrupoNombre, f.tipoEmpaqueGrupoCodigo].some((v) => v.toLowerCase().includes(buscado)));
  });

  /** Filas cuyos kilos de pago se cambiaron respecto a lo guardado. */
  readonly cambiadas = computed(() => this.filas().filter((f) => this.cambio(f)));
  readonly hayCambios = computed(() => this.cambiadas().length > 0);

  async ngOnInit(): Promise<void> {
    await this.cargar();
  }

  dos = dos;

  /** Abre el formulario de nueva combinación: trae los formatos y los tipos de empaque (agrupadores) activos del cultivo de la campaña elegida. */
  async abrirNueva(): Promise<void> {
    if (!this.online()) {
      this.feedback.warning('Necesitas internet para crear una combinación.', 'Sin conexión');
      return;
    }
    this.nuevoFormato.set('');
    this.nuevoGrupo.set('');
    this.nuevoKilos.set('');
    this.nuevaAbierta.set(true);
    this.nuevaCargando.set(true);
    try {
      const session = await this.auth.getSession();
      const nro = texto(session?.user?.documentoIdentidad);
      const cfg = nro ? await this.catalogosLocal.configuracionRepo.getByField('nrodocumento', nro) : null;
      const cultivo = texto(cfg?.codigoCultivo);
      if (!cultivo) {
        this.nuevaAbierta.set(false);
        this.feedback.warning('Elige tu campaña en Parámetros para saber el cultivo de los formatos.', 'Sin campaña');
        return;
      }
      const [formatos, grupos] = await Promise.all([this.catalogosApi.porCultivo('formatos', cultivo), this.catalogosApi.porCultivo('tiposEmpaqueGrupo', cultivo)]);
      if (formatos.error || grupos.error) {
        this.nuevaAbierta.set(false);
        this.feedback.error(texto(formatos.mensaje) || texto(grupos.mensaje) || 'No se pudieron consultar los formatos y tipos de empaque.');
        return;
      }
      const lista = (v: unknown) => (Array.isArray(v) ? v : []).filter((x) => esActivo(x['activo']));
      this.pesosFormato.set(Object.fromEntries(lista(formatos.data).map((x) => [String(x['id']), Number(x['pesoPorCaja']) || 0])));
      this.formatosOpc.set(lista(formatos.data).map((x) => ({ value: String(x['id']), label: `${texto(x['descripcion'])} (${texto(x['codigo'])})`, searchText: `${texto(x['descripcion'])} ${texto(x['codigo'])}` })));
      this.gruposOpc.set(lista(grupos.data).map((x) => ({ value: String(x['id']), label: `${texto(x['nombre'])} (${texto(x['codigo'])})`, searchText: `${texto(x['nombre'])} ${texto(x['codigo'])}` })));
    } catch {
      this.nuevaAbierta.set(false);
      this.feedback.error('Error de conexión: no se pudieron consultar los formatos y tipos de empaque.', 'Sin conexión');
    } finally {
      this.nuevaCargando.set(false);
    }
  }

  /** Al elegir el formato se muestra su peso real y se propone como kilos de pago (solo si el campo está vacío o conserva el peso del formato anterior). */
  elegirFormato(valor: string): void {
    const anterior = this.pesoFormatoElegido();
    this.nuevoFormato.set(valor);
    const peso = this.pesosFormato()[valor] ?? 0;
    const actual = this.nuevoKilos();
    if (peso > 0 && (actual === '' || (anterior !== null && actual === dos(anterior)))) this.nuevoKilos.set(dos(peso));
  }

  /** Activa o desactiva una combinación: desactivada ya no se ofrece al anotador; los kilos de lo ya registrado siguen contando. */
  async cambiarActivo(f: FilaKilos, activar: boolean): Promise<void> {
    await this.cambiarEstado(f, activar ? 'ACTIVAR' : 'DESACTIVAR', activar ? 'Se activó la combinación.' : 'Se desactivó la combinación.');
  }

  pedirEliminar(f: FilaKilos): void {
    if (this.hayCambios()) {
      this.feedback.warning('Guarda o descarta los cambios de kilos antes de eliminar una combinación.', 'Cambios sin guardar');
      return;
    }
    this.porEliminar.set(f);
  }

  cancelarEliminar(): void {
    if (!this.cambiandoEstado()) this.porEliminar.set(null);
  }

  async confirmarEliminar(): Promise<void> {
    const f = this.porEliminar();
    if (!f) return;
    await this.cambiarEstado(f, 'ELIMINAR', 'Se eliminó la combinación.');
    this.porEliminar.set(null);
  }

  private async cambiarEstado(f: FilaKilos, accion: 'ACTIVAR' | 'DESACTIVAR' | 'ELIMINAR', exito: string): Promise<void> {
    if (this.cambiandoEstado()) return;
    if (!this.connectivity.online()) {
      this.feedback.warning('Necesitas internet para cambiar la combinación.', 'Sin conexión');
      return;
    }
    if (this.hayCambios()) {
      this.feedback.warning('Guarda o descarta los cambios de kilos antes de cambiar el estado de una combinación.', 'Cambios sin guardar');
      await this.cargar();
      return;
    }
    this.cambiandoEstado.set(true);
    this.loading.show('Guardando...');
    try {
      const respuesta = await this.api.sincronizarKilosPago(JSON.stringify([{ formatoId: f.formatoId, tipoEmpaqueGrupoId: f.tipoEmpaqueGrupoId, accion }]));
      this.loading.hide();
      if (respuesta?.error) {
        this.feedback.error(respuesta.mensaje || 'No se pudo cambiar la combinación.');
      } else {
        this.feedback.success(exito, 'Kilos de pago');
      }
      await this.cargar();
    } catch {
      this.loading.hide();
      this.feedback.error('Ocurrió un error inesperado al cambiar la combinación.');
    } finally {
      this.cambiandoEstado.set(false);
    }
  }

  cerrarNueva(): void {
    if (!this.nuevaGuardando()) this.nuevaAbierta.set(false);
  }

  /** Kilos de la nueva combinación: solo números con hasta 2 decimales. */
  escribirNuevo(campo: HTMLInputElement): void {
    let valor = campo.value.replace(',', '.').replace(/[^\d.]/g, '');
    const punto = valor.indexOf('.');
    if (punto >= 0) valor = valor.slice(0, punto + 1) + valor.slice(punto + 1).replace(/\./g, '').slice(0, 2);
    valor = valor.slice(0, 8);
    if (campo.value !== valor) campo.value = valor;
    this.nuevoKilos.set(valor);
  }

  async guardarNueva(): Promise<void> {
    if (!this.nuevaLista() || this.nuevaGuardando()) return;
    const kilos = Number(this.nuevoKilos());
    if (!(kilos > 0 && kilos <= KILOS_MAXIMO)) {
      this.feedback.warning('Los kilos de pago deben ser mayores que 0 y no pasar de 99999.99.', 'Kilos de pago');
      return;
    }
    if (!this.connectivity.online()) {
      this.feedback.warning('Necesitas internet para crear la combinación.', 'Sin conexión');
      return;
    }
    const json = JSON.stringify([{ formatoId: Number(this.nuevoFormato()), tipoEmpaqueGrupoId: Number(this.nuevoGrupo()), kilosPago: kilos, crear: true }]);
    this.nuevaGuardando.set(true);
    try {
      const respuesta = await this.api.sincronizarKilosPago(json);
      if (respuesta?.error) {
        this.feedback.error(respuesta.mensaje || 'No se pudo crear la combinación.');
        return;
      }
      this.nuevaAbierta.set(false);
      this.feedback.success('Se creó la combinación.', 'Kilos de pago');
      await this.cargar();
    } catch {
      this.feedback.error('Ocurrió un error inesperado al crear la combinación.');
    } finally {
      this.nuevaGuardando.set(false);
    }
  }

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
      const filas = (Array.isArray(sobre?.data) ? sobre.data : []).map<FilaKilos>((f) => ({
        clave: `${f['formatoId']}|${f['tipoEmpaqueGrupoId']}`,
        formatoId: Number(f['formatoId']),
        tipoEmpaqueGrupoId: Number(f['tipoEmpaqueGrupoId']),
        formatoCodigo: texto(f['formatoCodigo']),
        formatoDescripcion: texto(f['formatoDescripcion']),
        tipoEmpaqueGrupoCodigo: texto(f['tipoEmpaqueGrupoCodigo']),
        tipoEmpaqueGrupoNombre: texto(f['tipoEmpaqueGrupoNombre']),
        pesoReal: Number(f['pesoReal']) || 0,
        kilosPago: Number(f['kilosPago']) || 0,
        activo: esActivo(f['activo']),
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
      this.feedback.warning(`Los kilos de pago de ${invalida.formatoDescripcion} (${invalida.tipoEmpaqueGrupoNombre}) deben ser mayores que 0 y no pasar de 99999.99.`, 'Kilos de pago');
      return;
    }

    const json = JSON.stringify(cambiadas.map((f) => ({ formatoId: f.formatoId, tipoEmpaqueGrupoId: f.tipoEmpaqueGrupoId, kilosPago: Number(this.textoDe(f)) })));

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
