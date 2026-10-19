import { ChangeDetectionStrategy, Component, HostListener, inject } from '@angular/core';
import { LucideAlertOctagon, LucideLogOut, LucideTriangleAlert, LucideX } from '@lucide/angular';
import { PendingLogoutModalService } from '../../services/pending-logout-modal.service';

@Component({
  selector: 'app-pending-logout-modal',
  imports: [LucideAlertOctagon, LucideLogOut, LucideTriangleAlert, LucideX],
  templateUrl: './pending-logout-modal.component.html',
  styleUrl: './pending-logout-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PendingLogoutModalComponent {
  readonly modal = inject(PendingLogoutModalService);

  @HostListener('document:keydown.escape')
  closeOnEscape(): void {
    if (this.modal.state().visible) {
      this.modal.cancel();
    }
  }
}
