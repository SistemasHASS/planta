import { Injectable } from '@angular/core';
import { LocalSession } from '../../interfaces/auth.interface';
import { BaseRepository } from '../db-base.repository';
import { DexieService } from '../dexie-db.service';
import { DB_TABLES } from '../db-table-names';

@Injectable({ providedIn: 'root' })
export class SessionRepository extends BaseRepository<LocalSession, string> {
  constructor(db: DexieService) {
    super(db, DB_TABLES.sessions);
  }

  saveSession(session: Omit<LocalSession, 'id'>): Promise<string> {
    return this.save({ ...session, id: 'current' });
  }

  getCurrent(): Promise<LocalSession | undefined> {
    return this.getByKey('current');
  }

  async updateTokens(tokens: Pick<LocalSession, 'sessionId' | 'accessToken' | 'refreshToken' | 'accessTokenExpiresAtUtc' | 'refreshTokenExpiresAtUtc' | 'sessionExpiresAtUtc'>): Promise<void> {
    await this.update('current', tokens);
  }

  clearSession(): Promise<void> {
    return this.clear();
  }
}
