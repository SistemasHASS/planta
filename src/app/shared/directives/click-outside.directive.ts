import { Directive, ElementRef, EventEmitter, HostListener, Output } from '@angular/core';

@Directive({
  selector: '[clickOutside]',
  standalone: true
})
export class ClickOutsideDirective {
  @Output() clickOutside = new EventEmitter();
  
  private clickedInside = false;

  constructor(private el: ElementRef) {}

  @HostListener('click', ['$event'])
  onClickInside(event: MouseEvent): void {
    this.clickedInside = true;
  }

  @HostListener('document:click', ['$event'])
  onClickOutside(event: MouseEvent): void {
    if (this.clickedInside && !this.el.nativeElement.contains(event.target)) {
      this.clickOutside.emit();
      this.clickedInside = false;
    }
  }

}