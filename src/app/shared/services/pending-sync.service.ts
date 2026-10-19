import { Injectable, inject } from '@angular/core';
import { DexieService } from '../dexiedb/dexie-db.service';

export interface PendingSyncSummaryItem {
  label: string;
  count: number;
}

export interface PendingSyncSummary {
  items: PendingSyncSummaryItem[];
  total: number;
}

type PendingGroup = {
  label: string;
  tables: string[];
};

/**
 * Tablas con datos creados offline (bd = 0) que aun no se suben a la API.
 * Al cerrar sesion se avisa al usuario si hay pendientes. Un modulo con sincronizacion
 * agrega aqui una linea (e importa DB_TABLES): { label: 'Productos', tables: [DB_TABLES.productos] }.
 * Los catalogos de solo lectura (fundos, cultivos...) no van aqui.
 */
const PENDING_GROUPS: PendingGroup[] = [
  // { label: 'Mi modulo', tables: [DB_TABLES.miModulo] },
];

@Injectable({ providedIn: 'root' })
export class PendingSyncService {
  private readonly db = inject(DexieService);

  async getSummary(): Promise<PendingSyncSummary> {
    if (PENDING_GROUPS.length === 0) {
      return { items: [], total: 0 };
    }

    if (!this.db.isOpen()) {
      await this.db.open();
    }

    const items = await Promise.all(
      PENDING_GROUPS.map(async (group) => ({
        label: group.label,
        count: (await Promise.all(group.tables.map((table) => this.countPending(table))))
          .reduce((total, count) => total + count, 0),
      })),
    );

    const pendingItems = items.filter((item) => item.count > 0);
    return {
      items: pendingItems,
      total: pendingItems.reduce((total, item) => total + item.count, 0),
    };
  }

  private countPending(tableName: string): Promise<number> {
    return this.db.getTable<{ bd?: number }>(tableName).where('bd').equals(0).count();
  }
}
