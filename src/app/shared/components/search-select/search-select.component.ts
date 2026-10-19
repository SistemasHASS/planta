import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Injector,
  afterNextRender,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
  ViewChildren,
  QueryList,
  computed,
  inject,
  signal,
} from "@angular/core";
import { FormsModule } from "@angular/forms";
import { LucideCheck, LucideChevronDown, LucideSearch, LucideX } from "@lucide/angular";

export interface SearchSelectOption {
  label: string;
  value: string;
  searchText?: string;
  /** Texto pequeno bajo el nombre (ej. 'Inspeccionado 4:40 p. m.'). */
  badge?: string;
  /** Color del texto pequeno (badge), ej. para distinguir el envase. */
  badgeColor?: string;
  /** Estado visual: 'pending' = punto verde; 'done' = fondo rosado (sigue siendo elegible). */
  tone?: 'pending' | 'done';
}

@Component({
  selector: "app-search-select",
  imports: [FormsModule, LucideCheck, LucideChevronDown, LucideSearch, LucideX],
  templateUrl: "./search-select.component.html",
  styleUrl: "./search-select.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchSelectComponent implements OnChanges, OnDestroy {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly optionsCollator = new Intl.Collator("es", {
    numeric: true,
    sensitivity: "base",
  });

  @ViewChild("searchInput") private searchInput?: ElementRef<HTMLInputElement>;
  @ViewChildren("optionItem", { read: ElementRef })
  private optionItems?: QueryList<ElementRef<HTMLButtonElement>>;
  @ViewChild("panel") private panelRef?: ElementRef<HTMLDivElement>;
  private readonly injector = inject(Injector);
  @ViewChild("optionList") private optionListElement?: ElementRef<HTMLDivElement>;

  @Input() label = "";
  private readonly placeholderText = signal("Seleccione");
  @Input() set placeholder(value: string) {
    this.placeholderText.set(value);
  }
  get placeholder(): string {
    return this.placeholderText();
  }
  @Input() hint = "";
  @Input() required = false;
  @Input() invalid = false;
  @Input() disabled = false;
  @Input() dropUp = false;
  @Input() value: string | null = null;
  private readonly optionList = signal<SearchSelectOption[]>([]);

  /** 'asc' (por defecto) ordena las opciones por texto; 'none' respeta el orden en que llegan. */
  @Input() set sortOrder(value: "asc" | "none") {
    this.sortOrderValue = value;
    this.optionList.set(this.sortOptions(this.optionList()));
  }
  private sortOrderValue: "asc" | "none" = "asc";

  @Input() set options(value: SearchSelectOption[] | null | undefined) {
    this.optionList.set(this.sortOptions(value ?? []));
    this.syncCurrentFromValue();
    this.syncActiveWithCurrent();
  }

  get options(): SearchSelectOption[] {
    return this.optionList();
  }

  @Output() selected = new EventEmitter<SearchSelectOption>();

  readonly opened = signal(false);
  readonly search = signal("");
  readonly current = signal<SearchSelectOption | null>(null);
  readonly activeIndex = signal(0);

  readonly filteredOptions = computed(() => {
    const term = this.normalize(this.search());

    if (!term) {
      return this.optionList();
    }

    return this.optionList().filter((option) =>
      this.normalize(option.searchText ?? option.label).includes(term),
    );
  });

  readonly displayLabel = computed(
    () => this.current()?.label ?? this.placeholderText(),
  );

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["value"] || changes["options"]) {
      this.syncCurrentFromValue();
    }

    if (this.disabled) {
      this.close();
    }
  }

  @HostListener("document:click", ["$event"])
  closeOnOutsideClick(event: MouseEvent): void {
    if (!this.opened()) {
      return;
    }

    if (!this.host.nativeElement.contains(event.target as Node)) {
      this.close();
    }
  }

  @HostListener("document:mousedown", ["$event"])
  closeOnOutsideMouseDown(event: MouseEvent): void {
    if (this.opened() && !this.host.nativeElement.contains(event.target as Node)) {
      this.close();
    }
  }

  @HostListener("focusout", ["$event"])
  closeOnFocusOut(event: FocusEvent): void {
    if (!this.opened()) {
      return;
    }

    const nextTarget = event.relatedTarget as Node | null;

    if (!nextTarget || !this.host.nativeElement.contains(nextTarget)) {
      this.close();
    }
  }

  toggle(): void {
    if (this.disabled) {
      return;
    }

    this.opened() ? this.close() : this.open();
  }

  open(): void {
    if (this.disabled) {
      return;
    }

    this.opened.set(true);
    this.panelOrigin = null;
    document.addEventListener("scroll", this.onAnyScroll, true);
    afterNextRender(() => this.positionPanel(), { injector: this.injector });
    this.syncActiveWithCurrent();
    queueMicrotask(() => {
      this.searchInput?.nativeElement.focus();
      this.scrollActiveOption();
    });
  }

  /** La lista es `position: fixed`: se ubica junto al campo (abajo, o arriba si no hay espacio) y sigue al campo al hacer scroll. */
  @HostListener("window:resize")
  positionPanel(event?: Event): void {
    const panel = this.panelRef?.nativeElement;
    const anchor = (this.host.nativeElement as HTMLElement).querySelector(".select-anchor");
    if (!this.opened() || !panel || !anchor) return;
    // El scroll de la propia lista de opciones no mueve el panel.
    if (event?.target instanceof Node && panel.contains(event.target)) return;

    // Si algun ancestro tiene transform, `fixed` se mide desde el: se descubre ese origen una sola vez y se descuenta.
    if (!this.panelOrigin) {
      const animation = panel.style.animation;
      panel.style.animation = "none";
      panel.style.top = "0px";
      panel.style.left = "0px";
      panel.style.right = "auto";
      panel.style.bottom = "auto";
      const origin = panel.getBoundingClientRect();
      this.panelOrigin = { top: origin.top, left: origin.left };
      panel.style.animation = animation;
    }

    const field = anchor.getBoundingClientRect();
    const height = panel.offsetHeight;
    // Si un ancestro con transform es el bloque contenedor de `fixed` (p. ej. el modal con overflow oculto), la lista se
    // recorta en sus bordes: el espacio disponible se mide dentro de ese contenedor y no solo dentro de la ventana.
    let limiteSuperior = 0;
    let limiteInferior = window.innerHeight;
    for (let el = panel.parentElement; el && el !== document.body; el = el.parentElement) {
      const estilo = getComputedStyle(el);
      const contiene = estilo.transform !== 'none' || estilo.filter !== 'none' || estilo.perspective !== 'none' || /paint|layout|strict|content/.test(estilo.contain);
      if (contiene) {
        const caja = el.getBoundingClientRect();
        limiteSuperior = Math.max(limiteSuperior, caja.top);
        limiteInferior = Math.min(limiteInferior, caja.bottom);
        break;
      }
    }
    const spaceBelow = limiteInferior - field.bottom;
    const spaceAbove = field.top - limiteSuperior;
    const openUp = this.dropUp || (spaceBelow < height + 16 && spaceAbove > spaceBelow);
    const top = openUp ? field.top - height - 8 : field.bottom + 8;

    panel.style.right = "auto";
    panel.style.bottom = "auto";
    panel.style.width = `${field.width}px`;
    panel.style.top = `${top - this.panelOrigin.top}px`;
    panel.style.left = `${field.left - this.panelOrigin.left}px`;
    panel.style.visibility = "visible";
  }

  private panelOrigin: { top: number; left: number } | null = null;
  /** El scroll no burbujea: se escucha en captura para seguir al campo aunque se desplace un contenedor interno. */
  private readonly onAnyScroll = (event: Event): void => this.positionPanel(event);

  ngOnDestroy(): void {
    document.removeEventListener("scroll", this.onAnyScroll, true);
  }

  close(): void {
    document.removeEventListener("scroll", this.onAnyScroll, true);
    this.opened.set(false);
    this.search.set("");
    this.activeIndex.set(0);
  }

  updateSearch(value: string): void {
    this.search.set(value);
    this.activeIndex.set(0);
    this.scrollActiveOption();
  }

  choose(option: SearchSelectOption): void {
    this.current.set(option);
    this.selected.emit(option);
    this.close();
  }

  clear(event: MouseEvent): void {
    event.stopPropagation();
    this.current.set(null);
    this.selected.emit({ label: '', value: '' });
    this.close();
  }

  isSelected(option: SearchSelectOption): boolean {
    return this.current()?.value === option.value;
  }

  isActive(index: number): boolean {
    return this.activeIndex() === index;
  }

  onKeydown(event: KeyboardEvent): void {
    if (this.disabled) {
      return;
    }

    if (
      !this.opened() &&
      ["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)
    ) {
      event.preventDefault();
      this.open();
      return;
    }

    if (!this.opened()) {
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      this.close();
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      this.moveActive(1);
      this.scrollActiveOption();
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      this.moveActive(-1);
      this.scrollActiveOption();
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const option = this.filteredOptions()[this.activeIndex()];

      if (option) {
        this.choose(option);
      }
    }
  }

  private syncCurrentFromValue(): void {
    const value = String(this.value ?? "").trim();
    if (!value) {
      this.current.set(null);
      return;
    }

    this.current.set(
      this.optionList().find((option) => option.value === value) ?? null,
    );
  }

  private sortOptions(options: SearchSelectOption[]): SearchSelectOption[] {
    if (this.sortOrderValue === "none") return [...options];
    return [...options].sort((left, right) =>
      this.optionsCollator.compare(left.label, right.label)
      || this.optionsCollator.compare(left.value, right.value),
    );
  }

  private moveActive(step: number): void {
    const total = this.filteredOptions().length;

    if (!total) {
      this.activeIndex.set(0);
      return;
    }

    this.activeIndex.update((current) => (current + step + total) % total);
  }

  private syncActiveWithCurrent(): void {
    const current = this.current();
    const index = current
      ? this.filteredOptions().findIndex(
          (option) => option.value === current.value,
        )
      : 0;
    this.activeIndex.set(index >= 0 ? index : 0);
  }

  private scrollActiveOption(): void {
    setTimeout(() => {
      const list = this.optionListElement?.nativeElement;
      const option = this.optionItems?.get(this.activeIndex())?.nativeElement;
      if (!list || !option) return;

      const optionTop = option.offsetTop;
      const optionBottom = optionTop + option.offsetHeight;
      const visibleTop = list.scrollTop;
      const visibleBottom = visibleTop + list.clientHeight;

      if (optionTop < visibleTop) {
        list.scrollTop = optionTop;
      } else if (optionBottom > visibleBottom) {
        list.scrollTop = optionBottom - list.clientHeight;
      }
    }, 0);
  }

  private normalize(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }
}
