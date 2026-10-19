/** Usuario que devuelve POST /api/auth/login: datos de apimaestra + datos de acopio (PLANTA_GetUsuarioAcopio). */
export interface Usuario {
  id?: string | null;
  idEmpresa?: string | null;
  ruc?: string | null;
  razonSocial?: string | null;
  idProyecto?: string | null;
  documentoIdentidad?: string | null;
  usuario?: string | null;
  nombre?: string | null;
  idRol?: string | null;
  rol?: string | null;
  aplicacion?: string | null;
  codigoAcopio?: string | null;
  acopioNombre?: string | null;
  serieGuia?: string | null;
}

export interface LoginResponse {
  sessionId: string;
  user: Usuario;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAtUtc: string;
  refreshTokenExpiresAtUtc: string;
  sessionExpiresAtUtc: string;
}

export interface RefreshResponse {
  sessionId: string;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAtUtc: string;
  refreshTokenExpiresAtUtc: string;
  sessionExpiresAtUtc: string;
}

export interface LocalSession extends LoginResponse {
  id: 'current';
  lastOnlineLoginAtUtc: string;
}

export interface ClientSession {
  deviceId: string;
  clientType: 'WEB' | 'ANDROID' | 'IOS' | 'DESKTOP';
  deviceName: string;
}

export interface ActiveSession {
  sessionId: string;
  username?: string | null;
  fullName?: string | null;
  clientType: string;
  deviceName?: string | null;
  ipAddress?: string | null;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
  sessionExpiresAt: string;
}
