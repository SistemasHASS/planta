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

  readonly columnasEditables = computed(() =>
    (this.config?.columnas ?? []).filter((c: CatalogoColumna) => {
      console.log(c)
      if (c.campo === 'Id') return false;
      if (c.auto) return false;
      if (c.editable === false) return false;
      return true;
    })
  );

  private readonly booleanBadgeFields = new Set<string>([
    'Activo',
    'EsEnsayo'
  ]);

  private initForm(): void {
    if (!this._config) return;
    const base: Record<string, any> = {};
    for (const c of this.columnasEditables()) {
      const current = this.value?.[c.campo];
      if (typeof current !== 'undefined') base[c.campo] = current;
      else if (typeof c.default !== 'undefined') base[c.campo] = c.default;
      else if (c.tipo === 'bit' && c.campo === 'Activo') base[c.campo] = 1;
      else base[c.campo] = '';
    }
    this.form.set(base);
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
    this.guardar.emit(this.form());
  }

  updateField(field: string, value: any): void {
    this.form.update(f => ({ ...f, [field]: value }));
  }

  getTitle(): string {
    return this.modo === 'editar' ? `Editar ${this.config?.label ?? ''}` : `Nuevo ${this.config?.label ?? ''}`;
  }
}
