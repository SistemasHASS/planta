
export type Modo = 'nuevo' | 'editado';

export interface MatrizCompatibilidad {
    id: number,
    clienteId: number,
    clienteNombre?: string,
    clienteCodigo?: string,
    consignatarioId: number,
    consignatarioNombre?: string,
    consignatarioCodigo?: string,
    destinoId: number,
    destinoNombre?: string,
    destinoCodigo?: string,
    formatoId: number,
    formatoNombre?: string,
    formatoCodigo?: string,
    tipoEmpaqueId: number,
    tipoEmpaqueNombre?: string,
    tipoEmpaqueGuiaId: number,
    tipoEmpaqueGuiaNombre?: string,
    calibreId: number,
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
    modo:Modo,
    bd?:number
}

export interface Usuario{
    id: number,
    usuario: string,
    idempresa: string,
    ruc: string,
    password?: string,
    nombreCompleto: string,
    perfil: string,
    acopioId?: number,
    acopioCodigo?: string | null,
    acopioNombre?: string | null,
    serieGuia?: string | null,
    activo: boolean,
    fechaCreacion: string,
    fechaModificacion?: string,
    modo:Modo,
    bd?:number
}

export interface ReglaSobrePeso{
    id: number,
    consignatarioId: number,
    formatoId: number,
    destinoId: number,
    transporteId:number,
    porcentaje: number,
    activo: boolean,
    fechaCreacion: string,
    fechaModificacion?: string,
    vigenciaDesde?: string,
    vigenciaHasta?: string,
    descripcion?: string,
    modo:Modo,
    bd?:number
}

