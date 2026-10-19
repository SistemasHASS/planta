import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideInbox, LucideMapPin, LucidePencil, LucidePower, LucideRefreshCcw, LucideSearch, LucideWifiOff, LucideX } from '@lucide/angular';
import { PaginatorComponent } from '../../shared/components/paginator/paginator.component';
import { SearchSelectComponent, SearchSelectOption } from '../../shared/components/search-select/search-select.component';
import { AdministracionApiService } from '../../shared/services/administracion-api.service';
import { AlertaService } from '../../shared/services/alerta.service';
import { CatalogosApiService } from '../../shared/services/catalogos-api.service';
import { ConfirmModalService } from '../../shared/services/confirm-modal.service';
import { ConnectivityService } from '../../shared/services/connectivity.service';
import { FeedbackModalService } from '../../shared/services/feedback-modal.service';
import { LoadingService } from '../../shared/services/loading.service';
import { esDispositivoMovil } from '../../shared/utils/archivo';
import { crearPaginacion } from '../../shared/utils/paginacion';
import { ModalEditarDestinatarioComponent } from './components/modal-editar-destinatario/modal-editar-destinatario.component';
import { DestinatarioAdmin, destinatarioAJson } from './destinatarios.interface';

const texto = (valor: unknown): string => String(valor ?? '').trim();

/** El servidor puede mandar bit como true/false, 1/0 o texto. */
const esVerdadero = (valor: unknown): boolean => {
  if (typeof valor === 'string') return ['1', 'true', 'si', 'sí'].includes(valor.trim().toLowerCase());
  return valor === true || valor === 1;
};

type FiltroEstado = '' | 'activos' | 'inactivos';

/**
 * Gestión de destinatarios (solo administrador, solo en línea). La lista sale de los clientes; a cada uno se le
 * configura su domicilio y punto de llegada. Todo se lee y se guarda en el servidor; no se guarda nada en el equipo.
 */
