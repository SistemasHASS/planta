export interface LoginRequest {
  usuario: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: UsuarioAuth;
}

export interface UsuarioAuth {
  id: number;
  usuario: string;
  nombreCompleto: string;
  perfil: 'ADMINISTRADOR' | 'LOGISTICA' | 'COORDINACION' | 'OPERACIONES';
  acopioId?: number;
  acopioCodigo?: string;
  acopioNombre?: string;
}
