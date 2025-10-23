
export interface Usuario {
    id: string;
    sociedad: number;
    ruc: string;
    razonSocial: string;
    idProyecto: string;
    proyecto: string;
    documentoIdentidad: string;
    usuario: string;
    clave: string;
    nombre: string;
    idrol: string;
    rol: string;
}

export interface Configuracion {
    id: string
    idfundo: number
    idcultivo: number
    idacopio: number
    fechatareo: string
    idceco: string
    idlabor: string
    fechainiciorefrigerio: string
    horainiciorefrigerio: string
    fechafinrefrigerio: string
    horafinrefrigerio: string
    horainiciojornada: string
    fecha_compensa: string
    idturno: string
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

export interface Ceco{
    id : string
    costcenter: string
    localname: string
}

export interface Labor{
    id : string
    costcenterdestinationgroup: string
    costcenterdestination: string
    localname: string
}

export interface Turno {
    id: number;
    turno: number;
    codTurno: string;
    nombreTurno: string;
    modulo: number;
}

export interface Incidencia{
    idincidencia: string,
    incidencia: string,
    estado: string,
    ruc: string
}

export interface MotivoSalida{
    idmotivo: number,
    ruc: string,
    motivo: string,
    estado: number
}

export interface Trabajador {
    id: string
    ruc: string
    nrodocumento: string
    nombres: string
    apellidopaterno: string
    apellidomaterno: string
    estado: number
    motivo: string
    bloqueado: number
    eliminado: number
    idmotivo: number
    motivosalida: number
}

export interface TrabajadorPlanilla {
    nrodocumento: string
    nombre: string
    fechatareo: string
    idfundo: number
    idcultivo: number
    idacopio: number
    hora_inicio: string
    fecha_fintareo: string
    hora_fin: string
    horas: number
    fecha_iniciorefrigerio: string
    hora_iniciorefrigerio: string
    fecha_finrefrigerio: string
    hora_finrefrigerio: string
    horas_refrigerio: number
    turno: string
    motivosalida: string
    disabled: boolean
    checked: boolean
    eliminado: number
    estado: number
    cerrado: boolean
    bloqueado: number
    idmotivocierre: number
    fecha_compensa: string
    nombreTurno: string
    labores: LaborPlanilla[]
}

export interface LaborPlanilla {
    idlabor: string
    labor: string
    idceco: string
    ceco: string
    idturno: string
    tipo: number
    horas: number
}

export interface IncidenciaPersona {
    iddetalleincidencia: string,
    fecharegistro: string,
    iddocumento: string,
    serie: string,
    nrodocumento: string,
    fechainicio: string,
    fechafin: string,
    anular: number,
    usuario_aprueba: string,
    idaprobacion:  string,
    glosa:  string,
    pdf64: string,
    idincidencia:  string,
    nombrePersona:  string,
    nombreIncidencia:  string,
    aprobado: number,
    checked: false,
    estado: number
}

export interface TareoAsistencia {
    idtareo_asistencia: string;
    ruc: string;
    nrodocumentosupervisor: string;
    fecha: string;
    tipo: number;
    fundo: number;
    codfundo: string;
    cultivo: number;
    codcultivo: string;
    planilla: TrabajadorPlanilla[];
}

export interface PlanillasAdicional {
    id: string
    ruc: string
    nrodocumentosupervisor: string
    idfundo: number
    codfundo: string
    idcultivo: number
    codcultivo: string
    idacopio: number
    fechatareo: string
    hora_inicio: string
    fecha_fintareo: string
    hora_fin: string
    horas: number
    idceco: number
    ceco: string
    idlabor: number
    labor: string
    idturno: string
    estado: number
    eliminado: number
    tipo: number
    trabajadores: Trabajador[]
}

export interface PersonaFlujoAprobacion {
    id: string
    ruc: string
    usuario: string
    nrodocumento: string
    nombrePersona: string
    rol: string
    idrol: string
    movimientos: []
}

export interface BonosPersona{
    nrodocumento: string
    nombres: string
    ceco: string
    labor: string
    turno: string
    monto: number
    totalH: string
    eliminado: number
}

export interface TareoSupervisor {
    idtareo_asistencia: string,
    fundo: number,
    codfundo: string,
    cultivo: number,
    codcultivo: string,
    fecha_registrobd: string,
    ruc: string,
    nrodocumentosupervisor: string,
    tipo: number,
    fecha_tareo: string,
    eliminado: number,
    origen: string,
    planilla: TareoSupervisorDetalle[]
}

export interface TareoSupervisorDetalle {
    idtareo_asistencia: string,
    nrodocumento: string,
    fecha_registrobd: string,
    fecha_iniciotareo: string,
    hora_inicio: string,
    fecha_fintareo: string,
    hora_fin: string,
    turno: number,
    motivosalida: number,
    acopio: number,
    bloqueado: number,
    eliminado: number,
    compensa: number,
    fechahora_iniciotareo: string,
    fechahora_fintareo: string,
    labores: any[]
}