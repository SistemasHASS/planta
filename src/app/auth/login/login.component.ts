import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { LucideEye, LucideEyeOff, LucideLock, LucideLogIn, LucideUser } from '@lucide/angular';
import { AuthService } from '../../shared/services/auth.service';
import { ConnectivityService } from '../../shared/services/connectivity.service';
import { LoadingService } from '../../shared/services/loading.service';
import { APP_VERSION } from '../../version';
@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, LucideUser, LucideLock, LucideEye, LucideEyeOff, LucideLogIn],
  templateUrl: './login.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly globalLoading = inject(LoadingService);
  readonly network = inject(ConnectivityService);
  
  readonly appVersion = APP_VERSION;
  readonly showPassword = signal(false);
  readonly loading = signal(false);
  readonly errorMessage = signal('');
  readonly passwordType = computed(() => (this.showPassword() ? 'text' : 'password'));

  readonly form = this.fb.nonNullable.group({
    usuario: ['', Validators.required],
    password: ['', Validators.required]
  });

  async submit(): Promise<void> {
    this.errorMessage.set('');

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.globalLoading.show('Iniciando sesion...');

    try {
      const { usuario, password } = this.form.getRawValue();
      await this.authService.login(usuario.trim(), password, (message) => this.globalLoading.update(message));
      this.globalLoading.update('Ingresando...');
      await this.router.navigateByUrl('/parametros');
    } catch (error) {
      this.errorMessage.set(this.messageFrom(error));
    } finally {
      this.globalLoading.hide();
      this.loading.set(false);
    }
  }

  /** Muestra el mensaje que devuelve la API (ej. credenciales invalidas) o uno generico. */
  private messageFrom(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const apiMessage = (error.error as { message?: string } | null)?.message;
      return apiMessage || 'No se pudo iniciar sesion. Verifica tus datos e intenta nuevamente.';
    }
    return error instanceof Error ? error.message : 'No se pudo iniciar sesion.';
  }
}
