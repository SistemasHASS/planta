export type CatalogoKey =
    | 'clientes'
    | 'consignatarios'
    | 'destinos'
    | 'formatos'
    | 'tiposEmpaque'
    | 'tiposEmpaqueGuia'
    | 'presentaciones'
    | 'tiposCaja'
    | 'tiposClamshell'
    | 'variedades'
    | 'lugaresProduccion'
    | 'transportes'
    | 'calibres'
    | 'categorias'
    | 'conductores'
    | 'vehiculos'
    | 'transportistas'
    | 'supervisores'
    | 'personalLogistica'
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
    editable?: boolean;
    noCrear?: boolean;
    fkTablas?: string[];
    dixieRepo?: string;
}
