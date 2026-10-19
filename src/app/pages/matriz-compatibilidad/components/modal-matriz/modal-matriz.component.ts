import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { LucideNetwork, LucideSave, LucideX } from '@lucide/angular';
import { SearchSelectComponent, SearchSelectOption } from '../../../../shared/components/search-select/search-select.component';
import { CatalogosApiService } from '../../../../shared/services/catalogos-api.service';
import { CatalogosRepository } from '../../../../shared/dexiedb/repository/catalogos.repository';
import { AdministracionApiService } from '../../../../shared/services/administracion-api.service';
import { ConnectivityService } from '../../../../shared/services/connectivity.service';
import { FeedbackModalService } from '../../../../shared/services/feedback-modal.service';
import { LoadingService } from '../../../../shared/services/loading.service';
import { opcionesDe } from '../../../../shared/utils/opciones-select';
import { portalToBody } from '../../../../shared/utils/portal';
import { CatalogosMatriz, MatrizFila, catalogosVacios, derivarDeGuia, matrizAJson } from '../../matriz-compatibilidad.interface';

type Fila = Record<string, any>;

const texto = (valor: unknown): string => String(valor ?? '').trim();

/** El servidor puede mandar bit como true/false, 1/0 o texto; sin dato se toma como activo. */
const estaActivo = (valor: unknown): boolean => {
  if (valor === undefined || valor === null) return true;
  if (typeof valor === 'string') return ['1', 'true', 'si', 'sí'].includes(valor.trim().toLowerCase());
  return valor === true || valor === 1;
};

/**
 * Ventana para crear o editar una combinación de la matriz (solo administrador, solo en línea). Los catálogos
 * se piden al servidor al abrirla. El tipo de empaque, la categoría y el calibre salen del tipo de empaque guía.
 * Al guardar envía de frente al servidor. No guarda nada en el equipo. Avisa con saved(mensaje) o closed().
 */
