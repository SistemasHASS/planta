import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from "@angular/core";
import {
  LucideCheck,
  LucideCpu,
  LucideEye,
  LucideEyeOff,
  LucideInbox,
  LucideMinus,
  LucidePlus,
  LucideX,
} from "@lucide/angular";
import { SearchSelectComponent, SearchSelectOption } from "../../../../shared/components/search-select/search-select.component";
import { AdministracionApiService } from "../../../../shared/services/administracion-api.service";
import { AlertaService } from "../../../../shared/services/alerta.service";
import { ConfirmModalService } from "../../../../shared/services/confirm-modal.service";
import { ConnectivityService } from "../../../../shared/services/connectivity.service";
import { FeedbackModalService } from "../../../../shared/services/feedback-modal.service";
import { LoadingService } from "../../../../shared/services/loading.service";
import { AcopioConfig } from "../../acopios-config.interface";

const texto = (valor: unknown): string => String(valor ?? "").trim();

/** Una máquina del acopio tal como se muestra y se edita (id 0 = nueva, aún sin guardar). */
interface MaquinaFila {
  clave: string;
  id: number;
  tipo: string;
  nombre: string;
  curos: number;
  puestos: number;
  activo: boolean;
  tipoGuardado: string;
  nombreGuardado: string;
  curosGuardados: number;
  puestosGuardados: number;
}

/** Fila que se envía al servidor (el SP Sincronizar lee un arreglo con estas filas). */
interface FilaSincronizar {
  id: number;
  modo: "nuevo" | "editado";
  codigoAcopio: string;
  codigoTipoProcesoEmpacado: string;
  nombre: string;
  cantidadCuros: number;
  puestosPorCuro: number;
  activo: boolean;
}

const MIN_CUROS = 1;
const MAX_CUROS = 10;
const MIN_PUESTOS = 1;
const MAX_PUESTOS = 12;
/** Puestos por curo que trae una máquina nueva. */
const PUESTOS_INICIALES = 8;

/**
 * Pestaña "Máquinas" del modal de líneas y máquinas (solo administrador, solo en línea).
 * Lista las máquinas del acopio, con sus curos dibujados. Se crean, editan, activan o desactivan una por una; no se eliminan.
 * Solo se guardan los curos y los puestos por curo: el lado A (la mitad, redondeada hacia arriba) y el lado B (el resto) se calculan aquí.
 */
