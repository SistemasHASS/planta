import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  LucideEye,
  LucideFileSpreadsheet,
  LucideFileText,
  LucideOctagonX,
  LucidePencil,
  LucidePlus,
  LucideRefreshCw,
  LucideSearch,
  LucideSend,
  LucideSquarePen,
  LucideTrash2,
  LucideWifiOff,
  LucideX,
  LucideCircleCheck,
} from '@lucide/angular';
import { SearchSelectComponent, SearchSelectOption } from '../../shared/components/search-select/search-select.component';
import { PaginatorComponent } from '../../shared/components/paginator/paginator.component';
import { CatalogosRepository } from '../../shared/dexiedb/repository/catalogos.repository';
import { ROLES } from '../../shared/guards/role.guard';
import { Configuracion } from '../../shared/interfaces/administracion.interface';
import { Usuario } from '../../shared/interfaces/auth.interface';
import { Conductor, Transportista, Vehiculo } from '../../shared/interfaces/catalogo.interface';
import { GuiaRemision } from '../../shared/interfaces/guia.interface';
import { ConfirmModalService } from '../../shared/services/confirm-modal.service';
import { AlertaService } from '../../shared/services/alerta.service';
import { AuthService } from '../../shared/services/auth.service';
import { CatalogosGuiaService } from '../../shared/services/catalogos-guia.service';
import { ConnectivityService } from '../../shared/services/connectivity.service';
import { LoadingService } from '../../shared/services/loading.service';
import { FeedbackModalService } from '../../shared/services/feedback-modal.service';
import { GuiasManualesApiService } from '../../shared/services/guias-manuales-api.service';
import { abrirOCompartirArchivo, descargarArchivo, esDispositivoMovil } from '../../shared/utils/archivo';
import { formatDateTime, nowPeruDate } from '../../shared/utils/date-time.util';
import { estadoGuiaClass, estadoSunatClass, estadoSunatLabel, esAceptadaSunat } from '../../shared/utils/estado-sunat';
import { crearPaginacion } from '../../shared/utils/paginacion';
import { ModalPdfSunatComponent } from '../guias/components/modal-pdf-sunat/modal-pdf-sunat.component';
import { ModalNuevaGuiaManualComponent } from './components/modal-nueva-guia-manual/modal-nueva-guia-manual.component';
import { ModalVerDetalleGuiaManualComponent } from './components/modal-ver-detalle-guia/modal-ver-detalle-guia.component';

const texto = (v: unknown): string => String(v ?? '').trim();

/**
 * Guias de remision manuales (sin palets, todo el detalle escrito a mano): listar, crear, editar, emitir ante SUNAT,
 * reenviar, consultar estado, anular, eliminar y exportar a Excel. La logica es la de la aplicacion anterior; solo cambian
 * la forma de llamar a la API (api/guias-manuales), las alertas y la pantalla. Solo funciona con internet (igual que antes).
 */
@Component({
  selector: 'app-guias-manuales',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    PaginatorComponent,
    SearchSelectComponent,
    ModalPdfSunatComponent,
    ModalNuevaGuiaManualComponent,
    ModalVerDetalleGuiaManualComponent,
    LucideCircleCheck,
    LucideEye,
    LucideFileSpreadsheet,
    LucideFileText,
    LucideOctagonX,
    LucidePencil,
    LucidePlus,
    LucideRefreshCw,
    LucideSearch,
    LucideSend,
    LucideSquarePen,
    LucideTrash2,
    LucideWifiOff,
    LucideX,
  ],
  templateUrl: './guias-manuales.component.html',
  styleUrl: './guias-manuales.component.scss',
})
export class GuiasManualesComponent implements OnInit {
  private readonly api = inject(GuiasManualesApiService);
  private readonly catalogosGuia = inject(CatalogosGuiaService);
  private readonly alertService = inject(AlertaService);
  private readonly confirmModal = inject(ConfirmModalService);
  private readonly feedback = inject(FeedbackModalService);
  private readonly connectivity = inject(ConnectivityService);
  private readonly auth = inject(AuthService);
  private readonly catalogosRepo = inject(CatalogosRepository);
  private readonly loading = inject(LoadingService);

