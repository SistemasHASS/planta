import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideSave, LucideX } from '@lucide/angular';
import { Campania } from '../../../../shared/interfaces/catalogo.interface';
import { AdministracionApiService } from '../../../../shared/services/administracion-api.service';
import { ConnectivityService } from '../../../../shared/services/connectivity.service';
import { FeedbackModalService } from '../../../../shared/services/feedback-modal.service';
import { LoadingService } from '../../../../shared/services/loading.service';
import { portalToBody } from '../../../../shared/utils/portal';
import { VariedadFila, texto } from '../../variedades.interface';

/**
 * Ventana para crear una variedad de ensayo o editar una variedad.
 * De las variedades del maestro solo se cambia la procedencia; de las de ensayo también el nombre.
 * Solo en línea: envía de frente al servidor. Avisa con saved(mensaje) o closed().
 */
@Component({
  selector: 'app-modal-variedad',
  imports: [FormsModule, LucideSave, LucideX],
  templateUrl: './modal-variedad.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModalVariedadComponent implements OnInit {
  constructor() {
    portalToBody();
  }

  private readonly administracionApi = inject(AdministracionApiService);
  private readonly connectivity = inject(ConnectivityService);
  private readonly loading = inject(LoadingService);
  private readonly feedback = inject(FeedbackModalService);

  /** Variedad que se edita (null = nueva de ensayo). */
  readonly registro = input<VariedadFila | null>(null);
  readonly campania = input<Campania | null>(null);

  readonly saved = output<string>();
  readonly closed = output<void>();

  readonly esNuevo = computed(() => !this.registro());
  /** El nombre solo se cambia en las variedades de ensayo (y al crear). */
  readonly nombreEditable = computed(() => this.esNuevo() || !!this.registro()?.esEnsayo);

  readonly variedad = signal('');
  readonly procedencia = signal('');
  readonly intento = signal(false);

  private inicial = '';

  readonly valido = computed(() => !!this.variedad().trim());
  readonly hayCambios = computed(() => this.esNuevo() || this.resumen() !== this.inicial);

  private resumen(): string {
    return JSON.stringify([this.variedad().trim(), this.procedencia().trim()]);
  }

  ngOnInit(): void {
    const r = this.registro();
    this.variedad.set(r?.variedad ?? '');
    this.procedencia.set(r?.procedencia ?? '');
    this.inicial = this.resumen();
  }

  async guardar(): Promise<void> {
    this.intento.set(true);
    if (!this.valido()) return;
    if (!this.connectivity.online()) {
      this.feedback.warning('Necesitas internet para guardar.', 'Sin conexión');
      return;
    }
    const r = this.registro();
    const c = this.campania();
    const json = JSON.stringify([
      {
        id: r ? r.codigo || r.idvariedad : '',
        cultivo: texto(c?.fruta) || r?.cultivo || '',
        idcultivo: texto(c?.codcultivo) || r?.idcultivo || '',
        variedad: this.variedad().trim(),
        procedencia: this.procedencia().trim() || null,
        esEnsayo: r ? r.esEnsayo : true,
        eliminado: false,
      },
    ]);
    this.loading.show('Guardando...');
    try {
      const respuesta = await this.administracionApi.sincronizarVariedades(json);
      this.loading.hide();
      if (respuesta?.error) {
        this.feedback.error(respuesta.mensaje || 'No se pudo guardar.');
        return;
      }
      this.saved.emit(r ? 'Variedad actualizada correctamente.' : 'Variedad de ensayo creada correctamente.');
    } catch {
      this.loading.hide();
      this.feedback.error('Ocurrió un error inesperado al guardar.');
    }
  }
}
