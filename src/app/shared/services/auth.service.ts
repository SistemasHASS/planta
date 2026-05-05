import { inject, Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
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
  readonly perfil = computed(() => this._usuario()?.perfil ?? null);
  readonly nombreCompleto = computed(() => this._usuario()?.nombreCompleto ?? '');
  readonly inicialUsuario = computed(() => {
    const nombre = this._usuario()?.nombreCompleto;
    return nombre ? nombre.charAt(0).toUpperCase() : 'U';
  });

  login(credentials: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/auth/login`, credentials).pipe(
      tap(res => {
        if (res.token && res.user) {
          localStorage.setItem('token', res.token);
          localStorage.setItem('usuario', JSON.stringify(res.user));
          this._usuario.set(res.user);
          this.dbDexie.open().catch(err => console.error('Error abriendo Dexie DB', err));
        }
      })
    );
  }

  logout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    this._usuario.set(null);
    this.dbDexie.close();
    this.dbDexie.delete().catch(err => console.error('Error eliminando Dexie DB', err));
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    return localStorage.getItem('token');
  }

  private getStoredUser(): UsuarioAuth | null {
    const data = localStorage.getItem('usuario');
    if (!data) return null;
    try { return JSON.parse(data); } catch { return null; }
  }
}