  readonly estadoSunatClass = estadoSunatClass;
  readonly estadoSunatLabel = estadoSunatLabel;
  readonly estadoGuiaClass = estadoGuiaClass;
  readonly esAceptadaSunat = esAceptadaSunat;

  readonly onlineSignal = computed(() => this.connectivity.isOnline());

  readonly usuario = signal<Usuario | null>(null);
  /** Administrador y monitor solo consultan (Excel y, el administrador, anular); logistica y guias manuales crean y operan. */
  readonly esAdmin = computed(() => [ROLES.admin, ROLES.monitor].some((r) => r === texto(this.usuario()?.idRol).toUpperCase()));
  readonly esAdministrador = computed(() => texto(this.usuario()?.idRol).toUpperCase() === ROLES.admin);

  readonly guias = signal<GuiaRemision[]>([]);
  readonly paginacion = crearPaginacion(() => this.guias(), 25);

  readonly isLoading = signal(false);
  readonly modalNuevaGuiaManualVisible = signal(false);
  readonly guardandoGuiaManual = signal(false);
  readonly modoEdicionGuia = signal(false);
  readonly guiaParaEditar = signal<any>(null);
  readonly modalVerDetalleAbierto = signal(false);
  readonly guiaDetalle = signal<any>(null);

  readonly savedConfig = signal<Configuracion | null>(null);
  readonly transportistas = signal<Transportista[]>([]);
  readonly conductores = signal<Conductor[]>([]);
  readonly vehiculos = signal<Vehiculo[]>([]);
  readonly destinatarios = signal<any[]>([]);
  readonly motivosTraslado = signal<any[]>([]);
  readonly establecimientoEmisor = signal<any | null>(null);
  readonly establecimientos = signal<any[]>([]);

  readonly filtroEstado = signal<string>('');
  readonly filtroTexto = signal<string>('');
  readonly filtroFechaDesde = signal<string>('');
  readonly filtroFechaHasta = signal<string>('');

  /** Dirección del PDF de SUNAT; mientras tiene valor se muestra la ventana del PDF. */
  readonly pdfUrlRaw = signal<string | null>(null);

  readonly estadoOpciones: SearchSelectOption[] = [
    { value: '', label: 'Todos los estados' },
    { value: 'ABIERTA', label: 'Abierta' },
    { value: 'CERRADA', label: 'Cerrada' },
    { value: 'ANULADO', label: 'Anulado' },
  ];

  async ngOnInit(): Promise<void> {
    const session = await this.auth.getSession();
    this.usuario.set(session?.user ?? null);
    const hoy = nowPeruDate();
    this.filtroFechaDesde.set(hoy);
    this.filtroFechaHasta.set(hoy);
    await this.cargarConfiguracion();
    void this.cargarMotivosTraslado();
    void this.onBuscarGuias();
  }

  limpiarFiltros(): void {
    const hoy = nowPeruDate();
    this.filtroEstado.set('');
    this.filtroTexto.set('');
    this.filtroFechaDesde.set(hoy);
    this.filtroFechaHasta.set(hoy);
    void this.onBuscarGuias();
  }

  fmtDateTime(value: unknown): string {
    return formatDateTime(value) || '—';
  }

  /** Celular o tablet: un toque sobre la fila abre el detalle de la guía. */
  alTocarFila(guia: GuiaRemision): void {
    if (esDispositivoMovil()) void this.abrirModalVerDetalle(guia);
  }

  /** Computador: doble clic sobre la fila abre el detalle de la guía. */
  alHacerDobleClicFila(guia: GuiaRemision): void {
    if (!esDispositivoMovil()) void this.abrirModalVerDetalle(guia);
  }

  // ───────── Listado ─────────

