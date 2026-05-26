import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-parametros-setup',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './parametros-setup.component.html',
})
export class ParametrosSetupComponent {
  private readonly router = inject(Router);

  irAParametros(): void {
    void this.router.navigate(['/parametros'], { queryParams: { allowSetup: 1 } });
  }
}
