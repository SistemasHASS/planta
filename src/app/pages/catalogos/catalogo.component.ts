import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { LucideBuilding2, LucideChevronDown, LucideIdCard, LucideInbox, LucideLibrary, LucideListFilter, LucidePencil, LucidePlus, LucidePower, LucideRefreshCcw, LucideSearch, LucideTruck, LucideUserCheck, LucideUsers, LucideWifiOff, LucideX } from '@lucide/angular';
import { PaginatorComponent } from '../../shared/components/paginator/paginator.component';
import { SearchMultiSelectComponent } from '../../shared/components/search-multi-select/search-multi-select.component';
import { SearchSelectComponent, SearchSelectOption } from '../../shared/components/search-select/search-select.component';
import { CatalogosRepository } from '../../shared/dexiedb/repository/catalogos.repository';
import { Configuracion } from '../../shared/interfaces/administracion.interface';
import { AdministracionApiService } from '../../shared/services/administracion-api.service';
import { AlertaService } from '../../shared/services/alerta.service';
import { AuthService } from '../../shared/services/auth.service';
import { CatalogosApiService, SobreSp } from '../../shared/services/catalogos-api.service';
import { ConfirmModalService } from '../../shared/services/confirm-modal.service';
import { ConnectivityService } from '../../shared/services/connectivity.service';
import { FeedbackModalService } from '../../shared/services/feedback-modal.service';
import { LoadingService } from '../../shared/services/loading.service';
import { MaestrosApiService } from '../../shared/services/maestros-api.service';
import { esDispositivoMovil } from '../../shared/utils/archivo';
import { crearFiltrosColumna } from '../../shared/utils/filtros-columna';
import { crearPaginacion } from '../../shared/utils/paginacion';
import { CATALOGOS, CatalogoKey, ConfigCatalogo, RegistroCatalogo, armarRegistro, etiquetaDe, extraDeAlcance, nombreDe, valorMostrado } from './catalogo.interface';
import { ModalCatalogoComponent } from './components/modal-catalogo/modal-catalogo.component';

const texto = (valor: unknown): string => String(valor ?? '').trim();

type FiltroEstado = '' | 'activos' | 'inactivos';

/**
 * Catálogos operativos (conductores, vehículos, transportistas, supervisores y personal de logística).
 * Solo administrador y solo en línea: la lista de la campaña elegida y cada cambio van de frente al servidor;
 * no se guarda nada en el equipo (solo se lee cuál es la campaña elegida en Parámetros). Una misma pantalla sirve
 * para los cinco: cada ruta indica cuál es con `data.catalogo`.
 */
