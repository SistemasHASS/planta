import { Component, ChangeDetectionStrategy, signal, inject } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../shared/services/auth.service';

@Component({
  selector: 'app-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  readonly loading = signal(false);
  readonly errorMsg = signal('');

  readonly form = this.fb.nonNullable.group({
    usuario: ['', Validators.required],
    password: ['', Validators.required]
  });

  onSubmit(): void {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.errorMsg.set('');

    this.auth.login(this.form.getRawValue()).subscribe({
      next: res => {
        this.loading.set(false);
        if (res.token && res.user) {
          this.router.navigate(['/dashboard']);
        } else {
          this.errorMsg.set('Credenciales incorrectas');
        }
      },
      error: () => {
        this.loading.set(false);
        this.errorMsg.set('Error de conexión con el servidor');
      }
    });
  }
}
