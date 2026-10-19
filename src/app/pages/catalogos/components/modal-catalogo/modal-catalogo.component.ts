import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideSave, LucideX } from '@lucide/angular';
import { SearchSelectComponent } from '../../../../shared/components/search-select/search-select.component';
import { CatalogosRepository } from '../../../../shared/dexiedb/repository/catalogos.repository';
import { CatalogosApiService } from '../../../../shared/services/catalogos-api.service';
import { MaestrosApiService } from '../../../../shared/services/maestros-api.service';
import { AdministracionApiService } from '../../../../shared/services/administracion-api.service';
import { ConnectivityService } from '../../../../shared/services/connectivity.service';
import { FeedbackModalService } from '../../../../shared/services/feedback-modal.service';
import { LoadingService } from '../../../../shared/services/loading.service';
import { portalToBody } from '../../../../shared/utils/portal';
import { CampoCatalogo, ConfigCatalogo, OpcionCampo, RegistroCatalogo, registroAJson } from '../../catalogo.interface';

const texto = (valor: unknown): string => String(valor ?? '').trim();

/**
 * Ventana para crear o editar un registro de un catálogo (operativo o del menú Catálogos).
 * Solo administrador y solo en línea: al guardar envía de frente al servidor y no guarda nada en el equipo.
 * Avisa con saved(mensaje) o closed().
 */
