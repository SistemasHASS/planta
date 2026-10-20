import { HttpErrorResponse } from "@angular/common/http";
import { Injectable, computed, inject, signal } from "@angular/core";
import { Router } from "@angular/router";
import { LocalSession, Usuario } from "../interfaces/auth.interface";
import { SessionRepository } from "../dexiedb/repository/session.repository";
import { OfflineDataOwner, OfflineOwnerRepository } from "../dexiedb/repository/offline-owner.repository";
import { DexieService } from "../dexiedb/dexie-db.service";
import { AuthApiService } from "./auth-api.service";
import { ConnectivityService } from "./connectivity.service";
import { DeviceService } from "./device.service";
import { SessionExpiredModalService } from "./session-expired-modal.service";
import { FeedbackModalService } from "./feedback-modal.service";

interface StoredAuthState {
  user: Usuario;
  lastOnlineLoginAtUtc: string;
}

const AUTH_STATE_KEY = "planta_auth_state";

/** Canal para avisar a las demas pestanas de la misma app (login, cierre de sesion, vencimiento). */
const CANAL_AUTH = "planta-auth";
/** Candado entre pestanas: solo una renueva el refresh token a la vez. */
const LOCK_REFRESH = "planta-refresh-token";

interface MensajeAuth {
  tipo: "login" | "logout" | "expirada";
}

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
  private readonly feedback = inject(FeedbackModalService);
  private readonly router = inject(Router);

  private readonly authState = signal<StoredAuthState | null>(
    this.getStoredAuthState(),
  );
  private readonly canal: BroadcastChannel | null =
    typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(CANAL_AUTH) : null;
  private refreshInFlight: Promise<string> | null = null;
  private sessionExpiryTimer: ReturnType<typeof setTimeout> | null = null;
  private vencimientoProgramado: string | null = null;
  private propietarioVerificado = false;
  private cierrePorPerdidaEnCurso: Promise<void> | null = null;

  constructor() {
    if (this.canal) {
      this.canal.onmessage = (event: MessageEvent<MensajeAuth>) => void this.alRecibirMensaje(event.data);
    }
  }

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
      this.clearStoredAuthState();
      await this.deleteLocalDatabase();
      await this.dexie.open();
    }

    await this.offlineOwnerRepository.save(owner);
    onProgress?.("Guardando sesion local...");
    await this.sessionRepository.saveSession(session);

    onProgress?.("Preparando acceso...");
    this.propietarioVerificado = true;
    this.scheduleSessionExpiration(session);
    this.requiresOnlineLogin.set(false);
    this.setStoredAuthState({
      user: session.user,
      lastOnlineLoginAtUtc: session.lastOnlineLoginAtUtc,
    });
    this.avisar({ tipo: "login" });

    return session;
  }

  /**
   * Lee la sesion SIEMPRE desde Dexie (no se guarda copia en memoria): asi lo que ve cada pestana es lo que hay
   * guardado. localStorage se comparte entre pestanas al instante; si otra pestana cerro sesion ya no hay estado
   * y ni siquiera se abre Dexie (evita recrear una base vacia).
   */
  async getSession(): Promise<LocalSession | undefined> {
    const stored = this.getStoredAuthState();
    if (!stored) {
      this.authState.set(null);
      this.cancelSessionExpiration();
      return undefined;
    }

    const session = await this.leerSesionLocal();
    if (!session) {
      // Hay sesion en localStorage pero la fila ya no existe en Dexie (se borro a mano): se cierra todo, como un logout.
      await this.cerrarPorSesionLocalPerdida();
      return undefined;
    }

    if (!this.authState()) {
      this.authState.set(stored);
    }
    if (!this.propietarioVerificado) {
      await this.ensureOfflineOwner(session.user);
      this.propietarioVerificado = true;
    }
    this.scheduleSessionExpiration(session);
    return session;
  }

  private async leerSesionLocal(): Promise<LocalSession | undefined> {
    if (!this.dexie.isOpen()) {
      await this.dexie.open();
    }
    return this.sessionRepository.getCurrent();
  }

  canUseApp(): boolean {
    return this.isLoggedIn();
  }

  async ensureAccessTokenForOnlineRequest(): Promise<string | null> {
    const session = await this.getSession();
    if (!session) {
      throw new SessionExpiredError();
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
      throw new SessionExpiredError();
    }

    if (this.isSessionExpired(session)) {
      await this.expireOnlineSession();
      throw new SessionExpiredError();
    }

    return this.refreshAccessToken(session, true);
  }

  private async refreshAccessToken(session: LocalSession, forzar = false): Promise<string> {
    if (this.refreshInFlight) {
      return this.refreshInFlight;
    }

    this.refreshInFlight = this.conCandadoDeRefresh(() => this.renovarTokens(session, forzar))
      .catch(async (error: unknown) => {
        if (error instanceof SessionExpiredError) {
          throw error;
        }
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

  /** Solo una pestana a la vez renueva el refresh token (el anterior se invalida al rotar). */
  private async conCandadoDeRefresh<T>(tarea: () => Promise<T>): Promise<T> {
    const locks = (navigator as Navigator & { locks?: LockManager }).locks;
    if (!locks) {
      return tarea();
    }
    return (await locks.request(LOCK_REFRESH, tarea)) as T;
  }

  private async renovarTokens(sesionUsada: LocalSession, forzar: boolean): Promise<string> {
    // Se vuelve a leer Dexie: mientras esperabamos el turno otra pestana pudo renovar o cerrar sesion.
    const actual = this.getStoredAuthState() ? await this.leerSesionLocal() : undefined;
    if (!actual) {
      throw new SessionExpiredError();
    }

    const otraPestanaRenovo = actual.refreshToken !== sesionUsada.refreshToken;
    const accessVigente = new Date(actual.accessTokenExpiresAtUtc).getTime() > Date.now();
    if (accessVigente && (otraPestanaRenovo || !forzar)) {
      return actual.accessToken;
    }

    const renewed = await this.api.refresh(actual.refreshToken, this.device.getClient());
    await this.sessionRepository.updateTokens(renewed);
    this.scheduleSessionExpiration({ ...actual, ...renewed });
    this.requiresOnlineLogin.set(false);
    return renewed.accessToken;
  }

  async logoutManual(): Promise<void> {
    const session = await this.getSession().catch(() => undefined);
    if (session && this.connectivity.isOnline()) {
      await this.api.logout(session.refreshToken).catch(() => undefined);
    }

    // Primero se quita el estado (localStorage): si una lectura llega mientras tanto, ve "sin sesion" y no "sesion perdida".
    this.cancelSessionExpiration();
    this.refreshInFlight = null;
    this.propietarioVerificado = false;
    this.requiresOnlineLogin.set(false);
    this.clearStoredAuthState();
    if (this.dexie.isOpen()) {
      await this.sessionRepository.clearSession().catch(() => undefined);
    }
    // Las demas pestanas cierran su conexion a Dexie y van al login antes de que se borre la base.
    this.avisar({ tipo: "logout" });
  }

  async deleteLocalDatabase(): Promise<void> {
    await this.dexie.deleteDatabase();
  }

  async clearExpiredSessionButKeepOfflineData(aviso: MensajeAuth["tipo"] = "expirada"): Promise<void> {
    this.cancelSessionExpiration();
    this.propietarioVerificado = false;
    this.clearStoredAuthState();
    if (this.dexie.isOpen()) {
      await this.sessionRepository.clearSession().catch(() => undefined);
    }
    this.avisar({ tipo: aviso });
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
    // Mismo vencimiento ya programado: no se reprograma en cada lectura de la sesion.
    if (this.vencimientoProgramado === session.sessionExpiresAtUtc) {
      return;
    }

    this.cancelSessionExpiration();
    this.vencimientoProgramado = session.sessionExpiresAtUtc;

    const delay = new Date(session.sessionExpiresAtUtc).getTime() - Date.now();
    if (!Number.isFinite(delay) || delay <= 0) {
      void this.expireSessionIfExpired();
      return;
    }

    this.sessionExpiryTimer = setTimeout(() => {
      this.sessionExpiryTimer = null;
      void this.expireSessionIfExpired();
    }, delay);
  }

  private async expireSessionIfExpired(): Promise<void> {
    if (!this.getStoredAuthState()) {
      return;
    }

    const session = await this.leerSesionLocal().catch(() => undefined);
    if (!session || !this.isSessionExpired(session)) {
      return;
    }

    await this.expireOnlineSession();
  }

  private cancelSessionExpiration(): void {
    this.vencimientoProgramado = null;
    if (this.sessionExpiryTimer !== null) {
      clearTimeout(this.sessionExpiryTimer);
      this.sessionExpiryTimer = null;
    }
  }

  /**
   * La fila de sesion desaparecio de Dexie mientras el estado seguia activo (alguien la borro a mano).
   * Se hace lo mismo que al cerrar sesion: avisar a las otras pestanas, borrar TODO Dexie e ir al login.
   * Varias lecturas a la vez comparten un solo cierre.
   */
  private cerrarPorSesionLocalPerdida(): Promise<void> {
    if (!this.cierrePorPerdidaEnCurso) {
      this.cierrePorPerdidaEnCurso = this.ejecutarCierrePorPerdida().finally(() => {
        this.cierrePorPerdidaEnCurso = null;
      });
    }
    return this.cierrePorPerdidaEnCurso;
  }

  private async ejecutarCierrePorPerdida(): Promise<void> {
    this.cancelSessionExpiration();
    this.refreshInFlight = null;
    this.propietarioVerificado = false;
    this.requiresOnlineLogin.set(false);
    this.clearStoredAuthState();
    this.avisar({ tipo: "logout" });
    await this.deleteLocalDatabase();
    void this.router.navigateByUrl("/login");
  }

  // ---- Sincronizacion entre pestanas (BroadcastChannel) ----

  private avisar(mensaje: MensajeAuth): void {
    try {
      this.canal?.postMessage(mensaje);
    } catch {
      // Sin canal: cada pestana igual se entera en su siguiente lectura de la sesion (localStorage + Dexie).
    }
  }

  private async alRecibirMensaje(mensaje: MensajeAuth): Promise<void> {
    switch (mensaje?.tipo) {
      case "logout":
        return this.alCerrarseSesionEnOtraPestana();
      case "expirada":
        return this.alVencerSesionEnOtraPestana();
      case "login":
        return this.alIniciarSesionEnOtraPestana();
    }
  }

  /** Otra pestana cerro sesion: se suelta la conexion a Dexie (esa pestana borrara la base) y se va al login. */
  private async alCerrarseSesionEnOtraPestana(): Promise<void> {
    if (!this.authState()) {
      return;
    }

    this.cancelSessionExpiration();
    this.refreshInFlight = null;
    this.propietarioVerificado = false;
    this.authState.set(null);
    this.requiresOnlineLogin.set(false);
    if (this.dexie.isOpen()) {
      this.dexie.close();
    }

    this.feedback.warning("Cerraste sesión en otra pestaña.", "Sesión cerrada");
    await this.router.navigateByUrl("/login");
  }

  /** La sesion vencio en otra pestana (Dexie se conserva): aqui tambien se muestra el aviso de sesion vencida. */
  private async alVencerSesionEnOtraPestana(): Promise<void> {
    if (!this.authState()) {
      return;
    }

    this.cancelSessionExpiration();
    this.refreshInFlight = null;
    this.propietarioVerificado = false;
    this.authState.set(null);
    this.requiresOnlineLogin.set(true);
    this.sessionExpiredModal.show();
  }

  /** Otra pestana inicio sesion. Si es otro usuario, esta pestana se recarga para no mezclar datos. */
  private async alIniciarSesionEnOtraPestana(): Promise<void> {
    const anterior = this.authState();
    const nuevo = this.getStoredAuthState();
    this.authState.set(nuevo);

    if (anterior && nuevo && anterior.user.usuario !== nuevo.user.usuario) {
      location.reload();
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
    await this.clearExpiredSessionButKeepOfflineData("logout");
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
