import { Component, ChangeDetectionStrategy, signal, inject, OnInit } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../shared/services/auth.service';
import { ActivatedRoute } from '@angular/router';
import { AlertService } from '../../shared/services/alert.service';


@Component({
  selector: 'app-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent implements OnInit{
  private readonly alertService = inject(AlertService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  readonly currentYear = new Date().getFullYear();

  readonly loading = signal(false);
  readonly errorMsg = signal('');

  readonly showPassword = signal(false);

  readonly form = this.fb.nonNullable.group({
    usuario: ['', Validators.required],
    password: ['', Validators.required]
  });

  ngOnInit(): void {
    const reason = this.route.snapshot.queryParamMap.get('reason');
    if (reason === 'session_expired') {
      this.alertService.showAlert('Advertencia','Tu sesión expiró. Vuelve a iniciar sesión.', 'warning');
    }

    // limpiar el query param para que no se repita
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { reason: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });

    this.auth.logout();
  }

  onSubmit(): void {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.errorMsg.set('');

    this.auth.login(this.form.getRawValue()).subscribe({
      next: res => {
        this.loading.set(false);
        if (res.user) {
          this.router.navigate(['/parametros']);
        } else {
          this.errorMsg.set('Credenciales incorrectas');
        }
      },
      error: (err) => {
        this.loading.set(false);
        this.errorMsg.set(err.message);
      }
    });
  }

  togglePasswordVisibility(): void {
    this.showPassword.update(v => !v);
  }
}
