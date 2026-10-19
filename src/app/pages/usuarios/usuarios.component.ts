import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  LucideChartColumn,
  LucideCircleHelp,
  LucideEye,
  LucideInbox,
  LucideMonitor,
  LucidePackage,
  LucidePencil,
  LucideRefreshCcw,
  LucideSearch,
  LucideShieldCheck,
  LucideSquarePen,
  LucideUsers,
  LucideWifiOff,
  LucideX,
} from '@lucide/angular';
import { PaginatorComponent } from '../../shared/components/paginator/paginator.component';
import { SearchMultiSelectComponent } from '../../shared/components/search-multi-select/search-multi-select.component';
import { SearchSelectOption } from '../../shared/components/search-select/search-select.component';
import { ROLES, ROLE_LABELS } from '../../shared/guards/role.guard';
import { CatalogosRepository } from '../../shared/dexiedb/repository/catalogos.repository';
import { Configuracion } from '../../shared/interfaces/administracion.interface';
import { Usuario } from '../../shared/interfaces/auth.interface';
import { AdministracionApiService } from '../../shared/services/administracion-api.service';
import { AlertaService } from '../../shared/services/alerta.service';
import { AuthService } from '../../shared/services/auth.service';
import { ConnectivityService } from '../../shared/services/connectivity.service';
import { FeedbackModalService } from '../../shared/services/feedback-modal.service';
import { LoadingService } from '../../shared/services/loading.service';
import { esDispositivoMovil } from '../../shared/utils/archivo';
import { crearPaginacion } from '../../shared/utils/paginacion';
import { ModalEditarUsuarioComponent } from './components/modal-editar-usuario/modal-editar-usuario.component';
import { UsuarioAcopio } from './usuarios.interface';

const texto = (valor: unknown): string => String(valor ?? '').trim();

/**
 * Gestión de usuarios (solo administrador, solo en línea): se ve a quién pertenece cada acopio y serie de guía
 * y se puede cambiar. Todo se lee y se guarda en el servidor; del equipo solo se lee cuál es la campaña elegida
 * en Parámetros (hace falta para listar los acopios al editar).
 */
