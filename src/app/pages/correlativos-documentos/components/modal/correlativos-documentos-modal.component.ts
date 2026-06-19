import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

const COLUMNAS_EDITABLES = [
  { campo: 'serie', label: 'Serie', tipo: 'nvarchar', maxLength: 4, required: true },
  { campo: 'numero', label: 'Número', tipo: 'nvarchar', maxLength: 10, required: true },
  { campo: 'eliminado', label: 'Inactivo', tipo: 'bit', required: false },
];

@Component({
  selector: 'app-correlativos-documentos-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './correlativos-documentos-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CorrelativosDocumentosModalComponent {
  private _value: any = null;

  @Input() modo: 'nuevo' | 'editar' = 'nuevo';

  @Input()
  set value(v: any) {
    this._value = v;
    this.initForm();
  }
  get value(): any {
    return this._value;
  }

  @Output() cerrar = new EventEmitter<void>();
  @Output() guardar = new EventEmitter<any>();

  readonly columnasEditables = COLUMNAS_EDITABLES;
  readonly form = signal<Record<string, any>>({});
  readonly initialForm = signal<Record<string, any>>({});
  readonly submitAttempted = signal(false);

  readonly hasChanges = computed(() => {
    if (this.modo !== 'editar') return true;
    const current = this.form();
    const initial = this.initialForm();
    for (const c of COLUMNAS_EDITABLES) {
      const a = initial?.[c.campo];
      const b = current?.[c.campo];
      if ((a ?? '') !== (b ?? '')) return true;
    }
    return false;
  });

  private initForm(): void {
    this.submitAttempted.set(false);
    const base: Record<string, any> = {};
    for (const c of COLUMNAS_EDITABLES) {
      const current = this.value?.[c.campo];
      if (typeof current !== 'undefined') {
        base[c.campo] = current;
      } else if (c.campo === 'eliminado') {
        base[c.campo] = false;
      } else {
        base[c.campo] = '';
      }
    }
    this.form.set(base);
    this.initialForm.set({ ...base });
  }

  private isEmptyRequiredValue(value: unknown, col: any): boolean {
    if (col.tipo === 'bit') return false;
    if (typeof value === 'string') return value.trim().length === 0;
    return value === null || value === undefined || value === '';
  }

  private missingRequiredFields(): any[] {
    const f = this.form();
    return COLUMNAS_EDITABLES.filter(col => {
      if (!col.required) return false;
      const v = f?.[col.campo];
      return this.isEmptyRequiredValue(v, col);
    });
  }

  isInvalid(fieldName: string): boolean {
    if (!this.submitAttempted()) return false;
    const col = COLUMNAS_EDITABLES.find(c => c.campo === fieldName);
    if (!col || !col.required) return false;
    return this.isEmptyRequiredValue(this.form()?.[fieldName], col);
  }

  isFormValid(): boolean {
    return this.missingRequiredFields().length === 0;
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
    if (this.modo === 'editar' && !this.hasChanges()) return;
    const merged = { ...(this.value ?? {}), ...this.form() };
    this.guardar.emit({ payload: merged, modo: this.modo, _pk: (this.value as any)?._pk });
  }

  updateField(field: string, value: any): void {
    if (field === 'numero' && value !== null && value !== undefined && String(value).trim() !== '') {
      const padded = String(value).trim().padStart(8, '0');
      this.form.update(f => ({ ...f, [field]: padded }));
    } else {
      this.form.update(f => ({ ...f, [field]: value }));
    }
  }

  getTitle(): string {
    return this.modo === 'editar' ? 'Editar Serie' : 'Nueva Serie';
  }
}
