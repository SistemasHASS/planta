import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, effect, inject, output, signal, viewChild } from '@angular/core';
import { SearchSelectComponent, SearchSelectOption } from '../../../../shared/components/search-select/search-select.component';
import { QrScannerModalComponent, ResultadoQr } from '../../../../shared/components/qr-scanner-modal/qr-scanner-modal.component';
import { ConnectivityService } from '../../../../shared/services/connectivity.service';
import { JornadasAnotadorApiService } from '../../../../shared/services/jornadas-anotador-api.service';
import { portalToBody } from '../../../../shared/utils/portal';
import { JornadaStore } from '../../jornada.store';
import { Fila, claveLinea, destinoEtiqueta, destinoValor, lineaTexto, refLinea, texto } from '../../jornada.utils';
import { CajasRegistradas, RecoleccionStore } from '../../recoleccion.store';

const MAX_CAJAS = 99999;

/** Lo que se muestra encima del escáner después de leer un QR. */
type Panel =
  | { tipo: 'buscando' }
  | { tipo: 'error'; mensaje: string }
  | { tipo: 'captura'; linea: Fila; puesto: number; empacador: Fila; existente: CajasRegistradas | undefined };

/**
 * "Recolección rápida": se elige una sola vez el formato y el tipo de empaque y después solo se escanea el QR de cada empacador.
 * Si el empacador está en una línea mía, se pide directo el número de cajas y se guarda igual que en el registro manual
 * (una fila por empacador en la recolección: si ya tenía cajas, se corrigen). Luego la cámara vuelve a abrirse sola.
 * El escáner es el compartido (no se modifica): mientras se atiende un código queda oculto y esta ventana se pone encima.
 */
