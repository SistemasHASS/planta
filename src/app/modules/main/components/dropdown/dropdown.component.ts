import { ClickOutsideDirective } from '@/app/shared/directives/click-outside.directive';
import { CommonModule } from '@angular/common';
import { Component, forwardRef, Input, OnChanges, SimpleChanges } from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'app-dropdown',
  standalone: true,
  imports: [CommonModule, FormsModule, ClickOutsideDirective],
  templateUrl: './dropdown.component.html',
  styleUrl: './dropdown.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DropdownComponent),
      multi: true,
    },
  ],
})
export class DropdownComponent implements ControlValueAccessor, OnChanges {
  @Input() data: any[] = [];
  @Input() valueField: string = 'id';
  @Input() textShow: string = '';
  @Input() textShow2: string = '';
  @Input() optionLabel: string = '';
  @Input() required: boolean = false;
  @Input() duration: number = 0.2;
  @Input() editable: boolean = false;
  @Input() disabled: boolean = false;

  isDrop: boolean = false;
  filteredData: any[] = [];
  selectedItem: any = null;
  showValidation: boolean = false;
  private tempValue: any = null;

  private onChange: (value: any) => void = () => {};
  private onTouched: () => void = () => {};

  constructor() {}

  writeValue(value: any): void {
    if (this.data?.length > 0) {
      this.setSelectedItem(value);
    } else {
      this.tempValue = value;
    }
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  ngOnInit() {
    this.filteredData = [...this.data];
    if (this.tempValue !== null) {
      this.setSelectedItem(this.tempValue);
      this.tempValue = null;
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data'] && this.data?.length > 0 && this.tempValue !== null) {
      this.setSelectedItem(this.tempValue);
      this.tempValue = null;
    }
  }

  private setSelectedItem(value: any) {
    const foundItem = this.data.find((item) => item[this.valueField] === value);
    this.selectedItem = foundItem ? foundItem[this.optionLabel] : null;
  }

  toggleDrop() {
    this.filteredData = [...this.data];
    this.isDrop = !this.isDrop;
  }

  closeDropdown() {
    this.isDrop = false;
    if (!this.disabled) {
      this.showValidation = true;
    }
  }

  openDropdown() {
    this.filteredData = [...this.data];
    this.isDrop = true;
  }

  darItem(item: any) {
    this.selectedItem = item[this.optionLabel];
    this.onChange(item[this.valueField]);
    this.closeDropdown();
  }

  onInputChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const value = input.value;
  
    if (!value || value.trim() === '') {
      this.clearSelection();
      return;
    }
  
    this.filterData(value);
    this.isDrop = true;
  
    // si lo escrito no coincide, no asignamos selección
    const match = this.data.find(item => 
      item[this.optionLabel].toLowerCase() === value.toLowerCase()
    );
    if (!match) {
      this.selectedItem = value; // queda como texto temporal
    } else {
      this.darItem(match);
    }
  }
  

  
  filterData(searchTerm: string) {
    const lowerSearch = searchTerm.toLowerCase();
    this.filteredData = this.data.filter((item) =>
      item[this.optionLabel].toLowerCase().includes(lowerSearch)
    );
  }

  clearSelection() {
    this.selectedItem = null;
    this.onChange(null);
    this.closeDropdown();
  }

  validateSelection() {
    if (!this.selectedItem || 
        !this.data.some(item => item[this.optionLabel] === this.selectedItem)) {
      this.clearSelection();
      this.showValidation = true;
    }
  }
  
}
