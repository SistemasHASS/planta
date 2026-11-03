import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from "@angular/core";
import { FormsModule } from "@angular/forms";
import {
  LucideBuilding2,
  LucideCheck,
  LucideChevronRight,
  LucideCpu,
  LucideEye,
  LucideEyeOff,
  LucideInbox,
  LucideMinus,
  LucidePlus,
  LucideRows3,
  LucideSearch,
  LucideX,
} from "@lucide/angular";
import { SearchSelectComponent, SearchSelectOption } from '../../../../shared/components/search-select/search-select.component';
import { AdministracionApiService } from "../../../../shared/services/administracion-api.service";
import { AlertaService } from "../../../../shared/services/alerta.service";
import { ConfirmModalService } from "../../../../shared/services/confirm-modal.service";
import { ConnectivityService } from "../../../../shared/services/connectivity.service";
import { FeedbackModalService } from "../../../../shared/services/feedback-modal.service";
import { LoadingService } from "../../../../shared/services/loading.service";
import { portalToBody } from "../../../../shared/utils/portal";
import { AcopioConfig } from "../../acopios-config.interface";
import { PanelMaquinasAcopioComponent } from "../panel-maquinas-acopio/panel-maquinas-acopio.component";

const texto = (valor: unknown): string => String(valor ?? "").trim();

/** Pestaña del panel derecho. */
type Pestania = "lineas" | "maquinas";

/** Una línea manual del acopio tal como se muestra y se edita (id 0 = nueva, aún sin guardar). */
interface LineaFila {
  clave: string;
  id: number;
  numero: number | null;
  tipo: string;
  puestos: number;
  activo: boolean;
  tipoGuardado: string;
  puestosGuardados: number;
}

/** Fila que se envía al servidor (el SP Sincronizar lee un arreglo con estas filas). */
interface FilaSincronizar {
  id: number;
  modo: "nuevo" | "editado";
  codigoAcopio: string;
  codigoTipoProcesoEmpacado: string;
  cantidadPuestos: number;
  activo: boolean;
}

const MIN_PUESTOS = 1;
const MAX_PUESTOS = 20;

/**
 * Ventana de líneas y máquinas por acopio (solo administrador, solo en línea).
 * A la izquierda lista todos los acopios; al elegir uno, a la derecha se muestran sus líneas (se crean, editan, activan o desactivan
 * y eliminan una por una) o sus máquinas. Todo se lee y se guarda en el servidor; no se guarda nada en el equipo.
 * Avisa a la pantalla con closed().
 */
