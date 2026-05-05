import { Injectable } from "@angular/core";
import { Acopio, Conductor, PersonalLogistico, Supervisor, Transportista, Vehiculo } from "../../interfaces/catalogo.interface";
import { BaseRepository } from "../db-base.repository";
import { DexieService } from "../dexie-db.service";

@Injectable({ providedIn: 'root' })
export class CatalogosOperacionalesRepository {
    constructor(
        public readonly conductoresRepo: ConductorRepository,
        public readonly vehiculosRepo: VehiculoRepository,
        public readonly transportistasRepo: TransportistaRepository,
        public readonly supervisoresRepo: SupervisorRepository,
        public readonly personalLogisticoRepo: PersonalLogisticoRepository,
        public readonly acopiosRepo: AcopioRepository,
    ) { }
}


@Injectable({ providedIn: 'root' })
export class ConductorRepository extends BaseRepository<Conductor> {
    constructor(db: DexieService) {
        super(db, 'conductores');
    }
}

@Injectable({ providedIn: 'root' })
export class VehiculoRepository extends BaseRepository<Vehiculo> {
    constructor(db: DexieService) {
        super(db, 'vehiculos');
    }
}
@Injectable({ providedIn: 'root' })
export class TransportistaRepository extends BaseRepository<Transportista> {
    constructor(db: DexieService) {
        super(db, 'transportistas');
    }
}
@Injectable({ providedIn: 'root' })
export class SupervisorRepository extends BaseRepository<Supervisor> {
    constructor(db: DexieService) {
        super(db, 'supervisores');
    }
}
@Injectable({ providedIn: 'root' })
export class PersonalLogisticoRepository extends BaseRepository<PersonalLogistico> {
    constructor(db: DexieService) {
        super(db, 'personalesLogistico');
    }
}
@Injectable({ providedIn: 'root' })
export class AcopioRepository extends BaseRepository<Acopio> {
    constructor(db: DexieService) {
        super(db, 'acopios');
    }
}
