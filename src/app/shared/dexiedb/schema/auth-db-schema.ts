import { DB_TABLES } from '../db-table-names';

export const AUTH_SCHEMA_V1 = {
  [DB_TABLES.sessions]: 'id,user.usuario,user.idRol,accessTokenExpiresAtUtc,refreshTokenExpiresAtUtc',
  [DB_TABLES.offlineOwner]: 'id,userId,companyId'
};
