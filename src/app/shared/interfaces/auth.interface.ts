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
  sociedad: number,
  idempresa: string,
  ruc: string,
  razonSocial: string,
  proyecto: string,
  documentoidentidad: string,
  nombre: string,
  idrol: string,
  rol: string,
  aplicacion: string,
  modotrabajo: number,
  fechacompensacion: string,
  serieGuia: string
}
