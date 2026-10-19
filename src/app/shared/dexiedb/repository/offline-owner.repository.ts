import { Injectable } from '@angular/core';
import { DB_TABLES } from '../db-table-names';
import { DexieService } from '../dexie-db.service';

export interface OfflineDataOwner {
  id: 'current';
  userId: string;
  companyId: string;
}

@Injectable({ providedIn: 'root' })
export class OfflineOwnerRepository {
  constructor(private readonly db: DexieService) {}

  get(): Promise<OfflineDataOwner | undefined> {
    return this.db.getTable<OfflineDataOwner, string>(DB_TABLES.offlineOwner).get('current');
  }

  save(owner: OfflineDataOwner): Promise<string> {
    return this.db.getTable<OfflineDataOwner, string>(DB_TABLES.offlineOwner).put(owner);
  }
}