  async onBuscarGuias(options: { mostrarCarga?: boolean } = {}): Promise<void> {
    const mostrarCarga = options.mostrarCarga ?? true;
    this.paginacion.page.set(1);
    if (!texto(this.savedConfig()?.idProyecto)) {
      await this.cargarConfiguracion();
    }
    const idProyecto = texto(this.savedConfig()?.idProyecto);
    if (!idProyecto) {
      this.alertService.showAlert('Error', 'No se encontró la configuración del proyecto.', 'error');
      return;
    }
    if (mostrarCarga) {
      this.loading.show('Procesando...');
    }
    try {
      this.isLoading.set(true);
      const resp = await this.api.listar({
        idProyecto,
        estado: this.filtroEstado().trim() || null,
        texto: this.filtroTexto().trim() || null,
        fechaDesde: this.filtroFechaDesde().trim() || null,
        fechaHasta: this.filtroFechaHasta().trim() || null,
      });
      if (resp?.error) {
        if (mostrarCarga) this.loading.hide();
        this.alertService.showAlert('Error', resp.mensaje ?? 'Error al listar guías manuales.', 'error');
        return;
      }

      await this.cargarDestinatarios();
      const destinatarios = this.destinatarios();
      const guiasEnriquecidas = (resp?.data ?? []).map((g: any) => {
        const documento = texto(g?.documentoDestinatario);
        const destinatario = destinatarios.find((d: any) => texto(d?.documentoFiscal) === documento);
        return { ...g, nombreDestinatario: texto((destinatario as any)?.nombre) };
      });

      this.guias.set(guiasEnriquecidas as GuiaRemision[]);
      if (mostrarCarga) this.loading.hide();
    } catch (error: any) {
      console.error('Error listando guías manuales:', error);
      if (mostrarCarga) this.loading.hide();
      this.alertService.showAlert('Error', error?.error?.message ?? 'Error al listar guías manuales.', 'error');
    } finally {
      this.isLoading.set(false);
    }
  }

  // ───────── Excel ─────────

  async exportarExcel(): Promise<void> {
    const idProyecto = texto(this.savedConfig()?.idProyecto);
    const codigoCultivo = texto(this.savedConfig()?.codigoCultivo) || null;
    if (!idProyecto) {
      this.alertService.showAlert('Error', 'No se encontró la configuración del proyecto.', 'error');
      return;
    }
    this.loading.show('Procesando...');
    try {
      const blob = await this.api.exportarExcel({
        idProyecto,
        estado: this.filtroEstado().trim() || null,
        texto: this.filtroTexto().trim() || null,
        fechaDesde: this.filtroFechaDesde().trim() || null,
        fechaHasta: this.filtroFechaHasta().trim() || null,
        codigoCultivo,
      });
      this.loading.hide();
      const nombre = `guias-remision-manuales-${new Date().toISOString().slice(0, 10)}.xlsx`;

      if (esDispositivoMovil()) {
        // Android / iOS: el archivo llego despues de esperar a la API, asi que solo se puede abrir desde un toque de la persona.
        this.feedback.open('success', {
          title: 'Excel listo',
          message: 'El Excel de guías manuales está listo. Toque "Abrir Excel" para verlo o compartirlo.',
          actionText: 'Cerrar',
          secondaryAction: { text: 'Abrir Excel', handler: () => abrirOCompartirArchivo(blob, nombre) },
        });
      } else {
        descargarArchivo(blob, nombre);
      }
    } catch (error: any) {
      console.error('Error exportando Excel:', error);
      this.loading.hide();
      const mensaje = await this.mensajeDeError(error, 'Error al exportar el Excel.');
      this.alertService.showAlert('Información', mensaje, 'warning');
    }
  }

  /** Mensaje del servidor ({ message }) aunque la respuesta llegue como Blob. */
  private async mensajeDeError(error: any, defecto: string): Promise<string> {
    const cuerpo = error?.error;
    if (cuerpo instanceof Blob) {
      try {
        return JSON.parse(await cuerpo.text())?.message ?? defecto;
      } catch {
        return defecto;
      }
    }
    return cuerpo?.message ?? defecto;
  }

  // ───────── PDF de SUNAT ─────────

