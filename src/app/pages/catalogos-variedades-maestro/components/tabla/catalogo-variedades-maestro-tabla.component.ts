import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { signal } from '@angular/core';
import { Variedad } from '../../../../shared/interfaces/catalogo.interface';

export type EstadoFiltro = 'activos' | 'inactivos' | 'todos';

@Component({
  selector: 'app-catalogo-variedades-maestro-tabla',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './catalogo-variedades-maestro-tabla.component.html',
  styleUrl: './catalogo-variedades-maestro-tabla.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogoVariedadesMaestroTablaComponent {
  private readonly _items = signal<Variedad[]>([]);
  private readonly _searchTerm = signal('');

  @Input({ required: true })
  set items(v: Variedad[]) {
    this._items.set(Array.isArray(v) ? v : []);
  }
  get items(): Variedad[] {
    return this._items();
  }

  @Input()
  set searchTerm(v: string) {
    this._searchTerm.set(v ?? '');
  }
  get searchTerm(): string {
    return this._searchTerm();
  }

  @Output() editar = new EventEmitter<Variedad>();
  @Output() eliminar = new EventEmitter<Variedad>();

  readonly columnas = [
    { campo: 'codigo', label: 'Código' },
    { campo: 'cultivo', label: 'Cultivo' },
    { campo: 'idvariedad', label: 'IdVariedad' },
    { campo: 'variedad', label: 'Variedad' },
    { campo: 'procedencia', label: 'Procedencia' },
    { campo: 'esEnsayo', label: 'Es Ensayo' },
    { campo: 'bd', label: 'Sincronizado' },
  ];

  readonly tableMinWidthPx = computed(() => {
    const cols = this.columnas.length;
    const estimated = cols * 180 + 220;
    return Math.max(900, estimated);
  });

  readonly filteredItems = computed(() => {
    const term = (this._searchTerm() ?? '').trim().toLowerCase();
    const base = this._items();

    if (!term) return base;

    const searchableFields = this.columnas.map(c => c.campo);
    return base.filter(i => {
      const text = searchableFields
        .map(f => String(i[f as keyof Variedad] ?? ''))
        .join(' ')
        .toLowerCase();
      return text.includes(term);
    });
  });

  trackById = (_: number, item: Variedad) => (item as any)?._pk ?? item?.id ?? item;

  onEditar(item: Variedad): void {
    this.editar.emit(item);
  }

  onEliminar(item: Variedad): void {
    this.eliminar.emit(item);
  }

  getRawValue(item: Variedad, campo: string): unknown {
    return (item as any)?.[campo];
  }

  getCellValue(item: Variedad, campo: string): unknown {
    const raw = (item as any)?.[campo];
    if (raw === null || raw === undefined || raw === '') return '-';
    return raw;
  }

  getEstadoLabel(activo: any): string {
    return this.asBitBoolean(activo) ? 'Activo' : 'Inactivo';
  }

  getSincronizadoLabel(bd: any): string {
    return this.asBitBoolean(bd) ? 'Sincronizado' : 'No sincronizado';
  }

  getSincronizadoClass(bd: any): string {
    return this.asBitBoolean(bd) ? 'sp-badge sp-badge-success' : 'sp-badge sp-badge-danger';
  }

  getEstadoClass(activo: any): string {
    return this.asBitBoolean(activo) ? 'sp-badge sp-badge-success' : 'sp-badge sp-badge-muted';
  }

  private asBitBoolean(value: unknown): boolean {
    if (value === true) return true;
    if (value === false) return false;
    if (value === 1) return true;
    if (value === 0) return false;
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') {
      const v = value.trim().toLowerCase();
      if (v === '1' || v === 'true' || v === 'si' || v === 'sí' || v === 'y') return true;
      if (v === '0' || v === 'false' || v === 'no' || v === 'n' || v === '') return false;
    }
    return !!value;
  }

  isEsEnsayoColumn(campo: string): boolean {
    return campo === 'esEnsayo';
  }

  isBdColumn(campo: string): boolean {
    return campo === 'bd';
  }
}
