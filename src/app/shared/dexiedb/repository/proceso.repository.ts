import { Injectable } from '@angular/core';
import { DexieService } from '../dexie-db.service';
import { BaseRepository } from '../db-base.repository';
import { DProcesoLogistico, DProcesoSupervisor, Proceso } from '../../interfaces/proceso.interface';
import { Palet } from '../../interfaces/palet.interface';

@Injectable({ providedIn: 'root' })
export class ProcesoRepository {
  constructor(
    public readonly procesosRepo: ProcesosRepo,
    public readonly dProcesoLogisticosRepo: DProcesoLogisticosRepo,
    public readonly dProcesoSupervisoresRepo: DProcesoSupervisoresRepo,
    public readonly paletsRepo: PaletsRepo
  ) {}
}

@Injectable({ providedIn: 'root' })
export class ProcesosRepo extends BaseRepository<Proceso> {
  constructor(db: DexieService) {
    super(db, 'procesos');
  }

  async getNoSincronizados(): Promise<Proceso[]> {
    return this.table.where('db' as any).notEqual(1 as any).toArray();
  }

  async deleteByIdProceso(idProceso: string): Promise<void> {
    const id = String(idProceso ?? '').trim();
    if (!id) return;
    const keys = await this.table.where('idProceso' as any).equals(id as any).primaryKeys();
    if (keys?.length) await this.table.bulkDelete(keys as any);
  }

  async clearSincronizadosByProyecto(idProyecto: string): Promise<string[]> {
    const proj = String(idProyecto ?? '').trim();
    if (!proj) return [];

    const rows = await this.table
      .where('db' as any)
      .equals(1 as any)
      .and((p: any) => String(p?.idProyecto ?? '').trim() === proj)
      .toArray();

    const keys = rows.map((r: any) => (r as any)?._pk).filter((k: any) => k != null);
    if (keys.length) await this.table.bulkDelete(keys as any);

    return rows.map((r: any) => String((r as any)?.idProceso ?? '').trim()).filter((x: string) => x.length > 0);
  }

  async saveByIdProceso(item: Proceso): Promise<any> {
    const anyItem = item as any;
    const idProceso = String(anyItem?.idProceso ?? '').trim();
    if (idProceso) {
      const existente = await this.table.where('idProceso' as any).equals(idProceso as any).first();
      if (existente) {
        anyItem._pk = (existente as any)._pk;
      }
    }
    return this.table.put(anyItem);
  }
}

@Injectable({ providedIn: 'root' })
export class DProcesoLogisticosRepo extends BaseRepository<DProcesoLogistico> {
  constructor(db: DexieService) {
    super(db, 'dProcesoLogisticos');
  }

  async getByIdProceso(idProceso: string): Promise<DProcesoLogistico[]> {
    const id = String(idProceso ?? '').trim();
    if (!id) return [];
    return this.table.where('idProceso' as any).equals(id as any).toArray();
  }

  async getNoSincronizadosByIdProceso(idProceso: string): Promise<DProcesoLogistico[]> {
    const rows = await this.getByIdProceso(idProceso);
    return (rows ?? []).filter((r: any) => (r as any)?.db !== 1);
  }

  async getSincronizadosByIdProceso(idProceso: string): Promise<DProcesoLogistico[]> {
    const rows = await this.getByIdProceso(idProceso);
    return (rows ?? []).filter((r: any) => (r as any)?.db !== 0);
  }

  async deleteByIdProceso(idProceso: string): Promise<void> {
    const id = String(idProceso ?? '').trim();
    if (!id) return;
    const keys = await this.table.where('idProceso' as any).equals(id as any).primaryKeys();
    if (keys?.length) await this.table.bulkDelete(keys as any);
  }

  async clearSincronizadosByIdProcesos(idProcesos: string[]): Promise<void> {
    const ids = (idProcesos ?? []).map(x => String(x ?? '').trim()).filter(x => x.length > 0);
    if (!ids.length) return;
    const keys = await this.table
      .where('idProceso' as any)
      .anyOf(ids as any)
      .and((r: any) => (r as any)?.db === 1)
      .primaryKeys();
    if (keys?.length) await this.table.bulkDelete(keys as any);
  }

