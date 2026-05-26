import { ADMINISTRACION_SCHEMA_V1 } from "./schema/administracion-db-schema";
import { CATELOGO_SCHEMA_V1 } from "./schema/catalogo-db-schema";
import { CATELOGO_OPERACIONALES_SCHEMA_V1 } from "./schema/catalogo-operacionales-db-schema";
import { PROCESO_SCHEMA_V1 } from "./schema/proceso-db-schema";


export const DB_SCHEMA = {
    ...CATELOGO_SCHEMA_V1,
    ...CATELOGO_OPERACIONALES_SCHEMA_V1,
    ...ADMINISTRACION_SCHEMA_V1,
    ...PROCESO_SCHEMA_V1,
};