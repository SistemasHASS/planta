import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideBuilding2, LucideSave, LucideSearch, LucideX } from '@lucide/angular';
import { SearchSelectComponent, SearchSelectOption } from '../../../../shared/components/search-select/search-select.component';
import { AdministracionApiService } from '../../../../shared/services/administracion-api.service';
import { CatalogosApiService } from '../../../../shared/services/catalogos-api.service';
import { ConnectivityService } from '../../../../shared/services/connectivity.service';
import { FeedbackModalService } from '../../../../shared/services/feedback-modal.service';
import { LoadingService } from '../../../../shared/services/loading.service';
import { portalToBody } from '../../../../shared/utils/portal';
import { AcopioConfig } from '../../acopios-config.interface';

const texto = (valor: unknown): string => String(valor ?? '').trim();

/** Máximo que acepta la base (decimal 10,2 con tope en 99999.99). */
const TAREA_MAXIMA = 99999.99;

/** Un tipo de proceso empacado que se puede marcar. */
interface TipoDisponible {
  codigo: string;
  nombre: string;
}

/**
 * Ventana para editar un acopio (solo administrador, solo en línea): serie de guía y tipos de proceso empacado activos.
 * Con el parámetro Flujo_Empaque activo, cada tipo marcado pide también los kilos de la tarea (meta de un empacador); sin el parámetro no se muestra ni se envía.
 * Al abrirse pide al servidor los tipos y las series disponibles; al guardar envía los cambios.
 * No guarda nada en el equipo. Avisa a la pantalla con saved(mensaje) o closed().
 */
