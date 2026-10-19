import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideFileText, LucideInbox, LucidePlus, LucidePower, LucideRefreshCcw, LucideSearch, LucideWifiOff, LucideX } from '@lucide/angular';
import { PaginatorComponent } from '../../shared/components/paginator/paginator.component';
import { SearchSelectComponent, SearchSelectOption } from '../../shared/components/search-select/search-select.component';
import { AdministracionApiService } from '../../shared/services/administracion-api.service';
import { AlertaService } from '../../shared/services/alerta.service';
import { ConfirmModalService } from '../../shared/services/confirm-modal.service';
import { ConnectivityService } from '../../shared/services/connectivity.service';
import { FeedbackModalService } from '../../shared/services/feedback-modal.service';
import { LoadingService } from '../../shared/services/loading.service';
import { crearPaginacion } from '../../shared/utils/paginacion';
import { ModalNuevaSerieComponent } from './components/modal-nueva-serie/modal-nueva-serie.component';
import { SerieGre } from './series-gre.interface';

const texto = (valor: unknown): string => String(valor ?? '').trim();

/** El servidor puede mandar bit como true/false, 1/0 o texto. */
const esVerdadero = (valor: unknown): boolean => {
  if (typeof valor === 'string') return ['1', 'true', 'si', 'sí'].includes(valor.trim().toLowerCase());
  return valor === true || valor === 1;
};

type FiltroEstado = '' | 'activas' | 'inactivas';

/**
 * Series de guía de remisión (solo administrador, solo en línea): se ven las series, se crea una nueva y se
 * activa o desactiva. Todo se lee y se guarda en el servidor; no se guarda nada en el equipo.
 */
@Component({
  selector: 'app-series-gre',
  imports: [FormsModule, PaginatorComponent, SearchSelectComponent, ModalNuevaSerieComponent, LucideFileText, LucideInbox, LucidePlus, LucidePower, LucideRefreshCcw, LucideSearch, LucideWifiOff, LucideX],
  templateUrl: './series-gre.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SeriesGreComponent implements OnInit {
  private readonly administracionApi = inject(AdministracionApiService);
  private readonly connectivity = inject(ConnectivityService);
  private readonly loading = inject(LoadingService);
  private readonly feedback = inject(FeedbackModalService);
  private readonly alertService = inject(AlertaService);
  private readonly confirmModal = inject(ConfirmModalService);

  readonly online = computed(() => this.connectivity.online());

  readonly series = signal<SerieGre[]>([]);
  readonly filtroTexto = signal('');
  readonly filtroEstado = signal<FiltroEstado>('');
  /** Ventana de nueva serie abierta. */
  readonly creando = signal(false);

  readonly estadoOpciones: SearchSelectOption[] = [
    { value: '', label: 'Todos los estados' },
    { value: 'activas', label: 'Activas' },
    { value: 'inactivas', label: 'Inactivas' },
  ];

  /** Series que cumplen el estado elegido y lo escrito (serie o número). */
  readonly seriesFiltradas = computed(() => {
    const buscado = this.filtroTexto().trim().toLowerCase();
    const estado = this.filtroEstado();
    return this.series().filter((s) => {
      if (estado === 'activas' && s.eliminado) return false;
      if (estado === 'inactivas' && !s.eliminado) return false;
      if (!buscado) return true;
      return [s.serie, s.numero].some((valor) => texto(valor).toLowerCase().includes(buscado));
    });
  });
  readonly paginacion = crearPaginacion(() => this.seriesFiltradas(), 25);

  async ngOnInit(): Promise<void> {
    await this.cargarSeries();
  }

  /** Pide al servidor las series y las muestra (no guarda nada en el equipo). */
  async cargarSeries(): Promise<void> {
    if (!this.online()) {
      this.series.set([]);
      this.feedback.error('Error de conexión: necesitas internet para ver las series.', 'Sin conexión');
      return;
    }

    this.loading.show('Cargando series...');
    try {
      const sobre = await this.administracionApi.correlativosDocumentos();
      if (sobre?.error) {
        this.series.set([]);
        this.feedback.error(sobre.mensaje || 'No se pudieron obtener las series.');
        return;
      }
      const filas = Array.isArray(sobre?.data) ? sobre.data : [];
      this.series.set(
        filas.map((fila) => ({
          id: Number(fila['id'] ?? 0),
          serie: texto(fila['serie']),
          numero: texto(fila['numero']),
          tipoDocumento: texto(fila['idTipoDocumentoNombre']) || 'Guía de Remisión',
          eliminado: esVerdadero(fila['eliminado']),
        })),
      );
      this.paginacion.page.set(1);
    } catch {
      this.series.set([]);
      this.feedback.error('Error de conexión: no se pudieron obtener las series.', 'Sin conexión');
    } finally {
      await this.loading.hideAfterMinimum();
    }
  }

  /** La ventana ya guardó: se cierra, se avisa y se vuelve a pedir la lista al servidor. */
  async alCrear(mensaje: string): Promise<void> {
    this.creando.set(false);
    this.alertService.showAlert('Éxito', mensaje, 'success');
    await this.cargarSeries();
  }

  /** Activa o desactiva la serie (pide confirmación y lo envía de frente al servidor). */
  async cambiarEstado(s: SerieGre): Promise<void> {
    if (!this.online()) {
      this.feedback.warning('Necesitas internet para cambiar el estado.', 'Sin conexión');
      return;
    }

    const activar = s.eliminado;
    const confirmado = await this.confirmModal.confirm({
      title: activar ? 'Activar serie' : 'Desactivar serie',
      eyebrow: 'Estado de la serie',
      message: activar ? 'La serie volverá a estar disponible.' : 'La serie dejará de estar disponible.',
      detail: `${s.serie} - ${s.numero}`,
      confirmText: activar ? 'Activar' : 'Desactivar',
      cancelText: 'Cancelar',
      tone: activar ? 'success' : 'danger',
    });
    if (!confirmado) return;

    const json = JSON.stringify([{ id: s.id, modo: 'editado', serie: s.serie, numero: s.numero, eliminado: !s.eliminado }]);
    this.loading.show(activar ? 'Activando serie...' : 'Desactivando serie...');
    try {
      const respuesta = await this.administracionApi.sincronizarCorrelativos(json);
      this.loading.hide();
      if (respuesta?.error) {
        this.feedback.error(respuesta.mensaje || 'No se pudo cambiar el estado.');
        return;
      }
      this.alertService.showAlert('Éxito', activar ? 'Serie activada' : 'Serie desactivada', 'success');
      await this.cargarSeries();
    } catch {
      this.loading.hide();
      this.feedback.error('Ocurrió un error inesperado al cambiar el estado.');
    }
  }
}
