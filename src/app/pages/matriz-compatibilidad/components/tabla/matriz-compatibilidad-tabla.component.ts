import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatrizCompatibilidad } from '../../../../shared/interfaces/administracion.interface';

@Component({
  selector: 'app-matriz-compatibilidad-tabla',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './matriz-compatibilidad-tabla.component.html',
  styleUrl: './matriz-compatibilidad-tabla.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MatrizCompatibilidadTablaComponent {
  private readonly _items = signal<MatrizCompatibilidad[]>([]);

  @Input({ required: true })
  set items(v: MatrizCompatibilidad[]) {
    this._items.set(Array.isArray(v) ? v : []);
    this.page.set(1);
  }
  get items(): MatrizCompatibilidad[] {
    return this._items();
  }

  @Input() estadoFiltro: 'activos' | 'inactivos' | 'todos' = 'activos';

  @Output() editar = new EventEmitter<MatrizCompatibilidad>();
  @Output() desactivar = new EventEmitter<MatrizCompatibilidad>();

  readonly page = signal(1);
  readonly pageSize = signal(15);

  readonly total = computed(() => this._items().length);
  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize())));

  readonly pagedItems = computed(() => {
    const p = this.page();
    const s = this.pageSize();
    const start = (p - 1) * s;
    const end = start + s;
    return this._items().slice(start, end);
  });

  readonly rangeLabel = computed(() => {
    const t = this.total();
    if (t === 0) return '0–0 de 0';
    const p = this.page();
    const s = this.pageSize();
    const start = (p - 1) * s + 1;
    const end = Math.min(t, p * s);
    return `${start}–${end} de ${t}`;
  });

  readonly pageNumbers = computed(() => {
    const totalPages = this.totalPages();
    const current = this.page();

    const pages: (number | '...')[] = [];
    const push = (v: number | '...') => pages.push(v);

    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) push(i);
      return pages;
    }

    push(1);

    const left = Math.max(2, current - 1);
    const right = Math.min(totalPages - 1, current + 1);

    if (left > 2) push('...');

    for (let i = left; i <= right; i++) push(i);

    if (right < totalPages - 1) push('...');

    push(totalPages);
    return pages;
  });

  setPage(p: number): void {
    const tp = this.totalPages();
    const next = Math.min(tp, Math.max(1, p));
    this.page.set(next);
  }

  prev(): void {
    this.setPage(this.page() - 1);
  }

  next(): void {
    this.setPage(this.page() + 1);
  }

  onPageSizeChange(value: unknown): void {
    const n = Number(value);
    this.pageSize.set(Number.isFinite(n) && n > 0 ? n : 15);
    this.page.set(1);
  }

  onEditar(item: MatrizCompatibilidad): void {
    this.editar.emit(item);
  }

  onDesactivar(item: MatrizCompatibilidad): void {
    this.desactivar.emit(item);
  }

  trackById = (_: number, item: MatrizCompatibilidad) => item?.id ?? item;

  estadoLabel(activo: any): string {
    return this.asBitBoolean(activo) ? 'Activo' : 'Inactivo';
  }

  estadoClass(activo: any): string {
    return this.asBitBoolean(activo) ? 'sp-badge sp-badge-success' : 'sp-badge sp-badge-muted';
  }

  sincronizadoLabel(bd: any): string {
    return this.asBitBoolean(bd) ? 'Sincronizado' : 'No sincronizado';
  }

  sincronizadoClass(bd: any): string {
    return this.estadoClass(bd);
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
}
