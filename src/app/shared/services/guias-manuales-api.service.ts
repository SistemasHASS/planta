import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SobreSp } from './catalogos-api.service';
import { FiltrosGuias } from './guias-api.service';

type Fila = Record<string, any>;

/**
 * Guias de remision manuales, sin palets (API: POST api/guias-manuales/...). Empresa, RUC, usuario, rol y acopio salen del token.
 * Devuelven el sobre del SP { error, data, mensaje } sin tocarlo: cada pantalla decide que hacer con el error.
 */
@Injectable({ providedIn: 'root' })
export class GuiasManualesApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/api/guias-manuales`;

  /** Crea la guia manual. `guias` es una guia o una lista; el SP lee el JSON tal cual. */
  sincronizar(idProyecto: string, guias: unknown): Promise<SobreSp<Fila[]>> {
    return this.post('sincronizar', { idProyecto, guias: JSON.stringify(guias) });
  }

  listar(filtros: FiltrosGuias): Promise<SobreSp<Fila[]>> {
    return this.post('listar', this.sinVacios(filtros));
  }

  /** Excel con las guias manuales filtradas (solo administrador y monitor). */
  exportarExcel(filtros: FiltrosGuias): Promise<Blob> {
    return firstValueFrom(this.http.post(`${this.baseUrl}/exportar-excel`, this.sinVacios(filtros), { responseType: 'blob' }));
  }

  obtener(idProyecto: string, codigoGuiaRemision: string): Promise<SobreSp<Fila[]>> {
    return this.post('obtener', { idProyecto, codigoGuiaRemision });
  }

  /** Edita la guia manual. `guias` es el JSON de la guia que lee el SP. */
  editar(idProyecto: string, guias: unknown): Promise<SobreSp<Fila[]>> {
    return this.post('editar', { idProyecto, guias: JSON.stringify(guias) });
  }

  eliminar(idProyecto: string, codigoGuiaRemision: string): Promise<SobreSp<Fila[]>> {
    return this.post('eliminar', { idProyecto, codigoGuiaRemision });
  }

  /** Cierra la guia y la envia a SUNAT. */
  emitir(idProyecto: string, codigoGuiaRemision: string): Promise<SobreSp> {
    return this.post('emitir', { idProyecto, codigoGuiaRemision });
  }

  /** Reenvia a SUNAT una guia CERRADA que aun no fue enviada. */
  reenviar(idProyecto: string, codigoGuiaRemision: string): Promise<SobreSp> {
    return this.post('reenviar', { idProyecto, codigoGuiaRemision });
  }

  consultarEstadoSunat(idProyecto: string, codigoGuiaRemision: string): Promise<SobreSp> {
    return this.post('consultar-estado-sunat', { idProyecto, codigoGuiaRemision });
  }

  anular(idProyecto: string, codigoGuiaRemision: string, codigoAcopio: string): Promise<SobreSp<Fila[]>> {
    return this.post('anular', { idProyecto, codigoGuiaRemision, codigoAcopio });
  }

  /** Los filtros vacios no se envian (el SP los toma como "sin filtro"). */
  private sinVacios(filtros: FiltrosGuias): Record<string, unknown> {
    return Object.fromEntries(Object.entries(filtros).filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== ''));
  }

  private post<T = Fila[]>(ruta: string, cuerpo: Record<string, unknown>): Promise<SobreSp<T>> {
    return firstValueFrom(this.http.post<SobreSp<T>>(`${this.baseUrl}/${ruta}`, cuerpo));
  }
}