@Component({
  selector: 'app-destinatarios',
  imports: [
    FormsModule,
    PaginatorComponent,
    SearchSelectComponent,
    ModalEditarDestinatarioComponent,
    LucideInbox,
    LucideMapPin,
    LucidePencil,
    LucidePower,
    LucideRefreshCcw,
    LucideSearch,
    LucideWifiOff,
    LucideX,
  ],
  templateUrl: './destinatarios.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DestinatariosComponent implements OnInit {
  private readonly catalogosApi = inject(CatalogosApiService);
  private readonly administracionApi = inject(AdministracionApiService);
  private readonly connectivity = inject(ConnectivityService);
  private readonly loading = inject(LoadingService);
  private readonly feedback = inject(FeedbackModalService);
  private readonly alertService = inject(AlertaService);
  private readonly confirmModal = inject(ConfirmModalService);

  readonly online = computed(() => this.connectivity.online());

  readonly destinatarios = signal<DestinatarioAdmin[]>([]);
  readonly filtroTexto = signal('');
  readonly filtroEstado = signal<FiltroEstado>('activos');
  /** Destinatario que se está editando (null = ventana cerrada). */
  readonly editando = signal<DestinatarioAdmin | null>(null);

  readonly estadoOpciones: SearchSelectOption[] = [
    { value: '', label: 'Todos los estados' },
    { value: 'activos', label: 'Activos' },
    { value: 'inactivos', label: 'Inactivos' },
  ];

  /** Destinatarios que coinciden con el estado elegido y con lo escrito (documento, nombre o dirección). */
  readonly destinatariosFiltrados = computed(() => {
    const buscado = this.filtroTexto().trim().toLowerCase();
    const estado = this.filtroEstado();
    return this.destinatarios().filter((d) => {
      if (estado === 'activos' && !d.activo) return false;
      if (estado === 'inactivos' && d.activo) return false;
      if (!buscado) return true;
      return [d.documentoFiscal, d.documento, d.nombre, d.domicilioFiscal, d.puntoLlegada].some((valor) => texto(valor).toLowerCase().includes(buscado));
    });
  });
  readonly paginacion = crearPaginacion(() => this.destinatariosFiltrados(), 25);

  async ngOnInit(): Promise<void> {
    await this.cargarDestinatarios();
  }

  /** Pide al servidor los clientes con su destinatario y los muestra (no guarda nada en el equipo). */
  async cargarDestinatarios(): Promise<void> {
    if (!this.online()) {
      this.destinatarios.set([]);
      this.feedback.error('Error de conexión: necesitas internet para ver los destinatarios.', 'Sin conexión');
      return;
    }

    this.loading.show('Cargando destinatarios...');
    try {
      const sobre = await this.catalogosApi.destinatarios();
      if (sobre?.error) {
        this.destinatarios.set([]);
        this.feedback.error(sobre.mensaje || 'No se pudieron obtener los destinatarios.');
        return;
      }
      const filas = Array.isArray(sobre?.data) ? sobre.data : [];
      this.destinatarios.set(
        filas.map((fila) => ({
          id: Number(fila['id'] ?? 0),
          idCliente: Number(fila['idCliente'] ?? 0),
          documentoFiscal: texto(fila['documentoFiscal']),
          documento: texto(fila['documento']),
          tipoDocumento: texto(fila['tipoDocumento']),
          nombre: texto(fila['nombre']),
          esCliente: texto(fila['esCliente']),
          domicilioFiscal: texto(fila['domicilioFiscal']),
          puntoLlegada: texto(fila['puntoLlegada']),
          domicilioFiscalDepartamento: texto(fila['domicilioFiscalDepartamento']),
          domicilioFiscalProvincia: texto(fila['domicilioFiscalProvincia']),
          domicilioFiscalDistrito: texto(fila['domicilioFiscalDistrito']),
          puntoLlegadaDepartamento: texto(fila['puntoLlegadaDepartamento']),
          puntoLlegadaProvincia: texto(fila['puntoLlegadaProvincia']),
          puntoLlegadaDistrito: texto(fila['puntoLlegadaDistrito']),
          activo: esVerdadero(fila['activo']),
        })),
      );
      this.paginacion.page.set(1);
    } catch {
      this.destinatarios.set([]);
      this.feedback.error('Error de conexión: no se pudieron obtener los destinatarios.', 'Sin conexión');
    } finally {
      await this.loading.hideAfterMinimum();
    }
  }

  /** Celular o tablet: un toque sobre la fila abre la edición. */
  alTocarFila(d: DestinatarioAdmin): void {
    if (esDispositivoMovil()) this.editar(d);
  }

  /** Computador: doble clic sobre la fila abre la edición. */
  alHacerDobleClicFila(d: DestinatarioAdmin): void {
    if (!esDispositivoMovil()) this.editar(d);
  }

  editar(d: DestinatarioAdmin): void {
    this.editando.set(d);
  }

  /** El modal ya guardó: se cierra, se avisa y se vuelve a pedir la lista al servidor. */
  async alGuardar(mensaje: string): Promise<void> {
    this.editando.set(null);
    this.alertService.showAlert('Éxito', mensaje, 'success');
    await this.cargarDestinatarios();
  }

  /** Activa o desactiva el destinatario (pide confirmación y lo envía de frente al servidor). */
  async cambiarEstado(d: DestinatarioAdmin): Promise<void> {
    if (!d.id) {
      this.feedback.warning('Primero configura el destinatario (domicilio y punto de llegada) con el botón Editar.');
      return;
    }
    if (!this.online()) {
      this.feedback.warning('Necesitas internet para cambiar el estado.', 'Sin conexión');
      return;
    }

    const activar = !d.activo;
    const confirmado = await this.confirmModal.confirm({
      title: activar ? 'Activar destinatario' : 'Desactivar destinatario',
      eyebrow: 'Estado del destinatario',
      message: activar ? 'El destinatario volverá a estar disponible para las guías.' : 'El destinatario dejará de estar disponible para las guías.',
      detail: d.nombre,
      confirmText: activar ? 'Activar' : 'Desactivar',
      cancelText: 'Cancelar',
      tone: activar ? 'success' : 'danger',
    });
    if (!confirmado) return;

    this.loading.show(activar ? 'Activando destinatario...' : 'Desactivando destinatario...');
    try {
      const respuesta = await this.administracionApi.sincronizarDestinatarios(destinatarioAJson({ ...d, activo: activar }));
      this.loading.hide();
      if (respuesta?.error) {
        this.feedback.error(respuesta.mensaje || 'No se pudo cambiar el estado.');
        return;
      }
      this.alertService.showAlert('Éxito', activar ? 'Destinatario activado' : 'Destinatario desactivado', 'success');
      await this.cargarDestinatarios();
    } catch {
      this.loading.hide();
      this.feedback.error('Ocurrió un error inesperado al cambiar el estado.');
    }
  }
}
