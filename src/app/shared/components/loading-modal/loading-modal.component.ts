import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { LoadingService } from "../../services/loading.service";

@Component({
  selector: "app-loading-modal",
  templateUrl: "./loading-modal.component.html",
  styleUrl: "./loading-modal.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoadingModalComponent {
  readonly loading = inject(LoadingService);
}