  /** PDF de SUNAT: se ve dentro de una ventana (también en celular) y desde ahí la persona puede descargarlo. */
  abrirPdfModal(url: string | null | undefined): void {
    if (!url) {
      this.alertService.showAlertAcept(
        'PDF no disponible',
        'Aún no se ha generado el archivo PDF de SUNAT. Consulte el estado SUNAT con el botón de actualizar para obtener el PDF.',
        'warning'
      );
      return;
    }
    this.pdfUrlRaw.set(url);
  }

  cerrarPdfModal(): void {
    this.pdfUrlRaw.set(null);
  }

  // ───────── Acciones sobre una guia ─────────

  async cerrarGuia(g: GuiaRemision): Promise<void> {
    const confirmado = await this.alertService.showConfirm(
      'Confirmar emisión',
      `¿Está seguro de emitir y numerar la guía ${g.serie ?? ''}-${g.numero ?? ''} (${g.codigoGuiaRemision})?`,
      'question'
    );
    if (!confirmado) return;

    const datos = this.datosDeGuia(g);
    if (!datos) return;

    this.loading.show('Procesando...');
    try {
      const resp: any = await this.api.emitir(datos.idProyecto, datos.codigoGuiaRemision);
      // Se actualiza la lista aunque falle el envio: la guia puede haber quedado cerrada.
      await this.onBuscarGuias({ mostrarCarga: false });
      this.loading.hide();
      if (resp?.error) {
        this.alertService.showAlertAcept('Error', resp?.mensaje ?? 'Error al emitir la guía.', 'error');
      } else {
        this.alertService.showAlert('Éxito', 'Guía emitida y numerada correctamente.', 'success');
      }
    } catch (error: any) {
      this.loading.hide();
      console.error('Error emitiendo guía:', error);
      this.alertService.showAlert('Error', error?.error?.message ?? 'Error al emitir la guía.', 'error');
    }
  }

  async reenviarGuia(g: GuiaRemision): Promise<void> {
    const confirmado = await this.alertService.showConfirm(
      'Confirmar reenvío',
      `¿Está seguro de reenviar la guía ${g.serie ?? ''}-${g.numero ?? ''} (${g.codigoGuiaRemision}) a SUNAT?`,
      'question'
    );
    if (!confirmado) return;

    const datos = this.datosDeGuia(g);
    if (!datos) return;

    this.loading.show('Procesando...');
    try {
      const resp: any = await this.api.reenviar(datos.idProyecto, datos.codigoGuiaRemision);
      await this.onBuscarGuias({ mostrarCarga: false });
      this.loading.hide();
      if (resp?.error) {
        this.alertService.showAlertAcept('Error', resp?.mensaje ?? 'Error al reenviar la guía.', 'error');
      } else {
        this.alertService.showAlert('Éxito', 'Guía reenviada correctamente.', 'success');
      }
    } catch (error: any) {
      this.loading.hide();
      console.error('Error reenviando guía:', error);
      this.alertService.showAlert('Error', error?.error?.message ?? 'Error al reenviar la guía.', 'error');
    }
  }

  async consultarEstadoSunat(g: GuiaRemision): Promise<void> {
    const datos = this.datosDeGuia(g);
    if (!datos) return;

    this.loading.show('Procesando...');
    try {
      const resp: any = await this.api.consultarEstadoSunat(datos.idProyecto, datos.codigoGuiaRemision);
      await this.onBuscarGuias({ mostrarCarga: false });
      this.loading.hide();
      if (resp?.error) {
        this.alertService.showAlertAcept('Error', resp?.mensaje ?? 'Error al consultar el estado SUNAT.', 'error');
      } else {
        this.alertService.showAlertAcept('Estado SUNAT', resp?.data?.data?.mensajeSunat ?? resp?.mensaje ?? 'Estado actualizado correctamente.', 'success');
      }
    } catch (error: any) {
      this.loading.hide();
      console.error('Error consultando estado SUNAT:', error);
      this.alertService.showAlert('Error', error?.error?.message ?? 'Error al consultar el estado SUNAT.', 'error');
    }
  }

