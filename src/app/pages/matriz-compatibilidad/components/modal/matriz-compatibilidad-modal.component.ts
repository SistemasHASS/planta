import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdvancedSelectComponent } from '../../../../shared/components/advanced-select/advanced-select.component';
import { MatrizCompatibilidad } from '../../../../shared/interfaces/administracion.interface';

type MatrizCompatibilidadForm = {
  clienteId: number | null;
  consignatarioId: number | null;
  destinoId: number | null;
  formatoId: number | null;
  calibreId: number | null;
  tipoEmpaqueId: number | null;
  tipoEmpaqueGuiaId: number | null;
  tipoCajaId: number | null;
  tipoClamshellId: number | null;
  presentacionId: number | null;
  categoriaId: number | null;
  activo: boolean;
};

@Component({
  selector: 'app-matriz-compatibilidad-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, AdvancedSelectComponent],
  templateUrl: './matriz-compatibilidad-modal.component.html',
  styleUrl: './matriz-compatibilidad-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MatrizCompatibilidadModalComponent {
  @Input() modo: 'nuevo' | 'editado' = 'nuevo';
  @Input() value: MatrizCompatibilidad | null = null;

  @Output() cerrar = new EventEmitter<void>();
  @Output() guardar = new EventEmitter<any>();

  readonly submitAttempted = signal(false);
  private readonly initialForm = signal<MatrizCompatibilidadForm | null>(null);
  readonly form = signal<MatrizCompatibilidadForm>({
    clienteId: null,
    consignatarioId: null,
    destinoId: null,
    formatoId: null,
    calibreId: null,
    tipoEmpaqueId: null,
    tipoEmpaqueGuiaId: null,
    tipoCajaId: null,
    tipoClamshellId: null,
    presentacionId: null,
    categoriaId: null,
    activo: true,
  });

  readonly title = computed(() => (this.modo === 'editado' ? 'Editar Combinación' : 'Nueva Combinación'));

  readonly hasChanges = computed(() => {
    if (this.modo !== 'editado') return true;
    const base = this.initialForm();
    if (!base) return false;
    const f = this.form();
    return (
      base.clienteId !== f.clienteId ||
      base.consignatarioId !== f.consignatarioId ||
      base.destinoId !== f.destinoId ||
      base.formatoId !== f.formatoId ||
      base.calibreId !== f.calibreId ||
      base.tipoEmpaqueId !== f.tipoEmpaqueId ||
      base.tipoEmpaqueGuiaId !== f.tipoEmpaqueGuiaId ||
      base.tipoCajaId !== f.tipoCajaId ||
      base.tipoClamshellId !== f.tipoClamshellId ||
      base.presentacionId !== f.presentacionId ||
      base.categoriaId !== f.categoriaId ||
      base.activo !== f.activo
    );
  });

  readonly canSave = computed(() => {
    const valid = this.isFormValid();
    if (!valid) return false;
    return this.modo === 'nuevo' ? true : this.hasChanges();
  });

  ngOnChanges(): void {
    const v = this.value ?? ({} as any);
    const next: MatrizCompatibilidadForm = {
      clienteId: v.clienteId ?? null,
      consignatarioId: v.consignatarioId ?? null,
      destinoId: v.destinoId ?? null,
      formatoId: v.formatoId ?? null,
      calibreId: v.calibreId ?? null,
      tipoEmpaqueId: v.tipoEmpaqueId ?? null,
      tipoEmpaqueGuiaId: v.tipoEmpaqueGuiaId ?? null,
      tipoCajaId: v.tipoCajaId ?? null,
      tipoClamshellId: v.tipoClamshellId ?? null,
      presentacionId: v.presentacionId ?? null,
      categoriaId: v.categoriaId ?? null,
      activo: typeof v.activo === 'boolean' ? v.activo : true,
    };
    this.form.set(next);
    this.initialForm.set(structuredClone(next));
    this.submitAttempted.set(false);
  }

  onBackdrop(): void {
    this.cerrar.emit();
  }

  onCerrar(): void {
    this.cerrar.emit();
  }

  private isEmpty(v: any): boolean {
    return v === null || v === undefined || v === '';
  }

  isFormValid(): boolean {
    const f = this.form();
    return !(
      this.isEmpty(f?.clienteId) ||
      this.isEmpty(f?.consignatarioId) ||
      this.isEmpty(f?.destinoId) ||
      this.isEmpty(f?.formatoId) ||
      this.isEmpty(f?.calibreId) ||
      this.isEmpty(f?.tipoEmpaqueId) ||
      this.isEmpty(f?.tipoEmpaqueGuiaId) ||
      this.isEmpty(f?.tipoCajaId) ||
      this.isEmpty(f?.tipoClamshellId)
    );
  }

  isInvalid(field: string): boolean {
    if (!this.submitAttempted()) return false;
    return this.isEmpty((this.form() as any)?.[field]);
  }

  onGuardar(): void {
    this.submitAttempted.set(true);
    if (!this.isFormValid()) return;
    if (this.modo === 'editado' && !this.hasChanges()) return;
    this.guardar.emit({ payload: { ...(this.value ?? {}), ...this.form() }, modo: this.modo, _pk: (this.value as any)?._pk });
  }

  updateField(field: string, value: any): void {
    this.form.update(f => ({ ...f, [field]: value }));
  }

}
