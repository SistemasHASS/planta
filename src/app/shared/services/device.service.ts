import { Injectable } from '@angular/core';

export interface ClientDevice {
  deviceId: string;
  clientType: 'WEB';
  deviceName: string;
}

const DEVICE_ID_KEY = 'planta_device_id';

@Injectable({ providedIn: 'root' })
export class DeviceService {
  getClient(): ClientDevice {
    return {
      deviceId: this.getOrCreateDeviceId(),
      clientType: 'WEB',
      deviceName: this.getDeviceName(),
    };
  }

  private getOrCreateDeviceId(): string {
    const existing = localStorage.getItem(DEVICE_ID_KEY);
    if (existing) return existing;

    const deviceId = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
    return deviceId;
  }

  private getDeviceName(): string {
    const userAgent = navigator.userAgent;
    const browser = userAgent.includes('Edg/') ? 'Edge'
      : userAgent.includes('Firefox/') ? 'Firefox'
      : userAgent.includes('Chrome/') ? 'Chrome'
      : userAgent.includes('Safari/') ? 'Safari'
      : 'Navegador';
    const operatingSystem = userAgent.includes('Windows') ? 'Windows'
      : userAgent.includes('Android') ? 'Android'
      : userAgent.includes('iPhone') || userAgent.includes('iPad') ? 'iOS'
      : userAgent.includes('Mac OS') ? 'macOS'
      : userAgent.includes('Linux') ? 'Linux'
      : 'desconocido';
    return `${browser} en ${operatingSystem}`;
  }
}
