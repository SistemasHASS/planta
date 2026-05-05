export type CatalogoKey =
    | 'clientes'
    | 'consignatarios'
    | 'destinos'
    | 'formatos'
    | 'tiposempaque'
    | 'tiposempaqueguia'
    | 'presentaciones'
    | 'tiposcaja'
    | 'tiposclamshell'
    | 'variedades'
    | 'lugaresproduccion'
    | 'transporte'
    | 'calibres'
    | 'categorias'
    | 'conductores'
    | 'vehiculos'
    | 'transportistas'
    | 'supervisores'
    | 'personallogistica'
    | 'acopios';

export type CampoTipo =
    | 'int'
    | 'varchar'
    | 'nvarchar'
    | 'decimal'
    | 'bit'
    | 'datetime'
    | 'datetime2';

export interface CatalogoColumna {
    campo: string;
    label: string;
    tipo: CampoTipo;
    visible?: boolean;
    editable?: boolean;
    required?: boolean;
    unique?: boolean;
    maxLength?: number;
    default?: unknown;
    auto?: boolean;
    fkTabla?: string;
    fkDisplay?: string;
}

export interface CatalogoConfig {
    tabla: string;
    label: string;
    icon: string;
    columnas: CatalogoColumna[];
    displayField: string;
    codigoField: string | null;
    tieneActivo: boolean;
    noCrear?: boolean;
    fkTablas?: string[];
}