import { HttpErrorResponse } from "@angular/common/http";
import { Injectable, computed, inject, signal } from "@angular/core";
import { LocalSession, Usuario } from "../interfaces/auth.interface";
import { SessionRepository } from "../dexiedb/repository/session.repository";
import { OfflineDataOwner, OfflineOwnerRepository } from "../dexiedb/repository/offline-owner.repository";
import { DexieService } from "../dexiedb/dexie-db.service";
import { AuthApiService } from "./auth-api.service";
import { ConnectivityService } from "./connectivity.service";
import { DeviceService } from "./device.service";
import { SessionExpiredModalService } from "./session-expired-modal.service";

interface StoredAuthState {
  user: Usuario;
  lastOnlineLoginAtUtc: string;
}

const AUTH_STATE_KEY = "planta_auth_state";

export class SessionExpiredError extends Error {
  constructor() {
    super("La sesion ha vencido. Debes iniciar sesion nuevamente.");
    this.name = "SessionExpiredError";
  }
}

@Injectable({ providedIn: "root" })
export class AuthService {
  private readonly api = inject(AuthApiService);
  private readonly sessionRepository = inject(SessionRepository);
  private readonly offlineOwnerRepository = inject(OfflineOwnerRepository);
  private readonly connectivity = inject(ConnectivityService);
  private readonly dexie = inject(DexieService);
  private readonly device = inject(DeviceService);
  private readonly sessionExpiredModal = inject(SessionExpiredModalService);

  private readonly authState = signal<StoredAuthState | null>(
    this.getStoredAuthState(),
  );
  private readonly currentSession = signal<LocalSession | null>(null);
  private refreshInFlight: Promise<string> | null = null;
  private sessionExpiryTimer: ReturnType<typeof setTimeout> | null = null;
  readonly requiresOnlineLogin = signal(false);
  readonly isLoggedIn = computed(() => !!this.authState());

  async login(
    usuario: string,
    password: string,
    onProgress?: (message: string) => void,
  ): Promise<LocalSession> {
    onProgress?.("Verificando conexion...");
    const online = await this.connectivity.checkConnection();

    if (!online) {
      throw new Error(
        "Necesitas internet y servidor disponible para iniciar sesion.",
      );
    }

    onProgress?.("Validando credenciales...");
    const response = await this.api.login(usuario, password, this.device.getClient());
    const session: LocalSession = {
      ...response,
      id: "current",
      lastOnlineLoginAtUtc: new Date().toISOString(),
    };

    onProgress?.("Verificando datos locales...");
    await this.dexie.open();
    const owner = this.toOfflineOwner(session.user);
    const currentOwner = await this.offlineOwnerRepository.get();

    if (currentOwner && !this.isSameOwner(currentOwner, owner)) {
      onProgress?.("Preparando datos del nuevo usuario...");
      await this.deleteLocalDatabase();
      await this.dexie.open();
    }

    await this.offlineOwnerRepository.save(owner);
    onProgress?.("Guardando sesion local...");
    await this.sessionRepository.saveSession(session);

    onProgress?.("Preparando acceso...");
    this.currentSession.set(session);
    this.scheduleSessionExpiration(session);
    this.requiresOnlineLogin.set(false);
    this.setStoredAuthState({
      user: session.user,
      lastOnlineLoginAtUtc: session.lastOnlineLoginAtUtc,
    });

    return session;
  }

  async getSession(): Promise<LocalSession | undefined> {
    const session = this.currentSession();
    if (session) {
      return session;
    }

    if (!this.dexie.isOpen()) {
      await this.dexie.open();
    }

    const localSession = await this.sessionRepository.getCurrent();
    this.currentSession.set(localSession ?? null);
    if (localSession) {
      await this.ensureOfflineOwner(localSession.user);
      this.scheduleSessionExpiration(localSession);
    }
    return localSession;
  }

  canUseApp(): boolean {
    return this.isLoggedIn();
  }

  async ensureAccessTokenForOnlineRequest(): Promise<string | null> {
    const session = await this.getSession();
    if (!session) {
      return null;
    }

    if (!this.connectivity.isOnline()) {
      return session.accessToken;
    }

    if (this.isSessionExpired(session)) {
      await this.expireOnlineSession();
      throw new SessionExpiredError();
    }

    if (new Date(session.accessTokenExpiresAtUtc).getTime() > Date.now()) {
      return session.accessToken;
    }

    return this.refreshAccessToken(session);
  }

  /** Renueva el JWT sin eliminar datos locales si el refresh token ya vencio. */
  async forceRefreshAccessToken(): Promise<string> {
    const session = await this.getSession();
    if (!session) {
      throw new Error("No existe una sesion local.");
    }

    if (this.isSessionExpired(session)) {
      await this.expireOnlineSession();
      throw new SessionExpiredError();
    }

    return this.refreshAccessToken(session);
  }

