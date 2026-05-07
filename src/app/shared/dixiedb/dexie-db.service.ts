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
        this.version(2).stores(DB_SCHEMA);
    }

    getTable<T, K = any>(tableName: string): Table<T, K> {
        return this.table<T, K>(tableName);
    }

}
