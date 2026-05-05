import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class CatalogoService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/catalogos`;

  // ── Catálogos generales (todos los catálogos de una vez) ──
  listarTodos(filtros?: Record<string, unknown>): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/listar`, filtros ?? {});
  }

  listarTodosOperarios(filtros?: Record<string, unknown>): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/operarios/listar`, filtros ?? {});
  }

  // ── Cascading selects (MatrizCompatibilidad) ──
  listarDestinos(filtros: { consignatarioId?: number } = {}): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/destinos`, filtros);
  }

  listarFormatos(filtros: { consignatarioId?: number; destinoId?: number } = {}): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/formatos`, filtros);
  }

  listarTiposEmpaqueGuia(filtros: { consignatarioId?: number; destinoId?: number; formatoId?: number } = {}): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/tipos-empaque-guia`, filtros);
  }

  listarCalibres(filtros: Record<string, unknown> = {}): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/calibres`, filtros);
  }

  listarPresentaciones(filtros: Record<string, unknown> = {}): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/presentaciones`, filtros);
  }

  listarTiposDesdeMatriz(filtros: Record<string, unknown> = {}): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/tipos-desde-matriz`, filtros);
  }

  listarCodigosRancho(filtros: { lugarProduccionId?: number; consignatarioId?: number } = {}): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/codigos-rancho`, filtros);
  }

  listarVariedades(filtros: { consignatarioId?: number } = {}): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/variedades`, filtros);
  }

  verificarDriscoll(filtros: { consignatarioId: number }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/verificar-driscoll`, filtros);
  }

  obtenerCampaniaActiva(): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/campania-activa`, {});
  }

  obtenerConfigTipoProceso(filtros: { acopioId?: number } = {}): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/config-tipo-proceso`, filtros);
  }
}