@Component({
  selector: 'app-usuarios',
  imports: [
    FormsModule,
    PaginatorComponent,
    SearchMultiSelectComponent,
    ModalEditarUsuarioComponent,
    LucideChartColumn,
    LucideCircleHelp,
    LucideEye,
    LucideInbox,
    LucideMonitor,
    LucidePackage,
    LucidePencil,
    LucideRefreshCcw,
    LucideSearch,
    LucideShieldCheck,
    LucideSquarePen,
    LucideUsers,
    LucideWifiOff,
    LucideX,
  ],
  templateUrl: './usuarios.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsuariosComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly catalogos = inject(CatalogosRepository);
  private readonly administracionApi = inject(AdministracionApiService);
  private readonly connectivity = inject(ConnectivityService);
  private readonly loading = inject(LoadingService);
  private readonly feedback = inject(FeedbackModalService);
  private readonly alertService = inject(AlertaService);

  readonly online = computed(() => this.connectivity.online());
  readonly usuario = signal<Usuario | null>(null);
  /** Campaña elegida en Parámetros (solo se lee su idProyecto). */
  readonly cfg = signal<Configuracion | null>(null);

  readonly usuarios = signal<UsuarioAcopio[]>([]);
  readonly filtroTexto = signal('');
  /** Usuario que se está editando (null = ventana cerrada). */
  readonly editando = signal<UsuarioAcopio | null>(null);

  /** Filtros (varios a la vez). Sin nada marcado, o con todo marcado, se ven todos los usuarios. */
  readonly perfilesElegidos = signal<string[]>([]);
  readonly acopiosElegidos = signal<string[]>([]);

  /** Valor especial del filtro de acopio para los usuarios que no tienen acopio. */
  private readonly SIN_ACOPIO = '__sin_acopio__';

  /** Un perfil por cada rol que aparece en la lista (ordenados de la A a la Z). */
  readonly perfilOpciones = computed<SearchSelectOption[]>(() =>
    [...new Set(this.usuarios().map((u) => texto(u.idRol)).filter(Boolean))]
      .map((idRol) => ({ value: idRol, label: this.nombrePerfil(idRol) }))
      .sort((a, b) => a.label.localeCompare(b.label, 'es')),
  );

  /** Un acopio por cada uno que aparece en la lista, más "Sin acopio". */
  readonly acopioOpciones = computed<SearchSelectOption[]>(() => {
    const porCodigo = new Map<string, string>();
    for (const u of this.usuarios()) if (u.codigoAcopio) porCodigo.set(u.codigoAcopio, u.acopioNombre || u.codigoAcopio);
    return [
      { value: this.SIN_ACOPIO, label: 'Sin acopio' },
      ...[...porCodigo].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label, 'es', { numeric: true })),
    ];
  });

  /** Usuarios que cumplen los filtros y lo escrito (usuario, nombre, documento, perfil, acopio o serie). */
  readonly usuariosFiltrados = computed(() => {
    const buscado = this.filtroTexto().trim().toLowerCase();
    const perfiles = this.perfilesElegidos();
    const acopios = this.acopiosElegidos();
    const todosPerfiles = perfiles.length === 0 || perfiles.length === this.perfilOpciones().length;
    const todosAcopios = acopios.length === 0 || acopios.length === this.acopioOpciones().length;
    return this.usuarios().filter((u) => {
      if (!todosPerfiles && !perfiles.includes(u.idRol)) return false;
      if (!todosAcopios && !acopios.includes(u.codigoAcopio || this.SIN_ACOPIO)) return false;
      if (!buscado) return true;
      return [u.usuario, u.nombre, u.documentoIdentidad, this.nombrePerfil(u.idRol), u.acopioNombre, u.codigoAcopio, u.serieGuia].some((valor) =>
        texto(valor).toLowerCase().includes(buscado),
      );
    });
  });
  readonly paginacion = crearPaginacion(() => this.usuariosFiltrados(), 25);

  async ngOnInit(): Promise<void> {
    const session = await this.auth.getSession();
    this.usuario.set(session?.user ?? null);
    const nro = texto(this.usuario()?.documentoIdentidad);
    this.cfg.set(nro ? ((await this.catalogos.configuracionRepo.getByField('nrodocumento', nro)) ?? null) : null);
    await this.cargarUsuarios();
  }

  nombrePerfil(idRol: string): string {
    return ROLE_LABELS[texto(idRol).toUpperCase()] ?? texto(idRol);
  }

  /** Color del distintivo de cada perfil (daisyUI). */
  clasePerfil(idRol: string): string {
    switch (texto(idRol).toUpperCase()) {
      case ROLES.admin: return 'badge-success';
      case ROLES.logistica: return 'badge-info';
      case ROLES.monitor: return 'badge-neutral';
      case ROLES.guiasManuales: return 'badge-secondary';
      case ROLES.coordinacion: return 'badge-warning';
      case ROLES.operaciones: return 'badge-primary';
      default: return 'badge-neutral';
    }
  }

  /** Pide al servidor los usuarios con su acopio y los muestra (no guarda nada en el equipo). */
  async cargarUsuarios(): Promise<void> {
    if (!this.online()) {
      this.usuarios.set([]);
      this.feedback.error('Error de conexión: necesitas internet para ver los usuarios.', 'Sin conexión');
      return;
    }

    this.loading.show('Cargando usuarios...');
    try {
      const sobre = await this.administracionApi.usuarios();
      if (sobre?.error) {
        this.usuarios.set([]);
        this.feedback.error(sobre.mensaje || 'No se pudieron obtener los usuarios.');
        return;
      }
      const filas = Array.isArray(sobre?.data) ? sobre.data : [];
      this.usuarios.set(
        filas.map((fila) => ({
          id: texto(fila['id'] ?? fila['documentoIdentidad']),
          idempresa: texto(fila['idempresa']),
          ruc: texto(fila['ruc']),
          razonSocial: texto(fila['razonSocial']),
          documentoIdentidad: texto(fila['documentoIdentidad']),
          nombre: texto(fila['nombre']),
          usuario: texto(fila['usuario']),
          idRol: texto(fila['idRol']),
          aplicacion: texto(fila['aplicacion']) || 'PLANTA',
          codigoAcopio: texto(fila['codigoAcopio']),
          acopioNombre: texto(fila['acopioNombre']),
          serieGuia: texto(fila['serieGuia']),
        })),
      );
      this.paginacion.page.set(1);
    } catch {
      this.usuarios.set([]);
      this.feedback.error('Error de conexión: no se pudieron obtener los usuarios.', 'Sin conexión');
    } finally {
      await this.loading.hideAfterMinimum();
    }
  }

  /** Celular o tablet: un toque sobre la fila abre la edición. */
  alTocarFila(u: UsuarioAcopio): void {
    if (esDispositivoMovil()) this.editar(u);
  }

  /** Computador: doble clic sobre la fila abre la edición. */
  alHacerDobleClicFila(u: UsuarioAcopio): void {
    if (!esDispositivoMovil()) this.editar(u);
  }

  editar(u: UsuarioAcopio): void {
    this.editando.set(u);
  }

  /** El modal ya guardó: se cierra, se avisa y se vuelve a pedir la lista al servidor. */
  async alGuardar(mensaje: string): Promise<void> {
    this.editando.set(null);
    this.alertService.showAlert('Éxito', mensaje, 'success');
    await this.cargarUsuarios();
  }
}
