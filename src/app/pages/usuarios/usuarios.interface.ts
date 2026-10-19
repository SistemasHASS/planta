/** Un usuario de la aplicación con el acopio y la serie de guía que tiene asignados (tal como lo devuelve el servidor). */
export interface UsuarioAcopio {
  id: string;
  idempresa: string;
  ruc: string;
  razonSocial: string;
  documentoIdentidad: string;
  nombre: string;
  usuario: string;
  idRol: string;
  aplicacion: string;
  codigoAcopio: string;
  acopioNombre: string;
  serieGuia: string;
}