@Component({
  selector: 'app-recoleccion-rapida',
  imports: [QrScannerModalComponent, SearchSelectComponent],
  templateUrl: './recoleccion-rapida.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecoleccionRapidaComponent {
  protected readonly store = inject(JornadaStore);
  protected readonly recoleccion = inject(RecoleccionStore);
  protected readonly destinoEtiqueta = destinoEtiqueta;
  protected readonly destinoValor = destinoValor;
  private readonly connectivity = inject(ConnectivityService);
  private readonly jornadasApi = inject(JornadasAnotadorApiService);

  /** Se pide cerrar todo (cancelar en la elección de formato). */
  readonly closed = output<void>();

  // ---- Elección de formato y tipo de empaque ----

  protected readonly formatoId = signal('');
  protected readonly tipoEmpaqueId = signal('');
  protected readonly tiposEmpaque = signal<SearchSelectOption[]>([]);
  protected readonly cargandoTipos = signal(false);
  protected readonly errorTipos = signal('');
  /** false = elegir formato y tipo; true = escaneando. */
  protected readonly escaneando = signal(false);

  // ---- Lo que ocurre después de leer un código ----

  protected readonly panel = signal<Panel | null>(null);
  /** Lo que se le pasa al escáner mientras se atiende un código: así apaga la cámara y la vuelve a abrir al quedar en null. */
  protected readonly resultadoEscaner = signal<ResultadoQr | null>(null);
  protected readonly cantidad = signal(0);
  /** Formato y tipo de empaque de ESTE empacador: parten de lo elegido al comenzar y se pueden cambiar solo para él. */
  protected readonly capFormatoId = signal('');
  protected readonly capTipoId = signal('');
  protected readonly capTipos = signal<SearchSelectOption[]>([]);
  protected readonly capCargando = signal(false);
  protected readonly guardando = signal(false);
  protected readonly errorGuardar = signal('');
  /** Aviso corto de lo último que se guardó (se muestra sobre la cámara). */
  protected readonly aviso = signal('');

  private readonly campo = viewChild<ElementRef<HTMLInputElement>>('campo');
  private temporizadorAviso: ReturnType<typeof setTimeout> | null = null;

  protected readonly etiquetaFormato = computed(() => this.recoleccion.opcionesFormato().find((o) => o.value === this.formatoId())?.label ?? '');
  protected readonly etiquetaTipo = computed(() => this.tiposEmpaque().find((o) => o.value === this.tipoEmpaqueId())?.label ?? '');
  protected readonly resumenEleccion = computed(() => [this.etiquetaFormato(), this.etiquetaTipo()].filter(Boolean).join(' · '));

  constructor() {
    portalToBody();
    inject(DestroyRef).onDestroy(() => {
      if (this.temporizadorAviso) clearTimeout(this.temporizadorAviso);
    });

    // Al aparecer el campo de cajas se enfoca para escribir de una vez.
    effect(() => {
      const el = this.campo()?.nativeElement;
      if (el) setTimeout(() => { el.focus(); el.select(); }, 60);
    });
  }

  protected async elegirFormato(opcion: SearchSelectOption): Promise<void> {
    if (opcion.value === this.formatoId()) return;
    this.errorTipos.set('');
    this.tipoEmpaqueId.set('');
    if (!opcion.value) {
      this.formatoId.set('');
      this.tiposEmpaque.set([]);
      return;
    }
    if (!this.connectivity.online()) {
      this.errorTipos.set('No hay conexión a internet');
      return;
    }
    this.cargandoTipos.set(true);
    try {
      const tipos = await this.recoleccion.tiposEmpaqueDeFormato(opcion.value);
      this.formatoId.set(opcion.value);
      this.tiposEmpaque.set(tipos);
      if (tipos.length === 0) this.errorTipos.set('La matriz de compatibilidad no tiene tipos de empaque para este formato.');
    } catch (e) {
      this.errorTipos.set(e instanceof Error && e.message ? e.message : 'No se pudieron consultar los tipos de empaque.');
    } finally {
      this.cargandoTipos.set(false);
    }
  }

  protected elegirTipo(opcion: SearchSelectOption): void {
    this.tipoEmpaqueId.set(opcion.value);
  }

  protected comenzar(): void {
    if (!this.formatoId() || !this.tipoEmpaqueId()) return;
    this.escaneando.set(true);
  }

  /** "Cancelar" en la cámara vuelve a la elección de formato (por si hay que cambiarlo); desde ahí se sale. */
  protected volverAEleccion(): void {
    this.panel.set(null);
    this.resultadoEscaner.set(null);
    this.escaneando.set(false);
  }

  // ---- Escaneo ----

  /** Termina de atender un código: quita el panel y la cámara vuelve a abrirse. */
  protected seguirEscaneando(): void {
    this.panel.set(null);
    this.errorGuardar.set('');
    this.resultadoEscaner.set(null);
  }

  protected async alLeerQr(valor: string): Promise<void> {
    this.errorGuardar.set('');
    this.resultadoEscaner.set({ codigo: valor, buscando: true, error: '', trabajador: null });
    this.panel.set({ tipo: 'buscando' });
    try {
      let puesto = this.puestoDe(valor);
      if (!puesto) {
        // Puede que lo hayan asignado hace un momento (otro dispositivo): se vuelven a leer los puestos una vez.
        if (this.connectivity.online()) {
          try { await this.store.cargarPuestos(); } catch { /* si falla, se sigue con lo que hay */ }
        }
        puesto = this.puestoDe(valor);
      }
      let nombre = '';
      if (!puesto) {
        // El código leído puede no ser el documento tal cual: se busca al trabajador para conocer su número y se reintenta.
        if (!this.connectivity.online()) {
          this.panel.set({ tipo: 'error', mensaje: 'No hay conexión a internet' });
          return;
        }
        const r = await this.jornadasApi.buscarTrabajador(valor);
        const trabajador = r.error ? null : (r.data?.[0] ?? null);
        if (!trabajador) {
          this.panel.set({ tipo: 'error', mensaje: r.mensaje || 'No se encontró al trabajador.' });
          return;
        }
        nombre = texto(trabajador['nombreCompleto']);
        puesto = this.puestoDe(texto(trabajador['numeroDocumento']));
        if (!puesto) {
          this.panel.set({ tipo: 'error', mensaje: `${nombre} no está asignado a ningún puesto.` });
          return;
        }
      }

      const empacador = puesto;
      const claveDeLinea = claveLinea(empacador);
      const linea = this.store.misLineas().find((l) => claveLinea(l) === claveDeLinea);
      if (!linea) {
        const otra = this.store.lineas().find((l) => claveLinea(l) === claveDeLinea);
        const donde = otra ? `en ${lineaTexto(otra)}, que es de otro anotador` : 'en una línea que no es tuya';
        this.panel.set({ tipo: 'error', mensaje: `${texto(empacador['nombreCompleto'])} está ${donde}.` });
        return;
      }
      const existente = this.recoleccion.registroDe(empacador);
      this.cantidad.set(existente?.cantidad ?? 0);
      this.capFormatoId.set(this.formatoId());
      this.capTipoId.set(this.tipoEmpaqueId());
      this.capTipos.set(this.tiposEmpaque());
      this.panel.set({ tipo: 'captura', linea, puesto: Number(empacador['puesto']), empacador, existente });
    } catch {
      this.panel.set({ tipo: 'error', mensaje: 'No se pudo buscar al trabajador.' });
    }
  }

  /** Puesto (con su empacador) donde está asignado el documento, en cualquier línea del acopio. */
  private puestoDe(documento: string): Fila | undefined {
    const doc = documento.trim();
    if (!doc) return undefined;
    return [...this.store.asignados().values()].find((e) => texto(e['numeroDocumento']) === doc);
  }

  // ---- Captura de cajas ----

  /** El empacador ya tenía cajas con otro formato o tipo de empaque: al guardar pasan a lo elegido aquí. */
  protected cambiaEmpaque(existente: CajasRegistradas | undefined): boolean {
    return !!existente && (existente.formatoId !== this.capFormatoId() || existente.tipoEmpaqueId !== this.capTipoId());
  }

  /** Cambia el formato solo para este empacador: se piden los tipos de empaque que la matriz permite y se vuelve a elegir el tipo. */
  protected async elegirFormatoCaptura(opcion: SearchSelectOption): Promise<void> {
    if (opcion.value === this.capFormatoId()) return;
    this.errorGuardar.set('');
    this.capTipoId.set('');
    if (!opcion.value) {
      this.capFormatoId.set('');
      this.capTipos.set([]);
      return;
    }
    if (!this.connectivity.online()) {
      this.errorGuardar.set('No hay conexión a internet');
      return;
    }
    this.capCargando.set(true);
    try {
      const tipos = await this.recoleccion.tiposEmpaqueDeFormato(opcion.value);
      this.capFormatoId.set(opcion.value);
      this.capTipos.set(tipos);
      if (tipos.length === 0) this.errorGuardar.set('La matriz de compatibilidad no tiene tipos de empaque para este formato.');
    } catch (e) {
      this.errorGuardar.set(e instanceof Error && e.message ? e.message : 'No se pudieron consultar los tipos de empaque.');
    } finally {
      this.capCargando.set(false);
    }
  }

  protected elegirTipoCaptura(opcion: SearchSelectOption): void {
    this.capTipoId.set(opcion.value);
  }

  protected sumar(delta: number): void {
    this.cantidad.update((c) => Math.min(MAX_CAJAS, Math.max(0, c + delta)));
  }

  protected escribir(campo: HTMLInputElement): void {
    const digitos = campo.value.replace(/\D/g, '');
    const n = digitos === '' ? 0 : Math.min(MAX_CAJAS, parseInt(digitos, 10));
    campo.value = n > 0 ? String(n) : '';
    this.cantidad.set(n);
  }

  protected soloDigitos(e: KeyboardEvent): void {
    if (e.ctrlKey || e.metaKey || e.altKey || e.key.length > 1) return;
    if (!/^\d$/.test(e.key)) e.preventDefault();
  }

  protected async guardar(): Promise<void> {
    const p = this.panel();
    if (p?.tipo !== 'captura' || this.guardando()) return;
    const cantidad = this.cantidad();
    if (!this.capFormatoId() || !this.capTipoId()) {
      this.errorGuardar.set('Elige el formato y el tipo de empaque.');
      return;
    }
    if (cantidad < 1) {
      this.errorGuardar.set('Escribe cuántas cajas tiene.');
      return;
    }
    if (!this.connectivity.online()) {
      this.errorGuardar.set('No hay conexión a internet');
      return;
    }
    this.errorGuardar.set('');
    this.guardando.set(true);
    const tipoEmpaqueId = this.capTipoId();
    try {
      const resp = await this.recoleccion.registrarCajas({
        ...refLinea(p.linea),
        puesto: p.puesto,
        formatoId: this.capFormatoId(),
        tipoEmpaqueId,
        cantidad,
        calibreNombre: this.recoleccion.calibreDe(tipoEmpaqueId) || (p.existente?.tipoEmpaqueId === tipoEmpaqueId ? p.existente.calibreNombre : ''),
      });
      if (resp.error) {
        this.errorGuardar.set(resp.mensaje || 'No se pudieron registrar las cajas.');
        return;
      }
      const nombre = texto(p.empacador['nombreCompleto']);
      const accion = texto(resp.data?.[0]?.['accion']);
      this.mostrarAviso(accion === 'SINCAMBIOS' ? `Sin cambios: ${nombre} ya tenía ${cantidad} caja(s).` : `${nombre}: ${cantidad} caja(s) ${accion === 'UPDATE' ? 'actualizadas' : 'guardadas'}.`);
      this.seguirEscaneando();
    } catch {
      this.errorGuardar.set('No se pudieron registrar las cajas.');
    } finally {
      this.guardando.set(false);
    }
  }

  private mostrarAviso(mensaje: string): void {
    this.aviso.set(mensaje);
    if (this.temporizadorAviso) clearTimeout(this.temporizadorAviso);
    this.temporizadorAviso = setTimeout(() => this.aviso.set(''), 3000);
  }
}
