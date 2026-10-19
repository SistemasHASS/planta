import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SobreSp } from './catalogos-api.service';

type Fila = Record<string, any>;

/** Filtros del listado y del Excel de guias (todos opcionales salvo el proyecto). */
export interface FiltrosGuias {
  idProyecto: string;
  estado?: string | null;
  fechaDesde?: string | null;
  fechaHasta?: string | null;
  texto?: string | null;
  codigoCultivo?: string | null;
}

/**
 * Guias de remision con palets (API: POST api/guias/...). Empresa, RUC, usuario, rol y acopio salen del token.
 * Devuelven el sobre del SP { error, data, mensaje } sin tocarlo: cada pantalla decide que hacer con el error.
 */
@Injectable({ providedIn: 'root' })
export class GuiasApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/api/guias`;

  /** Crea guias con sus palets. `guias` es una guia o una lista; el SP lee el JSON tal cual. */
  sincronizar(idProyecto: string, guias: unknown): Promise<SobreSp<Fila[]>> {
    return this.post('sincronizar', { idProyecto, guias: JSON.stringify(guias) });
  }

  listar(filtros: FiltrosGuias): Promise<SobreSp<Fila[]>> {
    return this.post('listar', this.sinVacios(filtros));
  }

  /** Excel con las guias filtradas (solo administrador y monitor). */
  exportarExcel(filtros: FiltrosGuias): Promise<Blob> {
    return firstValueFrom(this.http.post(`${this.baseUrl}/exportar-excel`, this.sinVacios(filtros), { responseType: 'blob' }));
  }

  /** Detalle de una guia con los nombres de catalogo completados. */
  obtener(idProyecto: string, codigoGuiaRemision: string): Promise<SobreSp<Fila[]>> {
    return this.post('obtener', { idProyecto, codigoGuiaRemision });
  }

  eliminar(idProyecto: string, codigoGuiaRemision: string): Promise<SobreSp<Fila[]>> {
    return this.post('eliminar', { idProyecto, codigoGuiaRemision });
  }

  emitir(idProyecto: string, codigoGuiaRemision: string): Promise<SobreSp> {
    return this.post('emitir', { idProyecto, codigoGuiaRemision });
  }

  consultarEstadoSunat(idProyecto: string, codigoGuiaRemision: string): Promise<SobreSp> {
    return this.post('consultar-estado-sunat', { idProyecto, codigoGuiaRemision });
  }

  anular(idProyecto: string, codigoGuiaRemision: string, codigoAcopio: string): Promise<SobreSp<Fila[]>> {
    return this.post('anular', { idProyecto, codigoGuiaRemision, codigoAcopio });
  }

  /** Edita una guia. `guias` es el JSON de la guia que lee el SP. */
  editar(idProyecto: string, guias: unknown): Promise<SobreSp<Fila[]>> {
    return this.post('editar', { idProyecto, guias: JSON.stringify(guias) });
  }

  codigosCaja(): Promise<SobreSp<Fila[]>> {
    return this.post('codigos-caja', {});
  }

  /** Procesos abiertos con palets cerrados que aun no estan en una guia activa. */
  procesos(idProyecto: string): Promise<SobreSp<Fila[]>> {
    return this.post('procesos', { idProyecto });
  }

  /** Los filtros vacios no se envian (el SP los toma como "sin filtro"). */
  private sinVacios(filtros: FiltrosGuias): Record<string, unknown> {
    return Object.fromEntries(Object.entries(filtros).filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== ''));
  }

  private post<T = Fila[]>(ruta: string, cuerpo: Record<string, unknown>): Promise<SobreSp<T>> {
    return firstValueFrom(this.http.post<SobreSp<T>>(`${this.baseUrl}/${ruta}`, cuerpo));
  }
}
