import { Injectable, inject, signal } from "@angular/core";
import { Router } from "@angular/router";

interface SessionExpiredModalState {
  visible: boolean;
  secondsRemaining: number;
}

const REDIRECT_DELAY_SECONDS = 10;

@Injectable({ providedIn: "root" })
export class SessionExpiredModalService {
  private readonly router = inject(Router);
  private redirectTimer: ReturnType<typeof setInterval> | null = null;
  private redirectAt = 0;

  readonly state = signal<SessionExpiredModalState>({
    visible: false,
    secondsRemaining: REDIRECT_DELAY_SECONDS,
  });

  show(): void {
    if (this.state().visible) {
      return;
    }

    this.redirectAt = Date.now() + REDIRECT_DELAY_SECONDS * 1000;
    this.state.set({ visible: true, secondsRemaining: REDIRECT_DELAY_SECONDS });
    this.redirectTimer = setInterval(() => this.updateCountdown(), 250);
  }

  async goToLogin(): Promise<void> {
    this.stopCountdown();
    this.state.set({ visible: false, secondsRemaining: REDIRECT_DELAY_SECONDS });
    await this.router.navigateByUrl("/login");
  }

  private updateCountdown(): void {
    const secondsRemaining = Math.max(
      0,
      Math.ceil((this.redirectAt - Date.now()) / 1000),
    );

    this.state.update((current) => ({ ...current, secondsRemaining }));
    if (secondsRemaining === 0) {
      void this.goToLogin();
    }
  }

  private stopCountdown(): void {
    if (this.redirectTimer !== null) {
      clearInterval(this.redirectTimer);
      this.redirectTimer = null;
    }
  }
}