  private async refreshAccessToken(session: LocalSession): Promise<string> {
    if (this.refreshInFlight) {
      return this.refreshInFlight;
    }

    this.refreshInFlight = this.api.refresh(session.refreshToken, this.device.getClient())
      .then(async (renewed) => {
        const updatedSession: LocalSession = { ...session, ...renewed };
        await this.sessionRepository.updateTokens(renewed);
        this.currentSession.set(updatedSession);
        this.scheduleSessionExpiration(updatedSession);
        this.requiresOnlineLogin.set(false);
        return renewed.accessToken;
      })
      .catch(async (error: unknown) => {
        // La sesion y Dexie se conservan: puede haber formularios pendientes offline.
        if (error instanceof HttpErrorResponse && (error.status === 401 || error.status === 403)) {
          await this.expireOnlineSession();
          throw new SessionExpiredError();
        }
        throw error;
      })
      .finally(() => {
        this.refreshInFlight = null;
      });

    return this.refreshInFlight;
  }

  async logoutManual(): Promise<void> {
    const session = await this.getSession().catch(() => undefined);
    if (session && this.connectivity.isOnline()) {
      await this.api.logout(session.refreshToken).catch(() => undefined);
    }

    if (this.dexie.isOpen()) {
      await this.sessionRepository.clearSession().catch(() => undefined);
    }

    this.currentSession.set(null);
    this.cancelSessionExpiration();
    this.requiresOnlineLogin.set(false);
    this.clearStoredAuthState();
  }

  async deleteLocalDatabase(): Promise<void> {
    await this.dexie.deleteDatabase();
  }

  async clearExpiredSessionButKeepOfflineData(): Promise<void> {
    if (this.dexie.isOpen()) {
      await this.sessionRepository.clearSession().catch(() => undefined);
    }

    this.currentSession.set(null);
    this.cancelSessionExpiration();
    this.clearStoredAuthState();
  }

  private isSessionExpired(session: LocalSession): boolean {
    const expiresAt = new Date(session.sessionExpiresAtUtc).getTime();
    return !Number.isFinite(expiresAt) || expiresAt <= Date.now();
  }

  private async expireOnlineSession(): Promise<void> {
    this.requiresOnlineLogin.set(true);
    await this.clearExpiredSessionButKeepOfflineData();
    this.sessionExpiredModal.show();
  }

  private scheduleSessionExpiration(session: LocalSession): void {
    this.cancelSessionExpiration();

    const delay = new Date(session.sessionExpiresAtUtc).getTime() - Date.now();
    if (!Number.isFinite(delay) || delay <= 0) {
      void this.expireSessionWhenOnline();
      return;
    }

    this.sessionExpiryTimer = setTimeout(() => {
      this.sessionExpiryTimer = null;
      void this.expireSessionWhenOnline();
    }, delay);
  }

  private async expireSessionWhenOnline(): Promise<void> {
    const session = this.currentSession();
    if (!session || !this.isSessionExpired(session)) {
      return;
    }

    // Offline keeps local work available; the next online action validates again.
    if (await this.connectivity.checkConnection()) {
      await this.expireOnlineSession();
    }
  }

  private cancelSessionExpiration(): void {
    if (this.sessionExpiryTimer !== null) {
      clearTimeout(this.sessionExpiryTimer);
      this.sessionExpiryTimer = null;
    }
  }

  private async ensureOfflineOwner(user: Usuario): Promise<void> {
    const owner = await this.offlineOwnerRepository.get();
    if (!owner) {
      await this.offlineOwnerRepository.save(this.toOfflineOwner(user));
    }
  }

  private toOfflineOwner(user: Usuario): OfflineDataOwner {
    const userId = this.firstText(user.id, user.documentoIdentidad, user.usuario);
    const companyId = this.firstText(user.idEmpresa);

    if (!userId || !companyId) {
      throw new Error('No se pudo identificar al propietario de los datos locales.');
    }

    return { id: 'current', userId, companyId };
  }

  private isSameOwner(current: OfflineDataOwner, next: OfflineDataOwner): boolean {
    return current.userId === next.userId && current.companyId === next.companyId;
  }

  private firstText(...values: unknown[]): string {
    for (const value of values) {
      const text = String(value ?? '').trim();
      if (text) return text;
    }

    return '';
  }

  async listActiveSessions() {
    return this.api.listSessions();
  }

  async revokeSession(sessionId: string): Promise<void> {
    await this.api.revokeSession(sessionId);
  }

  async logoutAll(): Promise<void> {
    await this.api.logoutAll();
    await this.clearExpiredSessionButKeepOfflineData();
  }

  private getStoredAuthState(): StoredAuthState | null {
    const raw = localStorage.getItem(AUTH_STATE_KEY);
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as StoredAuthState;
    } catch {
      localStorage.removeItem(AUTH_STATE_KEY);
      return null;
    }
  }

  private setStoredAuthState(state: StoredAuthState): void {
    localStorage.setItem(AUTH_STATE_KEY, JSON.stringify(state));
    this.authState.set(state);
  }

  private clearStoredAuthState(): void {
    localStorage.removeItem(AUTH_STATE_KEY);
    this.authState.set(null);
  }
}
