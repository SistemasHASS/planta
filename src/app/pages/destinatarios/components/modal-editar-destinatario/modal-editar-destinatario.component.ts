import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideMapPin, LucideSave, LucideX } from '@lucide/angular';
import { SearchSelectComponent } from '../../../../shared/components/search-select/search-select.component';
import { AdministracionApiService } from '../../../../shared/services/administracion-api.service';
import { CatalogosApiService } from '../../../../shared/services/catalogos-api.service';
import { ConnectivityService } from '../../../../shared/services/connectivity.service';
import { FeedbackModalService } from '../../../../shared/services/feedback-modal.service';
import { LoadingService } from '../../../../shared/services/loading.service';
import { opcionesDe } from '../../../../shared/utils/opciones-select';
import { portalToBody } from '../../../../shared/utils/portal';
import { DestinatarioAdmin, destinatarioAJson } from '../../destinatarios.interface';

type Fila = Record<string, any>;

/** Domicilio fiscal o punto de llegada: se elige departamento → provincia → distrito. */
type Zona = 'fiscal' | 'llegada';

/**
 * Ventana para configurar el destinatario de un cliente (solo administrador, solo en línea):
 * domicilio fiscal, punto de llegada (obligatorio) y si está activo. Al guardar lo envía de frente al servidor.
 * No guarda nada en el equipo. Avisa con saved(mensaje) o closed().
 */
