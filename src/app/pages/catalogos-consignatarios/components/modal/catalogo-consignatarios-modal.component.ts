import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, computed, signal, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CatalogosRepository } from '../../../../shared/dexiedb/repository/catalogos.repository';

const COLUMNAS_EDITABLES = [
  { campo: 'documento', label: 'Documento', tipo: 'nvarchar', maxLength: 50, unique: true, editable: false },
  { campo: 'nombre', label: 'Razón Social', tipo: 'nvarchar', maxLength: 200, editable: false },
  { campo: 'codigoGrupoCliente', label: 'Grupo Cliente', tipo: 'nvarchar', maxLength: 200, required: false, editable: true },
];

@Component({
  selector: 'app-catalogo-consignatarios-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './catalogo-consignatarios-modal.component.html',
  styleUrl: './catalogo-consignatarios-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogoConsignatariosModalComponent implements OnInit {
  private _value: any = null;
  private readonly catalogosRepo = inject(CatalogosRepository);

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
  readonly clientes = signal<any[]>([]);
  readonly codigosRancho = signal<any[]>([]);
  readonly selectedCodigoRanchoIds = signal<Set<number>>(new Set());
  readonly initialSelectedCodigoRanchoIds = signal<Set<number>>(new Set());

  readonly form = signal<Record<string, any>>({});
  readonly initialForm = signal<Record<string, any>>({});
  readonly submitAttempted = signal(false);

  async ngOnInit(): Promise<void> {
    const listaClientes = await this.catalogosRepo.clientesRepo.getAll();
    const clientesActivos = listaClientes.filter((c: any) => c.activo === true || c.activo === 1);
    this.clientes.set(clientesActivos);

    const listaRancho = await this.catalogosRepo.codigosRanchoRepo.getAll();
    const ranchosActivos = listaRancho.filter((r: any) => r.activo === true || r.activo === 1);
    this.codigosRancho.set(ranchosActivos);
  }

  readonly hasChanges = computed(() => {
    if (this.modo !== 'editar') return true;
    const current = this.form();
    const initial = this.initialForm();
    for (const c of COLUMNAS_EDITABLES) {
      const a = initial?.[c.campo];
      const b = current?.[c.campo];
      if ((a ?? '') !== (b ?? '')) return true;
    }
    const currentIds = Array.from(this.selectedCodigoRanchoIds()).sort((x, y) => x - y);
    const initialIds = Array.from(this.initialSelectedCodigoRanchoIds()).sort((x, y) => x - y);
    if (currentIds.length !== initialIds.length) return true;
    for (let i = 0; i < currentIds.length; i++) {
      if (currentIds[i] !== initialIds[i]) return true;
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
    this.form.set(base);
    this.initialForm.set({ ...base });

    const asignadosActivos = (this.value?.codigosRancho ?? [])
      .filter((r: any) => r.activo === true || r.activo === 1)
      .map((r: any) => Number(r.id));
    const setActivos = new Set<number>(asignadosActivos);
    this.selectedCodigoRanchoIds.set(new Set(setActivos));
    this.initialSelectedCodigoRanchoIds.set(new Set(setActivos));
  }

  toggleCodigoRancho(id: number): void {
    this.selectedCodigoRanchoIds.update(s => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  isCodigoRanchoSelected(id: number): boolean {
    return this.selectedCodigoRanchoIds().has(id);
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
    const previos = (this.value?.codigosRancho ?? []) as any[];
    const prevIds = new Set(previos.map((r: any) => Number(r.id)));

    const resultado: any[] = [];
    // Actualizar previos con estado actual
    for (const p of previos) {
      const id = Number(p.id);
      resultado.push({ id, codigo: p.codigo, activo: this.selectedCodigoRanchoIds().has(id) });
    }
    // Agregar nuevos seleccionados que no estaban antes
    for (const id of this.selectedCodigoRanchoIds()) {
      if (!prevIds.has(id)) {
        const rancho = this.codigosRancho().find((r: any) => Number(r.id) === id);
        if (rancho) resultado.push({ id: rancho.id, codigo: rancho.codigo, activo: true });
      }
    }
    const merged = { ...(this.value ?? {}), ...this.form(), codigosRancho: resultado };
    this.guardar.emit({ payload: merged, modo: this.modo, _pk: (this.value as any)?._pk });
  }

  updateField(field: string, value: any): void {
    this.form.update(f => ({ ...f, [field]: value }));
  }

  getTitle(): string {
    return this.modo === 'editar' ? 'Editar Consignatario' : 'Nuevo Consignatario';
  }
}
