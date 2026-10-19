import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { LucideRefreshCcw, LucideSave, LucideSettings, LucideTrash2 } from '@lucide/angular';
import { SearchSelectComponent, SearchSelectOption } from '../../shared/components/search-select/search-select.component';
import { CatalogosRepository } from '../../shared/dexiedb/repository/catalogos.repository';
import { Usuario } from '../../shared/interfaces/auth.interface';
import { Configuracion } from '../../shared/interfaces/administracion.interface';
import { Campania, Cultivo, Fundo } from '../../shared/interfaces/catalogo.interface';
import { ROLES } from '../../shared/guards/role.guard';
import { AuthService } from '../../shared/services/auth.service';
import { CatalogosSyncService } from '../../shared/services/catalogos-sync.service';
import { ConfirmModalService } from '../../shared/services/confirm-modal.service';
import { ConnectivityService } from '../../shared/services/connectivity.service';
import { FeedbackModalService } from '../../shared/services/feedback-modal.service';
import { LoadingService } from '../../shared/services/loading.service';

const texto = (v: unknown): string => String(v ?? '').trim();

/**
 * Parametros: el usuario elige la campaña con la que trabaja; el fundo y el cultivo salen de la campaña.
 * Sincronizar trae fundos, campañas y cultivos de apimaestra. Guardar deja la configuracion en este equipo (tabla
 * configuracion) y descarga los catalogos del rol. Mismo flujo de la aplicacion anterior.
 */
