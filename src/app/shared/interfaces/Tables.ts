
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
    cliente?: string;
    destino?: string;
    formato?: string;
    modulo?: string;
    turno?: string;
    lote?: string;
    variedad?: string;
    mercado?: string;
}

export interface Empresa {
    id: string;
    idempresa: string;
    ruc: string;
    razonsocial: string;
    empresa: number;
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
    ruc: string
    linea: string
    espacios: number
    color: string
    estado: number
    tipo?: string
    codigo?: string
    idacopio?: string
    configuraciones?: Configuracion
    operariosAsignados?: Operario[]
}

export interface Operario {
    id: number
    ruc: string
    dni: string
    nombres: string
    apellidopaterno: string
    apellidomaterno: string
    nombrescompletos: string
    estado: number
}

export interface Asignacion {
    id?: number
    idasignacion: string
    ruc: string
    idlinea: number
    posicion: number
    idoperario: number
    fechaproceso: string
    idfundo?: string
    idcultivo?: string
    idacopio?: string
    cliente?: string
    destino?: string
    formato?: string
    modulo?: string
    variedad?: string
    mercado?: string
    estado: number
    sincronizado: number
    fechaasignacion?: string
    fechasincronizacion?: string
}

export interface Conteo {
    id?: number
    idconteo: string
    ruc: string
    idasignacion: string
    idoperario: number
    idlinea: number
    cantidad: number
    fechaproceso: string
    fecharegistro: string
    sincronizado: number
    fechasincronizacion?: string
}

export interface Cliente {
    id: number
    codigo: string
    nombre: string
}

export interface Destino {
    iddestino: string
    codigo: string
    nombre: string
}

export interface Formato {
    id: number
    codigo: string
    descripcion: string
}

export interface Modulo {
    id: string
    idmodulo: string
    nombremodulo: string
    idfundo: string
    idcultivo: string
}

export interface Turno {
    id: number
    codigo: string
    descripcion: string
}

export interface Lote {
    id: number
    codigo: string
    descripcion: string
}

export interface Variedad {
    id: number
    idcultivo: string
    idmodulo: string
    idvariedad: string
    variedad: string
}

export interface Mercado {
    id: number
    codigo: string
    nombre: string
}
