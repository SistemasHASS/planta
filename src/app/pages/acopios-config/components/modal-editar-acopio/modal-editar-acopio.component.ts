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

/** Un tipo de proceso empacado que se puede marcar. */
interface TipoDisponible {
  codigo: string;
  nombre: string;
}

/**
 * Ventana para editar un acopio (solo administrador, solo en línea): serie de guía y tipos de proceso empacado activos.
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
    return [...codigos].some((codigo) => !!ahora[codigo] !== !!this.marcadosIniciales[codigo]);
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
      const [respTipos, respSeries] = await Promise.all([
        this.catalogosApi.porProyecto('tiposProcesoEmpacado', this.idProyecto()),
        this.administracionApi.correlativosDocumentos(),
      ]);

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

  async guardar(): Promise<void> {
    if (!this.connectivity.online()) {
      this.feedback.warning('Necesitas internet para guardar los cambios.', 'Sin conexión');
      return;
    }

    const codigoAcopio = texto(this.acopio().codigoAcopio);
    const marcados = this.marcados();

    // Se envían los tipos que el acopio ya tenía (activos o no) y los que se marcaron ahora.
    const codigos = new Set([...Object.keys(this.marcadosIniciales), ...Object.keys(marcados).filter((c) => marcados[c])]);

    const json = JSON.stringify([{ codigoAcopio, acopioNombre: texto(this.acopio().acopioNombre), serieGuia: this.serieGuia().trim() }]);
    const jsonDetalle = JSON.stringify(
      [...codigos].map((codigo) => ({ codigoAcopio, codigoTipoProcesoEmpacado: codigo, activo: !!marcados[codigo] })),
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
