import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ConnectivityService {
  private onlineStatus = new BehaviorSubject<boolean>(navigator.onLine);

  constructor() {
    window.addEventListener('online', () => this.updateOnlineStatus(true));
    window.addEventListener('offline', () => this.updateOnlineStatus(false));
  }

  private updateOnlineStatus(status: boolean) {
    this.onlineStatus.next(status);
  }

  get isOnline() {
    return this.onlineStatus.asObservable();
  }
}