  async anularGuia(g: GuiaRemision): Promise<void> {
    const confirmado = await this.alertService.showConfirm(
      'Confirmar anulación',
      `¿Está seguro de anular la guía ${g.serie ?? ''}-${g.numero ?? ''} (${g.codigoGuiaRemision})?`,
      'warning'
    );
    if (!confirmado) return;

    // Segunda confirmación (modal estándar de la app): la anulación no se puede revertir.
    const segura = await this.confirmModal.confirm({
      title: 'Advertencia de anulación',
      eyebrow: 'Acción irreversible',
      message: 'Una vez anulada la guía no se podrá revertir. Verifique que ya esté anulada en SUNAT antes de continuar.',
      detail: `Guía ${g.serie ?? ''}-${g.numero ?? ''}\n${g.nombreDestinatario ?? '—'}\nSUNAT: ${estadoSunatLabel(g.estadoSunat)} · ${(g as any).cantidad ?? 0} und — ${g.pesoTotal} kg`,
      confirmText: 'Sí, anular guía',
      cancelText: 'Cancelar',
      tone: 'danger',
    });
    if (!segura) return;

    await this.ejecutarAnulacion(g);
  }

  /** Anula la guía ya confirmada por la persona. */
  private async ejecutarAnulacion(g: GuiaRemision): Promise<void> {

    const datos = this.datosDeGuia(g);
    if (!datos) return;

    this.loading.show('Procesando...');
    try {
      const resp: any = await this.api.anular(datos.idProyecto, datos.codigoGuiaRemision, texto(g.codigoAcopio));
      this.loading.hide();
      if (resp?.error) {
        this.alertService.showAlert('Error', resp?.mensaje ?? 'Error al anular la guía.', 'error');
        return;
      }
      this.alertService.showAlertAcept('Éxito', 'Guía anulada correctamente.', 'success');
      await this.onBuscarGuias();
    } catch (error: any) {
      this.loading.hide();
      console.error('Error anulando guía:', error);
      this.alertService.showAlert('Error', error?.error?.message ?? 'Error al anular la guía.', 'error');
    }
  }

  /** Elimina una guía en borrador. Pide dos confirmaciones porque la acción no se puede deshacer. */
  async eliminarGuia(g: GuiaRemision): Promise<void> {
    if (!this.exigirInternet()) return;

    const resumen = [
      `Guía: ${g.codigoGuiaRemision ?? '—'}`,
      `Destinatario: ${g.nombreDestinatario ?? '—'}`,
      `Cantidad: ${(g as any).cantidad ?? 0} und · Peso: ${g.pesoTotal ?? 0} kg`,
      `Precinto: ${g.precinto ?? '—'} · Estado: ${g.estado ?? '—'}`,
    ].join('\n');

    const primera = await this.confirmModal.confirm({
      title: '¿Eliminar esta guía manual?',
      eyebrow: 'Guía en borrador',
      message: 'Se eliminará la guía junto con todos sus ítems.',
      detail: resumen,
      confirmText: 'Sí, continuar',
      cancelText: 'Cancelar',
      tone: 'warning',
    });
    if (!primera) return;
    await this.pausaEntreConfirmaciones();

    const segunda = await this.confirmModal.confirm({
      title: 'Confirmación final',
      eyebrow: 'Acción irreversible',
      message: 'Una vez eliminada, la guía no se podrá recuperar.',
      detail: resumen,
      confirmText: 'Sí, eliminar guía',
      cancelText: 'No, volver',
      tone: 'danger',
    });
    if (!segunda) return;

    const datos = this.datosDeGuia(g);
    if (!datos) return;

    this.loading.show('Eliminando guía...');
    try {
      const resp: any = await this.api.eliminar(datos.idProyecto, datos.codigoGuiaRemision);
      await this.loading.hideAfterMinimum();
      if (resp?.error) {
        this.alertService.showAlert('Error', resp?.mensaje ?? 'Error al eliminar la guía manual.', 'error');
        return;
      }
      this.alertService.showAlert('Éxito', 'Guía eliminada correctamente.', 'success');
      await this.onBuscarGuias();
    } catch (error: any) {
      console.error('Error eliminando guía:', error);
      await this.loading.hideAfterMinimum();
      this.alertService.showAlert('Error', error?.error?.message ?? 'Error al eliminar la guía.', 'error');
    }
  }

