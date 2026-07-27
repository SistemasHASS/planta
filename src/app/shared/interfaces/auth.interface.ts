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
  nombreCompleto?: string;
  perfil?: 'ADMINISTRADOR' | 'LOGISTICA' | 'COORDINACION' | 'OPERACIONES' | 'MONITOR' | null;
  codigoAcopio?: string;
  acopioCodigo?: string;
  acopioNombre?: string;
  sociedad: number,
  idempresa: string,
  ruc: string,
  razonSocial: string,
  proyecto: string,
  documentoidentidad: string,
  nombre: string,
  idrol?: string,
  idRol?: string,
  rol: string,
  aplicacion: string,
  modotrabajo: number,
  fechacompensacion: string,
  serieGuia: string
}
