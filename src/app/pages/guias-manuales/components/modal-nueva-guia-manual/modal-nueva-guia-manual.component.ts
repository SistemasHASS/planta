import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, OnInit, Output, signal, computed, SimpleChanges, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UbigeoDepartamento, UbigeoDistrito, UbigeoProvincia } from '../../../../shared/interfaces/catalogo.interface';
import { AuthService } from '../../../../shared/services/auth.service';
import { CatalogoService } from '../../../../shared/services/catalogo.service';
import { AdvancedSelectComponent } from '../../../../shared/components/advanced-select/advanced-select.component';
import { firstValueFrom } from 'rxjs';
import { formatDate, toLocalISOString } from '../../../../shared/utils/datetime.utils';

@Component({
  selector: 'app-modal-nueva-guia-manual',
  standalone: true,
  imports: [CommonModule, FormsModule, AdvancedSelectComponent],
  templateUrl: './modal-nueva-guia-manual.component.html',
  styleUrl: './modal-nueva-guia-manual.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModalNuevaGuiaManualComponent implements OnChanges, OnInit {
  @Input() transportistas: any[] = [];
  @Input() conductores: any[] = [];
  @Input() vehiculos: any[] = [];
  @Input() destinatarios: any[] = [];
  @Input() motivosTraslado: any[] = [];
  @Input() establecimientoEmisor: any = null;
  @Input() establecimientos: any[] = [];
  @Input() modoEdicion = false;
  @Input() guiaEditando: any = null;
  @Input() guardando = false;

  private readonly auth = inject(AuthService);
  private readonly catalogoService = inject(CatalogoService);

  readonly departamentos = signal<UbigeoDepartamento[]>([]);
  readonly provinciasPartida = signal<UbigeoProvincia[]>([]);
  readonly distritosPartida = signal<UbigeoDistrito[]>([]);
  readonly provinciasLlegada = signal<UbigeoProvincia[]>([]);
  readonly distritosLlegada = signal<UbigeoDistrito[]>([]);

  readonly destinatariosActivos = computed(() => {
    const list = this.destinatarios ?? [];
    return list.filter((d: any) => {
      const a = d?.activo;
      return a === true || a === 1 || (typeof a === 'string' && (a === '1' || a.toLowerCase() === 'true'));
    });
  });

  readonly unidadesMedida = signal<any[]>([]);
  readonly tiposLocacion = signal<any[]>([]);
  readonly locacionesTraslado = signal<any[]>([]);

  readonly unidadesMedidaActivas = computed(() => {
    const list = this.unidadesMedida() ?? [];
    const backend = list.filter((u: any) => {
      const a = u?.activo;
      const e = u?.eliminado;
      const activo = a === true || a === 1 || (typeof a === 'string' && (a === '1' || a.toLowerCase() === 'true'));
      const eliminado = e === true || e === 1 || (typeof e === 'string' && (e === '1' || e.toLowerCase() === 'true'));
      return activo && !eliminado;
    });
    if (backend.length > 0) return backend;
    return [
      { id: 1, codigo: 'NIU', descripcion: 'Unidad', simboloComercial: 'NIU' },
      { id: 2, codigo: 'BJ', descripcion: 'Balde', simboloComercial: 'BJ' },
      { id: 3, codigo: 'KGM', descripcion: 'Kilogramo', simboloComercial: 'KG' },
      { id: 4, codigo: 'LTR', descripcion: 'Litro', simboloComercial: 'LTR' },
    ];
  });

  @Output() cerrar = new EventEmitter<void>();
  @Output() crear = new EventEmitter<any>();
  @Output() editar = new EventEmitter<any>();

  readonly submitAttempted = signal(false);
  private transactionIdCreacion: string | null = null;

  readonly form = signal({
    destinatarioId: '',
    puntoPartida: '',
    puntoLlegada: '',
    ubigeoPartida: '',
    ubigeoLlegada: '',
    idEstablecimientoPartida: '',
    idEstablecimientoLlegada: '',
    departamentoPartida: '',
    provinciaPartida: '',
    distritoPartida: '',
    departamentoLlegada: '',
    provinciaLlegada: '',
    distritoLlegada: '',
    transportistaId: '',
    conductorId: '',
    vehiculoId: '',
    motivoTraslado: '13',
    descripcionMotivoTraslado: 'SERVICIO DE FRÍO',
    tipoLocacionId: '',
    codigoLocacion: '',
    fechaEntregaBienes: formatDate(new Date()) ?? '',
    precinto: '',
    parihuelas: 0,
    observacionesUsuario: '',
  });

  readonly detalle = signal<any[]>([]);
  readonly detalleSubmitAttempted = signal(false);

  readonly detalleActivos = computed(() => {
    return this.detalle().filter(d => !d.eliminado);
  });

  readonly esMotivoOtros = computed(() => {
    const motivo = String(this.form().motivoTraslado ?? '').trim();
    return motivo === '13' || motivo.toUpperCase() === 'OTROS';
  });

  readonly esTrasladoEntreEstablecimientos = computed(() => {
    const motivo = String(this.form().motivoTraslado ?? '').trim();
    return motivo === '04';
  });

  readonly esExportacion = computed(() => {
    const motivo = String(this.form().motivoTraslado ?? '').trim();
    return motivo === '09';
  });

  readonly locacionTrasladoLabel = computed(() => {
    const tipo = String(this.form().tipoLocacionId ?? '').trim();
    return tipo === '2' ? 'Aeropuerto' : 'Puerto';
  });

  readonly establecimientoDestinoId = signal('');

  readonly detalleValido = computed(() => {
    const det = this.detalle();
    const activos = det.filter(d => !d.eliminado);
    return activos.length > 0 && activos.every(d =>
      String(d.codigo ?? '').trim() &&
      String(d.descripcion ?? '').trim() &&
      String(d.codigoUnidadMedida ?? '').trim() &&
      d.cantidad !== null && d.cantidad !== undefined && d.cantidad !== '' && Number(d.cantidad) > 0 &&
      d.pesoEstimado !== null && d.pesoEstimado !== undefined && d.pesoEstimado !== '' && Number(d.pesoEstimado) > 0
    );
  });

  readonly ubigeoPartidaValido = computed(() => {
    const u = String(this.form().ubigeoPartida ?? '').trim();
    return u.length === 6;
  });

  readonly ubigeoLlegadaValido = computed(() => {
    const u = String(this.form().ubigeoLlegada ?? '').trim();
    return u.length === 6;
  });

  readonly formularioValido = computed(() => {
    const f = this.form();
    return !!(
      (this.esTrasladoEntreEstablecimientos() ? f.idEstablecimientoPartida?.trim() && this.establecimientoDestinoId() : f.destinatarioId) &&
      f.puntoPartida?.trim() &&
      f.puntoLlegada?.trim() &&
      f.idEstablecimientoPartida?.trim() &&
      (!this.esTrasladoEntreEstablecimientos() || f.idEstablecimientoLlegada?.trim()) &&
      (!this.esTrasladoEntreEstablecimientos() || this.establecimientosTrasladoDiferentes()) &&
      f.transportistaId &&
      f.conductorId &&
      f.vehiculoId &&
      f.motivoTraslado &&
      f.fechaEntregaBienes &&
      f.precinto?.trim() &&
      this.ubigeoPartidaValido() &&
      this.ubigeoLlegadaValido() &&
      (!this.esMotivoOtros() || f.descripcionMotivoTraslado?.trim()) &&
      this.detalleValido()
    );
  });

  constructor() {
    effect(() => {
      const f = this.form();
      const depPartida = String(f.departamentoPartida ?? '').trim();
      const provPartida = String(f.provinciaPartida ?? '').trim();
      const uPartida = String(f.ubigeoPartida ?? '').trim();

      if (depPartida && depPartida.length === 2) {
        this.loadProvinciasPartida(depPartida);
      } else {
        this.provinciasPartida.set([]);
      }

      if (depPartida && provPartida && depPartida.length === 2 && provPartida.length === 2) {
        this.loadDistritosPartida(depPartida, provPartida);
      } else {
        this.distritosPartida.set([]);
      }

      const depLlegada = String(f.departamentoLlegada ?? '').trim();
      const provLlegada = String(f.provinciaLlegada ?? '').trim();
      const uLlegada = String(f.ubigeoLlegada ?? '').trim();

      if (depLlegada && depLlegada.length === 2) {
        this.loadProvinciasLlegada(depLlegada);
      } else {
        this.provinciasLlegada.set([]);
      }

      if (depLlegada && provLlegada && depLlegada.length === 2 && provLlegada.length === 2) {
        this.loadDistritosLlegada(depLlegada, provLlegada);
      } else {
        this.distritosLlegada.set([]);
      }
    }, { allowSignalWrites: true });
  }

  ngOnInit(): void {
    void this.loadDepartamentos();
    void this.loadUnidadesMedida();
    void this.loadTiposLocacion();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['guiaEditando'] || changes['modoEdicion']) {
      this.transactionIdCreacion = null;
    }

    if (changes['guiaEditando'] && this.modoEdicion && this.guiaEditando) {
      const g = this.guiaEditando;
      const datosEmisor = this.getDatosEstablecimientoEmisor();
      const ubigeoPartida = String(g.ubigeoPartida ?? datosEmisor.ubigeo).trim();
      const ubigeoLlegada = String(g.ubigeoLlegada ?? '').trim();
      const motivoTraslado = String(g.motivoTraslado ?? '13').trim();
      const idEstablecimientoPartida = String(g.idEstablecimientoPartida ?? datosEmisor.idEstablecimiento).trim();
      const idEstablecimientoLlegada = String(g.idEstablecimientoLlegada ?? '').trim();
      this.establecimientoDestinoId.set(motivoTraslado === '04' ? idEstablecimientoLlegada : '');
      this.form.set({
        destinatarioId: String(g.destinatarioId ?? ''),
        puntoPartida: g.puntoPartida ?? datosEmisor.direccion,
        puntoLlegada: g.puntoLlegada ?? '',
        ubigeoPartida: ubigeoPartida,
        ubigeoLlegada: ubigeoLlegada,
        idEstablecimientoPartida,
        idEstablecimientoLlegada,
        departamentoPartida: ubigeoPartida.substring(0, 2),
        provinciaPartida: ubigeoPartida.substring(2, 4),
        distritoPartida: ubigeoPartida,
        departamentoLlegada: ubigeoLlegada.substring(0, 2),
        provinciaLlegada: ubigeoLlegada.substring(2, 4),
        distritoLlegada: ubigeoLlegada,
        transportistaId: String(g.transportistaId ?? ''),
        conductorId: String(g.conductorId ?? ''),
        vehiculoId: String(g.vehiculoId ?? ''),
        motivoTraslado,
        descripcionMotivoTraslado: g.descripcionMotivoTraslado ?? 'SERVICIO DE FRÍO',
        tipoLocacionId: String(g.tipoLocacionId ?? ''),
        codigoLocacion: String(g.codigoLocacion ?? ''),
        fechaEntregaBienes: g.fechaEntregaBienes ? formatDate(g.fechaEntregaBienes) ?? '' : formatDate(new Date()) ?? '',
        precinto: g.precinto ?? '',
        parihuelas: g.parihuelas ?? 0,
        observacionesUsuario: g.observacionesUsuario ?? '',
      });
      if (motivoTraslado === '09' && this.form().tipoLocacionId) {
        void this.loadLocacionesTraslado(this.form().tipoLocacionId);
      }
      this.aplicarEstablecimientosTrasladoSeleccionados();
      this.detalle.set(Array.isArray(g.detalleManual) ? g.detalleManual.map((d: any) => ({
        codigo: String(d.codigoItem ?? '0000000'),
        descripcion: d.descripcion ?? '',
        codigoUnidadMedida: d.codigoUnidadMedida ?? 'NIU',
        cantidad: d.cantidad ?? null,
        pesoEstimado: d.pesoEstimado ?? null,
        id: d.id,
      })) : []);
    }

    if (changes['establecimientoEmisor'] && !this.modoEdicion && this.establecimientoEmisor) {
      this.aplicarEstablecimientoEmisor();
    }

    if (changes['establecimientos'] && this.esTrasladoEntreEstablecimientos()) {
      this.aplicarEstablecimientosTrasladoSeleccionados();
    }
  }

  private aplicarEstablecimientoEmisor(): void {
    const datos = this.getDatosEstablecimientoEmisor();
    if (!datos.direccion && !datos.ubigeo) return;

    this.form.update(f => ({
      ...f,
      puntoPartida: datos.direccion,
      ubigeoPartida: datos.ubigeo,
      idEstablecimientoPartida: datos.idEstablecimiento,
      departamentoPartida: datos.ubigeo.substring(0, 2),
      provinciaPartida: datos.ubigeo.substring(2, 4),
      distritoPartida: datos.ubigeo,
    }));
  }

  private getDatosEstablecimientoEmisor(): { direccion: string; ubigeo: string; idEstablecimiento: string } {
    const direccion = String(this.establecimientoEmisor?.direccion ?? '').trim();
    const ubigeo = String(this.establecimientoEmisor?.codigoUbigeo ?? '').trim();
    const idEstablecimiento = String(this.establecimientoEmisor?.idEstablecimiento ?? '').trim();
    return { direccion, ubigeo, idEstablecimiento };
  }

  async loadUnidadesMedida(): Promise<void> {
    try {
      const resp: any = await firstValueFrom(this.catalogoService.listarUnidadesMedida());
      this.unidadesMedida.set(resp?.data ?? []);
    } catch (e) {
      console.error('Error cargando unidades de medida', e);
      this.unidadesMedida.set([]);
    }
  }

  async loadTiposLocacion(): Promise<void> {
    try {
      const resp: any = await firstValueFrom(this.catalogoService.listarTiposLocacion());
      this.tiposLocacion.set(resp?.data ?? []);
    } catch (e) {
      console.error('Error cargando tipos de locación', e);
      this.tiposLocacion.set([]);
    }
  }

  async loadLocacionesTraslado(tipoLocacionId: string): Promise<void> {
    try {
      const resp: any = tipoLocacionId === '2'
        ? await firstValueFrom(this.catalogoService.listarAeroPuertos())
        : await firstValueFrom(this.catalogoService.listarPuertos());
      this.locacionesTraslado.set(resp?.data ?? []);
    } catch (e) {
      console.error('Error cargando locaciones de traslado', e);
      this.locacionesTraslado.set([]);
    }
  }

  isInvalid(field: string): boolean {
    if (!this.submitAttempted()) return false;
    if (field === 'destinatarioId' && this.esTrasladoEntreEstablecimientos()) return false;
    const f = this.form();
    const value = (f as any)[field];
    return value === null || value === undefined || String(value).trim() === '';
  }

  isInvalidEstablecimientoDestino(): boolean {
    return this.submitAttempted() && this.esTrasladoEntreEstablecimientos() && (
      !this.establecimientoDestinoId() || !this.establecimientosTrasladoDiferentes()
    );
  }

  isInvalidEstablecimientoPartida(): boolean {
    return this.submitAttempted() && this.esTrasladoEntreEstablecimientos() && !this.form().idEstablecimientoPartida?.trim();
  }

  getEstablecimientosPartida(): any[] {
    return (this.establecimientos ?? []).filter((e: any) => String(e?.idEstablecimiento ?? '').trim());
  }

  getEstablecimientosDestino(): any[] {
    const origen = String(this.form().idEstablecimientoPartida ?? '').trim();
    return (this.establecimientos ?? []).filter((e: any) => {
      const idEstablecimiento = String(e?.idEstablecimiento ?? '').trim();
      return idEstablecimiento && idEstablecimiento !== origen;
    });
  }

  establecimientosTrasladoDiferentes(): boolean {
    if (!this.esTrasladoEntreEstablecimientos()) return true;
    const partida = String(this.form().idEstablecimientoPartida ?? '').trim();
    const llegada = String(this.form().idEstablecimientoLlegada ?? '').trim();
    return !!partida && !!llegada && partida !== llegada;
  }

  isInvalidDescripcionMotivoTraslado(): boolean {
    return this.submitAttempted() && this.esMotivoOtros() && !String(this.form().descripcionMotivoTraslado ?? '').trim();
  }

  isInvalidUbigeoPartida(): boolean {
    return this.submitAttempted() && !this.ubigeoPartidaValido();
  }

  isInvalidUbigeoLlegada(): boolean {
    return this.submitAttempted() && !this.ubigeoLlegadaValido();
  }

  onCancelar(): void {
    if (this.guardando) return;
    this.transactionIdCreacion = null;
    this.cerrar.emit();
  }

  onSubmit(): void {
    if (this.guardando) return;

    this.submitAttempted.set(true);
    this.detalleSubmitAttempted.set(true);
    if (!this.formularioValido()) return;

    if (this.modoEdicion) {
      const g = this.guiaEditando;
      const destinatarioId = String(this.form().destinatarioId ?? '').trim();
      const destinatario = this.destinatariosActivos().find((d: any) => String(d?.id ?? '').trim() === destinatarioId);
      const documentoDestinatario = String((destinatario as any)?.documentoFiscal ?? '').trim();

      const payload = {
        ...this.form(),
        destinatarioId,
        documentoDestinatario,
        codigoGuiaRemision: g.codigoGuiaRemision,
        transactionId_uuid: g.transactionId_uuid,
        estado: g.estado,
        detalle: this.detalle().map(d => ({
          id: d.id,
          descripcion: d.descripcion,
          codigoUnidadMedida: d.codigoUnidadMedida,
          cantidad: d.cantidad,
          pesoEstimado: d.pesoEstimado,
          codigoItem: d.codigo,
          eliminado: d.eliminado ?? false
        }))
      };
      this.editar.emit(payload);
    } else {
      const transactionId_uuid = this.getOrCreateTransactionId();
      const payload = {
        ...this.form(),
        transactionId_uuid,
        fechaCreacionWeb: toLocalISOString(),
        detalle: this.detalle().map(d => ({
          ...d,
          codigoItem: d.codigo
        }))
      };
      this.crear.emit(payload);
    }
  }

  private getOrCreateTransactionId(): string {
    if (!this.transactionIdCreacion) {
      this.transactionIdCreacion = this.generateUUID();
    }

    return this.transactionIdCreacion;
  }

  private generateUUID(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  agregarDetalle(): void {
    this.detalle.update(list => [
      ...list,
      {
        codigo: '0000000',
        descripcion: '',
        codigoUnidadMedida: 'NIU',
        cantidad: null,
        pesoEstimado: null,
      }
    ]);
  }

  eliminarDetalle(item: any): void {
    let index = -1;
    if (item.id) {
      index = this.detalle().findIndex(d => d.id === item.id);
    } else {
      index = this.detalle().findIndex(d => d === item);
    }
    if (index === -1) return;

    if (this.modoEdicion) {
      if (item.id) {
        this.detalle.update(list => {
          const nuevo = [...list];
          nuevo[index] = { ...nuevo[index], eliminado: true };
          return nuevo;
        });
        return;
      }
    }
    this.detalle.update(list => list.filter((_, i) => i !== index));
  }

  actualizarDetalle(item: any, field: string, value: any): void {
    const index = this.detalle().findIndex(d => d === item);
    if (index === -1) return;

    this.detalle.update(list => {
      const nuevo = [...list];
      if (field === 'cantidad') {
        nuevo[index] = { ...nuevo[index], [field]: value === '' ? '' : Number(value) };
      } else {
        nuevo[index] = { ...nuevo[index], [field]: value };
      }
      return nuevo;
    });
  }

  isInvalidDetalle(item: any, field: string): boolean {
    if (!this.detalleSubmitAttempted()) return false;
    const value = (item as any)[field];
    if (field === 'cantidad') {
      return value === null || value === undefined || value === '' || Number(value) <= 0;
    }
    return value === null || value === undefined || String(value).trim() === '';
  }

  updateField(field: string, value: any): void {
    if (field === 'motivoTraslado') {
      const motivo = String(value ?? '').trim();
      const motivoActual = String(this.form().motivoTraslado ?? '').trim();
      if (motivo === motivoActual) return;

      this.limpiarCamposPorCambioMotivo(motivo);
      if (motivo === '09') {
        void this.loadTiposLocacion();
      }
      return;
    }
    if (field === 'tipoLocacionId') {
      const tipoLocacionId = String(value ?? '').trim();
      this.locacionesTraslado.set([]);
      this.form.update(f => ({
        ...f,
        tipoLocacionId,
        codigoLocacion: '',
      }));
      if (tipoLocacionId) {
        void this.loadLocacionesTraslado(tipoLocacionId);
      }
      return;
    }
    if (field === 'codigoLocacion') {
      this.form.update(f => ({
        ...f,
        codigoLocacion: String(value ?? '').trim(),
      }));
      return;
    }
    if (field === 'establecimientoPartidaId') {
      const id = String(value ?? '').trim();
      const establecimiento = this.getEstablecimientosPartida().find((e: any) => String(e?.idEstablecimiento ?? '').trim() === id);
      const puntoPartida = String(establecimiento?.direccion ?? '').trim();
      const ubigeoPartida = String(establecimiento?.codigoUbigeo ?? '').trim();

      this.form.update(f => {
        const destinoIgual = id && id === String(f.idEstablecimientoLlegada ?? '').trim();
        if (destinoIgual) this.establecimientoDestinoId.set('');
        return {
          ...f,
          puntoPartida,
          ubigeoPartida,
          idEstablecimientoPartida: id,
          departamentoPartida: ubigeoPartida.substring(0, 2),
          provinciaPartida: ubigeoPartida.substring(2, 4),
          distritoPartida: ubigeoPartida,
          puntoLlegada: destinoIgual ? '' : f.puntoLlegada,
          ubigeoLlegada: destinoIgual ? '' : f.ubigeoLlegada,
          idEstablecimientoLlegada: destinoIgual ? '' : f.idEstablecimientoLlegada,
          departamentoLlegada: destinoIgual ? '' : f.departamentoLlegada,
          provinciaLlegada: destinoIgual ? '' : f.provinciaLlegada,
          distritoLlegada: destinoIgual ? '' : f.distritoLlegada,
        };
      });
      return;
    }
    if (field === 'establecimientoDestinoId') {
      const id = String(value ?? '').trim();
      const establecimiento = this.getEstablecimientosDestino().find((e: any) => String(e?.idEstablecimiento ?? '').trim() === id);
      const puntoLlegada = String(establecimiento?.direccion ?? '').trim();
      const ubigeoLlegada = String(establecimiento?.codigoUbigeo ?? '').trim();

      this.establecimientoDestinoId.set(id);
      this.form.update(f => ({
        ...f,
        puntoLlegada,
        ubigeoLlegada,
        idEstablecimientoLlegada: id,
        departamentoLlegada: ubigeoLlegada.substring(0, 2),
        provinciaLlegada: ubigeoLlegada.substring(2, 4),
        distritoLlegada: ubigeoLlegada,
      }));
      return;
    }
    if (field === 'destinatarioId') {
      const id = String(value ?? '').trim();
      const dest = this.destinatariosActivos().find((d: any) => String(d?.id ?? '').trim() === id);
      const puntoLlegada = dest?.puntoLlegada ?? dest?.domicilioFiscal ?? '';
      const ubigeoLlegada = String(dest?.puntoLlegadaDistrito ?? '').trim() || '131202';
      this.form.update(f => ({ ...f,
        destinatarioId: value,
        puntoLlegada,
        ubigeoLlegada,
        idEstablecimientoLlegada: '',
        departamentoLlegada: ubigeoLlegada.substring(0, 2),
        provinciaLlegada: ubigeoLlegada.substring(2, 4),
        distritoLlegada: ubigeoLlegada,
      }));
      return;
    }
    if (field === 'departamentoPartida') {
      this.form.update(f => ({ ...f, departamentoPartida: value, provinciaPartida: '', distritoPartida: '', ubigeoPartida: '' }));
      return;
    }
    if (field === 'provinciaPartida') {
      this.form.update(f => ({ ...f, provinciaPartida: value, distritoPartida: '', ubigeoPartida: '' }));
      return;
    }
    if (field === 'distritoPartida') {
      this.form.update(f => ({ ...f, distritoPartida: value, ubigeoPartida: value }));
      return;
    }
    if (field === 'departamentoLlegada') {
      this.form.update(f => ({ ...f, departamentoLlegada: value, provinciaLlegada: '', distritoLlegada: '', ubigeoLlegada: '' }));
      return;
    }
    if (field === 'provinciaLlegada') {
      this.form.update(f => ({ ...f, provinciaLlegada: value, distritoLlegada: '', ubigeoLlegada: '' }));
      return;
    }
    if (field === 'distritoLlegada') {
      this.form.update(f => ({ ...f, distritoLlegada: value, ubigeoLlegada: value }));
      return;
    }
    this.form.update(f => ({ ...f, [field]: value }));
  }

  private limpiarCamposPorCambioMotivo(motivo: string): void {
    const datosEmisor = this.getDatosEstablecimientoEmisor();
    const usarPartidaPorDefecto = motivo !== '04';
    this.establecimientoDestinoId.set('');
    this.detalle.set([]);
    this.detalleSubmitAttempted.set(false);
    this.submitAttempted.set(false);

    this.form.update(f => ({
      ...f,
      motivoTraslado: motivo,
      descripcionMotivoTraslado: motivo === '13' ? 'SERVICIO DE FRÍO' : '',
      tipoLocacionId: '',
      codigoLocacion: '',
      destinatarioId: '',
      puntoPartida: usarPartidaPorDefecto ? datosEmisor.direccion : '',
      ubigeoPartida: usarPartidaPorDefecto ? datosEmisor.ubigeo : '',
      idEstablecimientoPartida: usarPartidaPorDefecto ? datosEmisor.idEstablecimiento : '',
      departamentoPartida: usarPartidaPorDefecto ? datosEmisor.ubigeo.substring(0, 2) : '',
      provinciaPartida: usarPartidaPorDefecto ? datosEmisor.ubigeo.substring(2, 4) : '',
      distritoPartida: usarPartidaPorDefecto ? datosEmisor.ubigeo : '',
      puntoLlegada: '',
      ubigeoLlegada: '',
      idEstablecimientoLlegada: '',
      departamentoLlegada: '',
      provinciaLlegada: '',
      distritoLlegada: '',
      transportistaId: '',
      conductorId: '',
      vehiculoId: '',
      precinto: '',
      observacionesUsuario: '',
    }));
  }

  private aplicarEstablecimientosTrasladoSeleccionados(): void {
    if (!this.esTrasladoEntreEstablecimientos()) return;
    const f = this.form();
    const partida = this.getEstablecimientoPorId(f.idEstablecimientoPartida);
    const llegada = this.getEstablecimientoPorId(f.idEstablecimientoLlegada);

    if (!partida && !llegada) return;

    const puntoPartida = String(partida?.direccion ?? f.puntoPartida ?? '').trim();
    const ubigeoPartida = String(partida?.codigoUbigeo ?? f.ubigeoPartida ?? '').trim();
    const puntoLlegada = String(llegada?.direccion ?? f.puntoLlegada ?? '').trim();
    const ubigeoLlegada = String(llegada?.codigoUbigeo ?? f.ubigeoLlegada ?? '').trim();

    this.form.update(curr => ({
      ...curr,
      puntoPartida,
      ubigeoPartida,
      departamentoPartida: ubigeoPartida.substring(0, 2),
      provinciaPartida: ubigeoPartida.substring(2, 4),
      distritoPartida: ubigeoPartida,
      puntoLlegada,
      ubigeoLlegada,
      departamentoLlegada: ubigeoLlegada.substring(0, 2),
      provinciaLlegada: ubigeoLlegada.substring(2, 4),
      distritoLlegada: ubigeoLlegada,
    }));
  }

  private getEstablecimientoPorId(id: string | null | undefined): any | null {
    const idBuscado = String(id ?? '').trim();
    if (!idBuscado) return null;
    return (this.establecimientos ?? []).find((e: any) => String(e?.idEstablecimiento ?? '').trim() === idBuscado) ?? null;
  }

  async loadDepartamentos(): Promise<void> {
    try {
      const resp: any = await firstValueFrom(this.catalogoService.listarDepartamentos());
      this.departamentos.set(resp?.data ?? []);
    } catch (e) {
      console.error('Error cargando departamentos', e);
    }
  }

  async loadProvinciasPartida(codigoDepartamento: string): Promise<void> {
    try {
      const resp: any = await firstValueFrom(this.catalogoService.listarProvincias(codigoDepartamento));
      this.provinciasPartida.set(resp?.data ?? []);
    } catch (e) {
      console.error('Error cargando provincias partida', e);
    }
  }

  async loadDistritosPartida(codigoDepartamento: string, codigoProvincia: string): Promise<void> {
    try {
      const resp: any = await firstValueFrom(this.catalogoService.listarDistritos(codigoDepartamento, codigoProvincia));
      this.distritosPartida.set(resp?.data ?? []);
    } catch (e) {
      console.error('Error cargando distritos partida', e);
    }
  }

  async loadProvinciasLlegada(codigoDepartamento: string): Promise<void> {
    try {
      const resp: any = await firstValueFrom(this.catalogoService.listarProvincias(codigoDepartamento));
      this.provinciasLlegada.set(resp?.data ?? []);
    } catch (e) {
      console.error('Error cargando provincias llegada', e);
    }
  }

  async loadDistritosLlegada(codigoDepartamento: string, codigoProvincia: string): Promise<void> {
    try {
      const resp: any = await firstValueFrom(this.catalogoService.listarDistritos(codigoDepartamento, codigoProvincia));
      this.distritosLlegada.set(resp?.data ?? []);
    } catch (e) {
      console.error('Error cargando distritos llegada', e);
    }
  }
}
