import Dexie, { Table } from 'dexie';
import { DB_SCHEMA } from "./db-schema";
import { Acopio, Calibre, Categoria, Cliente, Conductor, Consignatario, Destino, Formato, LugarProduccion, PersonalLogistico, Presentacion, Supervisor, TipoCaja, TipoClamshell, TipoEmpaque, TipoEmpaqueGuia, Transporte, Variedad, Vehiculo } from "../interfaces/catalogo.interface";
import { Injectable } from "@angular/core";

@Injectable({
    providedIn: 'root'
})
export class DexieService extends Dexie {

    constructor() {
        super('PlantaDB');
        this.version(1).stores(DB_SCHEMA);
        this.version(2).stores(DB_SCHEMA);
        this.version(3).stores(DB_SCHEMA);
        this.version(4).stores(DB_SCHEMA);
        this.version(5).stores(DB_SCHEMA);
        this.version(6).stores(DB_SCHEMA);
        this.version(7).stores(DB_SCHEMA);
        this.version(8).stores(DB_SCHEMA).upgrade(tx => {
            return tx.table('guiasRemision').toCollection().modify((g: any) => {
                if (g.idproyecto !== undefined) {
                    g.idProyecto = g.idproyecto;
                    delete g.idproyecto;
                }
            });
        });
        this.version(9).stores(DB_SCHEMA).upgrade(tx => {
            return tx.table('guiasRemision').toCollection().modify((g: any) => {
                if (g.sincroniza === undefined) {
                    g.sincroniza = 'sincronizado';
                }
            });
        });
        this.version(10).stores(DB_SCHEMA);
        this.version(11).stores(DB_SCHEMA);
    }

    getTable<T, K = any>(tableName: string): Table<T, K> {
        return this.table<T, K>(tableName);
    }

}