@Component({
  selector: 'app-catalogo',
  imports: [
    FormsModule, PaginatorComponent, SearchSelectComponent, SearchMultiSelectComponent, ModalCatalogoComponent,
    LucideBuilding2, LucideChevronDown, LucideIdCard, LucideInbox, LucideLibrary, LucideListFilter, LucidePencil, LucidePlus, LucidePower,
    LucideRefreshCcw, LucideSearch, LucideTruck, LucideUserCheck, LucideUsers, LucideWifiOff, LucideX,
  ],
  templateUrl: './catalogo.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogoComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly catalogosLocal = inject(CatalogosRepository);
  private readonly catalogosApi = inject(CatalogosApiService);
  private readonly maestrosApi = inject(MaestrosApiService);
  private readonly administracionApi = inject(AdministracionApiService);
  private readonly connectivity = inject(ConnectivityService);
  private readonly loading = inject(LoadingService);
  private readonly feedback = inject(FeedbackModalService);
  private readonly alertService = inject(AlertaService);
  private readonly confirmModal = inject(ConfirmModalService);

  /** Cuál de los cinco catálogos es (lo indica la ruta). */
  readonly config: ConfigCatalogo = CATALOGOS[inject(ActivatedRoute).snapshot.data['catalogo'] as CatalogoKey];

  readonly online = computed(() => this.connectivity.online());
  /** Campaña elegida en Parámetros. */
  readonly cfg = signal<Configuracion | null>(null);

  readonly registros = signal<RegistroCatalogo[]>([]);
  readonly filtroTexto = signal('');
  readonly filtroEstado = signal<FiltroEstado>('');
  /** Filtros por columna desplegados o recogidos (empiezan recogidos). */
  readonly filtrosAbiertos = signal(false);

  /** Ventana abierta: null = cerrada; { registro: null } = nuevo; { registro } = editar. */
  readonly modal = signal<{ registro: RegistroCatalogo | null } | null>(null);

  /** El catálogo se guarda y se lista por proyecto o por cultivo: sin campaña elegida no hay qué mostrar. */
  readonly necesitaCampania = this.config.origen.tipo === 'proyecto' || this.config.origen.tipo === 'cultivo' || this.config.origen.tipo === 'calibres';
  readonly faltaCampania = computed(() => this.necesitaCampania && !this.cfg());

  /** Lo que se agrega a lo que se guarda (idproyecto, codigoCultivo o nada) según el catálogo. */
  readonly extra = computed(() => extraDeAlcance(this.config, texto(this.cfg()?.idProyecto), texto(this.cfg()?.codigoCultivo)));

  readonly estadoOpciones: SearchSelectOption[] = [
    { value: '', label: 'Todos los estados' },
    { value: 'activos', label: 'Activos' },
    { value: 'inactivos', label: 'Inactivos' },
  ];

  readonly etiqueta = (campo: string): string => etiquetaDe(this.config, campo);
  readonly valor = (r: RegistroCatalogo, campo: string): string => valorMostrado(this.config, r, campo);

  /** Filtros múltiples por columna (solo sobre lo listado). */
  readonly columnas = crearFiltrosColumna<RegistroCatalogo>(
    () => this.registros(),
    this.config.filtros.map((campo) => ({
      clave: campo,
      etiqueta: this.etiqueta(campo),
      placeholder: `Todos (${this.etiqueta(campo).toLowerCase()})`,
      valor: (r: RegistroCatalogo) => valorMostrado(this.config, r, campo),
    })),
  );
  readonly cantidadFiltros = computed(() => Object.values(this.columnas.elegidos()).filter((v) => v.length > 0).length);

  /** Registros que cumplen el estado, los filtros de columna y lo escrito (cualquier dato mostrado). */
  readonly filtrados = computed(() => {
    const buscado = this.filtroTexto().trim().toLowerCase();
    const estado = this.filtroEstado();
    return this.registros().filter((r) => {
      if (estado === 'activos' && !r.activo) return false;
      if (estado === 'inactivos' && r.activo) return false;
      if (!this.columnas.pasa(r)) return false;
      if (!buscado) return true;
      return this.config.columnas.some((c) => `${texto(r[c])} ${this.valor(r, c)}`.toLowerCase().includes(buscado));
    });
  });
  readonly paginacion = crearPaginacion(() => this.filtrados(), 25);

  async ngOnInit(): Promise<void> {
    const session = await this.auth.getSession();
    const nro = texto(session?.user?.documentoIdentidad);
    this.cfg.set(nro ? ((await this.catalogosLocal.configuracionRepo.getByField('nrodocumento', nro)) ?? null) : null);
    await this.cargar();
  }

  /** Pide al servidor la lista de este catálogo (solo su endpoint; no guarda nada en el equipo). */
  private async pedirFilas(): Promise<SobreSp<Record<string, any>[]>> {
    const idProyecto = texto(this.cfg()?.idProyecto);
    const codigoCultivo = texto(this.cfg()?.codigoCultivo);
    const origen = this.config.origen;
    switch (origen.tipo) {
      case 'proyecto':
        return this.catalogosApi.porProyecto(origen.catalogo, idProyecto);
      case 'cultivo':
        return this.catalogosApi.porCultivo(origen.catalogo, codigoCultivo);
      case 'clientes':
        return this.catalogosApi.clientes();
      case 'paises':
        return { error: false, data: (await this.maestrosApi.paises()) as Record<string, any>[] };
      case 'transportes':
        return { error: false, data: (await this.maestrosApi.transporte()) as Record<string, any>[] };
      case 'calibres': {
        const calibres = (await this.maestrosApi.calibres()) as Record<string, any>[];
        return { error: false, data: calibres.filter((c) => texto(c['idCultivo']) === codigoCultivo) };
      }
    }
  }

  /** Pide al servidor los registros y arma la lista. */
  async cargar(): Promise<void> {
    if (this.faltaCampania()) {
      this.registros.set([]);
      return;
    }
    if (!this.online()) {
      this.registros.set([]);
      this.feedback.error('Error de conexión: necesitas internet para ver los datos.', 'Sin conexión');
      return;
    }

    this.loading.show(`Cargando ${this.config.titulo.toLowerCase()}...`);
    try {
      const sobre = await this.pedirFilas();
      if (sobre?.error) {
        this.registros.set([]);
        this.feedback.error(sobre.mensaje || `No se pudo obtener ${this.config.titulo.toLowerCase()}.`);
        return;
      }
      const filas = Array.isArray(sobre?.data) ? sobre.data : [];
      const registros = filas.map((fila, i) => armarRegistro(this.config, fila, i));
      // Categorías, tipos de empaque y empaque guía: el calibre es de la apimaestra y ya está guardado en el equipo (solo se cruza el nombre).
      if (this.config.cruzarCalibre) {
        const calibres = await this.catalogosLocal.calibresRepo.getAll();
        for (const r of registros) {
          if (texto(r['nombreCalibre'])) continue;
          const calibre = (calibres as Record<string, any>[]).find((c) => texto(c['id']) === texto(r['calibreId']));
          r['nombreCalibre'] = texto(calibre?.['calibre']);
        }
      }
      this.registros.set(registros);
      this.paginacion.page.set(1);
    } catch {
      this.registros.set([]);
      this.feedback.error(`Error de conexión: no se pudo obtener ${this.config.titulo.toLowerCase()}.`, 'Sin conexión');
    } finally {
      await this.loading.hideAfterMinimum();
    }
  }

  nuevo(): void {
    this.modal.set({ registro: null });
  }

  editar(r: RegistroCatalogo): void {
    this.modal.set({ registro: r });
  }

  /** Celular o tablet: un toque sobre la fila abre la edición. */
  alTocarFila(r: RegistroCatalogo): void {
    if (!this.config.soloLectura && esDispositivoMovil()) this.editar(r);
  }

  /** Computador: doble clic sobre la fila abre la edición. */
  alHacerDobleClicFila(r: RegistroCatalogo): void {
    if (!this.config.soloLectura && !esDispositivoMovil()) this.editar(r);
  }

  /** La ventana ya guardó: se cierra, se avisa y se vuelve a pedir la lista al servidor. */
  async alGuardar(mensaje: string): Promise<void> {
    this.modal.set(null);
    this.alertService.showAlert('Éxito', mensaje, 'success');
    await this.cargar();
  }

  /** Activa o desactiva el registro (pide confirmación y lo envía de frente al servidor). */
  async cambiarEstado(r: RegistroCatalogo): Promise<void> {
    if (!this.online()) {
      this.feedback.warning('Necesitas internet para cambiar el estado.', 'Sin conexión');
      return;
    }

    const activar = !r.activo;
    const { singular, genero } = this.config;
    const confirmado = await this.confirmModal.confirm({
      title: `${activar ? 'Activar' : 'Desactivar'} ${singular}`,
      eyebrow: `Estado d${genero === 'a' ? 'e la' : 'el'} ${singular}`,
      message: activar ? `El ${singular} volverá a estar disponible.` : `El ${singular} dejará de estar disponible.`,
      detail: nombreDe(this.config, r),
      confirmText: activar ? 'Activar' : 'Desactivar',
      cancelText: 'Cancelar',
      tone: activar ? 'success' : 'danger',
    });
    if (!confirmado) return;

    this.loading.show(activar ? 'Activando...' : 'Desactivando...');
    try {
      // Solo se envía el estado (el servidor cambia únicamente las columnas que recibe).
      const json = JSON.stringify([{ id: r.id, ...this.extra(), activo: activar }]);
      const respuesta = await this.administracionApi.sincronizarCatalogo(this.config.tabla, json);
      this.loading.hide();
      if (respuesta?.error) {
        this.feedback.error(respuesta.mensaje || 'No se pudo cambiar el estado.');
        return;
      }
      this.alertService.showAlert('Éxito', activar ? 'Registro activado' : 'Registro desactivado', 'success');
      await this.cargar();
    } catch {
      this.loading.hide();
      this.feedback.error('Ocurrió un error inesperado al cambiar el estado.');
    }
  }
}
