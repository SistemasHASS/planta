import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, EventEmitter, HostListener, Input, Output, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CatalogoService } from '../../services/catalogo.service';
import { ConnectivityService } from '../../services/connectivity.service';
import { DexieService } from '../../dexiedb/dexie-db.service';

type OptionItem = Record<string, any>;
type SelectValue = string | number | null;

@Component({
  selector: 'app-advanced-select',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './advanced-select.component.html',
  styleUrl: './advanced-select.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdvancedSelectComponent {
  private readonly catalogoService = inject(CatalogoService);
  private readonly connectivity = inject(ConnectivityService);
  private readonly dexie = inject(DexieService);
  private readonly el = inject(ElementRef<HTMLElement>);

  @Input() table: string = '';
  @Input() placeholder = '— Seleccionar —';
  @Input() required = false;
  @Input() disabled = false;
  @Input() source: 'auto' | 'dexie' | 'api' = 'auto';

  private readonly _value = signal<SelectValue>(null);
  @Input()
  set value(v: SelectValue) {
    this._value.set(v ?? null);
  }
  get value(): SelectValue {
    return this._value();
  }
  @Output() valueChange = new EventEmitter<SelectValue>();

  @Input() idField = 'id';
  @Input() labelFields: string[] | null = null;
  @Input() labelSeparator = ' — ';

  private readonly _itemsInput = signal<OptionItem[] | null>(null);
  @Input()
  set itemsInput(v: OptionItem[] | null) {
    this._itemsInput.set(Array.isArray(v) ? v : v === null ? null : []);
    const arr = this._itemsInput();
    if (arr !== null) {
      this.items.set(arr);
    } else {
      this.items.set([]);
    }
  }
  get itemsInput(): OptionItem[] | null {
    return this._itemsInput();
  }

  readonly open = signal(false);
  readonly loading = signal(false);
  readonly query = signal('');
  readonly items = signal<OptionItem[]>([]);
  readonly dropUp = signal(false);

  private portalDropdownEl: HTMLElement | null = null;
  private portalOriginalParent: HTMLElement | null = null;
  private portalOriginalNextSibling: ChildNode | null = null;

  readonly selectedItem = computed(() => {
    const v = this._value();
    if (v === null || v === undefined) return null;
    const vv = String(v);
    return this.items().find(i => String(i?.[this.idField]) === vv) ?? null;
  });

  readonly selectedLabel = computed(() => {
    const it = this.selectedItem();
    if (!it) return '';
    return this.formatLabel(it);
  });

  readonly filtered = computed(() => {
    const q = (this.query() ?? '').trim().toLowerCase();
    const list = this.items();
    if (!q) return list;
    return list.filter(i => this.formatLabel(i).toLowerCase().includes(q));
  });

  get online(): boolean {
    return this.connectivity.isOnline();
  }

  ngOnChanges(): void {
    const v = this._value();
    if (v === null || v === undefined) return;
    if (!this.table) return;
    if (this.items().length > 0) return;
    if (this.itemsInput !== null) return;
    void this.ensureLoaded();
  }

  async toggle(): Promise<void> {
    if (this.disabled) return;
    const next = !this.open();
    this.open.set(next);
    if (next) {
      await this.ensureLoaded();
      this.recalcDirection();
      this.attachDropdownPortalIfNeeded();
      queueMicrotask(() => {
        const input = this.el.nativeElement.querySelector('input[data-role="search"]') as HTMLInputElement | null;
        input?.focus();
      });
    }
  }

  private recalcDirection(): void {
    const trigger = this.el.nativeElement.querySelector('button.as-trigger') as HTMLElement | null;
    if (!trigger) {
      this.dropUp.set(false);
      return;
    }

    const rect = trigger.getBoundingClientRect();
    // When dropdown is shown, it may be portaled (fixed) and must use viewport bounds.
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    const desired = 420;
    if (spaceBelow >= desired) {
      this.dropUp.set(false);
      return;
    }

    this.dropUp.set(spaceAbove > spaceBelow);
  }

  @HostListener('window:resize')
  onResize(): void {
    if (!this.open()) return;
    this.recalcDirection();
    this.updatePortalPosition();
  }

  @HostListener('window:scroll')
  onWindowScroll(): void {
    if (!this.open()) return;
    this.recalcDirection();
    this.updatePortalPosition();
  }

  private updatePortalPosition(): void {
    if (!this.open()) return;
    const dropdown = this.portalDropdownEl;
    if (!dropdown) return;

    const trigger = this.el.nativeElement.querySelector('button.as-trigger') as HTMLElement | null;
    if (!trigger) return;

    const triggerRect = trigger.getBoundingClientRect();
    dropdown.style.left = `${triggerRect.left}px`;
    dropdown.style.right = 'auto';
    dropdown.style.width = `${triggerRect.width}px`;

    if (this.dropUp()) {
      dropdown.style.top = 'auto';
      dropdown.style.bottom = `${window.innerHeight - triggerRect.top}px`;
    } else {
      dropdown.style.bottom = 'auto';
      dropdown.style.top = `${triggerRect.bottom}px`;
    }
  }

  close(): void {
    this.open.set(false);
    this.query.set('');
    this.detachDropdownPortal();
  }

  clear(ev?: MouseEvent): void {
    ev?.preventDefault();
    ev?.stopPropagation();
    if (this.disabled) return;
    this._value.set(null);
    this.valueChange.emit(null);
    this.close();
  }

  selectItem(item: OptionItem, ev?: MouseEvent): void {
    ev?.preventDefault();
    ev?.stopPropagation();
    if (this.disabled) return;
    const v = item?.[this.idField];
    this._value.set(v ?? null);
    this.valueChange.emit(v ?? null);
    this.close();
  }

  async ensureLoaded(): Promise<void> {
    if (!this.table) return;
    if (this.items().length > 0) return;
    if (this.itemsInput !== null) return;
    this.loading.set(true);
    try {
      const shouldUseApi = this.source === 'api' || (this.source === 'auto' && this.online);
      if (shouldUseApi) {
        const resp: any = await firstValueFrom(this.catalogoService.listarForTablaCatalogos(this.table));
        const data = resp?.data ?? resp;
        const arr = Array.isArray(data) ? data : (data?.[this.table] ?? []);
        this.items.set(Array.isArray(arr) ? arr : []);
      } else {
        const t = this.dexie.getTable(this.table) as any;
        const arr = await t.toArray();
        this.items.set(Array.isArray(arr) ? arr : []);
      }
    } finally {
      this.loading.set(false);
    }
  }

  formatLabel(item: OptionItem): string {
    const fields = this.labelFields;
    if (Array.isArray(fields) && fields.length > 0) {
      const parts = fields
        .map(f => String(item?.[f] ?? '').trim())
        .filter(Boolean);
      if (parts.length > 0) return parts.join(this.labelSeparator);
    }

    const fallback =
      String(item?.['descripcion'] ?? '').trim() ||
      String(item?.['nombre'] ?? '').trim() ||
      String(item?.[this.idField] ?? '').trim();
    return fallback;
  }

  @HostListener('document:click', ['$event'])
  onDocClick(ev: MouseEvent): void {
    if (!this.open()) return;
    const target = ev.target as Node | null;
    if (!target) return;
    if (this.el.nativeElement.contains(target)) return;
    if (this.portalDropdownEl && this.portalDropdownEl.contains(target)) return;
    this.close();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (!this.open()) return;
    this.close();
  }

  private attachDropdownPortalIfNeeded(): void {
    const tryAttach = (attemptsLeft: number): void => {
      if (!this.open()) return;
      if (this.portalDropdownEl) return;

      const dropdown = this.el.nativeElement.querySelector('.as-dropdown') as HTMLElement | null;
      if (!dropdown) {
        if (attemptsLeft <= 0) return;
        requestAnimationFrame(() => tryAttach(attemptsLeft - 1));
        return;
      }

      this.portalDropdownEl = dropdown;
      this.portalOriginalParent = dropdown.parentElement;
      this.portalOriginalNextSibling = dropdown.nextSibling;

      document.body.appendChild(dropdown);
      dropdown.classList.add('as-portal');

      this.updatePortalPosition();
    };

    requestAnimationFrame(() => tryAttach(10));
  }

  private detachDropdownPortal(): void {
    const dropdown = this.portalDropdownEl;
    const parent = this.portalOriginalParent;
    if (!dropdown || !parent) {
      this.portalDropdownEl = null;
      this.portalOriginalParent = null;
      this.portalOriginalNextSibling = null;
      return;
    }

    dropdown.classList.remove('as-portal');
    dropdown.style.left = '';
    dropdown.style.right = '';
    dropdown.style.top = '';
    dropdown.style.bottom = '';
    dropdown.style.width = '';

    if (this.portalOriginalNextSibling) {
      parent.insertBefore(dropdown, this.portalOriginalNextSibling);
    } else {
      parent.appendChild(dropdown);
    }

    this.portalDropdownEl = null;
    this.portalOriginalParent = null;
    this.portalOriginalNextSibling = null;
  }
}