@Component({
  selector: 'app-modal-editar-acopio',
  imports: [FormsModule, SearchSelectComponent, LucideBuilding2, LucideSave, LucideSearch, LucideX],
  templateUrl: './modal-editar-acopio.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModalEditarAcopioComponent implements OnInit {
  constructor() {
    portalToBody();
  }

  private readonly catalogosApi = inject(CatalogosApiService);
  private readonly administracionApi = inject(AdministracionApiService);
  private readonly connectivity = inject(ConnectivityService);
  private readonly loading = inject(LoadingService);
  private readonly feedback = inject(FeedbackModalService);

  /** Acopio que se edita y campaña a la que pertenece. */
  readonly acopio = input.required<AcopioConfig>();
  readonly idProyecto = input.required<string>();

  /** saved: se guardó bien (la pantalla recarga la lista). closed: se canceló. */
  readonly saved = output<string>();
  readonly closed = output<void>();

  readonly cargando = signal(false);
  readonly tipos = signal<TipoDisponible[]>([]);
  readonly series = signal<string[]>([]);

  /** Lo que la persona va eligiendo: la serie y qué tipos están marcados (código → marcado). */
  readonly serieGuia = signal('');
  readonly marcados = signal<Record<string, boolean>>({});
  readonly filtroTipos = signal('');

  /** Parámetro Flujo_Empaque activo: solo entonces se piden los kilos por tarea. */
  readonly flujoEmpaque = signal(false);
  /** Kilos por tarea escritos por tipo (código → texto del campo) y los que tenía guardados al abrir. */
  readonly tareas = signal<Record<string, string>>({});
  private tareasIniciales: Record<string, string> = {};

  /** Valores con los que se abrió la ventana, para saber si hubo cambios. */
  protected serieInicial = '';
  private marcadosIniciales: Record<string, boolean> = {};

  readonly opcionesSerie = computed<SearchSelectOption[]>(() => [
    { value: '', label: '— Seleccione serie —' },
    ...this.series().map((serie) => ({ value: serie, label: serie })),
  ]);

  /** Tipos que coinciden con lo escrito en el buscador de la ventana. */
  readonly tiposFiltrados = computed(() => {
    const buscado = this.filtroTipos().trim().toLowerCase();
    if (!buscado) return this.tipos();
    return this.tipos().filter((t) => `${t.codigo} ${t.nombre}`.toLowerCase().includes(buscado));
  });

  readonly cantidadMarcados = computed(() => Object.values(this.marcados()).filter(Boolean).length);

  readonly hayCambios = computed(() => {
    if (this.serieGuia().trim() !== this.serieInicial) return true;
    const ahora = this.marcados();
    const codigos = new Set([...Object.keys(ahora), ...Object.keys(this.marcadosIniciales)]);
    if ([...codigos].some((codigo) => !!ahora[codigo] !== !!this.marcadosIniciales[codigo])) return true;
    if (!this.flujoEmpaque()) return false;
    const tareas = this.tareas();
    return Object.keys(ahora).some((codigo) => ahora[codigo] && Number(tareas[codigo] ?? '') !== Number(this.tareasIniciales[codigo] ?? ''));
  });

  async ngOnInit(): Promise<void> {
    // Punto de partida: lo que el acopio ya tiene guardado.
    this.serieInicial = texto(this.acopio().serieGuia);
    this.serieGuia.set(this.serieInicial);
    const inicial: Record<string, boolean> = {};
    for (const tipo of this.acopio().tiposProcesoEmpacado) inicial[texto(tipo.codigo)] = tipo.activo !== false;
    this.marcadosIniciales = { ...inicial };
    this.marcados.set({ ...inicial });

    await this.cargarOpciones();
    this.prepararTareas();
  }

  /** Con el flujo de empaque activo: muestra solo los kilos por tarea que cada tipo ya tiene guardados (si no tiene, el campo queda vacío). */
  private prepararTareas(): void {
    if (!this.flujoEmpaque()) return;
    const guardadas: Record<string, string> = {};
    for (const tipo of this.acopio().tiposProcesoEmpacado) {
      if (tipo.kilosTarea != null && Number(tipo.kilosTarea) > 0) guardadas[texto(tipo.codigo)] = String(Number(tipo.kilosTarea));
    }
    this.tareasIniciales = { ...guardadas };
    this.tareas.set({ ...guardadas });
  }

  /** Pide al servidor los tipos de proceso empacado y las series de guía que se pueden elegir. */
  private async cargarOpciones(): Promise<void> {
    if (!this.connectivity.online()) {
      this.feedback.error('Error de conexión: necesitas internet para editar el acopio.', 'Sin conexión');
      return;
    }

    this.cargando.set(true);
    this.loading.show('Cargando datos del acopio...');
    try {
      const [respTipos, respSeries, respFlujo] = await Promise.all([
        this.catalogosApi.porProyecto('tiposProcesoEmpacado', this.idProyecto()),
        this.administracionApi.correlativosDocumentos(),
        // Si no se puede leer el parámetro, la ventana funciona como siempre (sin kilos por tarea).
        this.administracionApi.parametro('Flujo_Empaque').catch(() => null),
      ]);

      const filasFlujo = Array.isArray(respFlujo?.data) && !respFlujo?.error ? respFlujo.data : [];
      this.flujoEmpaque.set(filasFlujo.some((p) => texto(p['valor']).toUpperCase() === 'SI' && p['activo'] !== false && p['activo'] !== 0));

      const filasTipos = Array.isArray(respTipos?.data) && !respTipos.error ? respTipos.data : [];
      this.tipos.set(
        filasTipos
          .filter((fila) => fila['activo'] !== false && Number(fila['activo']) !== 0)
          .map((fila) => ({ codigo: texto(fila['codigo']), nombre: texto(fila['nombre']) }))
          .filter((tipo) => tipo.codigo),
      );

      // Series que no están eliminadas (sin repetir). Si el acopio tiene una serie que ya no está en la lista, se conserva.
      const filasSeries = Array.isArray(respSeries?.data) && !respSeries.error ? respSeries.data : [];
      const series = filasSeries.filter((fila) => !this.esVerdadero(fila['eliminado'])).map((fila) => texto(fila['serie'])).filter(Boolean);
      if (this.serieInicial) series.push(this.serieInicial);
      this.series.set([...new Set(series)]);
    } catch {
      this.feedback.error('Error de conexión: no se pudieron cargar las opciones.', 'Sin conexión');
    } finally {
      this.cargando.set(false);
      await this.loading.hideAfterMinimum();
    }
  }

  /** El servidor puede mandar bit como true/false, 1/0 o texto. */
  private esVerdadero(valor: unknown): boolean {
    if (typeof valor === 'string') return ['1', 'true', 'si', 'sí'].includes(valor.trim().toLowerCase());
    return valor === true || valor === 1;
  }

  estaMarcado(codigo: string): boolean {
    return !!this.marcados()[codigo];
  }

  /** Marca o desmarca todos los tipos que se están viendo (respeta el buscador). */
  marcarTodos(marcado: boolean): void {
    this.marcados.update((actual) => {
      const nuevo = { ...actual };
      for (const tipo of this.tiposFiltrados()) nuevo[tipo.codigo] = marcado;
      return nuevo;
    });
  }

  marcar(codigo: string, marcado: boolean): void {
    this.marcados.update((actual) => ({ ...actual, [codigo]: marcado }));
  }

  /** Lo que se escribe en kilos por tarea: solo números con hasta 2 decimales (también al pegar). */
  escribirTarea(codigo: string, campo: HTMLInputElement): void {
    let valor = campo.value.replace(',', '.').replace(/[^\d.]/g, '');
    const punto = valor.indexOf('.');
    if (punto >= 0) valor = valor.slice(0, punto + 1) + valor.slice(punto + 1).replace(/\./g, '').slice(0, 2);
    valor = valor.replace(/^0+(?=\d)/, '').slice(0, 8);
    if (campo.value !== valor) campo.value = valor;
    this.tareas.update((actual) => ({ ...actual, [codigo]: valor }));
  }

  /** Bloquea al teclear lo que no sirve en un número: la "e", signos y letras (las teclas de control y atajos siguen funcionando). */
  soloNumero(e: KeyboardEvent): void {
    if (e.ctrlKey || e.metaKey || e.altKey || e.key.length > 1) return;
    if (!/^[\d.,]$/.test(e.key)) e.preventDefault();
  }

  async guardar(): Promise<void> {
    if (!this.connectivity.online()) {
      this.feedback.warning('Necesitas internet para guardar los cambios.', 'Sin conexión');
      return;
    }

    const codigoAcopio = texto(this.acopio().codigoAcopio);
    const marcados = this.marcados();

    // Se envían los tipos que el acopio ya tenía (activos o no) y los que se marcaron ahora.
    const codigos = new Set([...Object.keys(this.marcadosIniciales), ...Object.keys(marcados).filter((c) => marcados[c])]);

    // Con el flujo de empaque activo, los kilos por tarea se envían solo si son mayores que 0 (0 o vacío = se deja como está).
    const conTarea = this.flujoEmpaque();
    const tareas = this.tareas();
    const conKilos = (codigo: string): boolean => !!marcados[codigo] && conTarea && Number(tareas[codigo]) > 0;
    if (conTarea) {
      const invalida = this.tipos().find((t) => conKilos(t.codigo) && Number(tareas[t.codigo]) > TAREA_MAXIMA);
      if (invalida) {
        this.feedback.warning(`Los kilos por tarea de ${invalida.nombre} no pueden pasar de 99999.99.`, 'Kilos por tarea');
        return;
      }
    }

    const json = JSON.stringify([{ codigoAcopio, acopioNombre: texto(this.acopio().acopioNombre), serieGuia: this.serieGuia().trim() }]);
    const jsonDetalle = JSON.stringify(
      [...codigos].map((codigo) => ({
        codigoAcopio,
        codigoTipoProcesoEmpacado: codigo,
        activo: !!marcados[codigo],
        ...(conKilos(codigo) ? { kilosTarea: Number(tareas[codigo]) } : {}),
      })),
    );

    this.loading.show('Guardando cambios...');
    try {
      const respuesta = await this.administracionApi.sincronizarAcopiosConfig(json, jsonDetalle);
      this.loading.hide();
      if (respuesta?.error) {
        this.feedback.error(respuesta.mensaje || 'No se pudo guardar la configuración del acopio.');
        return;
      }
      this.saved.emit(respuesta?.mensaje || 'Configuración del acopio guardada correctamente.');
    } catch {
      this.loading.hide();
      this.feedback.error('Ocurrió un error inesperado al guardar.');
    }
  }
}