  async saveByCompoundId(item: DProcesoLogistico): Promise<any> {
    const anyItem = item as any;
    if (anyItem.id != null && anyItem.idProceso != null) {
      const existente = await this.table
        .where('[id+idProceso]' as any)
        .equals([anyItem.id, anyItem.idProceso] as any)
        .first();
      if (existente) {
        anyItem._pk = (existente as any)._pk;
      }
    }
    return this.table.put(anyItem);
  }
}

@Injectable({ providedIn: 'root' })
export class DProcesoSupervisoresRepo extends BaseRepository<DProcesoSupervisor> {
  constructor(db: DexieService) {
    super(db, 'dProcesoSupervisores');
  }

  async getByIdProceso(idProceso: string): Promise<DProcesoSupervisor[]> {
    const id = String(idProceso ?? '').trim();
    if (!id) return [];
    return this.table.where('idProceso' as any).equals(id as any).toArray();
  }

  async getNoSincronizadosByIdProceso(idProceso: string): Promise<DProcesoSupervisor[]> {
    const rows = await this.getByIdProceso(idProceso);
    return (rows ?? []).filter((r: any) => (r as any)?.db !== 1);
  }

  async getSincronizadosByIdProceso(idProceso: string): Promise<DProcesoSupervisor[]> {
    const rows = await this.getByIdProceso(idProceso);
    return (rows ?? []).filter((r: any) => (r as any)?.db !== 0);
  }

  async deleteByIdProceso(idProceso: string): Promise<void> {
    const id = String(idProceso ?? '').trim();
    if (!id) return;
    const keys = await this.table.where('idProceso' as any).equals(id as any).primaryKeys();
    if (keys?.length) await this.table.bulkDelete(keys as any);
  }

  async clearSincronizadosByIdProcesos(idProcesos: string[]): Promise<void> {
    const ids = (idProcesos ?? []).map(x => String(x ?? '').trim()).filter(x => x.length > 0);
    if (!ids.length) return;
    const keys = await this.table
      .where('idProceso' as any)
      .anyOf(ids as any)
      .and((r: any) => (r as any)?.db === 1)
      .primaryKeys();
    if (keys?.length) await this.table.bulkDelete(keys as any);
  }

  async saveByCompoundId(item: DProcesoSupervisor): Promise<any> {
    const anyItem = item as any;
    if (anyItem.id != null && anyItem.idProceso != null) {
      const existente = await this.table
        .where('[id+idProceso]' as any)
        .equals([anyItem.id, anyItem.idProceso] as any)
        .first();
      if (existente) {
        anyItem._pk = (existente as any)._pk;
      }
    }
    return this.table.put(anyItem);
  }
}

@Injectable({ providedIn: 'root' })
export class PaletsRepo extends BaseRepository<Palet> {
  constructor(db: DexieService) {
    super(db, 'palet');
  }

  async getNoSincronizados(): Promise<Palet[]> {
    const rows = await this.table.toArray();
    return (rows ?? []).filter((r: any) => (r as any)?.bd === 0);
  }

  async getByIdProceso(idProceso: string): Promise<Palet[]> {
    const id = String(idProceso ?? '').trim();
    if (!id) return [];
    return this.table.where('idProceso' as any).equals(id as any).toArray();
  }

  async clearSincronizadosByIdProceso(idProceso: string): Promise<void> {
    const id = String(idProceso ?? '').trim();
    if (!id) return;
    const rows = await this.table.where('idProceso' as any).equals(id as any).toArray();
    const keys = (rows ?? [])
      .filter((r: any) => (r as any)?.bd === 1)
      .map((r: any) => (r as any)?._pk)
      .filter((k: any) => k != null);
    if (keys.length) await this.table.bulkDelete(keys as any);
  }

  async saveByIdPalet(item: Palet): Promise<any> {
    const anyItem = item as any;
    const idPalet = String(anyItem?.idPalet ?? '').trim();
    if (idPalet) {
      const existente = await this.table.where('idPalet' as any).equals(idPalet as any).first();
      if (existente) {
        anyItem._pk = (existente as any)._pk;
      }
    }
    return this.table.put(anyItem);
  }
}
