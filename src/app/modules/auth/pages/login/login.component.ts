import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService } from '@/app/modules/auth/services/auth.service';
import { DexieService } from '@/app/shared/dixiedb/dexie-db.service';
import { AlertService } from '@/app/shared/alertas/alerts.service';

@Component({
  selector: 'app-login',
  standalone: false,
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})

export class LoginComponent {
  
  mostrarClave = false;
  usuario: any;
  clave = ''
  mensajeLogin: String = '';
  isCharge : boolean = false;
  loginForm: FormGroup;

  constructor(
    private router: Router, 
    private fb: FormBuilder,
    private dexieService: DexieService,
    private alertService: AlertService,
    private authService: AuthService
  ) {
    this.loginForm = this.fb.group({
      usuario: ['', [Validators.required]],  // Campo requerido
      clave: ['', Validators.required]
    });
  }

  async ngOnInit() {
    this.usuario = await this.dexieService.showUsuario()
    if(!!this.usuario) {
      this.login()
    }
  }
  
  login() {
    this.router.navigate(['/main/parametros']);
  }

  toggleClave(): void {
    this.mostrarClave = !this.mostrarClave; // Cambia entre mostrar y ocultar
  }

  async onSubmit() {
    this.isCharge = true;
    if (this.loginForm.valid) {
      const loginData = this.loginForm.value;
      try {
        const resp =  await this.authService.login(loginData.usuario, loginData.clave);
        if (!!resp && resp.length > 0) {
          if (resp > 1) {
            this.mensajeLogin = 'El usuario cuenta con más de una cuenta, comuníquese con su administrador del servicio.';
          } else {
            await this.dexieService.saveUsuario(resp[0]);
            this.login();
          }
          this.isCharge = false;
        } else {
          this.isCharge = false;
          this.mensajeLogin = 'El usuario no se encuentra registrado.';
        }
      } catch (error) {
        this.isCharge = false;
        this.mensajeLogin = 'Hubo un error en el login, por favor intente nuevamente.';
        this.alertService.showAlert('error', this.mensajeLogin.toString(), 'error')
      }
    }
  }

}