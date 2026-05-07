import { Table, IndexableType, UpdateSpec } from 'dexie';
import { DexieService } from './dexie-db.service';

export abstract class BaseRepository<T, K extends IndexableType = any> {
  protected readonly table: Table<T, K>;

  protected constructor(
    protected readonly db: DexieService,
    tableName: string
  ) {
    this.table = this.db.getTable<T, K>(tableName);
  }

  getAll(): Promise<T[]> {
    return this.table.toArray();
  }

  getAllNoSincronizado(): Promise<T[]> {
    return this.table.where('bd').equals(0).toArray();
  }
  
  getByKey(key: K): Promise<T | undefined> {
    return this.table.get(key);
  }

  getByField(field: string, value: IndexableType): Promise<T | undefined> {
    return this.table.where(field).equals(value).first();
  }

  save(item: T): Promise<K> {
    return this.table.put(item);
  }

  bulkSave(items: T[]): Promise<K> {
    return this.table.bulkPut(items);
  }

  delete(key: K): Promise<void> {
    return this.table.delete(key);
  }

  clear(): Promise<void> {
    return this.table.clear();
  }

  update(key: K, changes: UpdateSpec<T>): Promise<number> {
    return this.table.update(key, changes);
  }
  
}