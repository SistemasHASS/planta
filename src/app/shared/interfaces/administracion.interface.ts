
export type Modo = 'nuevo' | 'editado';

export interface Configuracion {
    nrodocumento: string;
    idFundo: string;
    codigoCultivo: string;
    idProyecto: string;
}

export interface MatrizCompatibilidad {
    id: number,
    idProyecto: string,
    codigoCultivo: string,
    destinoId: string,
    destinoNombre?: string,
    documentoCliente: string,
    clienteNombre?: string,
    documentoConsignatario: string,
    consignatarioNombre?: string,
    formatoId: number,
    formatoNombre?: string,
    formatoCodigo?: string,
    tiposEmpaqueId: number,
    tipoEmpaqueNombre?: string,
    tipoEmpaqueGuiaId: number,
    tipoEmpaqueGuiaNombre?: string,
    calibreId: string,
    calibreNombre?: string,
    tipoCajaId: number,
    tipoCajaNombre?: string,
    tipoClamshellId: number,
    tipoClamshellNombre?: string,
    presentacionId: number,
    presentacionNombre?: string,
    categoriaId: number,
    categoriaNombre?: string,
    activo: boolean,
    fechaCreacion?: string,
    fechaModificacion?: string,
    modo: Modo,
    bd?: number
}

export interface Usuario {
    id: string,
    acopioId: number,
    acopioNombre: string,
    aplicacion: string,
    documentoIdentidad: string,
    idRol: string,
    idempresa: string,
    nombre: string,
    razonSocial: string,
    ruc: string,
    serieGuia: string,
    usuario: string,
    modo: Modo,
    bd?: number
}

export interface ReglaSobrePeso {
    id: number,
    idProyecto: string,
    codigoCultivo: string,
    documentoConsignatario: string,
    formatoId: number,
    destinoId: string,
    transporteId: string,
    porcentaje: number,
    vigenciaDesde: string,
    vigenciaHasta: string,
    descripcion: string,
    activo: boolean,
    fechaCreacion: string,
    modo: Modo,
    bd?: number
}

