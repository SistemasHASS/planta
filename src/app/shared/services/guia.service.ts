import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { GuiaRemision } from '../interfaces/guia.interface';
import { ApiResponse } from '../interfaces/catalogo.interface';

@Injectable({ providedIn: 'root' })
export class GuiaService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/guias`;

  listarPorProceso(procesoId: number): Observable<ApiResponse<GuiaRemision[]>> {
    return this.http.get<ApiResponse<GuiaRemision[]>>(`${this.apiUrl}/proceso/${procesoId}`);
  }

  obtenerPorId(id: number): Observable<ApiResponse<GuiaRemision>> {
    return this.http.get<ApiResponse<GuiaRemision>>(`${this.apiUrl}/${id}`);
  }

  crear(request: Record<string, unknown>): Observable<ApiResponse<GuiaRemision>> {
    return this.http.post<ApiResponse<GuiaRemision>>(this.apiUrl, request);
  }

  cerrar(id: number, serie?: string, numero?: number): Observable<ApiResponse<GuiaRemision>> {
    return this.http.post<ApiResponse<GuiaRemision>>(`${this.apiUrl}/cerrar`, { id, serie, numero });
  }

  anular(id: number): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(`${this.apiUrl}/anular`, { id });
  }

  eliminar(id: number): Observable<ApiResponse<unknown>> {
    return this.http.delete<ApiResponse<unknown>>(`${this.apiUrl}/${id}`);
  }
}
