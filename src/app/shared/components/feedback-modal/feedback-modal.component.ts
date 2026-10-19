import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  inject,
} from "@angular/core";
import {
  LucideCircleCheck,
  LucideCircleX,
  LucideShare2,
  LucideTriangleAlert,
  LucideX,
} from "@lucide/angular";
import { FeedbackModalService } from "../../services/feedback-modal.service";

@Component({
  selector: "app-feedback-modal",
  imports: [LucideCircleCheck, LucideCircleX, LucideShare2, LucideTriangleAlert, LucideX],
  templateUrl: "./feedback-modal.component.html",
  styleUrl: "./feedback-modal.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeedbackModalComponent {
  readonly feedback = inject(FeedbackModalService);

  @HostListener("document:keydown.escape")
  closeOnEscape(): void {
    if (this.feedback.state().visible) {
      this.feedback.close();
    }
  }
}
