import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { LucideLogIn, LucideTimerReset } from "@lucide/angular";
import { SessionExpiredModalService } from "../../services/session-expired-modal.service";

@Component({
  selector: "app-session-expired-modal",
  imports: [LucideLogIn, LucideTimerReset],
  templateUrl: "./session-expired-modal.component.html",
  styleUrl: "./session-expired-modal.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SessionExpiredModalComponent {
  readonly sessionExpired = inject(SessionExpiredModalService);

  goToLogin(): void {
    void this.sessionExpired.goToLogin();
  }
}