@Component({
  selector: 'app-modal-catalogo',
  imports: [FormsModule, SearchSelectComponent, LucideSave, LucideX],
  templateUrl: './modal-catalogo.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModalCatalogoComponent implements OnInit {
  constructor() {
    portalToBody();
  }

  private readonly administracionApi = inject(AdministracionApiService);
  private readonly catalogosApi = inject(CatalogosApiService);
  private readonly maestrosApi = inject(MaestrosApiService);
  private readonly catalogosLocal = inject(CatalogosRepository);
  private readonly connectivity = inject(ConnectivityService);
  private readonly loading = inject(LoadingService);
  private readonly feedback = inject(FeedbackModalService);

  readonly config = input.required<ConfigCatalogo>();
  /** Registro que se edita (null = nuevo) y los que ya existen (para no repetir). */
  readonly registro = input<RegistroCatalogo | null>(null);
  readonly registros = input.required<RegistroCatalogo[]>();
  /** Lo que se agrega al guardar (idproyecto, codigoCultivo o nada). */
  readonly extra = input<Record<string, string>>({});

  readonly saved = output<string>();
  readonly closed = output<void>();

  readonly esNuevo = computed(() => !this.registro());
  readonly intento = signal(false);

  /** Lo que la persona va escribiendo, por campo. */
  readonly valores = signal<Record<string, string>>({});
  readonly activo = signal(true);

  private inicial = '';

  /** Opciones de los selects que se piden al servidor (por campo) y si todavía se están pidiendo. */
  readonly opcionesDinamicas = signal<Record<string, OpcionCampo[]>>({});
  readonly cargando = signal(false);
  /** Filas completas de cada select (para mostrar datos de la opción elegida, como el calibre) y calibres guardados en el equipo. */
  private readonly filasFuente = signal<Record<string, Record<string, any>[]>>({});
  private readonly calibres = signal<Record<string, any>[]>([]);

  /** Datos de solo lectura de la opción elegida en un select (ej. calibre de la categoría). */
  derivados(campo: CampoCatalogo): { etiqueta: string; valor: string }[] {
    if (!campo.muestra) return [];
    const elegido = texto(this.valores()[campo.campo]);
    const fila = elegido ? this.filasFuente()[campo.campo]?.find((f) => texto(f[campo.fuente?.valor ?? 'id']) === elegido) : undefined;
    return campo.muestra.map((m) => {
      let valor = '';
      if (m.calibre) valor = texto(this.calibres().find((c) => texto(c['id']) === texto(fila?.['calibreId']))?.['calibre']);
      else if (m.campo) valor = texto(fila?.[m.campo]);
      return { etiqueta: m.etiqueta, valor: valor || '—' };
    });
  }

  opcionesDe(campo: CampoCatalogo): OpcionCampo[] {
    return campo.opciones ?? this.opcionesDinamicas()[campo.campo] ?? [];
  }

  /** Ya existe otro registro con el mismo dato único (sin distinguir mayúsculas). */
  readonly repetido = computed(() => {
    const unico = this.config().campoUnico;
    const actual = texto(this.valores()[unico]).toLowerCase();
    if (!actual) return false;
    const propio = this.registro()?.id;
    return this.registros().some((r) => r.id !== propio && texto(r[unico]).toLowerCase() === actual);
  });

  readonly valido = computed(() => {
    const v = this.valores();
    return this.config().campos.every((c) => !c.requerido || texto(v[c.campo])) && !this.repetido();
  });

  readonly hayCambios = computed(() => this.esNuevo() || this.resumen() !== this.inicial);

  private resumen(): string {
    return JSON.stringify([this.config().campos.map((c) => texto(this.valores()[c.campo])), this.activo()]);
  }

  async ngOnInit(): Promise<void> {
    const r = this.registro();
    const inicial: Record<string, string> = {};
    for (const c of this.config().campos) inicial[c.campo] = r ? texto(r[c.campo]) : (c.porDefecto ?? '');
    this.valores.set(inicial);
    this.activo.set(r ? r.activo : true);
    this.inicial = this.resumen();
    await this.cargarOpciones();
  }

  /** Pide al servidor las opciones de los selects recién al abrir la ventana (nuevo o editar). */
  private async cargarOpciones(): Promise<void> {
    const conFuente = this.config().campos.filter((c) => c.tipo === 'select' && c.fuente);
    if (conFuente.length === 0) return;
    if (!this.connectivity.online()) {
      this.feedback.warning('Necesitas internet para cargar las opciones.', 'Sin conexión');
      return;
    }
    const codigoCultivo = texto(this.extra()['codigoCultivo']);
    this.cargando.set(true);
    this.loading.show('Cargando opciones...');
    try {
      const resultado: Record<string, OpcionCampo[]> = {};
      const filasPorCampo: Record<string, Record<string, any>[]> = {};
      // El calibre es de la apimaestra y ya está guardado en el equipo: solo se cruza su nombre.
      if (this.config().campos.some((c) => c.muestra?.some((m) => m.calibre))) this.calibres.set((await this.catalogosLocal.calibresRepo.getAll()) as Record<string, any>[]);
      for (const campo of conFuente) {
        const fuente = campo.fuente!;
        let filas: Record<string, any>[] = [];
        if (fuente.origen === 'calibres') {
          const todos = (await this.maestrosApi.calibres()) as Record<string, any>[];
          filas = todos.filter((c) => texto(c['idCultivo']) === codigoCultivo);
        } else {
          const sobre = await this.catalogosApi.porCultivo(fuente.catalogo, codigoCultivo);
          filas = !sobre?.error && Array.isArray(sobre?.data) ? sobre.data : [];
        }
        filasPorCampo[campo.campo] = filas;
        const actual = texto(this.valores()[campo.campo]);
        resultado[campo.campo] = filas
          .filter((f) => f['activo'] === undefined || ['1', 'true'].includes(String(f['activo']).toLowerCase()) || texto(f[fuente.valor]) === actual)
          .map((f) => ({ value: texto(f[fuente.valor]), label: fuente.etiqueta.map((k) => texto(f[k])).filter(Boolean).join(' — ') || texto(f[fuente.valor]) }));
      }
      this.filasFuente.set(filasPorCampo);
      this.opcionesDinamicas.set(resultado);
    } catch {
      this.feedback.error('Error de conexión: no se pudieron cargar las opciones.', 'Sin conexión');
    } finally {
      this.cargando.set(false);
      await this.loading.hideAfterMinimum();
    }
  }

  /** Aplica las reglas del campo (mayúsculas o solo números) a lo escrito. */
  cambiar(campo: CampoCatalogo, valor: string): void {
    let limpio = valor ?? '';
    if (campo.soloDigitos || (campo.tipo === 'numero' && !campo.decimal)) limpio = limpio.replace(/\D/g, '');
    if (campo.tipo === 'numero' && campo.decimal) {
      limpio = limpio.replace(/[^\d.]/g, '');
      const [entero, ...resto] = limpio.split('.');
      limpio = resto.length ? `${entero}.${resto.join('')}` : entero;
    }
    if (campo.mayusculas) limpio = limpio.toUpperCase();
    if (campo.maxLength) limpio = limpio.slice(0, campo.maxLength);
    this.valores.update((actual) => ({ ...actual, [campo.campo]: limpio }));
  }

  esUnico(campo: CampoCatalogo): boolean {
    return campo.campo === this.config().campoUnico;
  }

  async guardar(): Promise<void> {
    this.intento.set(true);
    if (this.cargando() || !this.valido()) return;
    if (!this.connectivity.online()) {
      this.feedback.warning('Necesitas internet para guardar.', 'Sin conexión');
      return;
    }

    const config = this.config();
    const id = this.registro()?.id ?? 0;
    const json = registroAJson(config, id, this.valores(), this.activo(), this.extra());

    this.loading.show('Guardando...');
    try {
      const respuesta = await this.administracionApi.sincronizarCatalogo(config.tabla, json);
      this.loading.hide();
      if (respuesta?.error) {
        this.feedback.error(respuesta.mensaje || 'No se pudo guardar.');
        return;
      }
      const nombre = config.singular.charAt(0).toUpperCase() + config.singular.slice(1);
      this.saved.emit(id ? `${nombre} actualizad${config.genero} correctamente.` : `${nombre} cread${config.genero} correctamente.`);
    } catch {
      this.loading.hide();
      this.feedback.error('Ocurrió un error inesperado al guardar.');
    }
  }
}
