import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  inject,
} from "@angular/core";
import { LucideFileText, LucideX } from "@lucide/angular";
import { TextViewModalService } from "../../services/text-view-modal.service";

@Component({
  selector: "app-text-view-modal",
  imports: [LucideFileText, LucideX],
  templateUrl: "./text-view-modal.component.html",
  styleUrl: "./text-view-modal.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TextViewModalComponent {
  readonly modal = inject(TextViewModalService);

  @HostListener("document:keydown.escape")
  closeOnEscape(): void {
    if (this.modal.state().visible) {
      this.modal.close();
    }
  }
}
