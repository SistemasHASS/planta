import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  inject,
} from "@angular/core";
import { LucideAlertTriangle, LucideTrash2, LucideX } from "@lucide/angular";
import { ConfirmModalService } from "../../services/confirm-modal.service";

@Component({
  selector: "app-confirm-modal",
  imports: [LucideAlertTriangle, LucideTrash2, LucideX],
  templateUrl: "./confirm-modal.component.html",
  styleUrl: "./confirm-modal.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmModalComponent {
  readonly confirm = inject(ConfirmModalService);

  @HostListener("document:keydown.escape")
  closeOnEscape(): void {
    if (this.confirm.state().visible) {
      this.confirm.cancel();
    }
  }
}
