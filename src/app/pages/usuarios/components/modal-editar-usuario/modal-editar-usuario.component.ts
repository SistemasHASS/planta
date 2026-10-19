import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { LucideSave, LucideUser, LucideX } from '@lucide/angular';
import { SearchSelectComponent, SearchSelectOption } from '../../../../shared/components/search-select/search-select.component';
import { ROLE_LABELS } from '../../../../shared/guards/role.guard';
import { AdministracionApiService } from '../../../../shared/services/administracion-api.service';
import { CatalogosApiService } from '../../../../shared/services/catalogos-api.service';
import { ConnectivityService } from '../../../../shared/services/connectivity.service';
import { FeedbackModalService } from '../../../../shared/services/feedback-modal.service';
import { LoadingService } from '../../../../shared/services/loading.service';
import { portalToBody } from '../../../../shared/utils/portal';
import { UsuarioAcopio } from '../../usuarios.interface';

const texto = (valor: unknown): string => String(valor ?? '').trim();

/** Un acopio que se puede asignar (con la serie de guía que tiene configurada). */
interface AcopioDisponible {
  codigo: string;
  nombre: string;
  serie: string;
}

/**
 * Ventana para asignar el acopio a un usuario (solo administrador, solo en línea).
 * La serie de guía es la que tiene configurada el acopio elegido. Al abrirse pide los acopios al servidor;
 * al guardar envía el cambio. No guarda nada en el equipo. Avisa con saved(mensaje) o closed().
 */
@Component({
  selector: 'app-modal-editar-usuario',
  imports: [SearchSelectComponent, LucideSave, LucideUser, LucideX],
  templateUrl: './modal-editar-usuario.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModalEditarUsuarioComponent implements OnInit {
  constructor() {
    portalToBody();
  }

  private readonly catalogosApi = inject(CatalogosApiService);
  private readonly administracionApi = inject(AdministracionApiService);
  private readonly connectivity = inject(ConnectivityService);
  private readonly loading = inject(LoadingService);
  private readonly feedback = inject(FeedbackModalService);

  /** Usuario que se edita y campaña de la que salen los acopios. */
  readonly usuario = input.required<UsuarioAcopio>();
  readonly idProyecto = input.required<string>();

  /** saved: se guardó bien (la pantalla recarga la lista). closed: se canceló. */
  readonly saved = output<string>();
  readonly closed = output<void>();

  readonly cargando = signal(false);
  readonly acopios = signal<AcopioDisponible[]>([]);
  /** Código del acopio elegido ('' = sin acopio). */
  readonly codigoAcopio = signal('');

  protected codigoInicial = '';

  readonly perfil = computed(() => ROLE_LABELS[texto(this.usuario().idRol).toUpperCase()] ?? texto(this.usuario().idRol));

  readonly opcionesAcopio = computed<SearchSelectOption[]>(() => [
    { value: '', label: '— Sin acopio —' },
    ...this.acopios().map((a) => ({ value: a.codigo, label: a.nombre ? `${a.codigo} - ${a.nombre}` : a.codigo })),
  ]);

  /** Acopio elegido en este momento (para mostrar su serie). */
  readonly acopioElegido = computed(() => this.acopios().find((a) => a.codigo === this.codigoAcopio()) ?? null);

  readonly hayCambios = computed(() => this.codigoAcopio() !== this.codigoInicial);

  async ngOnInit(): Promise<void> {
    this.codigoInicial = texto(this.usuario().codigoAcopio);
    this.codigoAcopio.set(this.codigoInicial);
    await this.cargarAcopios();
  }

  /** Pide al servidor los acopios de la campaña. */
  private async cargarAcopios(): Promise<void> {
    if (!this.idProyecto()) {
      this.feedback.warning('Aún no hay una campaña configurada en este equipo. Ve a Parámetros para elegirla.');
      return;
    }
    if (!this.connectivity.online()) {
      this.feedback.error('Error de conexión: necesitas internet para editar el usuario.', 'Sin conexión');
      return;
    }

    this.cargando.set(true);
    this.loading.show('Cargando acopios...');
    try {
      const sobre = await this.catalogosApi.acopios(this.idProyecto());
      const filas = Array.isArray(sobre?.data) && !sobre.error ? sobre.data : [];
      const lista = filas
        .map((fila) => ({ codigo: texto(fila['codigoAcopio']), nombre: texto(fila['acopioNombre']), serie: texto(fila['serieGuia']) }))
        .filter((a) => a.codigo);
      // Si el usuario tiene un acopio que ya no está en la lista, se conserva para no perderlo.
      if (this.codigoInicial && !lista.some((a) => a.codigo === this.codigoInicial)) {
        lista.push({ codigo: this.codigoInicial, nombre: texto(this.usuario().acopioNombre), serie: texto(this.usuario().serieGuia) });
      }
      this.acopios.set(lista);
    } catch {
      this.feedback.error('Error de conexión: no se pudieron cargar los acopios.', 'Sin conexión');
    } finally {
      this.cargando.set(false);
      await this.loading.hideAfterMinimum();
    }
  }

  async guardar(): Promise<void> {
    if (!this.connectivity.online()) {
      this.feedback.warning('Necesitas internet para guardar los cambios.', 'Sin conexión');
      return;
    }

    const u = this.usuario();
    const acopio = this.acopioElegido();
    const json = JSON.stringify([
      {
        id: Number(u.id) || 0,
        modo: 'editado',
        usuario: u.usuario,
        documentoIdentidad: u.documentoIdentidad,
        nombre: u.nombre,
        idRol: u.idRol,
        codigoAcopio: acopio?.codigo ?? '',
        acopioNombre: acopio?.nombre ?? '',
        serieGuia: acopio?.serie ?? '',
      },
    ]);

    this.loading.show('Guardando cambios...');
    try {
      const respuesta = await this.administracionApi.sincronizarUsuarios(json);
      this.loading.hide();
      if (respuesta?.error) {
        this.feedback.error(respuesta.mensaje || 'No se pudo guardar el usuario.');
        return;
      }
      this.saved.emit(respuesta?.mensaje || 'Usuario actualizado correctamente.');
    } catch {
      this.loading.hide();
      this.feedback.error('Ocurrió un error inesperado al guardar.');
    }
  }
}
