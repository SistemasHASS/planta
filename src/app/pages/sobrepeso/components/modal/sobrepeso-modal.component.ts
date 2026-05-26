import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdvancedSelectComponent } from '../../../../shared/components/advanced-select/advanced-select.component';

import { ReglaSobrePeso } from '../../../../shared/interfaces/administracion.interface';
import { Consignatario, Destino, Formato, Transporte } from '../../../../shared/interfaces/catalogo.interface';
import { formatDate } from '../../../../shared/utils/datetime.utils';

type Form = {
  id?: number;
  documentoConsignatario: string | null;
  formatoId: number | null;
  destinoId: string | null;
  transporteId: string | null;
  porcentaje: number | null;
  descripcion: string;
  vigenciaDesde: string;
  vigenciaHasta: string;
  activo: boolean;
};

type Row = ReglaSobrePeso & { _pk?: any };

@Component({
  selector: 'app-sobrepeso-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, AdvancedSelectComponent],
  templateUrl: './sobrepeso-modal.component.html',
  styleUrl: './sobrepeso-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SobrepesoModalComponent {
  @Input() modo: 'nuevo' | 'editado' = 'nuevo';
  @Input() value: Row | null = null;

  @Input() consignatarios: Consignatario[] = [];
  @Input() formatos: Formato[] = [];
  @Input() destinos: Destino[] = [];
  @Input() transportes: Transporte[] = [];

  @Output() cerrar = new EventEmitter<void>();
  @Output() guardar = new EventEmitter<any>();

  readonly submitAttempted = signal(false);
  private readonly initialForm = signal<Form | null>(null);

  readonly form = signal<Form>({
    documentoConsignatario: null,
    formatoId: null,
    destinoId: null,
    transporteId: null,
    porcentaje: null,
    descripcion: '',
    vigenciaDesde: '',
    vigenciaHasta: '',
    activo: true,
  });

  readonly title = computed(() => (this.modo === 'editado' ? 'Editar Regla de Sobrepeso' : 'Nueva Regla de Sobrepeso'));

  readonly hasChanges = computed(() => {
    if (this.modo !== 'editado') return true;
    const base = this.initialForm();
    if (!base) return false;
    const f = this.form();
    return (
      (base.documentoConsignatario ?? null) !== (f.documentoConsignatario ?? null) ||
      (base.formatoId ?? null) !== (f.formatoId ?? null) ||
      (base.destinoId ?? null) !== (f.destinoId ?? null) ||
      (base.transporteId ?? null) !== (f.transporteId ?? null) ||
      (base.porcentaje ?? null) !== (f.porcentaje ?? null) ||
      base.descripcion !== f.descripcion ||
      base.vigenciaDesde !== f.vigenciaDesde ||
      base.vigenciaHasta !== f.vigenciaHasta ||
      base.activo !== f.activo
    );
  });

  readonly canSave = computed(() => {
    const valid = this.isFormValid();
    if (!valid) return false;
    return this.modo === 'nuevo' ? true : this.hasChanges();
  });

  private normalizeDateForInput(value: unknown): string {
    if (value === null || value === undefined || value === '') return '';
    if (typeof value === 'string') {
      const s = value.trim();
      if (!s) return '';
      const m = /^\d{4}-\d{2}-\d{2}/.exec(s);
      if (m) return m[0];
    }
    return formatDate(value) ?? '';
  }

  private parseDateInput(value: unknown): Date | null {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value !== 'string') return null;
    const s = value.trim();
    if (!s) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    const d = new Date(`${s}T00:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  private hasInvalidDateRange(): boolean {
    const f = this.form();
    const d = this.isEmpty(f.vigenciaDesde) ? null : this.parseDateInput(f.vigenciaDesde);
    const h = this.isEmpty(f.vigenciaHasta) ? null : this.parseDateInput(f.vigenciaHasta);

    if (!this.isEmpty(f.vigenciaDesde) && !d) return true;
    if (!this.isEmpty(f.vigenciaHasta) && !h) return true;
    if (d && h && h.getTime() < d.getTime()) return true;
    return false;
  }

  ngOnChanges(): void {
    const v: any = this.value ?? {};
    const next: Form = {
      id: v.id,
      documentoConsignatario: v.documentoConsignatario ?? null,
      formatoId: typeof v.formatoId === 'number' ? v.formatoId : null,
      destinoId: v.destinoId ?? null,
      transporteId: v.transporteId ?? null,
      porcentaje: v.porcentaje === null || v.porcentaje === undefined ? null : Number(v.porcentaje),
      descripcion: v.descripcion ?? '',
      vigenciaDesde: this.normalizeDateForInput(v.vigenciaDesde),
      vigenciaHasta: this.normalizeDateForInput(v.vigenciaHasta),
      activo: typeof v.activo === 'boolean' ? v.activo : true,
    };

    this.form.set(next);
    this.initialForm.set(structuredClone(next));
    this.submitAttempted.set(false);
  }

  private isEmpty(v: any): boolean {
    return v === null || v === undefined || v === '';
  }

  isFormValid(): boolean {
    const f = this.form();
    if (this.isEmpty(f.documentoConsignatario) || this.isEmpty(f.formatoId) || this.isEmpty(f.destinoId) || this.isEmpty(f.transporteId)) return false;
    if (f.porcentaje === null || f.porcentaje === undefined || !Number.isFinite(Number(f.porcentaje))) return false;
    if (this.hasInvalidDateRange()) return false;
    return true;
  }

  isInvalid(field: keyof Form): boolean {
    if (!this.submitAttempted()) return false;
    const f: any = this.form();
    if (field === 'porcentaje') return f[field] === null || f[field] === undefined || !Number.isFinite(Number(f[field]));
    if (field === 'documentoConsignatario' || field === 'formatoId' || field === 'destinoId' || field === 'transporteId') return this.isEmpty(f[field]);
    if (field === 'vigenciaDesde' || field === 'vigenciaHasta') return this.hasInvalidDateRange();
    return false;
  }

  updateField(field: keyof Form, value: any): void {
    this.form.update(f => ({ ...f, [field]: value }));
  }

  onPorcentajeChange(value: any): void {
    if (value === '' || value === null || value === undefined) {
      this.updateField('porcentaje', null);
      return;
    }
    const n = typeof value === 'number' ? value : parseFloat(String(value));
    this.updateField('porcentaje', Number.isFinite(n) ? n : null);
  }

  onBackdrop(): void {
    this.cerrar.emit();
  }

  onCerrar(): void {
    this.cerrar.emit();
  }

  onGuardar(): void {
    this.submitAttempted.set(true);
    if (!this.isFormValid()) return;
    if (this.modo === 'editado' && !this.hasChanges()) return;

    const f = this.form();
    const payload: any = {
      ...(this.value ?? {}),
      id: f.id ?? (this.value as any)?.id,
      documentoConsignatario: f.documentoConsignatario,
      formatoId: f.formatoId,
      destinoId: f.destinoId,
      transporteId: f.transporteId,
      porcentaje: Number(f.porcentaje),
      descripcion: this.isEmpty(f.descripcion) ? null : f.descripcion,
      vigenciaDesde: this.isEmpty(f.vigenciaDesde) ? null : f.vigenciaDesde,
      vigenciaHasta: this.isEmpty(f.vigenciaHasta) ? null : f.vigenciaHasta,
      activo: !!f.activo,
    };

    this.guardar.emit({ payload, modo: this.modo, _pk: (this.value as any)?._pk });
  }
}
