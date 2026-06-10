import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdvancedSelectComponent } from '../../../../shared/components/advanced-select/advanced-select.component';

const COLUMNAS_EDITABLES = [
  { campo: 'codigo', label: 'Código', tipo: 'nvarchar', maxLength: 50, required: true, unique: true },
  { campo: 'descripcion', label: 'Descripción', tipo: 'nvarchar', maxLength: 100, required: false },
  { campo: 'codigoCategoria', label: 'Categoría', tipo: 'select', required: true },
  { campo: 'activo', label: 'Estado', tipo: 'bit', required: true },
];

@Component({
  selector: 'app-catalogo-tipos-empaque-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, AdvancedSelectComponent],
  templateUrl: './catalogo-tipos-empaque-modal.component.html',
  styleUrl: './catalogo-tipos-empaque-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogoTiposEmpaqueModalComponent {
  private _value: any = null;

  @Input() modo: 'nuevo' | 'editar' = 'nuevo';
  @Input() categorias: any[] = [];

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
      } else if (c.campo === 'activo') {
        base[c.campo] = true;
      } else {
        base[c.campo] = '';
      }
    }
    // asegurar nombreCategoria y nombreCalibre desde value o categorias
    base['nombreCategoria'] = this.value?.['nombreCategoria'] ?? '';
    base['nombreCalibre'] = this.value?.['nombreCalibre'] ?? '';
    const ccat = base['codigoCategoria'] ?? this.value?.['codigoCategoria'] ?? '';
    if (ccat) {
      const cat = this.categorias.find((c: any) => String(c?.codigo ?? '') === String(ccat));
      if (!base['nombreCategoria']) base['nombreCategoria'] = cat?.nombre ?? '';
      if (!base['nombreCalibre']) base['nombreCalibre'] = cat?.calibreNombre ?? '';
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
    return COLUMNAS_EDITABLES.filter(col => {
      if (!col.required) return false;
      const v = f?.[col.campo];
      return this.isEmptyRequiredValue(v, col);
    });
  }

  isInvalid(col: any): boolean {
    if (!this.submitAttempted()) return false;
    if (!col.required) return false;
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
    // asegurar nombreCategoria y nombreCalibre segun codigoCategoria seleccionado
    const ccat = merged['codigoCategoria'];
    if (ccat) {
      const cat = this.categorias.find((c: any) => String(c?.codigo ?? '') === String(ccat));
      merged['nombreCategoria'] = cat?.nombre ?? '';
      merged['nombreCalibre'] = cat?.calibreNombre ?? '';
    } else {
      merged['nombreCategoria'] = '';
      merged['nombreCalibre'] = '';
    }
    this.guardar.emit({ payload: merged, modo: this.modo, _pk: (this.value as any)?._pk });
  }

  onCategoriaChange(id: string | number | null): void {
    const sid = String(id ?? '');
    const cat = this.categorias.find((c: any) => String(c?.codigo ?? '') === sid);
    this.form.update(f => ({
      ...f,
      codigoCategoria: sid,
      nombreCategoria: cat?.nombre ?? '',
      nombreCalibre: cat?.calibreNombre ?? ''
    }));
  }

  updateField(field: string, value: any): void {
    this.form.update(f => ({ ...f, [field]: value }));
  }

  getTitle(): string {
    return this.modo === 'editar' ? 'Editar Tipo de Empaque' : 'Nuevo Tipo de Empaque';
  }
}
