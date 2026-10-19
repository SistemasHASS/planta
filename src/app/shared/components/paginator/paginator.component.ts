import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';

@Component({
  selector: 'app-paginator',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (total() > 0) {
      <div class="pager">
        <span class="pager-info">{{ desde() }}–{{ hasta() }} de {{ total() }}</span>
        <div class="pager-controls">
          <label class="pager-size">
            <span>Filas</span>
            <select [value]="pageSize()" (change)="cambiarTamano($any($event.target).value)">
              @for (opt of opciones; track opt) { <option [value]="opt" [selected]="opt === pageSize()">{{ opt }}</option> }
            </select>
          </label>
          <button type="button" class="pager-btn" aria-label="Primera pagina" [disabled]="actual() <= 1" (click)="ir(1)">«</button>
          <button type="button" class="pager-btn" aria-label="Pagina anterior" [disabled]="actual() <= 1" (click)="ir(actual() - 1)">‹</button>
          <span class="pager-page">{{ actual() }} / {{ ultima() }}</span>
          <button type="button" class="pager-btn" aria-label="Pagina siguiente" [disabled]="actual() >= ultima()" (click)="ir(actual() + 1)">›</button>
          <button type="button" class="pager-btn" aria-label="Ultima pagina" [disabled]="actual() >= ultima()" (click)="ir(ultima())">»</button>
        </div>
      </div>
    }
  `,
  styles: `
    .pager { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: .5rem .75rem; padding: .6rem .85rem; border-top: 1px solid var(--app-border-2); background: var(--app-surface); color: var(--app-muted); font-size: .8rem; }
    .pager-controls { display: flex; flex-wrap: wrap; align-items: center; gap: .35rem; }
    .pager-size { display: inline-flex; align-items: center; gap: .35rem; margin-right: .4rem; }
    .pager-size select { height: 2.2rem; padding: 0 .4rem; border: 1px solid var(--app-border); border-radius: 7px; background: var(--app-surface); color: var(--app-text); }
    .pager-btn { display: inline-grid; place-items: center; min-width: 2.2rem; height: 2.2rem; border: 1px solid var(--app-border); border-radius: 7px; background: var(--app-surface); color: var(--app-text); font-size: 1.1rem; line-height: 1; cursor: pointer; -webkit-appearance: none; appearance: none; }
    .pager-btn:disabled { opacity: .4; cursor: not-allowed; }
    .pager-page { min-width: 3.6rem; text-align: center; font-weight: 700; color: var(--app-text); }
    @media (max-width: 640px) { .pager { justify-content: center; } .pager-info { flex: 0 0 100%; text-align: center; } }
  `,
})
export class PaginatorComponent {
  readonly total = input.required<number>();
  readonly page = model(1);
  readonly pageSize = model(10);
  readonly opciones = [10, 25, 50, 100];

  readonly ultima = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize())));
  readonly actual = computed(() => Math.min(Math.max(1, this.page()), this.ultima()));
  readonly desde = computed(() => (this.total() === 0 ? 0 : (this.actual() - 1) * this.pageSize() + 1));
  readonly hasta = computed(() => Math.min(this.total(), this.actual() * this.pageSize()));

  ir(p: number): void { this.page.set(Math.min(Math.max(1, p), this.ultima())); }
  cambiarTamano(v: string): void { this.pageSize.set(Number(v) || 10); this.page.set(1); }
}
