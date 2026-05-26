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

  async getByFields(criteria: Record<string, IndexableType>): Promise<T[]> {
    const entries = Object.entries(criteria ?? {})
      .filter(([k, v]) =>
        String(k ?? '').trim().length > 0 &&
        v !== undefined &&
        v !== null
      );

    if (entries.length === 0) return [];

    if (entries.length === 1) {
      const [field, value] = entries[0];

      return await this.table
        .where(field)
        .equals(value)
        .toArray();
    }

    const fields = entries.map(([field]) => field);
    const values = entries.map(([, value]) => value);

    try {
      return await this.table
        .where(`[${fields.join('+')}]` as any)
        .equals(values as any)
        .toArray();
    } catch {
      return await this.table
        .filter((item: any) =>
          entries.every(([field, value]) => item?.[field] === value)
        )
        .toArray();
    }
  }

  async saveFordec(item: T): Promise<K>  {
    const anyItem = item as any;

    if (anyItem.id != null) {
      const existente = await this.table
        .where('id')
        .equals(anyItem.id)
        .first();

      if (existente) {
        anyItem._pk = (existente as any)._pk;
      }
    }

    return this.table.put(anyItem);
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