@Component({
  selector: 'app-modal-matriz',
  imports: [SearchSelectComponent, LucideNetwork, LucideSave, LucideX],
  templateUrl: './modal-matriz.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModalMatrizComponent implements OnInit {
  constructor() {
    portalToBody();
  }

  private readonly administracionApi = inject(AdministracionApiService);
  private readonly catalogosApi = inject(CatalogosApiService);
  private readonly catalogosLocal = inject(CatalogosRepository);
  private readonly connectivity = inject(ConnectivityService);
  private readonly loading = inject(LoadingService);
  private readonly feedback = inject(FeedbackModalService);

  /** Combinación que se edita (null = nueva), las que ya existen (para no repetir) y los catálogos. */
  readonly matriz = input<MatrizFila | null>(null);
  readonly matrices = input.required<MatrizFila[]>();
  /** Catálogos: se piden al servidor al abrir la ventana. */
  readonly catalogos = signal<CatalogosMatriz>(catalogosVacios());
  readonly cargando = signal(false);
  readonly idProyecto = input.required<string>();
  readonly codigoCultivo = input.required<string>();

  readonly saved = output<string>();
  readonly closed = output<void>();

  readonly esNueva = computed(() => !this.matriz());
  readonly intento = signal(false);

  // Lo que la persona va eligiendo (ids como texto)
  readonly documentoCliente = signal('');
  readonly documentoConsignatario = signal('');
  readonly destinoId = signal('');
  readonly formatoId = signal('');
  readonly tipoEmpaqueGuiaId = signal('');
  readonly tipoCajaId = signal('');
  readonly tipoClamshellId = signal('');
  readonly presentacionId = signal('');
  readonly activo = signal(true);

  private inicial = '';

  /** Del tipo de empaque guía salen el tipo de empaque, la categoría y el calibre. */
  readonly derivado = computed(() => derivarDeGuia(this.catalogos(), this.tipoEmpaqueGuiaId()));

  /** Deja los registros activos (más el que ya está elegido, aunque esté inactivo). */
  private activos(lista: Fila[], campoId: string, elegido: string): Fila[] {
    return lista.filter((f) => estaActivo(f['activo']) || texto(f[campoId]) === elegido);
  }

  readonly optClientes = computed(() => opcionesDe(this.activos(this.catalogos().clientes, 'id', this.documentoCliente()), 'id', ['nombre']));

  /** Solo los consignatarios del grupo del cliente elegido. */
  readonly optConsignatarios = computed<SearchSelectOption[]>(() => {
    const cliente = this.catalogos().clientes.find((c) => texto(c['id']) === this.documentoCliente());
    const grupo = texto(cliente?.['codigo']);
    if (!grupo) return [];
    const delGrupo = this.catalogos().consignatarios.filter((c) => texto(c['codigoGrupoCliente']) === grupo);
    return opcionesDe(this.activos(delGrupo, 'documento', this.documentoConsignatario()), 'documento', ['nombre']);
  });

  readonly optDestinos = computed(() => opcionesDe(this.catalogos().destinos, 'id', ['id', 'pais']));
  readonly optFormatos = computed(() => opcionesDe(this.activos(this.catalogos().formatos, 'id', this.formatoId()), 'id', ['descripcion']));
  readonly optGuias = computed(() => opcionesDe(this.activos(this.catalogos().tiposEmpaqueGuia, 'id', this.tipoEmpaqueGuiaId()), 'id', ['codigo', 'nombre']));
  readonly optCajas = computed(() => opcionesDe(this.activos(this.catalogos().tiposCaja, 'id', this.tipoCajaId()), 'id', ['nombre']));
  readonly optClamshells = computed(() => opcionesDe(this.activos(this.catalogos().tiposClamshell, 'id', this.tipoClamshellId()), 'id', ['nombre']));
  readonly optPresentaciones = computed<SearchSelectOption[]>(() => [
    { value: '', label: '— Sin presentación —' },
    ...opcionesDe(this.activos(this.catalogos().presentaciones, 'id', this.presentacionId()), 'id', ['nombre']),
  ]);

  /** Ya existe otra combinación igual (mismos valores en todos los campos). */
  readonly repetida = computed(() => {
    const d = this.derivado();
    const propia = this.matriz()?.id;
    return this.matrices().some(
      (m) =>
        m.id !== propia &&
        m.documentoCliente === this.documentoCliente() &&
        m.documentoConsignatario === this.documentoConsignatario() &&
        m.destinoId === this.destinoId() &&
        m.formatoId === this.formatoId() &&
        m.tiposEmpaqueId === d.tiposEmpaqueId &&
        m.tipoEmpaqueGuiaId === this.tipoEmpaqueGuiaId() &&
        m.calibreId === d.calibreId &&
        m.tipoCajaId === this.tipoCajaId() &&
        m.tipoClamshellId === this.tipoClamshellId() &&
        m.presentacionId === this.presentacionId() &&
        m.categoriaId === d.categoriaId,
    );
  });

  readonly valido = computed(() => {
    const d = this.derivado();
    return (
      !!this.documentoCliente() && !!this.documentoConsignatario() && !!this.destinoId() && !!this.formatoId() &&
      !!this.tipoEmpaqueGuiaId() && !!d.tiposEmpaqueId && !!d.calibreId && !!this.tipoCajaId() && !!this.tipoClamshellId() && !this.repetida()
    );
  });

  readonly hayCambios = computed(() => this.esNueva() || this.resumen() !== this.inicial);

  private resumen(): string {
    return JSON.stringify([
      this.documentoCliente(), this.documentoConsignatario(), this.destinoId(), this.formatoId(), this.tipoEmpaqueGuiaId(),
      this.tipoCajaId(), this.tipoClamshellId(), this.presentacionId(), this.activo(),
    ]);
  }

  async ngOnInit(): Promise<void> {
    const m = this.matriz();
    if (m) {
      this.documentoCliente.set(m.documentoCliente);
      this.documentoConsignatario.set(m.documentoConsignatario);
      this.destinoId.set(m.destinoId);
      this.formatoId.set(m.formatoId);
      this.tipoEmpaqueGuiaId.set(m.tipoEmpaqueGuiaId);
      this.tipoCajaId.set(m.tipoCajaId);
      this.tipoClamshellId.set(m.tipoClamshellId);
      this.presentacionId.set(m.presentacionId);
      this.activo.set(m.activo);
    }
    this.inicial = this.resumen();
    await this.cargarCatalogos();
  }

  private filas(sobre: { error?: boolean; data?: unknown } | undefined): Fila[] {
    return sobre && !sobre.error && Array.isArray(sobre.data) ? (sobre.data as Fila[]) : [];
  }

  /** Pide los catálogos recién al abrir la ventana (nueva o editar). */
  private async cargarCatalogos(): Promise<void> {
    const cultivo = texto(this.codigoCultivo());
    if (!this.connectivity.online()) {
      this.feedback.warning('Necesitas internet para cargar los catálogos.', 'Sin conexión');
      return;
    }
    this.cargando.set(true);
    this.loading.show('Cargando catálogos...');
    try {
      // Consignatario, destino y calibre ya están en el equipo; el cliente (grupo de clientes) se pide al endpoint.
      const [consignatarios, destinos, calibres] = await Promise.all([
        this.catalogosLocal.consignatariosRepo.getAll(),
        this.catalogosLocal.destinosRepo.getAll(),
        this.catalogosLocal.calibresRepo.getAll(),
      ]);
      const [clientes, formatos, tiposEmpaqueGuia, tiposEmpaque, categorias, tiposCaja, tiposClamshell, presentaciones] = await Promise.all([
        this.catalogosApi.clientes(),
        this.catalogosApi.porCultivo('formatos', cultivo),
        this.catalogosApi.porCultivo('tiposEmpaqueGuia', cultivo),
        this.catalogosApi.porCultivo('tiposEmpaque', cultivo),
        this.catalogosApi.porCultivo('categorias', cultivo),
        this.catalogosApi.porCultivo('tiposCaja', cultivo),
        this.catalogosApi.porCultivo('tiposClamshell', cultivo),
        this.catalogosApi.porCultivo('presentaciones', cultivo),
      ]);
      this.catalogos.set({
        clientes: this.filas(clientes),
        consignatarios: consignatarios as Fila[],
        destinos: destinos as Fila[],
        formatos: this.filas(formatos),
        tiposEmpaqueGuia: this.filas(tiposEmpaqueGuia),
        tiposEmpaque: this.filas(tiposEmpaque),
        categorias: this.filas(categorias),
        calibres: (calibres as Fila[]).filter((c) => texto(c['idCultivo']) === cultivo),
        tiposCaja: this.filas(tiposCaja),
        tiposClamshell: this.filas(tiposClamshell),
        presentaciones: this.filas(presentaciones),
      });
    } catch {
      this.feedback.error('Error de conexión: no se pudieron cargar los catálogos.', 'Sin conexión');
    } finally {
      this.cargando.set(false);
      await this.loading.hideAfterMinimum();
    }
  }

  /** Al cambiar el cliente se limpia el consignatario (cada cliente tiene los suyos). */
  elegirCliente(valor: string): void {
    this.documentoCliente.set(valor);
    this.documentoConsignatario.set('');
  }

  async guardar(): Promise<void> {
    this.intento.set(true);
    if (this.cargando() || !this.valido()) return;
    if (!this.connectivity.online()) {
      this.feedback.warning('Necesitas internet para guardar la combinación.', 'Sin conexión');
      return;
    }

    const d = this.derivado();
    const base: MatrizFila = {
      id: this.matriz()?.id ?? 0,
      documentoCliente: this.documentoCliente(),
      documentoConsignatario: this.documentoConsignatario(),
      destinoId: this.destinoId(),
      formatoId: this.formatoId(),
      tiposEmpaqueId: d.tiposEmpaqueId,
      tipoEmpaqueGuiaId: this.tipoEmpaqueGuiaId(),
      calibreId: d.calibreId,
      categoriaId: d.categoriaId,
      tipoCajaId: this.tipoCajaId(),
      tipoClamshellId: this.tipoClamshellId(),
      presentacionId: this.presentacionId(),
      activo: this.activo(),
      clienteNombre: '', consignatarioNombre: '', destinoNombre: '', formatoNombre: '', tipoEmpaqueNombre: '', tipoEmpaqueGuiaNombre: '',
      calibreNombre: '', tipoCajaNombre: '', tipoClamshellNombre: '', presentacionNombre: '', categoriaNombre: '',
    };
    const modo = this.esNueva() ? 'nuevo' : 'editado';

    this.loading.show('Guardando combinación...');
    try {
      const respuesta = await this.administracionApi.sincronizarMatricesCompatibilidad(matrizAJson(base, modo, texto(this.idProyecto()), texto(this.codigoCultivo())));
      this.loading.hide();
      if (respuesta?.error) {
        this.feedback.error(respuesta.mensaje || 'No se pudo guardar la combinación.');
        return;
      }
      this.saved.emit(modo === 'editado' ? 'Combinación actualizada correctamente.' : 'Combinación creada correctamente.');
    } catch {
      this.loading.hide();
      this.feedback.error('Ocurrió un error inesperado al guardar.');
    }
  }
}