@Component({
  selector: "app-panel-maquinas-acopio",
  imports: [
    SearchSelectComponent,
    LucideCheck,
    LucideCpu,
    LucideEye,
    LucideEyeOff,
    LucideInbox,
    LucideMinus,
    LucidePlus,
    LucideX,
  ],
  templateUrl: "./panel-maquinas-acopio.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PanelMaquinasAcopioComponent {
  private readonly api = inject(AdministracionApiService);
  private readonly connectivity = inject(ConnectivityService);
  private readonly confirmModal = inject(ConfirmModalService);
  private readonly loading = inject(LoadingService);
  private readonly feedback = inject(FeedbackModalService);
  private readonly alertService = inject(AlertaService);

  /** Acopio del que se muestran las máquinas. */
  readonly acopio = input.required<AcopioConfig>();

  readonly minCuros = MIN_CUROS;
  readonly maxCuros = MAX_CUROS;
  readonly minPuestos = MIN_PUESTOS;
  readonly maxPuestos = MAX_PUESTOS;
  readonly todosLosCuros = Array.from({ length: MAX_CUROS }, (_, i) => i + 1);
  readonly todosLosPuestos = Array.from({ length: MAX_PUESTOS }, (_, i) => i + 1);

  readonly maquinas = signal<MaquinaFila[]>([]);
  private contadorNuevas = 0;
  /** Zona con scroll de la lista de máquinas (para subir hasta la fila nueva). */
  private readonly listaMaquinas = viewChild<ElementRef<HTMLElement>>("listaMaquinas");

  readonly totalMaquinas = computed(() => this.maquinas().filter((m) => m.id > 0).length);
  readonly totalPuestosActivos = computed(() =>
    this.maquinas()
      .filter((m) => m.id > 0 && m.activo)
      .reduce((suma, m) => suma + m.curosGuardados * m.puestosGuardados, 0),
  );
  readonly hayBorrador = computed(() => this.maquinas().some((m) => m.id === 0));
  /** Tipos de proceso activos del acopio que son de máquina. Sin ninguno no se pueden crear máquinas. */
  readonly tiposMaquina = computed(() =>
    this.acopio().tiposProcesoEmpacado.filter((t) => t.activo && t.maquina),
  );
  /** Esos tipos listos para el select (se muestra el código; el nombre sirve para buscar). */
  private readonly opcionesBase = computed<SearchSelectOption[]>(() =>
    this.tiposMaquina().map((t) => ({ value: t.codigo, label: t.codigo, searchText: `${t.codigo} ${t.nombre}` })),
  );
  /** Listas con un tipo extra (el que la máquina ya tenía y hoy no está disponible). Se guardan para no crear una lista nueva en cada revisión de la pantalla. */
  private readonly opcionesConExtra = new Map<string, SearchSelectOption[]>();

  /** Tipos que se pueden elegir en la máquina: los de máquina activos del acopio y, si ya tiene otro, ese también. */
  opcionesTipo(maquina: MaquinaFila): SearchSelectOption[] {
    const base = this.opcionesBase();
    if (!maquina.tipo || base.some((o) => o.value === maquina.tipo)) return base;
    const clave = `${this.acopio().codigoAcopio}|${maquina.tipo}`;
    const guardada = this.opcionesConExtra.get(clave);
    if (guardada && guardada.slice(0, base.length).every((o, i) => o === base[i])) return guardada;
    const lista = [...base, { value: maquina.tipo, label: maquina.tipo }];
    this.opcionesConExtra.set(clave, lista);
    return lista;
  }

  /** Puestos del lado A de cada curo: la mitad, redondeada hacia arriba (3 puestos → A 2 y B 1). El lado B es el resto. */
  mitadA(puestos: number): number {
    return Math.ceil(puestos / 2);
  }

  /** Texto de cómo se reparten los puestos de un curo (ej. "lado A (1–4) y lado B (5–8)"). */
  textoLados(puestos: number): string {
    const a = this.mitadA(puestos);
    const rango = (desde: number, hasta: number) => (desde === hasta ? `${desde}` : `${desde}–${hasta}`);
    return puestos > 1 ? `lado A (${rango(1, a)}) y lado B (${rango(a + 1, puestos)})` : "lado A (1)";
  }

  constructor() {
    // Al abrir la pestaña o cambiar de acopio se piden las máquinas al servidor.
    effect(() => {
      this.acopio().codigoAcopio;
      untracked(() => void this.cargar("Cargando máquinas..."));
    });
  }

  /**
   * Pide al servidor las máquinas del acopio (no guarda nada en el equipo).
   * conservar = true (después de guardar): lo que la persona ya cambió en otras filas y aún no guardó, y la fila nueva sin guardar, no se pierden.
   */
  private async cargar(mensaje: string, conservar = false): Promise<void> {
    const acopio = this.acopio();
    if (!this.connectivity.online()) {
      this.maquinas.set([]);
      this.loading.hide();
      this.feedback.error("Error de conexión: necesitas internet para ver las máquinas.", "Sin conexión");
      return;
    }

    const previas = conservar ? this.maquinas() : [];
    this.loading.show(mensaje);
    try {
      const sobre = await this.api.acopioMaquinas(acopio.codigoAcopio);
      if (acopio.codigoAcopio !== this.acopio().codigoAcopio) return;
      if (sobre?.error) {
        this.maquinas.set([]);
        this.feedback.error(sobre.mensaje || "No se pudieron obtener las máquinas.");
        return;
      }
      const filas = Array.isArray(sobre?.data) ? sobre.data : [];
      const delServidor = filas.map((fila) => {
        const maquina = this.aMaquina(fila);
        const previa = previas.find((p) => p.id === maquina.id);
        return previa && this.tieneCambios(previa)
          ? { ...maquina, tipo: previa.tipo, nombre: previa.nombre, curos: previa.curos, puestos: previa.puestos }
          : maquina;
      });
      this.maquinas.set([...previas.filter((p) => p.id === 0), ...delServidor]);
    } catch {
      this.maquinas.set([]);
      this.feedback.error("Error de conexión: no se pudieron obtener las máquinas.", "Sin conexión");
    } finally {
      await this.loading.hideAfterMinimum();
    }
  }

  /** Convierte la fila del servidor en una máquina lista para mostrar y editar. */
  private aMaquina(fila: Record<string, any>): MaquinaFila {
    const id = Number(fila["id"] ?? 0);
    const tipo = texto(fila["codigoTipoProcesoEmpacado"]);
    const nombre = texto(fila["nombre"]);
    const curos = Number(fila["cantidadCuros"] ?? 0);
    const puestos = Number(fila["puestosPorCuro"] ?? 0);
    return {
      clave: `maquina-${id}`,
      id,
      tipo,
      nombre,
      curos,
      puestos,
      activo: fila["activo"] === true || fila["activo"] === 1,
      tipoGuardado: tipo,
      nombreGuardado: nombre,
      curosGuardados: curos,
      puestosGuardados: puestos,
    };
  }

  /** La máquina es nueva o cambió el tipo, el nombre, los curos o los puestos desde la última vez que se guardó. */
  tieneCambios(maquina: MaquinaFila): boolean {
    return (
      maquina.id === 0 ||
      maquina.tipo !== maquina.tipoGuardado ||
      maquina.nombre.trim() !== maquina.nombreGuardado ||
      maquina.curos !== maquina.curosGuardados ||
      maquina.puestos !== maquina.puestosGuardados
    );
  }

  /** Se puede guardar cuando hay cambios y están completos (código solo si es nueva). */
  puedeGuardar(maquina: MaquinaFila): boolean {
    return (
      this.tieneCambios(maquina) &&
      maquina.tipo !== "" &&
      maquina.nombre.trim() !== "" &&
      maquina.curos >= MIN_CUROS &&
      maquina.puestos >= MIN_PUESTOS
    );
  }

  agregarMaquina(): void {
    if (this.hayBorrador()) return;
    if (this.tiposMaquina().length === 0) {
      this.feedback.warning(
        "Este acopio no tiene un tipo de proceso de máquina activo. Actívalo primero en Editar acopio.",
      );
      return;
    }
    this.contadorNuevas++;
    // La fila nueva va arriba para que se vea aunque la lista sea larga.
    this.maquinas.update((filas) => [
      {
        clave: `nueva-${this.contadorNuevas}`,
        id: 0,
        tipo: this.tiposMaquina()[0].codigo,
        nombre: "",
        curos: 2,
        puestos: PUESTOS_INICIALES,
        activo: true,
        tipoGuardado: "",
        nombreGuardado: "",
        curosGuardados: 0,
        puestosGuardados: 0,
      },
      ...filas,
    ]);
    // La fila nueva queda arriba: se sube la lista para que se vea y se pueda llenar sin buscarla.
    setTimeout(() => this.listaMaquinas()?.nativeElement.scrollTo({ top: 0, behavior: "smooth" }));
  }

  private modificar(maquina: MaquinaFila, cambios: Partial<MaquinaFila>): void {
    this.maquinas.update((filas) => filas.map((f) => (f.clave === maquina.clave ? { ...f, ...cambios } : f)));
  }

  cambiarTipo(maquina: MaquinaFila, tipo: string): void {
    this.modificar(maquina, { tipo });
  }

  escribirNombre(maquina: MaquinaFila, ev: Event): void {
    this.modificar(maquina, { nombre: (ev.target as HTMLInputElement).value });
  }

  /** Curos dentro del rango permitido. */
  private limitar(valor: unknown): number {
    const numero = Math.trunc(Number(valor));
    if (!Number.isFinite(numero)) return MIN_CUROS;
    return Math.min(MAX_CUROS, Math.max(MIN_CUROS, numero));
  }

  sumarCuros(maquina: MaquinaFila, delta: number): void {
    this.modificar(maquina, { curos: this.limitar(maquina.curos + delta) });
  }

  /** Puestos por curo dentro del rango permitido. */
  private limitarPuestos(valor: unknown): number {
    const numero = Math.trunc(Number(valor));
    if (!Number.isFinite(numero)) return MIN_PUESTOS;
    return Math.min(MAX_PUESTOS, Math.max(MIN_PUESTOS, numero));
  }

  sumarPuestos(maquina: MaquinaFila, delta: number): void {
    this.modificar(maquina, { puestos: this.limitarPuestos(maquina.puestos + delta) });
  }

  /** Solo deja pasar dígitos: bloquea letras, "e", signos, punto y coma. Las teclas de control y los atajos siguen funcionando. */
  bloquearTecla(ev: KeyboardEvent): void {
    if (ev.ctrlKey || ev.metaKey || ev.altKey || ev.key.length > 1) return;
    if (!/^\d$/.test(ev.key)) ev.preventDefault();
  }

  /** Lo escrito o pegado: solo dígitos enteros (máximo 2) y nunca más del máximo. Vacío mientras se escribe se acepta (se corrige al salir). */
  escribirCuros(maquina: MaquinaFila, ev: Event): void {
    const campo = ev.target as HTMLInputElement;
    const digitos = campo.value.replace(/\D/g, "").slice(0, 2);
    const numero = digitos === "" ? 0 : Math.min(MAX_CUROS, Number(digitos));
    campo.value = digitos === "" ? "" : String(numero);
    this.modificar(maquina, { curos: numero });
  }

  /** Lo escrito o pegado en puestos por curo: solo dígitos enteros (máximo 2) y nunca más del máximo. */
  escribirPuestos(maquina: MaquinaFila, ev: Event): void {
    const campo = ev.target as HTMLInputElement;
    const digitos = campo.value.replace(/\D/g, "").slice(0, 2);
    const numero = digitos === "" ? 0 : Math.min(MAX_PUESTOS, Number(digitos));
    campo.value = digitos === "" ? "" : String(numero);
    this.modificar(maquina, { puestos: numero });
  }

  terminarPuestos(maquina: MaquinaFila): void {
    if (maquina.puestos < MIN_PUESTOS) this.modificar(maquina, { puestos: MIN_PUESTOS });
  }

  /** Al salir del campo: si quedó vacío o en 0, vuelve al mínimo. */
  terminarCuros(maquina: MaquinaFila): void {
    if (maquina.curos < MIN_CUROS) this.modificar(maquina, { curos: MIN_CUROS });
  }

  /**
   * Envía la fila al servidor (Sincronizar) con su carga. Devuelve true si se guardó. Si falló, avisa y devuelve false.
   * Si se guardó, la carga queda abierta: quien llama vuelve a pedir la lista y esa recarga la cierra.
   */
  private async enviar(mensajeCarga: string, fila: FilaSincronizar): Promise<boolean> {
    if (!this.connectivity.online()) {
      this.feedback.error("Error de conexión: necesitas internet para guardar.", "Sin conexión");
      return false;
    }
    this.loading.show(mensajeCarga);
    try {
      const sobre = await this.api.sincronizarAcopioMaquinas(JSON.stringify([fila]));
      if (sobre?.error) {
        this.feedback.error(sobre.mensaje || "No se pudo completar la acción.");
      } else {
        return true;
      }
    } catch {
      this.feedback.error("Error de conexión: no se pudo completar la acción.", "Sin conexión");
    }
    await this.loading.hideAfterMinimum();
    return false;
  }

  /** Crea la máquina (si es nueva) o guarda el nombre y los curos. */
  async guardar(maquina: MaquinaFila): Promise<void> {
    if (!this.puedeGuardar(maquina)) return;
    const respuesta = await this.enviar("Guardando máquina...", {
      id: maquina.id,
      modo: maquina.id === 0 ? "nuevo" : "editado",
      codigoAcopio: this.acopio().codigoAcopio,
      codigoTipoProcesoEmpacado: maquina.tipo,
      nombre: maquina.nombre.trim(),
      cantidadCuros: maquina.curos,
      puestosPorCuro: maquina.puestos,
      activo: maquina.activo,
    });
    if (!respuesta) return;
    // La fila nueva se quita: la lista que viene del servidor ya la trae.
    this.maquinas.update((filas) => filas.filter((f) => f.clave !== maquina.clave));
    this.alertService.showAlert("Éxito", "Máquina guardada", "success");
    await this.cargar("Actualizando máquinas...", true);
  }

  /** Desactivar pide dos confirmaciones seguidas: la primera avisa qué pasa; la segunda confirma de nuevo con la máquina y el acopio. */
  private async confirmarDesactivar(maquina: MaquinaFila): Promise<boolean> {
    const detalle = `${maquina.nombreGuardado} · ${this.acopio().acopioNombre}`;
    const primera = await this.confirmModal.confirm({
      title: "Desactivar máquina",
      eyebrow: "Advertencia",
      message: "La máquina quedará inactiva: no se podrá usar ni editar hasta que se vuelva a activar, y sus puestos dejarán de contarse como activos.",
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
      message: "Esta acción cambia la disponibilidad de la máquina para el acopio. Confirma para desactivarla.",
      detail: detalle,
      confirmText: "Sí, desactivar",
      cancelText: "No, volver",
      tone: "danger",
    });
  }

  /** Activa o desactiva la máquina (se guarda al instante; no envía los cambios sin guardar de nombre o curos). */
  async alternarActivo(maquina: MaquinaFila): Promise<void> {
    if (maquina.id === 0) return;
    const activar = !maquina.activo;
    if (!activar && !(await this.confirmarDesactivar(maquina))) return;
    const respuesta = await this.enviar(activar ? "Activando máquina..." : "Desactivando máquina...", {
      id: maquina.id,
      modo: "editado",
      codigoAcopio: this.acopio().codigoAcopio,
      codigoTipoProcesoEmpacado: maquina.tipoGuardado,
      nombre: maquina.nombreGuardado,
      cantidadCuros: maquina.curosGuardados,
      puestosPorCuro: maquina.puestosGuardados,
      activo: activar,
    });
    if (!respuesta) return;
    this.alertService.showAlert("Éxito", activar ? "Máquina activada" : "Máquina desactivada", "success");
    await this.cargar("Actualizando máquinas...", true);
  }

  /** Quita de la lista una máquina nueva que aún no se guardó (las guardadas no se eliminan: solo se activan o desactivan). */
  descartarNueva(maquina: MaquinaFila): void {
    if (maquina.id !== 0) return;
    this.maquinas.update((filas) => filas.filter((f) => f.clave !== maquina.clave));
  }
}
