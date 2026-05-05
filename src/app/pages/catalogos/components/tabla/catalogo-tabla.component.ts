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
    'Activo',
    'EsEnsayo',
  ]);
  private readonly booleanBadgeFieldsSincronizado = new Set<string>([
    'db'
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

  readonly tableMinWidthPx = computed(() => {
    const cols = this.columnasVisibles().length;
    // Rough width per column + fixed space for index/actions.
    const estimated = cols * 180 + 220;
    return Math.max(900, estimated);
  });

  readonly filteredItems = computed(() => {
    const cfg = this._config();
    const term = (this._searchTerm() ?? '').trim().toLowerCase();

    let base = this._items();

    if (cfg?.tieneActivo) {
      const f = this._estadoFiltro();
      if (f === 'activos') base = base.filter(i => !!i?.Activo);
      if (f === 'inactivos') base = base.filter(i => !i?.Activo);
    }

    if (!term) return base;

    const codigoField = cfg?.codigoField ?? null;
    const displayField = cfg?.displayField ?? null;

    return base.filter(i => {
      const parts: string[] = [];
      if (codigoField) parts.push(String(i?.[codigoField] ?? ''));
      if (displayField) parts.push(String(i?.[displayField] ?? ''));
      return parts.join(' ').toLowerCase().includes(term);
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

    if (raw === null || raw === undefined || raw === '') return '-';
    return raw;
  }

  getEstadoLabel(activo: any): string {
    return this.asBitBoolean(activo) ? 'Activo' : 'Inactivo';
  }
  getSincronizadoLabel(activo: any): string {
    return this.asBitBoolean(activo) ? 'Sincronizado' : 'No sincronizado';
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
