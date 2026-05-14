import { inject, Injectable, signal, computed } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, Observable, tap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { LoginRequest, LoginResponse, UsuarioAuth } from '../interfaces/auth.interface';
import { DexieService } from '../dixiedb/dexie-db.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly apiUrl = environment.apiUrl;
  private readonly dbDexie = inject(DexieService);

  private readonly _usuario = signal<UsuarioAuth | null>(this.getStoredUser());
  readonly usuario = this._usuario.asReadonly();
  readonly isLoggedIn = computed(() => !!this._usuario());
  readonly perfil = computed(() => this._usuario()?.idrol ?? null);
  readonly nombreCompleto = computed(() => this._usuario()?.nombre ?? '');
  readonly inicialUsuario = computed(() => {
    const nombre = this._usuario()?.usuario;
    return nombre ? nombre.charAt(0).toUpperCase() : 'U';
  });

  login(credentials: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/auth/login`, credentials, { withCredentials: true })
      .pipe(
        tap(res => {
          if (res.user) {
            let usuario: UsuarioAuth = res.user;
            localStorage.setItem('usuario', JSON.stringify(usuario));
            let use=localStorage.getItem('usuario');
            console.log("1-1-1-1-1-",use)
            this._usuario.set(res.user);
            this.dbDexie.open().catch(err => console.error('Error abriendo Dexie DB', err));
          }
        }),
        catchError((error: HttpErrorResponse) => {
          const mensaje = error.error?.message || 'Credenciales incorrectas.';
          return throwError(() => new Error(mensaje));
        })
      );
  }

  logout(): void {
    this.http.post(`${this.apiUrl}/auth/logout`, {}, { withCredentials: true }).subscribe();
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    this._usuario.set(null);
    this.dbDexie.close();
    this.dbDexie.delete().catch(err => console.error('Error eliminando Dexie DB', err));
    this.router.navigate(['/login']);
  }


  private getStoredUser(): UsuarioAuth | null {
    const data = localStorage.getItem('usuario');
    if (!data) return null;
    try { return JSON.parse(data); } catch { return null; }
  }
}