@Component({
  selector: 'app-modal-editar-destinatario',
  imports: [FormsModule, SearchSelectComponent, LucideMapPin, LucideSave, LucideX],
  templateUrl: './modal-editar-destinatario.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModalEditarDestinatarioComponent implements OnInit {
  constructor() {
    portalToBody();
  }

  private readonly catalogosApi = inject(CatalogosApiService);
  private readonly administracionApi = inject(AdministracionApiService);
  private readonly connectivity = inject(ConnectivityService);
  private readonly loading = inject(LoadingService);
  private readonly feedback = inject(FeedbackModalService);

  readonly destinatario = input.required<DestinatarioAdmin>();

  /** saved: se guardó bien (la pantalla recarga la lista). closed: se canceló. */
  readonly saved = output<string>();
  readonly closed = output<void>();

  readonly cargando = signal(false);
  readonly intento = signal(false);

  // Lo que la persona va escribiendo
  readonly domicilioFiscal = signal('');
  readonly puntoLlegada = signal('');
  readonly activo = signal(true);
  readonly fiscal = signal({ departamento: '', provincia: '', distrito: '' });
  readonly llegada = signal({ departamento: '', provincia: '', distrito: '' });

  // Listas para los buscadores
  readonly departamentos = signal<Fila[]>([]);
  readonly provinciasFiscal = signal<Fila[]>([]);
  readonly distritosFiscal = signal<Fila[]>([]);
  readonly provinciasLlegada = signal<Fila[]>([]);
  readonly distritosLlegada = signal<Fila[]>([]);

  readonly optDepartamentos = computed(() => opcionesDe(this.departamentos(), 'codigoDepartamento', ['nombreDepartamento']));
  readonly optProvinciasFiscal = computed(() => opcionesDe(this.provinciasFiscal(), 'codigoProvincia', ['nombreProvincia']));
  readonly optDistritosFiscal = computed(() => opcionesDe(this.distritosFiscal(), 'codigoUbigeo', ['nombreDistrito']));
  readonly optProvinciasLlegada = computed(() => opcionesDe(this.provinciasLlegada(), 'codigoProvincia', ['nombreProvincia']));
  readonly optDistritosLlegada = computed(() => opcionesDe(this.distritosLlegada(), 'codigoUbigeo', ['nombreDistrito']));

  /** Es la primera vez que se configura este cliente. */
  readonly esNuevo = computed(() => !this.destinatario().id);

  /** Valores con los que se abrió la ventana, para saber si hubo cambios. */
  private inicial = '';

  readonly hayCambios = computed(() => this.esNuevo() || this.resumen() !== this.inicial);
  readonly llegadaValida = computed(() => this.puntoLlegada().trim() !== '' && this.llegada().distrito !== '');

  private resumen(): string {
    return JSON.stringify([this.domicilioFiscal().trim(), this.puntoLlegada().trim(), this.activo(), this.fiscal().distrito, this.llegada().distrito]);
  }

  async ngOnInit(): Promise<void> {
    const d = this.destinatario();
    this.domicilioFiscal.set(d.domicilioFiscal);
    this.puntoLlegada.set(d.puntoLlegada);
    this.activo.set(d.id ? d.activo : true);
    this.fiscal.set({ departamento: d.domicilioFiscalDepartamento, provincia: d.domicilioFiscalProvincia, distrito: d.domicilioFiscalDistrito });
    this.llegada.set({ departamento: d.puntoLlegadaDepartamento, provincia: d.puntoLlegadaProvincia, distrito: d.puntoLlegadaDistrito });
    this.inicial = this.resumen();

    await this.cargarListas();
  }

  /** Pide al servidor los departamentos y, si ya hay ubicación guardada, sus provincias y distritos. */
  private async cargarListas(): Promise<void> {
    if (!this.connectivity.online()) {
      this.feedback.error('Error de conexión: necesitas internet para editar el destinatario.', 'Sin conexión');
      return;
    }

    this.cargando.set(true);
    this.loading.show('Cargando datos del destinatario...');
    try {
      const respuesta = await this.catalogosApi.departamentos();
      this.departamentos.set(respuesta?.data ?? []);
      await Promise.all([this.cargarProvincias('fiscal'), this.cargarDistritos('fiscal'), this.cargarProvincias('llegada'), this.cargarDistritos('llegada')]);
    } catch {
      this.feedback.error('Error de conexión: no se pudieron cargar los datos.', 'Sin conexión');
    } finally {
      this.cargando.set(false);
      await this.loading.hideAfterMinimum();
    }
  }

  private ubicacion(zona: Zona) {
    return zona === 'fiscal' ? this.fiscal : this.llegada;
  }

  private async cargarProvincias(zona: Zona): Promise<void> {
    const departamento = this.ubicacion(zona)().departamento;
    const filas = departamento ? ((await this.catalogosApi.provincias(departamento))?.data ?? []) : [];
    (zona === 'fiscal' ? this.provinciasFiscal : this.provinciasLlegada).set(filas);
  }

  private async cargarDistritos(zona: Zona): Promise<void> {
    const { departamento, provincia } = this.ubicacion(zona)();
    const filas = departamento && provincia ? ((await this.catalogosApi.distritos(departamento, provincia))?.data ?? []) : [];
    (zona === 'fiscal' ? this.distritosFiscal : this.distritosLlegada).set(filas);
  }

  /** Al elegir departamento se limpian provincia y distrito y se piden las provincias nuevas. */
  async elegirDepartamento(zona: Zona, codigo: string): Promise<void> {
    this.ubicacion(zona).set({ departamento: codigo, provincia: '', distrito: '' });
    (zona === 'fiscal' ? this.distritosFiscal : this.distritosLlegada).set([]);
    await this.pedir(() => this.cargarProvincias(zona));
  }

  /** Al elegir provincia se limpia el distrito y se piden los distritos nuevos. */
  async elegirProvincia(zona: Zona, codigo: string): Promise<void> {
    this.ubicacion(zona).update((u) => ({ ...u, provincia: codigo, distrito: '' }));
    await this.pedir(() => this.cargarDistritos(zona));
  }

  elegirDistrito(zona: Zona, codigo: string): void {
    this.ubicacion(zona).update((u) => ({ ...u, distrito: codigo }));
  }

  private async pedir(accion: () => Promise<void>): Promise<void> {
    try {
      await accion();
    } catch {
      this.feedback.error('Error de conexión: no se pudo cargar la lista.', 'Sin conexión');
    }
  }

  async guardar(): Promise<void> {
    this.intento.set(true);
    if (!this.llegadaValida()) return;
    if (!this.connectivity.online()) {
      this.feedback.warning('Necesitas internet para guardar los cambios.', 'Sin conexión');
      return;
    }

    const json = destinatarioAJson({
      ...this.destinatario(),
      domicilioFiscal: this.domicilioFiscal().trim(),
      puntoLlegada: this.puntoLlegada().trim(),
      domicilioFiscalDistrito: this.fiscal().distrito,
      puntoLlegadaDistrito: this.llegada().distrito,
      activo: this.activo(),
    });

    this.loading.show('Guardando destinatario...');
    try {
      const respuesta = await this.administracionApi.sincronizarDestinatarios(json);
      this.loading.hide();
      if (respuesta?.error) {
        this.feedback.error(respuesta.mensaje || 'No se pudo guardar el destinatario.');
        return;
      }
      this.saved.emit(this.esNuevo() ? 'Destinatario creado correctamente.' : 'Destinatario actualizado correctamente.');
    } catch {
      this.loading.hide();
      this.feedback.error('Ocurrió un error inesperado al guardar.');
    }
  }
}
