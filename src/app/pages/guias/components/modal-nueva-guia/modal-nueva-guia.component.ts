import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, signal, computed } from '@angular/core';
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
export class ModalNuevaGuiaComponent {
  @Input() procesos: Proceso[] = [];
  @Input() transportistas: any[] = [];
  @Input() conductores: any[] = [];
  @Input() vehiculos: any[] = [];
  @Input() destinatarios: any[] = [];

  readonly destinatariosActivos = computed(() => {
    const list = this.destinatarios ?? [];
    return list.filter((d: any) => {
      const a = d?.activo;
      return a === true || a === 1 || (typeof a === 'string' && (a === '1' || a.toLowerCase() === 'true'));
    });
  });

  @Output() cerrar = new EventEmitter<void>();
  @Output() crear = new EventEmitter<any>();

  readonly submitAttempted = signal(false);
  readonly palets = signal<Palet[]>([]);
  readonly paletsSeleccionados = signal<Set<string>>(new Set());

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
    parihuelas: 0,
    observacionesUsuario: '',
  });

  readonly tienePalets = computed(() => this.palets().length > 0);
  readonly nroPaletsSeleccionados = computed(() => this.paletsSeleccionados().size);

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
    this.form.update(f => ({ ...f, [field]: value }));
    if (field === 'procesoId') {
      this.cargarPaletsPorProceso(value);
    }
  }

  cargarPaletsPorProceso(procesoId: string): void {
    this.paletsSeleccionados.set(new Set());
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
      !isNaN(parihuelasNum) && parihuelasNum >= 0 && parihuelasNum <= 99
    );
  }

  isInvalidPalets(): boolean {
    return this.submitAttempted() && this.nroPaletsSeleccionados() === 0;
  }

  isInvalidParihuelas(): boolean {
    if (!this.submitAttempted()) return false;
    const v = Number((this.form() as any).parihuelas);
    return isNaN(v) || v < 0 || v > 99;
  }

  onCrear(): void {
    this.submitAttempted.set(true);
    if (!this.isFormValid()) return;
    const paletsIds = Array.from(this.paletsSeleccionados());
    const paletsData = this.palets().filter(p => paletsIds.includes(String(p.idPalet ?? '').trim()));
    this.crear.emit({
      ...this.form(),
      paletsSeleccionados: paletsIds,
      paletsDetalle: paletsData,
    });
  }
}