@Component({
  selector: "app-modal-lineas-acopio",
  imports: [
    FormsModule,
    SearchSelectComponent,
    PanelMaquinasAcopioComponent,
    LucideBuilding2,
    LucideCheck,
    LucideChevronRight,
    LucideCpu,
    LucideEye,
    LucideEyeOff,
    LucideInbox,
    LucideMinus,
    LucidePlus,
    LucideRows3,
    LucideSearch,
    LucideX,
  ],
  templateUrl: "./modal-lineas-acopio.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModalLineasAcopioComponent implements OnInit {
  constructor() {
    portalToBody();
  }

  private readonly api = inject(AdministracionApiService);
  private readonly connectivity = inject(ConnectivityService);
  private readonly confirmModal = inject(ConfirmModalService);
  private readonly loading = inject(LoadingService);
  private readonly feedback = inject(FeedbackModalService);
  private readonly alertService = inject(AlertaService);

  /** Todos los acopios y el que se abre seleccionado (si no viene, el primero de la lista). */
  readonly acopios = input.required<AcopioConfig[]>();
  readonly inicial = input<AcopioConfig | null>(null);

  readonly closed = output<void>();

  readonly minPuestos = MIN_PUESTOS;
  readonly maxPuestos = MAX_PUESTOS;

  readonly filtroTexto = signal("");
  /** Código del acopio elegido ('' = se usa el inicial, o el primero de la lista). */
  private readonly elegido = signal("");
  readonly pestania = signal<Pestania>("lineas");
  readonly lineas = signal<LineaFila[]>([]);
  private contadorNuevas = 0;
  /** Zona con scroll de la lista de líneas (para subir hasta la fila nueva). */
  private readonly listaLineas = viewChild<ElementRef<HTMLElement>>("listaLineas");

  /** Acopios que coinciden con lo escrito en el buscador (código o nombre). */
  readonly acopiosFiltrados = computed(() => {
    const buscado = this.filtroTexto().trim().toLowerCase();
    if (!buscado) return this.acopios();
    return this.acopios().filter((a) =>
      [a.codigoAcopio, a.acopioNombre].some((valor) =>
        texto(valor).toLowerCase().includes(buscado),
      ),
    );
  });

  /** Acopio que se está viendo a la derecha. */
  readonly seleccionado = computed<AcopioConfig | null>(() => {
    const lista = this.acopios();
    const codigo = this.elegido() || texto(this.inicial()?.codigoAcopio);
    return lista.find((a) => a.codigoAcopio === codigo) ?? lista[0] ?? null;
  });

  /** Tipos de proceso activos del acopio elegido (lo que se puede elegir en cada línea). */
  private readonly tiposActivos = computed(() =>
    (this.seleccionado()?.tiposProcesoEmpacado ?? []).filter((t) => t.activo),
  );

  readonly totalLineas = computed(
    () => this.lineas().filter((l) => l.id > 0).length,
  );
  readonly totalPuestosActivos = computed(() =>
    this.lineas()
      .filter((l) => l.id > 0 && l.activo)
      .reduce((suma, l) => suma + l.puestosGuardados, 0),
  );
  readonly hayBorrador = computed(() => this.lineas().some((l) => l.id === 0));

  ngOnInit(): void {
    void this.cargarLineas("Cargando líneas...");
  }

  /** Cambia de acopio mostrando la carga y pide al servidor sus líneas. */
  async elegir(acopio: AcopioConfig): Promise<void> {
    if (acopio.codigoAcopio === this.seleccionado()?.codigoAcopio) return;
    this.elegido.set(acopio.codigoAcopio);
    this.lineas.set([]);
    // En la pestaña de máquinas el propio panel pide sus datos al cambiar de acopio.
    if (this.pestania() === "lineas") {
      await this.cargarLineas(`Cargando ${acopio.acopioNombre}...`);
    }
  }

  /** Cambia entre líneas y máquinas mostrando la carga. */
  async cambiarPestania(pestania: Pestania): Promise<void> {
    if (pestania === this.pestania()) return;
    this.pestania.set(pestania);
    // Al entrar a máquinas el panel se crea y pide sus datos con su carga.
    if (pestania === "lineas") {
      await this.cargarLineas("Cargando líneas...");
    }
  }

  /**
   * Pide al servidor las líneas del acopio elegido (no guarda nada en el equipo).
   * conservar = true (después de guardar): lo que la persona ya cambió en otras filas y aún no guardó, y las filas nuevas sin guardar, no se pierden.
   */
  private async cargarLineas(mensaje: string,conservar = false): Promise<void> {
    const acopio = this.seleccionado();
    if (!acopio) {
      this.lineas.set([]);
      this.loading.hide();
      return;
    }
    if (!this.connectivity.online()) {
      this.lineas.set([]);
      this.loading.hide();
      this.feedback.error(
        "Error de conexión: necesitas internet para ver las líneas.",
        "Sin conexión",
      );
      return;
    }

    const previas = conservar ? this.lineas() : [];
    this.loading.show(mensaje);
    try {
      const sobre = await this.api.acopioLineas(acopio.codigoAcopio);
      if (acopio.codigoAcopio !== this.seleccionado()?.codigoAcopio) return;
      if (sobre?.error) {
        this.lineas.set([]);
        this.feedback.error(
          sobre.mensaje || "No se pudieron obtener las líneas.",
        );
        return;
      }
      const filas = Array.isArray(sobre?.data) ? sobre.data : [];
      const delServidor = filas.map((fila) => {
        const linea = this.aLinea(fila);
        const previa = previas.find((p) => p.id === linea.id);
        return previa && this.tieneCambios(previa)
          ? { ...linea, tipo: previa.tipo, puestos: previa.puestos }
          : linea;
      });
      this.lineas.set([...previas.filter((p) => p.id === 0), ...delServidor]);
    } catch {
      this.lineas.set([]);
      this.feedback.error(
        "Error de conexión: no se pudieron obtener las líneas.",
        "Sin conexión",
      );
    } finally {
      await this.loading.hideAfterMinimum();
    }
  }

  /** Convierte la fila del servidor en una línea lista para mostrar y editar. */
  private aLinea(fila: Record<string, any>): LineaFila {
    const id = Number(fila["id"] ?? 0);
    const tipo = texto(fila["codigoTipoProcesoEmpacado"]);
    const puestos = Number(fila["cantidadPuestos"] ?? 0);
    return {
      clave: `linea-${id}`,
      id,
      numero: Number(fila["numero"] ?? 0) || null,
      tipo,
      puestos,
      activo: fila["activo"] === true || fila["activo"] === 1,
      tipoGuardado: tipo,
      puestosGuardados: puestos,
    };
  }

  /** Tipos activos del acopio elegido, listos para el select (se muestra el código; el nombre sirve para buscar). */
  private readonly opcionesBase = computed<SearchSelectOption[]>(() =>
    this.tiposActivos().map((t) => ({ value: t.codigo, label: t.codigo, searchText: `${t.codigo} ${t.nombre}` })),
  );
  /** Listas con un tipo extra (el que la línea ya tenía y hoy no está activo). Se guardan para no crear una lista nueva en cada revisión de la pantalla. */
  private readonly opcionesConExtra = new Map<string, SearchSelectOption[]>();

  /** Tipos que se pueden elegir en la línea: los activos del acopio y, si ya tiene otro, ese también. */
  opcionesTipo(linea: LineaFila): SearchSelectOption[] {
    const base = this.opcionesBase();
    if (!linea.tipo || base.some((o) => o.value === linea.tipo)) return base;
    const clave = `${this.seleccionado()?.codigoAcopio ?? ''}|${linea.tipo}`;
    const guardada = this.opcionesConExtra.get(clave);
    if (guardada && guardada.slice(0, base.length).every((o, i) => o === base[i])) return guardada;
    const lista = [...base, { value: linea.tipo, label: linea.tipo }];
    this.opcionesConExtra.set(clave, lista);
    return lista;
  }

  /** La línea es nueva o cambió el tipo o los puestos desde la última vez que se guardó. */
  tieneCambios(linea: LineaFila): boolean {
    return (
      linea.id === 0 ||
      linea.tipo !== linea.tipoGuardado ||
      linea.puestos !== linea.puestosGuardados
    );
  }

  agregarLinea(): void {
    if (this.hayBorrador()) return;
    const tipo = this.tiposActivos()[0]?.codigo ?? "";
    if (!tipo) {
      this.feedback.warning(
        "Este acopio no tiene tipos de proceso activos. Actívalos primero en Editar acopio.",
      );
      return;
    }
    this.contadorNuevas++;
    // La fila nueva va arriba para que se vea aunque la lista sea larga.
    this.lineas.update((filas) => [
      {
        clave: `nueva-${this.contadorNuevas}`,
        id: 0,
        numero: null,
        tipo,
        puestos: 4,
        activo: true,
        tipoGuardado: "",
        puestosGuardados: 0,
      },
      ...filas,
    ]);
    // La fila nueva queda arriba: se sube la lista para que se vea y se pueda llenar sin buscarla.
    setTimeout(() => this.listaLineas()?.nativeElement.scrollTo({ top: 0, behavior: "smooth" }));
  }

  private modificar(linea: LineaFila, cambios: Partial<LineaFila>): void {
    this.lineas.update((filas) =>
      filas.map((f) => (f.clave === linea.clave ? { ...f, ...cambios } : f)),
    );
  }

  cambiarTipo(linea: LineaFila, tipo: string): void {
    this.modificar(linea, { tipo });
  }

  /** Puestos dentro del rango permitido. */
  private limitar(valor: unknown): number {
    const numero = Math.trunc(Number(valor));
    if (!Number.isFinite(numero)) return MIN_PUESTOS;
    return Math.min(MAX_PUESTOS, Math.max(MIN_PUESTOS, numero));
  }

  sumarPuestos(linea: LineaFila, delta: number): void {
    this.modificar(linea, { puestos: this.limitar(linea.puestos + delta) });
  }

  /** Solo deja pasar dígitos: bloquea letras, "e", signos, punto y coma. Las teclas de control (borrar, flechas, tab) y los atajos (copiar, pegar) siguen funcionando. */
  bloquearTecla(ev: KeyboardEvent): void {
    if (ev.ctrlKey || ev.metaKey || ev.altKey || ev.key.length > 1) return;
    if (!/^\d$/.test(ev.key)) ev.preventDefault();
  }

  /** Lo escrito o pegado: solo dígitos enteros (máximo 2) y nunca más del máximo permitido. Vacío mientras se escribe se acepta (se corrige al salir). */
  escribirPuestos(linea: LineaFila, ev: Event): void {
    const campo = ev.target as HTMLInputElement;
    const digitos = campo.value.replace(/\D/g, "").slice(0, 2);
    const numero = digitos === "" ? 0 : Math.min(MAX_PUESTOS, Number(digitos));
    campo.value = digitos === "" ? "" : String(numero);
    this.modificar(linea, { puestos: numero });
  }

  /** Al salir del campo: si quedó vacío o en 0, vuelve al mínimo. */
  terminarPuestos(linea: LineaFila): void {
    if (linea.puestos < MIN_PUESTOS)
      this.modificar(linea, { puestos: MIN_PUESTOS });
  }

  /**
   * Envía la fila al servidor (Sincronizar) con su carga. Devuelve true si se guardó. Si falló, avisa y devuelve false.
   * Si se guardó, la carga queda abierta: quien llama vuelve a pedir la lista y esa recarga la cierra.
   */
  private async enviar(mensajeCarga: string,fila: FilaSincronizar): Promise<boolean> {
    if (!this.connectivity.online()) {
      this.feedback.error(
        "Error de conexión: necesitas internet para guardar.",
        "Sin conexión",
      );
      return false;
    }
    this.loading.show(mensajeCarga);
    try {
      const sobre = await this.api.sincronizarAcopioLineas(
        JSON.stringify([fila]),
      );
      if (sobre?.error) {
        this.feedback.error(sobre.mensaje || "No se pudo completar la acción.");
      } else {
        return true;
      }
    } catch {
      this.feedback.error(
        "Error de conexión: no se pudo completar la acción.",
        "Sin conexión",
      );
    }
    await this.loading.hideAfterMinimum();
    return false;
  }

  /** Crea la línea (si es nueva) o guarda el tipo y los puestos. */
  async guardar(linea: LineaFila): Promise<void> {
    const acopio = this.seleccionado();
    if (!acopio || !this.tieneCambios(linea)) return;
    const respuesta = await this.enviar("Guardando línea...", {
      id: linea.id,
      modo: linea.id === 0 ? "nuevo" : "editado",
      codigoAcopio: acopio.codigoAcopio,
      codigoTipoProcesoEmpacado: linea.tipo,
      cantidadPuestos: linea.puestos,
      activo: linea.activo,
    });
    if (!respuesta) return;
    // La fila nueva se quita: la lista que viene del servidor ya la trae con su número.
    this.lineas.update((filas) => filas.filter((f) => f.clave !== linea.clave));
    this.alertService.showAlert("Éxito", "Línea guardada", "success");
    await this.cargarLineas("Actualizando líneas...", true);
  }

  /** Desactivar pide dos confirmaciones seguidas: la primera avisa qué pasa; la segunda confirma de nuevo con la línea y el acopio. */
  private async confirmarDesactivar(linea: LineaFila, acopio: AcopioConfig): Promise<boolean> {
    const detalle = `Línea ${linea.numero} · ${acopio.acopioNombre}`;
    const primera = await this.confirmModal.confirm({
      title: "Desactivar línea",
      eyebrow: "Advertencia",
      message: "La línea quedará inactiva: no se podrá usar ni editar hasta que se vuelva a activar, y sus puestos dejarán de contarse como activos.",
      detail: detalle,
      confirmText: "Continuar",
      cancelText: "Cancelar",
      tone: "warning",
    });
    if (!primera) return false;
    // Entre los dos avisos se muestra la carga, para que se note que hay una segunda confirmación.
    this.loading.show("Preparando confirmación...");
    await this.loading.hideAfterMinimum();
    return this.confirmModal.confirm({
      title: "¿Seguro que quieres desactivarla?",
      eyebrow: "Confirma de nuevo",
      message: "Esta acción cambia la disponibilidad de la línea para el acopio. Confirma para desactivarla.",
      detail: detalle,
      confirmText: "Sí, desactivar",
      cancelText: "No, volver",
      tone: "danger",
    });
  }

  /** Activa o desactiva la línea (se guarda al instante; no envía los cambios sin guardar de tipo o puestos). */
  async alternarActivo(linea: LineaFila): Promise<void> {
    const acopio = this.seleccionado();
    if (!acopio || linea.id === 0) return;
    const activar = !linea.activo;
    if (!activar && !(await this.confirmarDesactivar(linea, acopio))) return;
    const respuesta = await this.enviar(
      activar ? "Activando línea..." : "Desactivando línea...",
      {
        id: linea.id,
        modo: "editado",
        codigoAcopio: acopio.codigoAcopio,
        codigoTipoProcesoEmpacado: linea.tipoGuardado,
        cantidadPuestos: linea.puestosGuardados,
        activo: activar,
      },
    );
    if (!respuesta) return;
    this.alertService.showAlert(
      "Éxito",
      activar ? "Línea activada" : "Línea desactivada",
      "success",
    );
    await this.cargarLineas("Actualizando líneas...", true);
  }

  /** Quita de la lista una línea nueva que aún no se guardó (las líneas guardadas no se eliminan: solo se activan o desactivan). */
  descartarNueva(linea: LineaFila): void {
    if (linea.id !== 0) return;
    this.lineas.update((filas) => filas.filter((f) => f.clave !== linea.clave));
  }
}
