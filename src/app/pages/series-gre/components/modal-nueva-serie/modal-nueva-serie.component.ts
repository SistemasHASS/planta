import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideFilePlus, LucideSave, LucideX } from '@lucide/angular';
import { AdministracionApiService } from '../../../../shared/services/administracion-api.service';
import { ConnectivityService } from '../../../../shared/services/connectivity.service';
import { FeedbackModalService } from '../../../../shared/services/feedback-modal.service';
import { LoadingService } from '../../../../shared/services/loading.service';
import { portalToBody } from '../../../../shared/utils/portal';
import { SerieGre } from '../../series-gre.interface';

/**
 * Ventana para crear una serie de guía (solo administrador, solo en línea): serie de 4 caracteres y número inicial
 * (hasta 8 dígitos; el servidor lo completa con ceros). Al guardar lo envía de frente al servidor.
 * No guarda nada en el equipo. Avisa con saved(mensaje) o closed().
 */
@Component({
  selector: 'app-modal-nueva-serie',
  imports: [FormsModule, LucideFilePlus, LucideSave, LucideX],
  templateUrl: './modal-nueva-serie.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModalNuevaSerieComponent {
  constructor() {
    portalToBody();
  }

  private readonly administracionApi = inject(AdministracionApiService);
  private readonly connectivity = inject(ConnectivityService);
  private readonly loading = inject(LoadingService);
  private readonly feedback = inject(FeedbackModalService);

  /** Series que ya existen (para no repetir). */
  readonly seriesExistentes = input.required<SerieGre[]>();

  readonly saved = output<string>();
  readonly closed = output<void>();

  readonly serie = signal('');
  readonly numero = signal('');
  readonly intento = signal(false);

  readonly serieRepetida = computed(() => this.seriesExistentes().some((s) => s.serie.toUpperCase() === this.serie().trim().toUpperCase()));
  readonly valido = computed(() => this.serie().trim().length > 0 && this.numero().trim().length > 0 && !this.serieRepetida());

  /** La serie va en mayúsculas y sin espacios. */
  cambiarSerie(valor: string): void {
    this.serie.set(valor.toUpperCase().replace(/\s/g, ''));
  }

  /** El número solo admite dígitos. */
  cambiarNumero(valor: string): void {
    this.numero.set(valor.replace(/\D/g, ''));
  }

  async guardar(): Promise<void> {
    this.intento.set(true);
    if (!this.valido()) return;
    if (!this.connectivity.online()) {
      this.feedback.warning('Necesitas internet para guardar la serie.', 'Sin conexión');
      return;
    }

    const json = JSON.stringify([{ id: 0, modo: 'nuevo', serie: this.serie().trim(), numero: this.numero().trim().padStart(8, '0'), eliminado: false }]);
    this.loading.show('Guardando serie...');
    try {
      const respuesta = await this.administracionApi.sincronizarCorrelativos(json);
      this.loading.hide();
      if (respuesta?.error) {
        this.feedback.error(respuesta.mensaje || 'No se pudo guardar la serie.');
        return;
      }
      this.saved.emit('Serie creada correctamente.');
    } catch {
      this.loading.hide();
      this.feedback.error('Ocurrió un error inesperado al guardar.');
    }
  }
}
