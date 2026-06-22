import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output, signal, computed, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Proceso } from '../../../../shared/interfaces/proceso.interface';
import { Palet } from '../../../../shared/interfaces/palet.interface';
import { AdvancedSelectComponent } from '../../../../shared/components/advanced-select/advanced-select.component';

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
  @Input() modoEdicion = false;
  @Input() guiaEditando: any = null;

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
  readonly palets = signal<Palet[]>([]);
  readonly paletsSeleccionados = signal<Set<string>>(new Set());

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
      String(init['transportistaId'] ?? '') !== String(curr.transportistaId ?? '') ||
      String(init['conductorId'] ?? '') !== String(curr.conductorId ?? '') ||
      String(init['vehiculoId'] ?? '') !== String(curr.vehiculoId ?? '') ||
      String(init['motivoTraslado'] ?? '') !== String(curr.motivoTraslado ?? '') ||
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
      String(init['inspeccionMedidaCorrectiva'] ?? '') !== String(curr.inspeccionMedidaCorrectiva ?? '');
    const initIds = Array.from(this.initialPaletsSeleccionados()).sort();
    const currIds = Array.from(this.paletsSeleccionados()).sort();
    const paletsChanged = initIds.length !== currIds.length || initIds.some((v, i) => v !== currIds[i]);
    return formChanged || paletsChanged;
  });

  readonly form = signal({
    procesoId: '',
    destinatarioId: '',
    puntoPartida: 'CARRETERA PANAMERICANA NORTE KM. 492.5',
    puntoLlegada: '',
    transportistaId: '',
    conductorId: '',
    vehiculoId: '',
    motivoTraslado: 'OTROS',
    precinto: '',
    parihuelas: null as number | null,
    observacionesUsuario: '',
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

  private boolToSiNo(val: boolean | null | undefined): 'si' | 'no' | '' {
    if (val === true) return 'si';
    if (val === false) return 'no';
    return '';
  }

  readonly tienePalets = computed(() => this.palets().length > 0);
  readonly nroPaletsSeleccionados = computed(() => this.paletsSeleccionados().size);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['guiaEditando'] && this.modoEdicion && this.guiaEditando) {
      const g = this.guiaEditando;
      this.form.set({
        procesoId: String(g.procesoId ?? ''),
        destinatarioId: String(g.destinatarioId ?? ''),
        puntoPartida: g.puntoPartida ?? 'CARRETERA PANAMERICANA NORTE KM. 492.5',
        puntoLlegada: g.puntoLlegada ?? '',
        transportistaId: String(g.transportistaId ?? ''),
        conductorId: String(g.conductorId ?? ''),
        vehiculoId: String(g.vehiculoId ?? ''),
        motivoTraslado: g.motivoTraslado ?? 'OTROS',
        precinto: g.precinto ?? '',
        parihuelas: Number(g.parihuelas) || 0,
        observacionesUsuario: g.observacionesUsuario ?? '',
        inspeccionTemperatura: g.inspeccionTemperatura != null ? String(g.inspeccionTemperatura) : '',
        numeroViaje: g.numeroViaje != null ? String(g.numeroViaje) : '',
        inspeccionLibreOlores: this.boolToSiNo(g.inspeccionLibreOlores),
        inspeccionLibreInsectos: this.boolToSiNo(g.inspeccionLibreInsectos),
        inspeccionLibreMateriasExtranas: this.boolToSiNo(g.inspeccionLibreMateriasExtranas),
        inspeccionUnidadLimpia: this.boolToSiNo(g.inspeccionUnidadLimpia),
        inspeccionObservaciones: g.inspeccionObservaciones ?? '',
        inspeccionMedidaCorrectiva: g.inspeccionMedidaCorrectiva ?? '',
      });
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
  }

  onBackdrop(): void {
    this.cerrar.emit();
  }

  onCerrar(): void {
    this.cerrar.emit();
  }

  updateField(field: string, value: any): void {
    if (field === 'destinatarioId') {
      const id = String(value ?? '').trim();
      const dest = this.destinatariosActivos().find((d: any) => String(d?.id ?? '').trim() === id);
      const puntoLlegada = dest?.puntoLlegada ?? dest?.domicilioFiscal ?? '';
      this.form.update(f => ({ ...f, destinatarioId: value, puntoLlegada }));
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
    const v = (this.form() as any)[field];
    return v === null || v === undefined || String(v).trim() === '';
  }

  isFormValid(): boolean {
    const f = this.form();
    const parihuelasNum = Number(f.parihuelas);
    return !!(
      f.procesoId &&
      f.destinatarioId &&
      f.puntoPartida?.trim() &&
      f.puntoLlegada?.trim() &&
      f.transportistaId &&
      f.conductorId &&
      f.vehiculoId &&
      f.motivoTraslado?.trim() &&
      f.precinto?.trim() &&
      this.nroPaletsSeleccionados() > 0 &&
      !isNaN(parihuelasNum) && parihuelasNum >= 1 && parihuelasNum <= 99
    );
  }

  isInvalidPalets(): boolean {
    return this.submitAttempted() && this.nroPaletsSeleccionados() === 0;
  }

  isInvalidParihuelas(): boolean {
    if (!this.submitAttempted()) return false;
    const v = Number((this.form() as any).parihuelas);
    return isNaN(v) || v < 1 || v > 99;
  }

  onCrear(): void {
    this.submitAttempted.set(true);
    if (!this.isFormValid()) return;
    const paletsIds = Array.from(this.paletsSeleccionados());
    const paletsData = this.palets().filter(p => paletsIds.includes(String(p.idPalet ?? '').trim()));
    const f = this.form();
    const payload = {
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
    };
    if (this.modoEdicion) {
      this.editar.emit(payload);
    } else {
      this.crear.emit(payload);
    }
  }
}
