import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { signal } from '@angular/core';
import { formatDate } from '../../../../shared/utils/datetime.utils';

export type EstadoFiltro = 'activos' | 'inactivos' | 'todos';

const COLUMNAS = [
  { campo: 'id', label: 'ID', tipo: 'int', visible: false },
  { campo: 'codigo', label: 'Código', tipo: 'nvarchar' },
  { campo: 'nombre', label: 'Nombre', tipo: 'nvarchar' },
  { campo: 'nombreTipoEmpaque', label: 'Tipo Empaque', tipo: 'nvarchar' },
  { campo: 'nombreCategoria', label: 'Categoría', tipo: 'nvarchar' },
  { campo: 'nombreCalibre', label: 'Calibre', tipo: 'nvarchar' },
  { campo: 'bd', label: 'Sincronizado', tipo: 'bit', visible: true },
  { campo: 'activo', label: 'Estado', tipo: 'bit' },
  { campo: 'fechaCreacion', label: 'Fecha Creación', tipo: 'datetime', visible: true },
];

@Component({
  selector: 'app-catalogo-tipos-empaque-guia-tabla',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './catalogo-tipos-empaque-guia-tabla.component.html',
  styleUrl: './catalogo-tipos-empaque-guia-tabla.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogoTiposEmpaqueGuiaTablaComponent {
  private readonly _items = signal<any[]>([]);
  private readonly _searchTerm = signal('');
  private readonly _estadoFiltro = signal<EstadoFiltro>('todos');

  @Input({ required: true })
  set items(v: any[]) {
    this._items.set(Array.isArray(v) ? v : []);
  }
  get items(): any[] {
    return this._items();
  }

  @Input()
  set searchTerm(v: string) {
    this._searchTerm.set(v ?? '');
  }
  get searchTerm(): string {
    return this._searchTerm();
  }

  @Input()
  set estadoFiltro(v: EstadoFiltro) {
    this._estadoFiltro.set(v ?? 'todos');
  }
  get estadoFiltro(): EstadoFiltro {
    return this._estadoFiltro();
  }

  @Output() editar = new EventEmitter<any>();
  @Output() desactivar = new EventEmitter<any>();
  @Output() eliminar = new EventEmitter<any>();

  readonly columnasVisibles = computed(() =>
    COLUMNAS.filter((c: any) => c.visible !== false)
  );

  readonly tableMinWidthPx = computed(() => {
    const cols = this.columnasVisibles().length;
    const estimated = cols * 180 + 220;
    return Math.max(900, estimated);
  });

  readonly filteredItems = computed(() => {
    const term = (this._searchTerm() ?? '').trim().toLowerCase();
    let base = this._items();

    const f = this._estadoFiltro();
    if (f === 'activos') base = base.filter((i: any) => !!i?.activo);
    if (f === 'inactivos') base = base.filter((i: any) => !i?.activo);

    if (!term) return base;

    return base.filter((i: any) => {
      const parts: string[] = [
        String(i?.codigo ?? ''),
        String(i?.nombre ?? ''),
        String(i?.nombreTipoEmpaque ?? ''),
        String(i?.nombreCategoria ?? ''),
        String(i?.nombreCalibre ?? ''),
      ];
      return parts.join(' ').toLowerCase().includes(term);
    });
  });

  trackById = (_: number, item: any) => item?._pk ?? item?.id ?? item;

  onEditar(item: any): void {
    this.editar.emit(item);
  }

  onDesactivar(item: any): void {
    this.desactivar.emit(item);
  }

  onEliminar(item: any): void {
    this.eliminar.emit(item);
  }

  getCellValue(item: any, col: any): unknown {
    const campo = String(col?.campo ?? '').toLowerCase();
    if (campo === 'nombretipoempaque') {
      return item?.codigoTipoEmpaque ?? '-';
    }
    const raw = item?.[col.campo];
    const tipo = String(col?.tipo ?? '').toLowerCase();
    const isDateTime = tipo.startsWith('datetime') || campo.includes('fechacreacion');
    if (isDateTime) return formatDate(raw) ?? '-';
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

  isBooleanBadgeColumn(col: any): boolean {
    return col.campo === 'activo';
  }

  isBooleanBadgeColumnSincronizado(col: any): boolean {
    return col.campo === 'bd';
  }
}
