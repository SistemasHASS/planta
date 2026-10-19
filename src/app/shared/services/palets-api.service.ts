import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SobreSp } from './catalogos-api.service';

type Fila = Record<string, any>;

/** Cuerpo comun de las consultas de la matriz de compatibilidad. */
export interface ConsultaMatriz {
  codigoCultivo: string;
  documentoConsignatario: string;
  destinoId: string;
  formatoId?: number;
  tipoEmpaqueGuiaId?: number;
  presentacionId?: number;
  tipoCajaId?: number;
}

/**
 * Palets, sus detalles y la matriz de compatibilidad (API: POST api/palets/...).
 * Empresa, RUC, usuario, rol y acopio salen del token. Devuelven el sobre del SP { error, data, mensaje } sin tocarlo.
 */
@Injectable({ providedIn: 'root' })
export class PaletsApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/api/palets`;

  porProceso(idProceso: string): Promise<SobreSp<Fila[]>> {
    return this.post('por-proceso', { idProceso });
  }

  /** Crea, edita o cierra palets. `palets` es un palet o una lista; el SP lee el JSON tal cual. */
  sincronizar(palets: unknown): Promise<SobreSp<Fila[]>> {
    return this.post('sincronizar', { palets: JSON.stringify(palets) });
  }

  sincronizarDPalets(dPalets: unknown[]): Promise<SobreSp<Fila[]>> {
    return this.post('sincronizar-dpalets', { dPalets: JSON.stringify(dPalets) });
  }

  dPaletsPorAcopio(): Promise<SobreSp<Fila[]>> {
    return this.post('dpalets-por-acopio', {});
  }

  dPaletsPorPalet(idPalet: string): Promise<SobreSp<Fila[]>> {
    return this.post('dpalets-por-palet', { idPalet });
  }

  codigosRanchoPorLugar(idProyecto: string, idLugaresDeProduccion: number): Promise<SobreSp<Fila[]>> {
    return this.post('codigos-rancho-por-lugar', { idProyecto, idLugaresDeProduccion });
  }

  /** PDF con la composicion del palet. */
  fichaComposicion(idPalet: string): Promise<Blob> {
    return firstValueFrom(this.http.post(`${this.baseUrl}/ficha-composicion`, { idPalet }, { responseType: 'blob' }));
  }

  // ───────── Matriz de compatibilidad ─────────

  destinosPorMatriz(idProyecto: string, documentoConsignatario: string): Promise<SobreSp<Fila[]>> {
    return this.post('matriz/destinos', { idProyecto, documentoConsignatario });
  }

  formatosPorMatriz(c: ConsultaMatriz): Promise<SobreSp<Fila[]>> {
    return this.post('matriz/formatos', c);
  }

  tiposEmpaqueGuiaPorMatriz(c: ConsultaMatriz): Promise<SobreSp<Fila[]>> {
    return this.post('matriz/tipos-empaque-guia', c);
  }

  presentacionesPorMatriz(c: ConsultaMatriz): Promise<SobreSp<Fila[]>> {
    return this.post('matriz/presentaciones', c);
  }

  tiposCajaPorMatriz(c: ConsultaMatriz): Promise<SobreSp<Fila[]>> {
    return this.post('matriz/tipos-caja', c);
  }

  tiposClamshellPorMatriz(c: ConsultaMatriz): Promise<SobreSp<Fila[]>> {
    return this.post('matriz/tipos-clamshell', c);
  }

  private post(ruta: string, cuerpo: object): Promise<SobreSp<Fila[]>> {
    return firstValueFrom(this.http.post<SobreSp<Fila[]>>(`${this.baseUrl}/${ruta}`, cuerpo));
  }
}
