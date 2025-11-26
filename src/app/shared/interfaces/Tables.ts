
export interface Usuario {
    id: string;
    documentoidentidad: string;
    idproyecto: string;
    idrol: string;
    nombre: string;
    proyecto: string;
    razonSocial: string;
    rol: string;
    ruc: string;
    sociedad: number;
    usuario: string;
    idempresa: string;
}

export interface Configuracion {
    id: string;
    idempresa: string;
    fechaproceso: string;
    idfundo: string;
    idcultivo: string;
    horario: string;
    idacopio: string;
}

export interface Fundo {
    id: number;
    fundo: number;
    empresa: number;
    codigoFundo: string;
    nombreFundo: string
}

export interface Cultivo {
    id: number;
    empresa: number;
    codigo: string;
    descripcion: string;
}

export interface Acopio{
    id : string
    nave: string
    codigoAcopio: string
    acopio: string
}

export interface Linea {
    id: number
    codigo: string
    ruc: string
    descripcion: string
    ubicaciones: number
    color: string
    estado: string
    eliminado: number
}
