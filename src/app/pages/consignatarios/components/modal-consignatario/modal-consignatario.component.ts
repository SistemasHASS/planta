import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { LucideSave, LucideX } from '@lucide/angular';
import { SearchSelectComponent, SearchSelectOption } from '../../../../shared/components/search-select/search-select.component';
import { AdministracionApiService } from '../../../../shared/services/administracion-api.service';
import { CatalogosApiService } from '../../../../shared/services/catalogos-api.service';
import { ConnectivityService } from '../../../../shared/services/connectivity.service';
import { FeedbackModalService } from '../../../../shared/services/feedback-modal.service';
import { LoadingService } from '../../../../shared/services/loading.service';
import { portalToBody } from '../../../../shared/utils/portal';
import { ConsignatarioFila, texto } from '../../consignatarios.interface';

const esActivo = (valor: unknown): boolean => valor === undefined || valor === null || valor === true || valor === 1 || ['1', 'true'].includes(String(valor).toLowerCase());

/**
 * Ventana para asignar el grupo cliente y los códigos rancho de un consignatario.
 * Solo en línea: las opciones se piden al servidor al abrirla y el cambio se envía de frente (no se guarda nada en el equipo).
 * Avisa con saved(mensaje) o closed().
 */
@Component({
  selector: 'app-modal-consignatario',
  imports: [SearchSelectComponent, LucideSave, LucideX],
  templateUrl: './modal-consignatario.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModalConsignatarioComponent implements OnInit {
  constructor() {
    portalToBody();
  }

  private readonly administracionApi = inject(AdministracionApiService);
  private readonly catalogosApi = inject(CatalogosApiService);
  private readonly connectivity = inject(ConnectivityService);
  private readonly loading = inject(LoadingService);
  private readonly feedback = inject(FeedbackModalService);

  readonly registro = input.required<ConsignatarioFila>();
  /** Proyecto de la campaña elegida (de ahí salen los códigos rancho). */
  readonly idProyecto = input<string>('');

  readonly saved = output<string>();
  readonly closed = output<void>();

  readonly grupo = signal('');
  /** Códigos rancho elegidos. */
  readonly elegidos = signal<Set<string>>(new Set());
  readonly buscarRancho = signal('');

  readonly grupos = signal<SearchSelectOption[]>([]);
  readonly ranchos = signal<string[]>([]);
  readonly cargando = signal(false);

  private inicial = '';

  readonly ranchosVisibles = computed(() => {
    const buscado = this.buscarRancho().trim().toLowerCase();
    return this.ranchos().filter((c) => !buscado || c.toLowerCase().includes(buscado));
  });

  private resumen(): string {
    return JSON.stringify([this.grupo(), [...this.elegidos()].sort()]);
  }

  readonly hayCambios = computed(() => this.resumen() !== this.inicial);

  async ngOnInit(): Promise<void> {
    const r = this.registro();
    this.grupo.set(r.codigoGrupoCliente);
    this.elegidos.set(new Set(r.codigosRancho.map((c) => c.codigo)));
    this.inicial = this.resumen();
    await this.cargarOpciones();
  }

  /** Pide al servidor los grupos de clientes y los códigos rancho recién al abrir la ventana. */
  private async cargarOpciones(): Promise<void> {
    if (!this.connectivity.online()) {
      this.feedback.warning('Necesitas internet para cargar las opciones.', 'Sin conexión');
      return;
    }
    this.cargando.set(true);
    this.loading.show('Cargando opciones...');
    try {
      const actual = this.registro().codigoGrupoCliente;
      const [clientes, ranchos] = await Promise.all([
        this.catalogosApi.clientes(),
        this.idProyecto() ? this.catalogosApi.porProyecto('codigosRancho', this.idProyecto()) : Promise.resolve(null),
      ]);
      const filasClientes = !clientes?.error && Array.isArray(clientes?.data) ? clientes.data : [];
      this.grupos.set(
        filasClientes
          .filter((c) => esActivo(c['activo']) || texto(c['codigo']) === actual)
          .map((c) => ({ value: texto(c['codigo']), label: texto(c['nombre']) || texto(c['codigo']) })),
      );
      const filasRanchos = ranchos && !ranchos.error && Array.isArray(ranchos.data) ? ranchos.data : [];
      const codigos = new Set(filasRanchos.filter((f) => esActivo(f['activo'])).map((f) => texto(f['codigo'])).filter(Boolean));
      // Los ya asignados siempre se muestran (aunque el código ya no esté activo) para poder quitarlos.
      for (const c of this.registro().codigosRancho) codigos.add(c.codigo);
      this.ranchos.set([...codigos].sort((a, b) => a.localeCompare(b, 'es', { numeric: true })));
    } catch {
      this.feedback.error('Error de conexión: no se pudieron cargar las opciones.', 'Sin conexión');
    } finally {
      this.cargando.set(false);
      await this.loading.hideAfterMinimum();
    }
  }

  alternar(codigo: string): void {
    this.elegidos.update((s) => {
      const nuevo = new Set(s);
      if (nuevo.has(codigo)) nuevo.delete(codigo);
      else nuevo.add(codigo);
      return nuevo;
    });
  }

  async guardar(): Promise<void> {
    if (this.cargando() || !this.hayCambios()) return;
    if (!this.connectivity.online()) {
      this.feedback.warning('Necesitas internet para guardar.', 'Sin conexión');
      return;
    }
    const r = this.registro();
    // El servidor desactiva los códigos rancho que no se envían.
    const json = JSON.stringify([
      { documento: r.documento, nombre: r.nombre, codigoGrupoCliente: this.grupo(), codigosRancho: [...this.elegidos()].map((codigo) => ({ codigo, activo: true })) },
    ]);
    this.loading.show('Guardando...');
    try {
      const respuesta = await this.administracionApi.sincronizarConsignatarios(json);
      this.loading.hide();
      if (respuesta?.error) {
        this.feedback.error(respuesta.mensaje || 'No se pudo guardar.');
        return;
      }
      this.saved.emit('Consignatario actualizado correctamente.');
    } catch {
      this.loading.hide();
      this.feedback.error('Ocurrió un error inesperado al guardar.');
    }
  }
}
