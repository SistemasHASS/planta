import { Injectable } from '@angular/core';
import Dexie, { Table } from 'dexie';
import { AUTH_SCHEMA_V1, DB_SCHEMA } from './db-schema';

/** Nombre de la base IndexedDB en el navegador. */
const DB_NAME = 'PlantaApp';

/** Tablas de las primeras versiones de desarrollo (esquema simplificado). La version 5 las elimina para crear las definitivas. */
const TABLAS_PRELIMINARES = {
  fundos: 'id,codigoFundo',
  cultivos: 'id,codigo',
  campanias: 'idproyecto,idfundo,codcultivo',
  configuracion: 'nrodocumento',
  catalogos: 'clave',
  procesos: 'idProceso,idProyecto,estado,db',
  dProcesoLogisticos: '[idProceso+idLogistico],idProceso,db',
  dProcesoSupervisores: '[idProceso+idSupervisor],idProceso,db',
  palets: 'idPalet,idProceso,estado,bd',
  dpalets: 'idDPalet,idPalet,bd',
};
const ELIMINAR_PRELIMINARES = Object.fromEntries(Object.keys(TABLAS_PRELIMINARES).map((t) => [t, null]));

@Injectable({ providedIn: 'root' })
export class DexieService extends Dexie {
  constructor() {
    super(DB_NAME);

    // Version 1 = autenticacion. Cuando se agregue una tabla o un indice: subir el numero y, si hay datos
    // que migrar, encadenar .upgrade(async (tx) => { ... }). Nunca editar una version ya publicada.
    this.version(1).stores(AUTH_SCHEMA_V1);
    this.version(2).stores({ ...AUTH_SCHEMA_V1, fundos: TABLAS_PRELIMINARES.fundos, cultivos: TABLAS_PRELIMINARES.cultivos, campanias: TABLAS_PRELIMINARES.campanias, configuracion: TABLAS_PRELIMINARES.configuracion });
    this.version(3).stores({ ...AUTH_SCHEMA_V1, fundos: TABLAS_PRELIMINARES.fundos, cultivos: TABLAS_PRELIMINARES.cultivos, campanias: TABLAS_PRELIMINARES.campanias, configuracion: TABLAS_PRELIMINARES.configuracion, catalogos: TABLAS_PRELIMINARES.catalogos });
    this.version(4).stores({ ...AUTH_SCHEMA_V1, ...TABLAS_PRELIMINARES });
    // Version 5 = se eliminan las tablas preliminares (cambian de llave primaria).
    this.version(5).stores({ ...AUTH_SCHEMA_V1, ...ELIMINAR_PRELIMINARES });
    // Version 6 = esquema definitivo: mismas tablas que la aplicacion anterior.
    this.version(6).stores(DB_SCHEMA);
  }

  getTable<T, K = any>(tableName: string): Table<T, K> {
    return this.table<T, K>(tableName);
  }

  async deleteDatabase(): Promise<void> {
    if (this.isOpen()) {
      this.close();
    }

    await Dexie.delete(this.name);
  }
}
