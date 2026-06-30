import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CatalogoColumna, CatalogoConfig } from '../../catalogos.type';

@Component({
  selector: 'app-catalogo-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './catalogo-modal.component.html',
  styleUrl: './catalogo-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogoModalComponent {
  private _config!: CatalogoConfig;
  private _value: any = null;

  @Input({ required: true })
  set config(v: CatalogoConfig) {
    this._config = v;
    this.initForm();
  }
  get config(): CatalogoConfig {
    return this._config;
  }

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

  readonly form = signal<Record<string, any>>({});
  readonly initialForm = signal<Record<string, any>>({});
  readonly submitAttempted = signal(false);

  readonly hasChanges = computed(() => {
    if (this.modo !== 'editar') return true;
    const current = this.form();
    const initial = this.initialForm();
    for (const c of this.columnasEditables()) {
      const a = initial?.[c.campo];
      const b = current?.[c.campo];
      if ((a ?? '') !== (b ?? '')) return true;
    }
    return false;
  });

  readonly columnasEditables = computed(() =>
    (this.config?.columnas ?? []).filter((c: CatalogoColumna) => {
      if (c.campo === 'Id') return false;
      if (c.auto) return false;
      if (c.editable === false) return false;
      return true;
    })
  );

  private readonly booleanBadgeFields = new Set<string>([
    'activo',
    'esEnsayo'
  ]);

  private initForm(): void {
    if (!this._config) return;
    this.submitAttempted.set(false);
    const base: Record<string, any> = {};
    for (const c of this.columnasEditables()) {
      const current = this.value?.[c.campo];
      if (typeof current !== 'undefined') {
        base[c.campo] = current;
      } else if (typeof c.default !== 'undefined') {
        base[c.campo] = c.default;
      } else if (this.modo === 'nuevo' && c.tipo === 'bit' && c.campo === 'activo') {
        base[c.campo] = true;
      }
      else base[c.campo] = '';
    }
    this.form.set(base);
    this.initialForm.set({ ...base });
  }

  private isEmptyRequiredValue(value: unknown, col: CatalogoColumna): boolean {
    if (col.tipo === 'bit') return value === null || value === undefined || value === '';
    if (typeof value === 'string') return value.trim().length === 0;
    return value === null || value === undefined || value === '';
  }

  private missingRequiredFields(): CatalogoColumna[] {
    const f = this.form();
    return this.columnasEditables().filter(col => {
      if (!col.required) return false;
      const v = f?.[col.campo];
      return this.isEmptyRequiredValue(v, col);
    });
  }

  isInvalid(col: CatalogoColumna): boolean {
    if (!this.submitAttempted()) return false;
    if (!col.required) return false;
    return this.isEmptyRequiredValue(this.form()?.[col.campo], col);
  }

  isFormValid(): boolean {
    return this.missingRequiredFields().length === 0;
  }

  isBooleanBadgeColumn(col: CatalogoColumna): boolean {
    return col.tipo === 'bit' && this.booleanBadgeFields.has(col.campo);
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

  getTitle(): string {
    const base = this.modo === 'editar' ? `Editar ${this.config?.label ?? ''}` : `Nuevo ${this.config?.label ?? ''}`;
    const apellidos = String(this.value?.['apellidos'] ?? '').trim();
    const nombres = String(this.value?.['nombres'] ?? '').trim();
    if (apellidos || nombres) {
      return `${base}: ${[apellidos, nombres].filter(v => v).join(' ')}`;
    }
    return base;
  }
}
