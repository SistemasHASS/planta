import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ActiveSession, ClientSession, LoginResponse, RefreshResponse } from '../interfaces/auth.interface';

@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  login(usuario: string, password: string, client: ClientSession): Promise<LoginResponse> {
    return firstValueFrom(this.http.post<LoginResponse>(`${this.baseUrl}/api/auth/login`, { usuario, password, client }));
  }

  refresh(refreshToken: string, client: ClientSession): Promise<RefreshResponse> {
    return firstValueFrom(this.http.post<RefreshResponse>(`${this.baseUrl}/api/auth/refresh`, { refreshToken, client }));
  }

  logout(refreshToken: string): Promise<unknown> {
    return firstValueFrom(this.http.post(`${this.baseUrl}/api/auth/logout`, { refreshToken }));
  }

  listSessions(): Promise<ActiveSession[]> {
    return firstValueFrom(this.http.get<ActiveSession[]>(`${this.baseUrl}/api/auth/sessions`));
  }

  revokeSession(sessionId: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${this.baseUrl}/api/auth/sessions/${sessionId}`));
  }

  logoutAll(): Promise<unknown> {
    return firstValueFrom(this.http.post(`${this.baseUrl}/api/auth/logout-all`, {}));
  }
}
