import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

const COLUMNAS_EDITABLES = [
  { campo: 'codigo', label: 'Código', tipo: 'varchar', maxLength: 100, required: true, unique: true, readonlyEnEditar: true, soloEditar: true },
  { campo: 'cultivo', label: 'Cultivo', tipo: 'varchar', maxLength: 50, required: true, readonlyEnEditar: true, soloEditar: true },
  { campo: 'idvariedad', label: 'Id Variedad', tipo: 'varchar', maxLength: 100, required: true, readonlyEnEditar: true, soloEditar: true },
  { campo: 'variedad', label: 'Variedad', tipo: 'varchar', maxLength: 100, required: true },
  { campo: 'procedencia', label: 'Procedencia', tipo: 'varchar', maxLength: 100, required: false },
  { campo: 'esEnsayo', label: 'Es Ensayo', tipo: 'bit', default: true, readonlyEnEditar: true, disabledEnNuevo: true },
];

@Component({
  selector: 'app-catalogo-variedades-maestro-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './catalogo-variedades-maestro-modal.component.html',
  styleUrl: './catalogo-variedades-maestro-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogoVariedadesMaestroModalComponent {
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

  get columnasActivas() {
    return COLUMNAS_EDITABLES.filter(c => this.modo === 'editar' || !c.soloEditar);
  }

  readonly form = signal<Record<string, any>>({});
  readonly initialForm = signal<Record<string, any>>({});
  readonly submitAttempted = signal(false);

  readonly hasChanges = computed(() => {
    if (this.modo !== 'editar') return true;
    const current = this.form();
    const initial = this.initialForm();
    for (const c of this.columnasActivas) {
      const a = initial?.[c.campo];
      const b = current?.[c.campo];
      if ((a ?? '') !== (b ?? '')) return true;
    }
    return false;
  });

  private initForm(): void {
    this.submitAttempted.set(false);
    const base: Record<string, any> = {};
    for (const c of this.columnasActivas) {
      const current = this.value?.[c.campo];
      if (typeof current !== 'undefined') {
        base[c.campo] = current;
      } else if (typeof c.default !== 'undefined') {
        base[c.campo] = c.default;
      } else {
        base[c.campo] = '';
      }
    }
    this.form.set(base);
    this.initialForm.set({ ...base });
  }

  private isEmptyRequiredValue(value: unknown, col: any): boolean {
    if (col.tipo === 'bit') return value === null || value === undefined || value === '';
    if (typeof value === 'string') return value.trim().length === 0;
    return value === null || value === undefined || value === '';
  }

  private missingRequiredFields(): any[] {
    const f = this.form();
    return this.columnasActivas.filter(col => {
      if (!col.required) return false;
      if (this.modo === 'editar' && col.readonlyEnEditar) return false;
      const v = f?.[col.campo];
      return this.isEmptyRequiredValue(v, col);
    });
  }

  isInvalid(col: any): boolean {
    if (!this.submitAttempted()) return false;
    if (!col.required) return false;
    if (this.modo === 'editar' && col.readonlyEnEditar) return false;
    return this.isEmptyRequiredValue(this.form()?.[col.campo], col);
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
    this.form.update(f => ({ ...f, [field]: value }));
  }

  isCampoReadonly(col: any): boolean {
    if (this.modo !== 'editar') return false;
    if (col.readonlyEnEditar) return true;
    if (col.campo === 'variedad') {
      return this.value?.esEnsayo !== true;
    }
    return false;
  }

  getTitle(): string {
    return this.modo === 'editar' ? 'Editar Variedad' : 'Nueva Variedad de Ensayo';
  }
}
