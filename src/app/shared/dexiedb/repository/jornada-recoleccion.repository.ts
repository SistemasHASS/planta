import { Injectable } from '@angular/core';
import { BaseRepository } from '../db-base.repository';
import { DexieService } from '../dexie-db.service';

/** Elección de formato y tipo de empaque de una línea en la recolección. */
export interface SeleccionLineaRecoleccion {
  /** usuario|idJornada|claveLinea */
  clave: string;
  usuario: string;
  idJornada: number;
  /** Llave de la línea o curo: "L12" (línea manual) o "M3-2" (máquina 3, curo 2). */
  claveLinea: string;
  formatoId: string;
  tipoEmpaqueId: string | null;
}

export const claveSeleccion = (usuario: string, idJornada: number, claveLinea: string): string => `${usuario}|${idJornada}|${claveLinea}`;

@Injectable({ providedIn: 'root' })
export class JornadaRecoleccionRepository extends BaseRepository<SeleccionLineaRecoleccion, string> {
  constructor(db: DexieService) {
    super(db, 'jornadaLineaRecoleccion');
  }

  /** Todo lo que el usuario guardó en este equipo (de cualquier jornada). */
  porUsuario(usuario: string): Promise<SeleccionLineaRecoleccion[]> {
    return this.table.where('usuario').equals(usuario).toArray();
  }

  eliminarVarios(claves: string[]): Promise<void> {
    return claves.length ? this.table.bulkDelete(claves) : Promise.resolve();
  }
}
