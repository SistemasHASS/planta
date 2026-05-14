import { Injectable } from "@angular/core";
import { DexieService } from "../dexie-db.service";
import { BaseRepository } from "../db-base.repository";
import { MatrizCompatibilidad, ReglaSobrePeso, Usuario } from "../../interfaces/administracion.interface";


@Injectable({ providedIn: 'root' })
export class AdministracionRepository {
    constructor(
        public readonly matricesCompatibilidadRepository: MatricesCompatibilidadRepository,
        public readonly usuariosRepository: UsuariosRepository,
        public readonly reglasSobrePesoRepository: ReglasSobrePesoRepository
    ) { }
}


@Injectable({ providedIn: 'root' })
export class MatricesCompatibilidadRepository extends BaseRepository<MatrizCompatibilidad> {
    constructor(db: DexieService) {
        super(db, 'matricesCompatibilidad');
    }
}

@Injectable({providedIn: 'root'})
export class UsuariosRepository extends BaseRepository<Usuario> {
    constructor(db: DexieService) {
        super(db, 'usuarios');
    }
}

@Injectable({providedIn: 'root'})
export class ReglasSobrePesoRepository extends BaseRepository<ReglaSobrePeso> {
    constructor(db: DexieService) {
        super(db, 'reglasSobrePeso');
    }
}
