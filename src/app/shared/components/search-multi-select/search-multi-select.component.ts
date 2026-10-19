import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  Output,
  ViewChild,
  computed,
  inject,
  signal,
} from "@angular/core";
import { FormsModule } from "@angular/forms";
import {
  LucideCheck,
  LucideChevronDown,
  LucideSearch,
  LucideX,
} from "@lucide/angular";
import { SearchSelectOption } from "../search-select/search-select.component";

@Component({
  selector: "app-search-multi-select",
  imports: [FormsModule, LucideCheck, LucideChevronDown, LucideSearch, LucideX],
  templateUrl: "./search-multi-select.component.html",
  styleUrl: "./search-multi-select.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchMultiSelectComponent {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly optionsCollator = new Intl.Collator("es", {
    numeric: true,
    sensitivity: "base",
  });
  private readonly rawOptions = signal<SearchSelectOption[]>([]);
  private readonly sortOrderValue = signal<'asc' | 'desc' | 'none'>('asc');
  private readonly optionList = computed(() => this.sortOptions(this.rawOptions()));
  private readonly selectedValues = signal<string[]>([]);

  @ViewChild("searchInput") private searchInput?: ElementRef<HTMLInputElement>;
  @ViewChild("optionListElement") private optionListElement?: ElementRef<HTMLElement>;

  @Input() label = "";
  @Input() placeholder = "Seleccione";
  @Input() disabled = false;
  @Input() ignoredSearchTerms: string[] = [];
  @Input() searchByValue = true;
  @Input() showSelectAll = false;

  /** Orden de la lista: ascendente por defecto, "desc" de mayor a menor o "none" para respetar el orden recibido. */
  @Input() set sortOrder(value: 'asc' | 'desc' | 'none') {
    this.sortOrderValue.set(value);
  }

  @Input() set options(value: SearchSelectOption[] | null | undefined) {
    this.rawOptions.set(value ?? []);
    this.selectedValues.update((current) =>
      current.filter((item) =>
        this.optionList().some((option) => option.value === item),
      ),
    );
  }

  @Input() set values(value: string[] | null | undefined) {
    this.selectedValues.set([...(value ?? [])]);
  }

  @Output() valuesChange = new EventEmitter<string[]>();

  readonly opened = signal(false);
  readonly search = signal("");
  readonly activeIndex = signal(0);

  readonly filteredOptions = computed(() => {
    const term = this.searchable(this.search());
    if (!term) {
      return this.optionList();
    }

    return this.optionList().filter((option) =>
      this.searchable(option.searchText ?? option.label).includes(term) ||
      (this.searchByValue && this.normalize(option.value).includes(term)),
    );
  });

  readonly displayLabel = computed(() => {
    const selected = this.selectedValues();
    if (selected.length === 0) {
      return this.placeholder;
    }

    if (selected.length === 1) {
      return (
        this.optionList().find((option) => option.value === selected[0])
          ?.label ?? "1 seleccionado"
      );
    }

    return `${selected.length} seleccionados`;
  });

  readonly hasValue = computed(() => this.selectedValues().length > 0);
  readonly allOptionsSelected = computed(() => {
    const options = this.optionList();
    return options.length > 0 && options.every((option) => this.selectedValues().includes(option.value));
  });

  @HostListener("document:click", ["$event"])
  closeOnOutsideClick(event: MouseEvent): void {
    if (!this.opened()) {
      return;
    }

    if (!this.host.nativeElement.contains(event.target as Node)) {
      this.close();
    }
  }

  // Algunos contenedores de modal detienen el bubbling del click; mousedown
  // permite cerrar el selector antes de que ese evento sea detenido.
  @HostListener("document:mousedown", ["$event"])
  closeOnOutsideMouseDown(event: MouseEvent): void {
    if (this.opened() && !this.host.nativeElement.contains(event.target as Node)) {
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
    queueMicrotask(() => this.searchInput?.nativeElement.focus());
  }

  close(): void {
    this.opened.set(false);
    this.search.set("");
    this.activeIndex.set(0);
  }

  updateSearch(value: string): void {
    this.search.set(value);
    this.activeIndex.set(0);
    queueMicrotask(() => {
      if (this.optionListElement) {
        this.optionListElement.nativeElement.scrollTop = 0;
      }
    });
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
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      this.moveActive(-1);
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const option = this.filteredOptions()[this.activeIndex()];
      if (option) {
        this.toggleOption(option);
      }
    }
  }

  toggleOption(option: SearchSelectOption): void {
    const exists = this.isSelected(option);
    const next = exists
      ? this.selectedValues().filter((item) => item !== option.value)
      : [...this.selectedValues(), option.value];

    this.selectedValues.set(next);
    this.valuesChange.emit(next);
  }

  clear(event?: MouseEvent): void {
    event?.stopPropagation();
    this.selectedValues.set([]);
    this.valuesChange.emit([]);
  }

  toggleAll(): void {
    const next = this.allOptionsSelected()
      ? []
      : this.optionList().map((option) => option.value);
    this.selectedValues.set(next);
    this.valuesChange.emit(next);
  }

  isSelected(option: SearchSelectOption): boolean {
    return this.selectedValues().includes(option.value);
  }

  isActive(index: number): boolean {
    return this.activeIndex() === index;
  }

  private moveActive(step: number): void {
    const total = this.filteredOptions().length;
    if (!total) {
      this.activeIndex.set(0);
      return;
    }

    this.activeIndex.update((current) => (current + step + total) % total);
    queueMicrotask(() => {
      const index = this.activeIndex();
      const option = this.optionListElement?.nativeElement.querySelector<HTMLElement>(
        `[data-option-index="${index}"]`,
      );
      option?.scrollIntoView({ block: "nearest" });
    });
  }

  private sortOptions(options: SearchSelectOption[]): SearchSelectOption[] {
    const orden = this.sortOrderValue();
    if (orden === 'none') return [...options];
    const sentido = orden === 'desc' ? -1 : 1;
    return [...options].sort((left, right) =>
      sentido * (this.optionsCollator.compare(left.label, right.label)
      || this.optionsCollator.compare(left.value, right.value)),
    );
  }

  private normalize(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  private searchable(value: string): string {
    let result = this.normalize(value);
    for (const term of this.ignoredSearchTerms) {
      const normalizedTerm = this.normalize(term);
      if (normalizedTerm) {
        result = result.replace(new RegExp(`\\b${this.escapeRegExp(normalizedTerm)}\\b`, "g"), " ");
      }
    }
    return result.replace(/\s+/g, " ").trim();
  }

  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
}