@Component({
  selector: 'app-parametros',
  imports: [SearchSelectComponent, LucideRefreshCcw, LucideSave, LucideSettings, LucideTrash2],
  templateUrl: './parametros.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ParametrosComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly connectivity = inject(ConnectivityService);
  private readonly loading = inject(LoadingService);
  private readonly feedback = inject(FeedbackModalService);
  private readonly confirm = inject(ConfirmModalService);
  private readonly catalogos = inject(CatalogosRepository);
  private readonly catalogosSync = inject(CatalogosSyncService);

  readonly usuario = signal<Usuario | null>(null);
  readonly fundos = signal<Fundo[]>([]);
  readonly cultivos = signal<Cultivo[]>([]);
  readonly campanias = signal<Campania[]>([]);
  readonly guardada = signal<Configuracion | null>(null);
  readonly campaniaId = signal<string | null>(null);

  readonly periodo = (v: unknown): string => {
    const [y, m, d] = texto(v).split('T')[0].split('-');
    return y && m && d ? `${d}/${m}/${y}` : '—';
  };

  readonly campaniaSeleccionada = computed(() => this.campanias().find((c) => texto(c.idproyecto) === this.campaniaId()) ?? null);
  /** El fundo y el cultivo de la campaña elegida (la campaña guarda sus codigos). */
  readonly fundoSeleccionado = computed(() => this.fundos().find((f) => texto(f.codigoFundo) === texto(this.campaniaSeleccionada()?.idfundo)) ?? null);
  readonly cultivoSeleccionado = computed(() => this.cultivos().find((c) => texto(c.codigo) === texto(this.campaniaSeleccionada()?.codcultivo)) ?? null);

  readonly opcionesCampania = computed<SearchSelectOption[]>(() =>
    this.campanias().map((c) => ({ value: texto(c.idproyecto), label: `${texto(c.idproyecto)} — ${texto(c.descripcion)}` })),
  );

  readonly etiquetaFundo = computed(() => this.etiquetaDeFundo(this.fundoSeleccionado(), this.campaniaSeleccionada()?.idfundo));
  readonly etiquetaCultivo = computed(() => this.etiquetaDeCultivo(this.cultivoSeleccionado(), this.campaniaSeleccionada()?.codcultivo));

  readonly etiquetaGuardada = computed(() => {
    const cfg = this.guardada();
    if (!cfg) return null;
    const camp = this.campanias().find((c) => texto(c.idproyecto) === texto(cfg.idProyecto));
    const fundo = this.fundos().find((f) => texto(f.id) === texto(cfg.idFundo)) ?? null;
    const cultivo = this.cultivos().find((c) => texto(c.codigo) === texto(cfg.codigoCultivo)) ?? null;
    return {
      campania: camp ? `${camp.idproyecto} — ${texto(camp.descripcion)}` : cfg.idProyecto,
      fundo: this.etiquetaDeFundo(fundo, cfg.idFundo),
      cultivo: this.etiquetaDeCultivo(cultivo, cfg.codigoCultivo),
    };
  });

  async ngOnInit(): Promise<void> {
    this.usuario.set((await this.auth.getSession())?.user ?? null);
    await this.cargarDatosDesdeDexie();
    await this.cargarConfiguracionGuardada();
  }

  onCampania(opcion: SearchSelectOption): void {
    this.campaniaId.set(opcion.value);
  }

  /** Trae fundos, campañas y cultivos de apimaestra y reemplaza lo guardado en el equipo. */
  async sincronizar(): Promise<void> {
    if (!this.connectivity.online()) {
      this.feedback.error('No hay conexión a internet');
      return;
    }

    this.loading.show('Sincronizando parametros...');
    try {
      await this.catalogosSync.sincronizarMaestros();
      await this.cargarDatosDesdeDexie();
      await this.cargarConfiguracionGuardada();
      await this.loading.hideAfterMinimum();
      this.feedback.success('Sincronización completada', 'Listo');
    } catch {
      this.loading.hide();
      this.feedback.error('Error sincronizando parámetros');
    }
  }

  async guardar(): Promise<void> {
    const nro = this.nroDocumento();
    if (!nro) {
      this.feedback.error('No se encontró el nro de documento del usuario.');
      return;
    }
    const camp = this.campaniaSeleccionada();
    if (!camp) {
      this.feedback.warning('Seleccione una Campaña.', 'Validación');
      return;
    }
    const fundo = this.fundoSeleccionado();
    const cultivo = this.cultivoSeleccionado();
    const idFundo = texto(fundo?.id);
    const codigoCultivo = texto(cultivo?.codigo);
    if (!idFundo || !codigoCultivo) {
      this.feedback.warning('No se pudo obtener Fundo/Cultivo desde la Campaña seleccionada.', 'Validación');
      return;
    }

    const cfg: Configuracion = { nrodocumento: nro, idFundo: fundo!.id as unknown as string, codigoCultivo, idProyecto: texto(camp.idproyecto) };
    try {
      const existente: any = await this.catalogos.configuracionRepo.getByField('nrodocumento', nro);
      if (existente?._pk != null) await this.catalogos.configuracionRepo.delete(existente._pk);
      await this.catalogos.configuracionRepo.save(cfg);
      this.guardada.set(cfg);
    } catch {
      this.feedback.error('No se pudo guardar la configuración');
      return;
    }
    await this.descargarCatalogos(cfg);
  }

  /** Descarga los catalogos segun el rol (en la aplicacion anterior: getListarCatalogosUsuarios). */
  private async descargarCatalogos(cfg: Configuracion): Promise<void> {
    if (!this.connectivity.online()) {
      this.feedback.error('No hay conexión a internet');
      return;
    }
    const rol = texto(this.usuario()?.idRol).toUpperCase();
    const trae = rol === ROLES.logistica || rol === ROLES.admin || rol === ROLES.monitor;
    if (!trae) {
      // Roles aún en migración: por ahora solo se sincronizan los acopios.
      this.loading.show('Descargando acopios...');
      const faltaron = await this.catalogosSync.sincronizarAcopios(cfg);
      await this.loading.hideAfterMinimum();
      if (faltaron.length > 0) this.feedback.warning(`Configuración guardada, pero fallaron: ${faltaron.join(', ')}.`, 'Sincronización parcial');
      else this.feedback.warning(`Configuración y acopios guardados. La descarga del resto de catálogos del rol ${rol} se está migrando.`);
      return;
    }

    this.loading.show('Descargando catalogos...');
    try {
      // Logística, Administrador y Monitor: las pantallas son en línea. Solo se guardan los acopios y los maestros que usan los reportes online.
      const faltaron = await this.catalogosSync.sincronizarMaestrosAdministrador(cfg);
      await this.loading.hideAfterMinimum();
      if (faltaron.length > 0) this.feedback.warning(`Se sincronizó, pero estos catálogos fallaron: ${faltaron.join(', ')}.`, 'Sincronización parcial');
      else this.feedback.success('Sincronización completada', 'Listo');
    } catch {
      this.loading.hide();
      this.feedback.error('Error sincronizando parámetros');
    }
  }

  async eliminar(): Promise<void> {
    const nro = this.nroDocumento();
    if (!nro) {
      this.feedback.error('No se encontró el nro de documento del usuario.');
      return;
    }
    const ok = await this.confirm.confirm({
      title: 'Confirmación',
      message: '¿Eliminar la configuración guardada?',
      confirmText: 'Si, eliminar',
      cancelText: 'Cancelar',
      tone: 'danger',
    });
    if (!ok) return;

    try {
      const existente: any = await this.catalogos.configuracionRepo.getByField('nrodocumento', nro);
      if (existente?._pk != null) await this.catalogos.configuracionRepo.delete(existente._pk);
      this.guardada.set(null);
      this.campaniaId.set(null);
      this.feedback.success('Configuración eliminada correctamente', 'Eliminado');
    } catch {
      this.feedback.error('No se pudo eliminar la configuración');
    }
  }

  private nroDocumento(): string {
    return texto(this.usuario()?.documentoIdentidad);
  }

  private async cargarDatosDesdeDexie(): Promise<void> {
    const [fundos, cultivos, campanias] = await Promise.all([
      this.catalogos.fundoRepo.getAll(),
      this.catalogos.cultivoRepo.getAll(),
      this.catalogos.campaniaRepo.getAll(),
    ]);
    this.fundos.set(fundos ?? []);
    this.cultivos.set(cultivos ?? []);
    this.campanias.set(campanias ?? []);
  }

  private async cargarConfiguracionGuardada(): Promise<void> {
    const nro = this.nroDocumento();
    const cfg = nro ? await this.catalogos.configuracionRepo.getByField('nrodocumento', nro) : undefined;
    this.guardada.set(cfg ?? null);
    if (cfg) this.campaniaId.set(texto(cfg.idProyecto));
  }

  private etiquetaDeFundo(f: Fundo | null, codigo?: unknown): string {
    return f ? `${texto(f.codigoFundo)} — ${texto(f.nombreFundo)}` : texto(codigo) || '—';
  }

  private etiquetaDeCultivo(c: Cultivo | null, codigo?: unknown): string {
    return c ? `${texto(c.codigo)} — ${texto(c.descripcion)}` : texto(codigo) || '—';
  }
}
