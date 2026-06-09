import { Injectable } from '@angular/core';
import { BaseRepository } from '../db-base.repository';
import { DexieService } from '../dexie-db.service';

@Injectable({ providedIn: 'root' })
export class GuiasRemisionRepository {
  constructor(
    public readonly guiasRepo: GuiaRemisionRepo,
    public readonly paletsRepo: GuiaRemisionPaletsRepo,
  ) {}
}

@Injectable({ providedIn: 'root' })
export class GuiaRemisionRepo extends BaseRepository<any> {
  constructor(db: DexieService) {
    super(db, 'guiasRemision');
  }

  async getByIdProyecto(idProyecto: string): Promise<any[]> {
    const id = String(idProyecto ?? '').trim();
    if (!id) return [];
    return this.table.where('idProyecto' as any).equals(id as any).toArray();
  }

  async getByCodigoGuiaRemision(codigo: string): Promise<any | undefined> {
    const c = String(codigo ?? '').trim();
    if (!c) return undefined;
    return this.table.where('codigoGuiaRemision' as any).equals(c as any).first();
  }

  async saveByCodigoGuiaRemision(item: any): Promise<any> {
    const codigo = String(item?.codigoGuiaRemision ?? '').trim();
    if (codigo) {
      const existente = await this.table.where('codigoGuiaRemision' as any).equals(codigo as any).first();
      if (existente) {
        item._pk = (existente as any)._pk;
      }
    }
    return this.table.put(item);
  }

  async clearByIdProyecto(idProyecto: string): Promise<void> {
    const id = String(idProyecto ?? '').trim();
    if (!id) return;
    const keys = await this.table.where('idProyecto' as any).equals(id as any).primaryKeys();
    if (keys?.length) await this.table.bulkDelete(keys as any);
  }

  async clearSyncByIdProyecto(idProyecto: string): Promise<void> {
    const id = String(idProyecto ?? '').trim();
    if (!id) return;
    const todas = await this.table.where('idProyecto' as any).equals(id as any).toArray();
    const keysSync = (todas ?? [])
      .filter((g: any) => {
        const bd = g?.bd;
        return bd === 1 || String(bd ?? '').trim() === '1';
      })
      .map((g: any) => g?._pk)
      .filter(Boolean);
    if (keysSync?.length) await this.table.bulkDelete(keysSync as any);
  }

  async bulkDelete(keys: any[]): Promise<void> {
    if (keys?.length) await this.table.bulkDelete(keys as any);
  }
}

@Injectable({ providedIn: 'root' })
export class GuiaRemisionPaletsRepo extends BaseRepository<any> {
  constructor(db: DexieService) {
    super(db, 'guiasRemisionPalets');
  }

  async getByCodigoGuiaRemision(codigo: string): Promise<any[]> {
    const c = String(codigo ?? '').trim();
    if (!c) return [];
    return this.table.where('codigoGuiaRemision' as any).equals(c as any).toArray();
  }

  async clearByCodigoGuiaRemision(codigo: string): Promise<void> {
    const c = String(codigo ?? '').trim();
    if (!c) return;
    const keys = await this.table.where('codigoGuiaRemision' as any).equals(c as any).primaryKeys();
    if (keys?.length) await this.table.bulkDelete(keys as any);
  }

  async saveByCodigoGuiaRemision(item: any): Promise<any> {
    const codigo = String(item?.codigoGuiaRemision ?? '').trim();
    const codigoPalet = String(item?.codigoPalet ?? '').trim();
    if (codigo && codigoPalet) {
      const existente = await this.table
        .where('codigoGuiaRemision' as any)
        .equals(codigo as any)
        .and((r: any) => String(r?.codigoPalet ?? '').trim() === codigoPalet)
        .first();
      if (existente) {
        item._pk = (existente as any)._pk;
      }
    }
    return this.table.put(item);
  }
}
