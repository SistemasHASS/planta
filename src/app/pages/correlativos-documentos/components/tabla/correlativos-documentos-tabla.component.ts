import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { signal } from '@angular/core';

@Component({
  selector: 'app-correlativos-documentos-tabla',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './correlativos-documentos-tabla.component.html',
  styleUrl: './correlativos-documentos-tabla.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CorrelativosDocumentosTablaComponent {
  private readonly _items = signal<any[]>([]);
  private readonly _searchTerm = signal('');

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

  @Output() toggleEstado = new EventEmitter<any>();
  @Output() eliminar = new EventEmitter<any>();

  readonly filteredItems = computed(() => {
    const term = (this._searchTerm() ?? '').trim().toLowerCase();
    let base = this._items();
    if (!term) return base;
    return base.filter((i: any) => {
      const parts = [String(i?.serie ?? ''), String(i?.numero ?? '')];
      return parts.join(' ').toLowerCase().includes(term);
    });
  });

  trackById = (_: number, item: any) => item?._pk ?? item?.id ?? item;

  onToggleEstado(item: any): void {
    this.toggleEstado.emit(item);
  }

  onEliminar(item: any): void {
    this.eliminar.emit(item);
  }

  estadoLabel(eliminado: any): string {
    return this.asBitBoolean(eliminado) ? 'Inactivo' : 'Activo';
  }

  estadoClass(eliminado: any): string {
    return this.asBitBoolean(eliminado) ? 'sp-badge sp-badge-muted' : 'sp-badge sp-badge-success';
  }

  sincronizadoLabel(bd: any): string {
    return this.asBitBoolean(bd) ? 'Sincronizado' : 'No sincronizado';
  }

  sincronizadoClass(bd: any): string {
    return this.asBitBoolean(bd) ? 'sp-badge sp-badge-success' : 'sp-badge sp-badge-danger';
  }

  canDelete(bd: any): boolean {
    return !this.asBitBoolean(bd);
  }

  asBitBoolean(value: unknown): boolean {
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
}
