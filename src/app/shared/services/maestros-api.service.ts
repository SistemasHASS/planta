import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Campania, Cultivo, Fundo } from '../interfaces/catalogo.interface';

/** Pais, calibre y transporte de apimaestra. */
export type Maestro = Record<string, unknown>;

/** Catalogos de apimaestra (puente de la API propia). La empresa y el RUC salen del token, no se envian. */
@Injectable({ providedIn: 'root' })
export class MaestrosApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/api/maestros`;

  fundos(): Promise<Fundo[]> {
    return this.consultar<Fundo>('fundos');
  }

  cultivos(): Promise<Cultivo[]> {
    return this.consultar<Cultivo>('cultivos');
  }

  campanias(): Promise<Campania[]> {
    return this.consultar<Campania>('campanias');
  }

  paises(): Promise<Maestro[]> {
    return this.consultar<Maestro>('paises');
  }

  calibres(): Promise<Maestro[]> {
    return this.consultar<Maestro>('calibres');
  }

  transporte(): Promise<Maestro[]> {
    return this.consultar<Maestro>('transporte');
  }

  /** Para sumar un catalogo: un metodo como los de arriba (la API tambien tiene acopios, variedades, clientes y tipos-clamshell de apimaestra). */
  private async consultar<T>(recurso: string): Promise<T[]> {
    const resp = await firstValueFrom(this.http.post<T[] | { data?: T[] }>(`${this.baseUrl}/${recurso}`, {}));
    const lista = Array.isArray(resp) ? resp : resp?.data;
    return Array.isArray(lista) ? lista : [];
  }
}
