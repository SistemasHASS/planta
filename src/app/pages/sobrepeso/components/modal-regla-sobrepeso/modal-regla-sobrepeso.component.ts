import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideGauge, LucideSave, LucideX } from '@lucide/angular';
import { SearchSelectComponent, SearchSelectOption } from '../../../../shared/components/search-select/search-select.component';
import { AdministracionApiService } from '../../../../shared/services/administracion-api.service';
import { CatalogosApiService } from '../../../../shared/services/catalogos-api.service';
import { ConnectivityService } from '../../../../shared/services/connectivity.service';
import { FeedbackModalService } from '../../../../shared/services/feedback-modal.service';
import { LoadingService } from '../../../../shared/services/loading.service';
import { opcionesDe } from '../../../../shared/utils/opciones-select';
import { portalToBody } from '../../../../shared/utils/portal';
import { ReglaSobrepeso, reglaAJson } from '../../sobrepeso.interface';

const texto = (valor: unknown): string => String(valor ?? '').trim();

/**
 * Ventana para crear o editar una regla de sobrepeso (solo administrador, solo en línea). Al guardar la envía de
 * frente al servidor. No guarda nada en el equipo. Avisa con saved(mensaje) o closed().
 */
@Component({
  selector: 'app-modal-regla-sobrepeso',
  imports: [FormsModule, SearchSelectComponent, LucideGauge, LucideSave, LucideX],
  templateUrl: './modal-regla-sobrepeso.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModalReglaSobrepesoComponent implements OnInit {
  constructor() {
    portalToBody();
  }

  private readonly administracionApi = inject(AdministracionApiService);
  private readonly catalogosApi = inject(CatalogosApiService);
  private readonly connectivity = inject(ConnectivityService);
  private readonly loading = inject(LoadingService);
  private readonly feedback = inject(FeedbackModalService);

  /** Regla que se edita (null = regla nueva) y la campaña a la que pertenece. */
  readonly regla = input<ReglaSobrepeso | null>(null);
  readonly idProyecto = input.required<string>();
  readonly codigoCultivo = input.required<string>();

  /** Listas de los buscadores de consignatario, destino y transporte (salen de los catálogos del equipo). */
  readonly optConsignatarios = input.required<SearchSelectOption[]>();
  readonly optDestinos = input.required<SearchSelectOption[]>();
  readonly optTransportes = input.required<SearchSelectOption[]>();

  readonly saved = output<string>();
  readonly closed = output<void>();

  /** Formatos de la campaña: se piden al servidor recién al abrir esta ventana. */
  readonly optFormatos = signal<SearchSelectOption[]>([]);
  readonly cargando = signal(false);

  readonly esNueva = computed(() => !this.regla());
  readonly intento = signal(false);

  // Lo que la persona va escribiendo
  readonly documentoConsignatario = signal('');
  readonly formatoId = signal('');
  readonly destinoId = signal('');
  readonly transporteId = signal('');
  /** Decimal como texto (0.0200 = 2 %). */
  readonly porcentaje = signal('');
  readonly descripcion = signal('');
  readonly vigenciaDesde = signal('');
  readonly vigenciaHasta = signal('');
  readonly activo = signal(true);

  private inicial = '';

  /** Porcentaje escrito, como número (null si no es válido). */
  readonly porcentajeNumero = computed(() => {
    const t = this.porcentaje().trim().replace(',', '.');
    if (!t) return null;
    const n = Number(t);
    return Number.isFinite(n) && n >= 0 && n < 10 ? n : null;
  });

  /** El rango de fechas es válido cuando "hasta" no es anterior a "desde". */
  readonly rangoInvalido = computed(() => !!this.vigenciaDesde() && !!this.vigenciaHasta() && this.vigenciaHasta() < this.vigenciaDesde());

  readonly valido = computed(
    () => !!this.documentoConsignatario() && !!this.formatoId() && !!this.destinoId() && !!this.transporteId() && this.porcentajeNumero() !== null && !this.rangoInvalido(),
  );

  readonly hayCambios = computed(() => this.esNueva() || this.resumen() !== this.inicial);

  private resumen(): string {
    return JSON.stringify([
      this.documentoConsignatario(), this.formatoId(), this.destinoId(), this.transporteId(), this.porcentajeNumero(),
      this.descripcion().trim(), this.vigenciaDesde(), this.vigenciaHasta(), this.activo(),
    ]);
  }

  async ngOnInit(): Promise<void> {
    const r = this.regla();
    if (r) {
      this.documentoConsignatario.set(r.documentoConsignatario);
      this.formatoId.set(r.formatoId);
      this.destinoId.set(r.destinoId);
      this.transporteId.set(r.transporteId);
      this.porcentaje.set(String(r.porcentaje));
      this.descripcion.set(r.descripcion);
      this.vigenciaDesde.set(r.vigenciaDesde);
      this.vigenciaHasta.set(r.vigenciaHasta);
      this.activo.set(r.activo);
    }
    this.inicial = this.resumen();
    await this.cargarFormatos();
  }

  /** Pide al servidor los formatos de la campaña (solo cuando se abre la ventana). */
  private async cargarFormatos(): Promise<void> {
    if (!this.connectivity.online()) {
      this.feedback.error('Error de conexión: necesitas internet para editar la regla.', 'Sin conexión');
      return;
    }
    this.cargando.set(true);
    this.loading.show('Cargando formatos...');
    try {
      const sobre = await this.catalogosApi.porCultivo('formatos', texto(this.codigoCultivo()));
      this.optFormatos.set(opcionesDe(Array.isArray(sobre?.data) && !sobre.error ? sobre.data : [], 'id', ['descripcion']));
    } catch {
      this.feedback.error('Error de conexión: no se pudieron cargar los formatos.', 'Sin conexión');
    } finally {
      this.cargando.set(false);
      await this.loading.hideAfterMinimum();
    }
  }

  async guardar(): Promise<void> {
    this.intento.set(true);
    if (!this.valido()) return;
    if (!this.connectivity.online()) {
      this.feedback.warning('Necesitas internet para guardar la regla.', 'Sin conexión');
      return;
    }

    const base: ReglaSobrepeso = {
      id: this.regla()?.id ?? 0,
      documentoConsignatario: this.documentoConsignatario(),
      formatoId: this.formatoId(),
      destinoId: this.destinoId(),
      transporteId: this.transporteId(),
      porcentaje: this.porcentajeNumero() ?? 0,
      vigenciaDesde: this.vigenciaDesde(),
      vigenciaHasta: this.vigenciaHasta(),
      descripcion: this.descripcion().trim(),
      activo: this.activo(),
      consignatarioNombre: '',
      formatoNombre: '',
      destinoNombre: '',
      transporteNombre: '',
    };
    const modo = this.esNueva() ? 'nuevo' : 'editado';

    this.loading.show('Guardando regla...');
    try {
      const respuesta = await this.administracionApi.sincronizarReglasSobrepeso(reglaAJson(base, modo, texto(this.idProyecto()), texto(this.codigoCultivo())));
      this.loading.hide();
      if (respuesta?.error) {
        this.feedback.error(respuesta.mensaje || 'No se pudo guardar la regla.');
        return;
      }
      this.saved.emit(modo === 'editado' ? 'Regla actualizada correctamente.' : 'Regla creada correctamente.');
    } catch {
      this.loading.hide();
      this.feedback.error('Ocurrió un error inesperado al guardar.');
    }
  }
}