  /** Pausa corta con loading entre dos confirmaciones: evita que un doble clic acepte las dos sin leer la segunda. */
  private async pausaEntreConfirmaciones(mensaje = 'Preparando confirmación final...'): Promise<void> {
    this.loading.show(mensaje);
    await this.loading.hideAfterMinimum(800);
  }

  /** Sin internet no se puede operar con las guías manuales: todo se pide y se guarda en el servidor. */
  private exigirInternet(): boolean {
    if (this.connectivity.isOnline()) return true;
    this.alertService.showAlert('Sin conexión', 'Se necesita internet para trabajar con las guías manuales.', 'warning');
    return false;
  }

  /** Proyecto y codigo de la guia; avisa si falta alguno. */
  private datosDeGuia(g: GuiaRemision): { idProyecto: string; codigoGuiaRemision: string } | null {
    const idProyecto = texto(this.savedConfig()?.idProyecto);
    const codigoGuiaRemision = texto(g?.codigoGuiaRemision);
    if (!idProyecto || !codigoGuiaRemision) {
      this.loading.hide();
      this.alertService.showAlert('Error', 'No se pudo obtener la información de la guía.', 'error');
      return null;
    }
    return { idProyecto, codigoGuiaRemision };
  }

  // ───────── Detalle ─────────

  async abrirModalVerDetalle(g: GuiaRemision): Promise<void> {
    const datos = this.datosDeGuia(g);
    if (!datos) return;

    this.loading.show('Procesando...');
    try {
      const resp = await this.api.obtener(datos.idProyecto, datos.codigoGuiaRemision);
      this.loading.hide();
      if (resp?.error) {
        this.alertService.showAlert('Error', resp.mensaje ?? 'Error al obtener detalle de la guía.', 'error');
        return;
      }
      const guia = Array.isArray(resp?.data) ? resp.data[0] : resp?.data;
      if (!guia || typeof guia !== 'object') {
        this.alertService.showAlert('Error', 'No se encontró el detalle de la guía.', 'error');
        return;
      }
      this.guiaDetalle.set(guia);
      this.modalVerDetalleAbierto.set(true);
    } catch (error: any) {
      console.error('Error obteniendo detalle guía manual:', error);
      this.loading.hide();
      this.alertService.showAlert('Error', error?.error?.message ?? 'Error al obtener detalle de la guía.', 'error');
    }
  }

  cerrarModalVerDetalle(): void {
    this.modalVerDetalleAbierto.set(false);
    this.guiaDetalle.set(null);
  }

  // ───────── Crear / editar ─────────

  async abrirModalNuevaGuiaManual(): Promise<void> {
    this.loading.show('Procesando...');
    try {
      if (!this.savedConfig()) {
        await this.cargarConfiguracion();
      }
      await this.cargarCatalogosDelFormulario();
      this.modoEdicionGuia.set(false);
      this.guiaParaEditar.set(null);
      this.modalNuevaGuiaManualVisible.set(true);
    } catch (err: any) {
      console.error('Error cargando catálogos guía manual:', err);
      this.alertService.showAlert('Error', err?.error?.message ?? err?.message ?? 'Error al cargar catálogos', 'error');
    } finally {
      this.loading.hide();
    }
  }

