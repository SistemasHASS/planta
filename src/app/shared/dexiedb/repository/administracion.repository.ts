import { Injectable } from "@angular/core";
import { DexieService } from "../dexie-db.service";
import { BaseRepository } from "../db-base.repository";
import { CorrelativoDocumento, MatrizCompatibilidad, ReglaSobrePeso } from "../../interfaces/administracion.interface";


@Injectable({ providedIn: 'root' })
export class AdministracionRepository {
    constructor(
        public readonly matricesCompatibilidadRepository: MatricesCompatibilidadRepository,
        public readonly reglasSobrePesoRepository: ReglasSobrePesoRepository,
        public readonly correlativosDocumentosRepository: CorrelativosDocumentosRepository
    ) { }
}


@Injectable({ providedIn: 'root' })
export class MatricesCompatibilidadRepository extends BaseRepository<MatrizCompatibilidad> {
    constructor(db: DexieService) {
        super(db, 'matricesCompatibilidad');
    }
}


@Injectable({providedIn: 'root'})
export class ReglasSobrePesoRepository extends BaseRepository<ReglaSobrePeso> {
    constructor(db: DexieService) {
        super(db, 'reglasSobrePeso');
    }
}

@Injectable({providedIn: 'root'})
export class CorrelativosDocumentosRepository extends BaseRepository<CorrelativoDocumento> {
    constructor(db: DexieService) {
        super(db, 'correlativosDocumentos');
    }
}
