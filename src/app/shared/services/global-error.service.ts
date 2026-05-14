import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class GlobalErrorService {
  private readonly _forbidden$ = new Subject<string>();
  readonly forbidden$ = this._forbidden$.asObservable();

  emitForbidden(message: string): void {
    this._forbidden$.next(message);
  }
}