  async editarGuia(g: GuiaRemision): Promise<void> {
    const datos = this.datosDeGuia(g);
    if (!datos) return;

    this.loading.show('Procesando...');
    try {
      const resp = await this.api.obtener(datos.idProyecto, datos.codigoGuiaRemision);
      if (resp?.error) {
        this.alertService.showAlert('Error', resp.mensaje ?? 'Error al obtener la guía manual.', 'error');
        return;
      }
      const detalleData: any = Array.isArray(resp?.data) ? resp.data[0] : resp?.data;
      if (!detalleData) {
        this.alertService.showAlert('Error', 'No se encontró el detalle de la guía manual.', 'error');
        return;
      }

      await this.cargarCatalogosDelFormulario();

      const documento = texto(detalleData?.documentoDestinatario);
      const destinatario = this.destinatarios().find((d: any) => texto(d?.documentoFiscal) === documento);
      const detalleItems: any[] = Array.isArray(detalleData?.detalle) ? detalleData.detalle : [];

      this.guiaParaEditar.set({
        destinatarioId: texto((destinatario as any)?.id),
        puntoPartida: detalleData?.puntoPartida ?? '',
        puntoLlegada: detalleData?.puntoLlegada ?? '',
        ubigeoPartida: detalleData?.ubigeoPartida ?? '131202',
        ubigeoLlegada: detalleData?.ubigeoLlegada ?? '131202',
        idEstablecimientoPartida: texto(detalleData?.idEstablecimientoPartida),
        idEstablecimientoLlegada: texto(detalleData?.idEstablecimientoLlegada),
        transportistaId: String(detalleData?.idTransportista ?? ''),
        conductorId: String(detalleData?.idConductor ?? ''),
        vehiculoId: String(detalleData?.idVehiculo ?? ''),
        motivoTraslado: texto(detalleData?.codigoSunatMotivoTraslado ?? detalleData?.motivoTraslado ?? '13'),
        descripcionMotivoTraslado: detalleData?.descripcionMotivoTraslado ?? '',
        fechaEntregaBienes: detalleData?.fechaEntregaBienes ?? '',
        precinto: detalleData?.precinto ?? '',
        observacionesUsuario: detalleData?.observacionesUsuario ?? '',
        codigoGuiaRemision: detalleData?.codigoGuiaRemision,
        transactionId_uuid: detalleData?.transactionId_uuid,
        fechaCreacionWeb: detalleData?.fechaCreacionWeb,
        estado: detalleData?.estado,
        detalleManual: detalleItems.map((d: any) => ({
          id: d.id,
          descripcion: d.descripcion ?? '',
          codigoUnidadMedida: d.codigoUnidadMedida ?? 'NIU',
          cantidad: d.cantidad ?? 0,
          pesoEstimado: d.pesoEstimado ?? 0,
          codigoItem: d.codigoItem ?? '',
        })),
      });

      this.modoEdicionGuia.set(true);
      this.modalNuevaGuiaManualVisible.set(true);
    } catch (error: any) {
      console.error('Error preparando edición guía manual:', error);
      this.alertService.showAlert('Error', error?.error?.message ?? error?.message ?? 'Error al preparar la edición de la guía manual.', 'error');
    } finally {
      this.loading.hide();
    }
  }

  cerrarModalNuevaGuiaManual(): void {
    if (this.guardandoGuiaManual()) return;
    this.modalNuevaGuiaManualVisible.set(false);
    this.modoEdicionGuia.set(false);
    this.guiaParaEditar.set(null);
    this.guardandoGuiaManual.set(false);
  }

  async onCrearGuiaManual(payload: any): Promise<void> {
    if (this.guardandoGuiaManual()) return;
    this.guardandoGuiaManual.set(true);

    const idProyecto = texto(this.savedConfig()?.idProyecto);
    if (!idProyecto) {
      this.alertService.showAlert('Error', 'No se encontró el proyecto.', 'error');
      this.guardandoGuiaManual.set(false);
      return;
    }
    if (!this.connectivity.isOnline()) {
      this.alertService.showAlert('Error', 'No hay conexión a internet.', 'error');
      this.guardandoGuiaManual.set(false);
      return;
    }

    const destinatario = this.destinatarios().find((d) => texto((d as any)?.id) === texto(payload.destinatarioId));
    const guiaPayload = {
      ...payload,
      documentoDestinatario: texto((destinatario as any)?.documentoFiscal),
      estado: 'ABIERTA',
    };
    delete (guiaPayload as any).destinatarioId;

    this.loading.show('Procesando...');
    try {
      const resp = await this.api.sincronizar(idProyecto, [guiaPayload]);
      this.loading.hide();
      if (resp?.error) {
        this.alertService.showAlert('Error', resp.mensaje ?? 'Error al guardar la guía manual.', 'error');
        return;
      }
      this.alertService.showAlert('Éxito', resp?.mensaje || 'Guía manual registrada correctamente.', 'success');
      this.modalNuevaGuiaManualVisible.set(false);
      await this.onBuscarGuias();
    } catch (err: any) {
      this.loading.hide();
      console.error('Error guardando guía manual:', err);
      this.alertService.showAlert('Error', err?.error?.message ?? err?.message ?? 'Error al guardar la guía manual.', 'error');
    } finally {
      this.guardandoGuiaManual.set(false);
    }
  }

