import { Injectable } from "@angular/core";
import { Calibre, Campania, Categoria, Cliente, Consignatario, Cultivo, Destino, Formato, Fundo, LugarProduccion, Presentacion, TipoCaja, TipoClamshell, TipoEmpaque, TipoEmpaqueGuia, TipoProcesoEmpacado, Transporte, Variedad } from "../../interfaces/catalogo.interface";
import { BaseRepository } from "../db-base.repository";
import { DexieService } from "../dexie-db.service";
import { Configuracion } from "../../interfaces/administracion.interface";


@Injectable({ providedIn: 'root' })
export class CatalogosRepository {
    constructor(
        public readonly configuracionRepo: ConfiguracionRepository,
        public readonly fundoRepo: FundoRepository,
        public readonly campaniaRepo: CampaniaRepository,
        public readonly cultivoRepo: CultivoRepository,
        public readonly clientesRepo: ClienteRepository,
        public readonly consignatariosRepo: ConsignatarioRepository,
        public readonly destinosRepo: DestinoRepository,
        public readonly formatosRepo: FormatoRepository,
        public readonly calibresRepo: CalibreRepository,
        public readonly categoriasRepo: CategoriaRepository,
        public readonly tiposEmpaqueRepo: TipoEmpaqueRepository,
        public readonly tiposEmpaqueGuiaRepo: TipoEmpaqueGuiaRepository,
        public readonly presentacionesRepo: PresentacionRepository,
        public readonly tiposCajaRepo: TipoCajaRepository,
        public readonly tiposClamshellRepo: TipoClamshellRepository,
        public readonly variedadesRepo: VariedadRepository,
        public readonly lugaresProduccionRepo: LugarProduccionRepository,
        public readonly transportesRepo: TransporteRepository,
        public readonly tipoProcesoEmpacadoRepo: TipoProcesoEmpacadoRepository,
    ) { }
}

@Injectable({ providedIn: 'root' })
export class TipoProcesoEmpacadoRepository extends BaseRepository<TipoProcesoEmpacado> {
    constructor(db: DexieService) {
        super(db, 'tipoProcesoEmpacado');
    }
}

@Injectable({ providedIn: 'root' })
export class ConfiguracionRepository extends BaseRepository<Configuracion> {
    constructor(db: DexieService) {
        super(db, 'configuracion');
    }
}

@Injectable({ providedIn: 'root' })
export class FundoRepository extends BaseRepository<Fundo> {
    constructor(db: DexieService) {
        super(db, 'fundo');
    }
}
@Injectable({ providedIn: 'root' })
export class CultivoRepository extends BaseRepository<Cultivo> {
    constructor(db: DexieService) {
        super(db, 'cultivos');
    }
}

@Injectable({ providedIn: 'root' })
export class CampaniaRepository extends BaseRepository<Campania> {
    constructor(db: DexieService) {
        super(db, 'campanias');
    }
}


@Injectable({ providedIn: 'root' })
export class ClienteRepository extends BaseRepository<Cliente> {
    constructor(db: DexieService) {
        super(db, 'clientes');
    }
}

@Injectable({ providedIn: 'root' })
export class ConsignatarioRepository extends BaseRepository<Consignatario> {
    constructor(db: DexieService) {
        super(db, 'consignatarios');
    }
}

@Injectable({ providedIn: 'root' })
export class DestinoRepository extends BaseRepository<Destino> {
    constructor(db: DexieService) {
        super(db, 'destinos');
    }
}

@Injectable({ providedIn: 'root' })
export class FormatoRepository extends BaseRepository<Formato> {
    constructor(db: DexieService) {
        super(db, 'formatos');
    }
}
@Injectable({ providedIn: 'root' })
export class CalibreRepository extends BaseRepository<Calibre> {
    constructor(db: DexieService) {
        super(db, 'calibres');
    }
}

@Injectable({ providedIn: 'root' })
export class CategoriaRepository extends BaseRepository<Categoria> {
    constructor(db: DexieService) {
        super(db, 'categorias');
    }
}

@Injectable({ providedIn: 'root' })
export class TipoEmpaqueRepository extends BaseRepository<TipoEmpaque> {
    constructor(db: DexieService) {
        super(db, 'tiposEmpaque');
    }
}

@Injectable({ providedIn: 'root' })
export class TipoEmpaqueGuiaRepository extends BaseRepository<TipoEmpaqueGuia> {
    constructor(db: DexieService) {
        super(db, 'tiposEmpaqueGuia');
    }
}

@Injectable({ providedIn: 'root' })
export class PresentacionRepository extends BaseRepository<Presentacion> {
    constructor(db: DexieService) {
        super(db, 'presentaciones');
    }
}

@Injectable({ providedIn: 'root' })
export class TipoCajaRepository extends BaseRepository<TipoCaja> {
    constructor(db: DexieService) {
        super(db, 'tiposCaja');
    }
}

@Injectable({ providedIn: 'root' })
export class TipoClamshellRepository extends BaseRepository<TipoClamshell> {
    constructor(db: DexieService) {
        super(db, 'tiposClamshell');
    }
}

@Injectable({ providedIn: 'root' })
export class VariedadRepository extends BaseRepository<Variedad> {
    constructor(db: DexieService) {
        super(db, 'variedades');
    }
}

@Injectable({ providedIn: 'root' })
export class LugarProduccionRepository extends BaseRepository<LugarProduccion> {
    constructor(db: DexieService) {
        super(db, 'lugaresProduccion');
    }
}

@Injectable({ providedIn: 'root' })
export class TransporteRepository extends BaseRepository<Transporte> {
    constructor(db: DexieService) {
        super(db, 'transportes');
    }
}