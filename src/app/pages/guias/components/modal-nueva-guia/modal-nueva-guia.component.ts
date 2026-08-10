import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output, signal, computed, SimpleChanges, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Proceso } from '../../../../shared/interfaces/proceso.interface';
import { Palet } from '../../../../shared/interfaces/palet.interface';
import { UbigeoDepartamento, UbigeoDistrito, UbigeoProvincia } from '../../../../shared/interfaces/catalogo.interface';
import { CatalogoService } from '../../../../shared/services/catalogo.service';
import { AdvancedSelectComponent } from '../../../../shared/components/advanced-select/advanced-select.component';
import { firstValueFrom } from 'rxjs';
import { formatDate } from '../../../../shared/utils/datetime.utils';

@Component({
  selector: 'app-modal-nueva-guia',
  standalone: true,
  imports: [CommonModule, FormsModule, AdvancedSelectComponent],
  templateUrl: './modal-nueva-guia.component.html',
  styleUrl: './modal-nueva-guia.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModalNuevaGuiaComponent implements OnChanges {
  @Input() procesos: Proceso[] = [];
  @Input() transportistas: any[] = [];
  @Input() conductores: any[] = [];
  @Input() vehiculos: any[] = [];
  @Input() destinatarios: any[] = [];
  @Input() motivosTraslado: any[] = [];
  @Input() establecimientoEmisor: any = null;
  @Input() establecimientos: any[] = [];
  @Input() modoEdicion = false;
  @Input() guiaEditando: any = null;
  @Input() borradorGuia: any = null;

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

  @Output() cerrar = new EventEmitter<void>();
  @Output() crear = new EventEmitter<any>();
  @Output() editar = new EventEmitter<any>();

  readonly submitAttempted = signal(false);
  readonly creando = signal(false);
  readonly palets = signal<Palet[]>([]);
  readonly paletsSeleccionados = signal<Set<string>>(new Set());
  private transactionIdCreacion: string | null = null;

  private readonly initialForm = signal<Record<string, any>>({});
  private readonly initialPaletsSeleccionados = signal<Set<string>>(new Set());

  readonly hasChanges = computed(() => {
    if (!this.modoEdicion) return true;
    const init = this.initialForm();
    const curr = this.form();
    const formChanged =
      String(init['procesoId'] ?? '') !== String(curr.procesoId ?? '') ||
      String(init['destinatarioId'] ?? '') !== String(curr.destinatarioId ?? '') ||
      String(init['puntoPartida'] ?? '') !== String(curr.puntoPartida ?? '') ||
      String(init['puntoLlegada'] ?? '') !== String(curr.puntoLlegada ?? '') ||
      String(init['ubigeoPartida'] ?? '') !== String(curr.ubigeoPartida ?? '') ||
      String(init['ubigeoLlegada'] ?? '') !== String(curr.ubigeoLlegada ?? '') ||
      String(init['idEstablecimientoPartida'] ?? '') !== String(curr.idEstablecimientoPartida ?? '') ||
      String(init['idEstablecimientoLlegada'] ?? '') !== String(curr.idEstablecimientoLlegada ?? '') ||
      String(init['transportistaId'] ?? '') !== String(curr.transportistaId ?? '') ||
      String(init['conductorId'] ?? '') !== String(curr.conductorId ?? '') ||
      String(init['vehiculoId'] ?? '') !== String(curr.vehiculoId ?? '') ||
      String(init['motivoTraslado'] ?? '') !== String(curr.motivoTraslado ?? '') ||
      String(init['fechaEntregaBienes'] ?? '') !== String(curr.fechaEntregaBienes ?? '') ||
      String(init['precinto'] ?? '') !== String(curr.precinto ?? '') ||
      Number(init['parihuelas'] ?? 0) !== Number(curr.parihuelas ?? 0) ||
      String(init['observacionesUsuario'] ?? '') !== String(curr.observacionesUsuario ?? '') ||
      String(init['inspeccionTemperatura'] ?? '') !== String(curr.inspeccionTemperatura ?? '') ||
      String(init['numeroViaje'] ?? '') !== String(curr.numeroViaje ?? '') ||
      String(init['inspeccionLibreOlores'] ?? '') !== String(curr.inspeccionLibreOlores ?? '') ||
      String(init['inspeccionLibreInsectos'] ?? '') !== String(curr.inspeccionLibreInsectos ?? '') ||
      String(init['inspeccionLibreMateriasExtranas'] ?? '') !== String(curr.inspeccionLibreMateriasExtranas ?? '') ||
      String(init['inspeccionUnidadLimpia'] ?? '') !== String(curr.inspeccionUnidadLimpia ?? '') ||
      String(init['inspeccionObservaciones'] ?? '') !== String(curr.inspeccionObservaciones ?? '') ||
      String(init['inspeccionMedidaCorrectiva'] ?? '') !== String(curr.inspeccionMedidaCorrectiva ?? '') ||
      String(init['descripcionMotivoTraslado'] ?? '') !== String(curr.descripcionMotivoTraslado ?? '');
    const initIds = Array.from(this.initialPaletsSeleccionados()).sort();
    const currIds = Array.from(this.paletsSeleccionados()).sort();
    const paletsChanged = initIds.length !== currIds.length || initIds.some((v, i) => v !== currIds[i]);
    return formChanged || paletsChanged;
  });

  readonly form = signal({
    procesoId: '',
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
    fechaEntregaBienes: formatDate(new Date()),
    precinto: '',
    parihuelas: null as number | null,
    observacionesUsuario: 'PRODUCTO EXAMINADO POR DETECTOR DE METALES-CONFORME',
    inspeccionTemperatura: '',
    numeroViaje: '',
    inspeccionLibreOlores: '' as 'si' | 'no' | '',
    inspeccionLibreInsectos: '' as 'si' | 'no' | '',
    inspeccionLibreMateriasExtranas: '' as 'si' | 'no' | '',
    inspeccionUnidadLimpia: '' as 'si' | 'no' | '',
    inspeccionObservaciones: '',
    inspeccionMedidaCorrectiva: '',
  });

  readonly hayAlgunoNoInspeccion = computed(() => {
    const f = this.form();
    return f.inspeccionLibreOlores === 'no' ||
           f.inspeccionLibreInsectos === 'no' ||
           f.inspeccionLibreMateriasExtranas === 'no' ||
           f.inspeccionUnidadLimpia === 'no';
  });

  readonly esMotivoOtros = computed(() => this.form().motivoTraslado === '13');
  readonly esTrasladoEntreEstablecimientos = computed(() => this.form().motivoTraslado === '04');
  readonly establecimientoDestinoId = signal('');

  readonly ubigeoPartidaValido = computed(() => {
    const u = String(this.form().ubigeoPartida ?? '').trim();
    return u.length === 6;
  });

  readonly ubigeoLlegadaValido = computed(() => {
    const u = String(this.form().ubigeoLlegada ?? '').trim();
    return u.length === 6;
  });

  constructor() {
    effect(() => {
      const f = this.form();
      const depPartida = String(f.departamentoPartida ?? '').trim();
      const provPartida = String(f.provinciaPartida ?? '').trim();

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

  private boolToSiNo(val: boolean | null | undefined): 'si' | 'no' | '' {
    if (val === true) return 'si';
    if (val === false) return 'no';
    return '';
  }

  readonly tienePalets = computed(() => this.palets().length > 0);
  readonly nroPaletsSeleccionados = computed(() => this.paletsSeleccionados().size);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['guiaEditando'] || changes['modoEdicion']) {
      this.creando.set(false);
      if (!this.borradorGuia) {
        this.transactionIdCreacion = null;
      }
      void this.loadDepartamentos();
    }

    if (changes['borradorGuia'] && !this.modoEdicion && this.borradorGuia) {
      this.cargarBorrador(this.borradorGuia);
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
        procesoId: String(g.procesoId ?? ''),
        destinatarioId: String(g.destinatarioId ?? ''),
        puntoPartida: g.puntoPartida ?? datosEmisor.direccion,
        puntoLlegada: g.puntoLlegada ?? '',
        ubigeoPartida,
        ubigeoLlegada,
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
        descripcionMotivoTraslado: g.descripcionMotivoTraslado ?? '',
        fechaEntregaBienes: g.fechaEntregaBienes ?? formatDate(new Date()),
        precinto: g.precinto ?? '',
        parihuelas: Number(g.parihuelas) || 0,
        observacionesUsuario: g.observacionesUsuario ?? 'PRODUCTO EXAMINADO POR DETECTOR DE METALES-CONFORME',
        inspeccionTemperatura: g.inspeccionTemperatura != null ? String(g.inspeccionTemperatura) : '',
        numeroViaje: g.numeroViaje != null ? String(g.numeroViaje) : '',
        inspeccionLibreOlores: this.boolToSiNo(g.inspeccionLibreOlores),
        inspeccionLibreInsectos: this.boolToSiNo(g.inspeccionLibreInsectos),
        inspeccionLibreMateriasExtranas: this.boolToSiNo(g.inspeccionLibreMateriasExtranas),
        inspeccionUnidadLimpia: this.boolToSiNo(g.inspeccionUnidadLimpia),
        inspeccionObservaciones: g.inspeccionObservaciones ?? '',
        inspeccionMedidaCorrectiva: g.inspeccionMedidaCorrectiva ?? '',
      });
      this.aplicarEstablecimientosTrasladoSeleccionados();
      this.initialForm.set({ ...this.form() });
      this.submitAttempted.set(false);
      // Guardar estado inicial para detectar cambios en edición
      const initSeleccionados = new Set<string>(
        (g.paletsSeleccionados ?? []).map((p: any) => String(p ?? '').trim()).filter(Boolean)
      );
      this.initialPaletsSeleccionados.set(initSeleccionados);
      const procesoId = String(g.procesoId ?? '').trim();
      if (procesoId) {
        this.cargarPaletsPorProceso(procesoId, false);
        const seleccionados = new Set<string>(
          (g.paletsSeleccionados ?? []).map((p: any) => String(p ?? '').trim()).filter(Boolean)
        );
        this.paletsSeleccionados.set(seleccionados);
      }
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

  private cargarBorrador(borrador: any): void {
    const datosEmisor = this.getDatosEstablecimientoEmisor();
    const ubigeoPartida = String(borrador.ubigeoPartida ?? datosEmisor.ubigeo).trim();
    const ubigeoLlegada = String(borrador.ubigeoLlegada ?? '').trim();
    const motivoTraslado = String(borrador.motivoTraslado ?? '13');
    const idEstablecimientoPartida = String(borrador.idEstablecimientoPartida ?? datosEmisor.idEstablecimiento).trim();
    const idEstablecimientoLlegada = String(borrador.idEstablecimientoLlegada ?? '').trim();
    this.establecimientoDestinoId.set(motivoTraslado === '04' ? idEstablecimientoLlegada : '');
    this.form.set({
      procesoId: String(borrador.procesoId ?? ''),
      destinatarioId: String(borrador.destinatarioId ?? ''),
      puntoPartida: borrador.puntoPartida ?? datosEmisor.direccion,
      puntoLlegada: borrador.puntoLlegada ?? '',
      ubigeoPartida,
      ubigeoLlegada,
      idEstablecimientoPartida,
      idEstablecimientoLlegada,
      departamentoPartida: String(borrador.departamentoPartida ?? ubigeoPartida.substring(0, 2)),
      provinciaPartida: String(borrador.provinciaPartida ?? ubigeoPartida.substring(2, 4)),
      distritoPartida: String(borrador.distritoPartida ?? ubigeoPartida),
      departamentoLlegada: String(borrador.departamentoLlegada ?? ubigeoLlegada.substring(0, 2)),
      provinciaLlegada: String(borrador.provinciaLlegada ?? ubigeoLlegada.substring(2, 4)),
      distritoLlegada: String(borrador.distritoLlegada ?? ubigeoLlegada),
      transportistaId: String(borrador.transportistaId ?? ''),
      conductorId: String(borrador.conductorId ?? ''),
      vehiculoId: String(borrador.vehiculoId ?? ''),
      motivoTraslado,
      descripcionMotivoTraslado: borrador.descripcionMotivoTraslado ?? '',
      fechaEntregaBienes: borrador.fechaEntregaBienes ?? formatDate(new Date()),
      precinto: borrador.precinto ?? '',
      parihuelas: Number(borrador.parihuelas) || null,
      observacionesUsuario: borrador.observacionesUsuario ?? 'PRODUCTO EXAMINADO POR DETECTOR DE METALES-CONFORME',
      inspeccionTemperatura: borrador.inspeccionTemperatura != null ? String(borrador.inspeccionTemperatura) : '',
      numeroViaje: borrador.numeroViaje != null ? String(borrador.numeroViaje) : '',
      inspeccionLibreOlores: borrador.inspeccionLibreOlores ?? '',
      inspeccionLibreInsectos: borrador.inspeccionLibreInsectos ?? '',
      inspeccionLibreMateriasExtranas: borrador.inspeccionLibreMateriasExtranas ?? '',
      inspeccionUnidadLimpia: borrador.inspeccionUnidadLimpia ?? '',
      inspeccionObservaciones: borrador.inspeccionObservaciones ?? '',
      inspeccionMedidaCorrectiva: borrador.inspeccionMedidaCorrectiva ?? '',
    });
    this.aplicarEstablecimientosTrasladoSeleccionados();

    this.creando.set(false);
    this.submitAttempted.set(false);
    this.transactionIdCreacion = String(borrador.transactionId_uuid ?? '').trim() || null;

    const seleccionados = new Set<string>(
      (borrador.paletsSeleccionados ?? []).map((p: any) => String(p ?? '').trim()).filter(Boolean)
    );
    this.paletsSeleccionados.set(seleccionados);

    const procesoId = String(borrador.procesoId ?? '').trim();
    if (procesoId) {
      this.cargarPaletsPorProceso(procesoId, false);
    }
  }

  onBackdrop(): void {
    if (this.creando()) return;
    this.transactionIdCreacion = null;
    this.cerrar.emit();
  }

  onCerrar(): void {
    if (this.creando()) return;
    this.transactionIdCreacion = null;
    this.cerrar.emit();
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

  updateField(field: string, value: any): void {
    if (field === 'motivoTraslado') {
      const motivo = String(value ?? '').trim();
      const motivoActual = String(this.form().motivoTraslado ?? '').trim();
      if (motivo === motivoActual) return;

      this.limpiarCamposPorCambioMotivo(motivo);
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
      this.form.update(f => ({
        ...f,
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
    if (field === 'parihuelas') {
      const num = Number(value);
      if (!Number.isInteger(num) || num < 1 || num > 99) {
        this.form.update(f => ({ ...f, [field]: null }));
        return;
      }
    }
    if (field === 'inspeccionTemperatura') {
      const num = Number(value);
      if (isNaN(num)) {
        this.form.update(f => ({ ...f, [field]: '' }));
        return;
      }
    }
    if (field === 'numeroViaje') {
      const num = Number(value);
      if (!Number.isInteger(num) || num < 1) {
        this.form.update(f => ({ ...f, [field]: '' }));
        return;
      }
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
    if (field === 'procesoId') {
      this.cargarPaletsPorProceso(value);
    }
  }

  cargarPaletsPorProceso(procesoId: string, resetSeleccionados = true): void {
    if (resetSeleccionados) {
      this.paletsSeleccionados.set(new Set());
    }
    const id = String(procesoId ?? '').trim();
    if (!id) {
      this.palets.set([]);
      return;
    }
    const proceso = this.procesos.find(p => String((p as any)?.id ?? '').trim() === id || String((p as any)?.idProceso ?? '').trim() === id);
    const lista = (proceso as any)?.palets ?? [];
    this.palets.set(Array.isArray(lista) ? lista : []);
  }

  togglePaletSeleccionado(idPalet: string): void {
    const id = String(idPalet ?? '').trim();
    if (!id) return;
    this.paletsSeleccionados.update(prev => {
      const nuevo = new Set(prev);
      if (nuevo.has(id)) {
        nuevo.delete(id);
      } else {
        nuevo.add(id);
      }
      return nuevo;
    });
  }

  seleccionarTodos(): void {
    const todos = new Set<string>(this.palets().map(p => String(p.idPalet ?? '').trim()).filter(Boolean));
    this.paletsSeleccionados.set(todos);
  }

  deseleccionarTodos(): void {
    this.paletsSeleccionados.set(new Set());
  }

  readonly todosSeleccionados = computed(() => {
    const ids = new Set(this.palets().map(p => String(p.idPalet ?? '').trim()).filter(Boolean));
    if (ids.size === 0) return false;
    return this.paletsSeleccionados().size === ids.size;
  });

  isInvalid(field: string): boolean {
    if (!this.submitAttempted()) return false;
    if (field === 'destinatarioId' && this.esTrasladoEntreEstablecimientos()) return false;
    const v = (this.form() as any)[field];
    return v === null || v === undefined || String(v).trim() === '';
  }

  isFormValid(): boolean {
    const f = this.form();
    const parihuelasNum = Number(f.parihuelas);
    return !!(
      f.procesoId &&
      (this.esTrasladoEntreEstablecimientos() ? f.idEstablecimientoPartida?.trim() && this.establecimientoDestinoId() : f.destinatarioId) &&
      f.puntoPartida?.trim() &&
      f.puntoLlegada?.trim() &&
      f.idEstablecimientoPartida?.trim() &&
      (!this.esTrasladoEntreEstablecimientos() || f.idEstablecimientoLlegada?.trim()) &&
      (!this.esTrasladoEntreEstablecimientos() || this.establecimientosTrasladoDiferentes()) &&
      this.ubigeoPartidaValido() &&
      this.ubigeoLlegadaValido() &&
      f.transportistaId &&
      f.conductorId &&
      f.vehiculoId &&
      f.motivoTraslado?.trim() &&
      (!this.esMotivoOtros() || f.descripcionMotivoTraslado?.trim()) &&
      f.fechaEntregaBienes?.trim() &&
      f.precinto?.trim() &&
      this.nroPaletsSeleccionados() > 0 &&
      !isNaN(parihuelasNum) && parihuelasNum >= 1 && parihuelasNum <= 99
    );
  }

  isInvalidUbigeoPartida(): boolean {
    return this.submitAttempted() && !this.ubigeoPartidaValido();
  }

  isInvalidUbigeoLlegada(): boolean {
    return this.submitAttempted() && !this.ubigeoLlegadaValido();
  }

  isInvalidPalets(): boolean {
    return this.submitAttempted() && this.nroPaletsSeleccionados() === 0;
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

  isInvalidParihuelas(): boolean {
    if (!this.submitAttempted()) return false;
    const v = Number((this.form() as any).parihuelas);
    return isNaN(v) || v < 1 || v > 99;
  }

  isInvalidDescripcionMotivoTraslado(): boolean {
    if (!this.submitAttempted()) return false;
    if (!this.esMotivoOtros()) return false;
    const v = (this.form() as any).descripcionMotivoTraslado;
    return v === null || v === undefined || String(v).trim() === '';
  }

  onCrear(): void {
    if (this.creando()) return;

    this.submitAttempted.set(true);
    if (!this.isFormValid()) return;
    const paletsIds = Array.from(this.paletsSeleccionados());
    const paletsData = this.palets().filter(p => paletsIds.includes(String(p.idPalet ?? '').trim()));
    const f = this.form();
    const payload: any = {
      ...f,
      paletsSeleccionados: paletsIds,
      paletsDetalle: paletsData,
      inspeccionTemperatura: f.inspeccionTemperatura ? parseFloat(f.inspeccionTemperatura) : null,
      numeroViaje: f.numeroViaje ? parseInt(f.numeroViaje, 10) : null,
      inspeccionLibreOlores: f.inspeccionLibreOlores,
      inspeccionLibreInsectos: f.inspeccionLibreInsectos,
      inspeccionLibreMateriasExtranas: f.inspeccionLibreMateriasExtranas,
      inspeccionUnidadLimpia: f.inspeccionUnidadLimpia,
      inspeccionObservaciones: f.inspeccionObservaciones.trim() || undefined,
      inspeccionMedidaCorrectiva: f.inspeccionMedidaCorrectiva.trim() || undefined,
      descripcionMotivoTraslado: this.esMotivoOtros() ? f.descripcionMotivoTraslado.trim() || undefined : undefined,
    };
    if (this.modoEdicion) {
      this.editar.emit(payload);
    } else {
      this.creando.set(true);
      payload.transactionId_uuid = this.getOrCreateTransactionId();
      this.crear.emit(payload);
    }
  }

  private limpiarCamposPorCambioMotivo(motivo: string): void {
    const datosEmisor = this.getDatosEstablecimientoEmisor();
    const usarPartidaPorDefecto = motivo !== '04';
    this.establecimientoDestinoId.set('');
    this.submitAttempted.set(false);
    this.form.update(f => ({
      ...f,
      motivoTraslado: motivo,
      descripcionMotivoTraslado: motivo === '13' ? 'SERVICIO DE FRÍO' : '',
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
      parihuelas: null,
      observacionesUsuario: 'PRODUCTO EXAMINADO POR DETECTOR DE METALES-CONFORME',
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
}