  async onEditarGuiaManual(payload: any): Promise<void> {
    const idProyecto = texto(this.savedConfig()?.idProyecto);
    if (!idProyecto) {
      this.alertService.showAlert('Error', 'No se encontró la configuración del proyecto.', 'error');
      return;
    }

    this.loading.show('Procesando...');
    try {
      const resp = await this.api.editar(idProyecto, payload);
      this.loading.hide();
      if (resp?.error) {
        this.alertService.showAlert('Error', resp.mensaje ?? 'Error al editar la guía manual.', 'error');
        return;
      }
      this.alertService.showAlert('Éxito', resp?.mensaje || 'Guía manual editada correctamente.', 'success');
      this.modalNuevaGuiaManualVisible.set(false);
      this.modoEdicionGuia.set(false);
      this.guiaParaEditar.set(null);
      await this.onBuscarGuias();
    } catch (err: any) {
      this.loading.hide();
      console.error('Error editando guía manual:', err);
      this.alertService.showAlert('Error', err?.error?.message ?? err?.message ?? 'Error al editar la guía manual.', 'error');
    }
  }

  // ───────── Catalogos ─────────

  private async cargarCatalogosDelFormulario(): Promise<void> {
    await this.cargarTransportistas();
    await this.cargarConductores();
    await this.cargarVehiculos();
    await this.cargarDestinatarios();
    await this.cargarMotivosTraslado();
    await this.cargarEstablecimientoEmisor();
    await this.cargarEstablecimientos();
  }

  private async cargarConfiguracion(): Promise<void> {
    try {
      const nro = texto(this.usuario()?.documentoIdentidad);
      if (!nro) {
        this.savedConfig.set(null);
        return;
      }
      const cfg = await this.catalogosRepo.configuracionRepo.getByField('nrodocumento', nro);
      this.savedConfig.set(cfg ?? null);
    } catch (error) {
      console.log('Error cargando configuracion en guias manuales', error);
      this.savedConfig.set(null);
    }
  }

  private async cargarTransportistas(): Promise<void> {
    this.transportistas.set((await this.catalogosGuia.transportistas(texto(this.savedConfig()?.idProyecto))) ?? []);
  }

  private async cargarConductores(): Promise<void> {
    this.conductores.set((await this.catalogosGuia.conductores(texto(this.savedConfig()?.idProyecto))) ?? []);
  }

  private async cargarVehiculos(): Promise<void> {
    this.vehiculos.set((await this.catalogosGuia.vehiculos(texto(this.savedConfig()?.idProyecto))) ?? []);
  }

  private async cargarDestinatarios(): Promise<void> {
    this.destinatarios.set((await this.catalogosGuia.destinatarios()) ?? []);
  }

  private async cargarMotivosTraslado(): Promise<void> {
    this.motivosTraslado.set((await this.catalogosGuia.motivosTraslado()) ?? []);
  }

  private async cargarEstablecimientoEmisor(): Promise<void> {
    this.establecimientoEmisor.set(await this.catalogosGuia.establecimientoEmisor());
  }

  private async cargarEstablecimientos(): Promise<void> {
    this.establecimientos.set(await this.catalogosGuia.establecimientos());
  }
}
