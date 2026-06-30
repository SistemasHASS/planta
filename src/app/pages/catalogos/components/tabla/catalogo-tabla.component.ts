import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CatalogoColumna, CatalogoConfig } from '../../catalogos.type';
import { signal } from '@angular/core';
import { formatDate } from '../../../../shared/utils/datetime.utils';

export type EstadoFiltro = 'activos' | 'inactivos' | 'todos';

@Component({
  selector: 'app-catalogo-tabla',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './catalogo-tabla.component.html',
  styleUrl: './catalogo-tabla.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogoTablaComponent {
  private readonly booleanBadgeFields = new Set<string>([
    'activo',
    'esEnsayo',
  ]);
  private readonly booleanBadgeFieldsSincronizado = new Set<string>([
    'bd'
  ]);

  private readonly _config = signal<CatalogoConfig | null>(null);
  private readonly _items = signal<any[]>([]);
  private readonly _searchTerm = signal('');
  private readonly _estadoFiltro = signal<EstadoFiltro>('todos');

  @Input({ required: true })
  set config(v: CatalogoConfig) {
    this._config.set(v);
  }
  get config(): CatalogoConfig {
    return this._config() as CatalogoConfig;
  }

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
    (this._config()?.columnas ?? []).filter((c: CatalogoColumna) => c.visible !== false)
  );

  readonly hasActivoColumn = computed(() => {
    const cols = this._config()?.columnas ?? [];
    return cols.some(c => String(c?.campo ?? '').trim().toLowerCase() === 'activo');
  });

  readonly isEditable = computed(() => {
    const cfg = this._config();
    return (cfg as any)?.editable !== false;
  });

  readonly showActions = computed(() => this.isEditable());
  readonly showToggleActivo = computed(() => this.isEditable() && this.hasActivoColumn() && !!this._config()?.tieneActivo);

  readonly tableMinWidthPx = computed(() => {
    const cols = this.columnasVisibles().length;
    const estimated = cols * 180 + 220;
    return Math.max(900, estimated);
  });

  readonly filteredItems = computed(() => {
    const cfg = this._config();
    const term = (this._searchTerm() ?? '').trim().toLowerCase();

    let base = this._items();

    if (cfg?.tieneActivo && this.hasActivoColumn()) {
      const f = this._estadoFiltro();
      if (f === 'activos') base = base.filter(i => !!i?.activo);
      if (f === 'inactivos') base = base.filter(i => !i?.activo);
    }

    if (!term) return base;

    // Buscar en TODAS las columnas visibles (no solo codigoField / displayField)
    const searchableFields = (this.columnasVisibles() ?? [])
      .map(c => String(c?.campo ?? '').trim())
      .filter(f => f.length > 0);

    return base.filter(i => {
      const text = searchableFields
        .map(f => String(i?.[f] ?? ''))
        .join(' ')
        .toLowerCase();
      return text.includes(term);
    });
  });

  trackById = (_: number, item: any) => item?.Id ?? item;

  onEditar(item: any): void {
    this.editar.emit(item);
  }

  onDesactivar(item: any): void {
    this.desactivar.emit(item);
  }

  onEliminar(item: any): void {
    this.eliminar.emit(item);
  }

  getRawValue(item: any, col: CatalogoColumna): unknown {
    return item?.[col.campo];
  }

  getCellValue(item: any, col: CatalogoColumna): unknown {
    const raw = item?.[col.campo];

    const tipo = String((col as any)?.tipo ?? '').toLowerCase();
    const campo = String(col?.campo ?? '').toLowerCase();
    const isDateTime = tipo.startsWith('datetime') || campo.includes('fechacreacion');
    if (isDateTime) return formatDate(raw) ?? '-';

    if (tipo === 'select') {
      const op = col.opciones?.find(o => String(o.value) === String(raw ?? ''));
      return op?.label ?? raw ?? '-';
    }

    if (raw === null || raw === undefined || raw === '') return '-';
    return raw;
  }

  getEstadoLabel(activo: any): string {
    return this.asBitBoolean(activo) ? 'Activo' : 'Inactivo';
  }
  getSincronizadoLabel(activo: any): string {
    return this.asBitBoolean(activo) ? 'Sincronizado' : 'No sincronizado';
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

  isBooleanBadgeColumn(col: CatalogoColumna): boolean {
    return String((col as any)?.tipo ?? '').toLowerCase() === 'bit' && this.booleanBadgeFields.has(col.campo);
  }
  
  isBooleanBadgeColumnSincronizado(col: CatalogoColumna): boolean {
    return String((col as any)?.tipo ?? '').toLowerCase() === 'bit' && this.booleanBadgeFieldsSincronizado.has(col.campo);
  }

  isMobileVisibleColumn(col: CatalogoColumna): boolean {
    const cfg = this._config();
    const codigoField = cfg?.codigoField ?? null;
    const displayField = cfg?.displayField ?? null;
    if (col.campo === 'Activo') return true;
    if (codigoField && col.campo === codigoField) return true;
    if (displayField && col.campo === displayField) return true;
    return false;
  }
}
