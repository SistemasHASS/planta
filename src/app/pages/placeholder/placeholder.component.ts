import { Component, ChangeDetectionStrategy, input } from '@angular/core';

@Component({
  selector: 'app-placeholder',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-title-area">
      <h2><i class="bi" [class]="icon()"></i> {{ title() }}</h2>
      <p class="page-subtitle">{{ subtitle() }}</p>
    </div>
    <div class="sp-card">
      <div class="sp-card-body text-center" style="padding:60px 20px">
        <i class="bi" [class]="icon()" style="font-size:64px;color:var(--color-text-muted);opacity:0.3"></i>
        <h4 style="margin-top:20px;color:var(--color-text-muted)">Módulo en desarrollo</h4>
        <p style="color:var(--color-text-muted);font-size:14px">Esta funcionalidad estará disponible próximamente</p>
      </div>
    </div>
  `,
  styles: []
})
export class PlaceholderComponent {
  readonly title = input.required<string>();
  readonly subtitle = input.required<string>();
  readonly icon = input<string>('bi-info-circle');
}
