import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { RouterOutlet } from "@angular/router";
import { LoadingModalComponent } from "./shared/components/loading-modal/loading-modal.component";
import { FeedbackModalComponent } from "./shared/components/feedback-modal/feedback-modal.component";
import { TextViewModalComponent } from "./shared/components/text-view-modal/text-view-modal.component";
import { ConfirmModalComponent } from "./shared/components/confirm-modal/confirm-modal.component";
import { PendingLogoutModalComponent } from "./shared/components/pending-logout-modal/pending-logout-modal.component";
import { SessionExpiredModalComponent } from "./shared/components/session-expired-modal/session-expired-modal.component";
import { ThemeService } from './shared/services/theme.service';
import { APP_VERSION } from './version';

@Component({
  selector: "app-root",
  imports: [
    RouterOutlet,
    LoadingModalComponent,
    FeedbackModalComponent,
    TextViewModalComponent,
    ConfirmModalComponent,
    PendingLogoutModalComponent,
    SessionExpiredModalComponent,
  ],
  template:
    "<router-outlet /><app-loading-modal /><app-feedback-modal /><app-text-view-modal /><app-confirm-modal /><app-pending-logout-modal /><app-session-expired-modal />",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
  /** Se inyecta al arrancar para que el tema guardado se aplique antes de mostrar nada. */
  private readonly tema = inject(ThemeService);

   constructor() {
    console.log('Versión:', APP_VERSION);
  }
}
