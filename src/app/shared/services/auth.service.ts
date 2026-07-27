import { inject, Injectable, signal, computed } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, firstValueFrom, Observable, tap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { LoginRequest, LoginResponse, UsuarioAuth } from '../interfaces/auth.interface';
import { DexieService } from '../dexiedb/dexie-db.service';
import { AlertService } from './alert.service';
import Dexie from 'dexie';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly apiUrl = environment.apiUrl;
  private readonly dbDexie = inject(DexieService);
  private readonly alertService = inject(AlertService);

  private readonly _usuario = signal<UsuarioAuth | null>(this.getStoredUser());
  readonly usuario = this._usuario.asReadonly();
  readonly isLoggedIn = computed(() => !!this._usuario());

  private mapIdRolToPerfil(idrol: string | null | undefined): UsuarioAuth['perfil'] | null {
    if (!idrol) return null;
    const v = String(idrol).trim().toUpperCase();

    // Códigos actuales del sistema Planta
    if (v === 'ADPLA') return 'ADMINISTRADOR';
    if (v === 'LOPLA') return 'LOGISTICA';
    if (v === 'MOPLA') return 'MONITOR';
    if (v === 'COPLA') return 'COORDINACION';
    if (v === 'OPPLA') return 'OPERACIONES';

    // Si ya viene normalizado, dejarlo pasar
    if (v === 'ADMINISTRADOR' || v === 'LOGISTICA' || v === 'MONITOR' ||v === 'COORDINACION' || v === 'OPERACIONES') {
      return v as UsuarioAuth['perfil'];
    }

    return null;
  }

  readonly perfil = computed(() => {
    const u = this._usuario();
    const idrol = u?.idrol ?? u?.idRol;
    return this.mapIdRolToPerfil(idrol) ?? u?.perfil ?? null;
  });
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
            let use = localStorage.getItem('usuario');
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

  async logout(): Promise<void> {
    this.alertService.mostrarModalCarga();
    try {
      await firstValueFrom(
        this.http.post(`${this.apiUrl}/auth/logout`, {}, { withCredentials: true })
      );
    } catch (error) {
      console.log('Error en logout backend', error);
    }

    try {
      if (this.dbDexie && this.dbDexie.isOpen()) {
        this.dbDexie.close();
      }

      // this.dbDexie.delete().catch(err => console.log('Error eliminando Dexie DB', err));
      await Promise.race([
        this.dbDexie.delete(),
        Dexie.delete('PlantaDB'),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout eliminando PlantaDB')), 5000)
        )
      ]);

      localStorage.removeItem('token');
      localStorage.removeItem('usuario');
      localStorage.clear();
      this._usuario.set(null);
      // window.location.href = '/login';

    } catch (error) {
      console.error('La eliminación falló o se bloqueó por conexiones activas:', error);
    } finally {
      this.alertService.cerrarModalCarga();
      this.router.navigate(['/login']);
    }
  }


  private getStoredUser(): UsuarioAuth | null {
    const data = localStorage.getItem('usuario');
    if (!data) return null;
    try { return JSON.parse(data); } catch { return null; }
  }
}
