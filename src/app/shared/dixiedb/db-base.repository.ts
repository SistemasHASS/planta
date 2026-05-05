import { Table } from 'dexie';
import { DexieService } from './dexie-db.service';

export abstract class BaseRepository<T extends { id?: number }> {
  protected readonly table: Table<T, number>;

  protected constructor(
    protected readonly db: DexieService,
    tableName: string
  ) {
    this.table = this.db.getTable<T>(tableName);
  }

  getAll(): Promise<T[]> {
    return this.table.toArray();
  }

  getById(id: number): Promise<T | undefined> {
    return this.table.get(id);
  }

  save(item: T): Promise<number> {
    return this.table.put(item);
  }

  bulkSave(items: T[]): Promise<number> {
    return this.table.bulkPut(items);
  }

  delete(id: number): Promise<void> {
    return this.table.delete(id);
  }

  clear(): Promise<void> {
    return this.table.clear();
  }
}