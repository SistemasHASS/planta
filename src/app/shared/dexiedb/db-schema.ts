import { ADMINISTRACION_SCHEMA_V1 } from './schema/administracion-db-schema';
import { AUTH_SCHEMA_V1 } from './schema/auth-db-schema';
import { CATELOGO_SCHEMA_V1 } from './schema/catalogo-db-schema';
import { CATELOGO_OPERACIONALES_SCHEMA_V1 } from './schema/catalogo-operacionales-db-schema';
import { PROCESO_SCHEMA_V1 } from './schema/proceso-db-schema';

/** Esquema completo de la base local (mismas tablas e indices que la aplicacion anterior, mas las de autenticacion). */
export const DB_SCHEMA = {
  ...AUTH_SCHEMA_V1,
  ...CATELOGO_SCHEMA_V1,
  ...CATELOGO_OPERACIONALES_SCHEMA_V1,
  ...ADMINISTRACION_SCHEMA_V1,
  ...PROCESO_SCHEMA_V1,
};

export { AUTH_SCHEMA_V1 };
