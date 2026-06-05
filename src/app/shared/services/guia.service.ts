import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { GuiaRemision } from '../interfaces/guia.interface';

@Injectable({ providedIn: 'root' })
export class GuiaService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/guias-remision`;

  listarProcesosGuia(): Observable<any> {
    return this.http.get(`${this.apiUrl}/get-procesos-guia`, { withCredentials: true });
  }

  sincronizarGuiasRemision(payload: { idProyecto: string; guias: GuiaRemision[]; }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/sincronizar-guias-remision`, payload, { withCredentials: true });
  }

  listarGuiasRemision(idProyecto: string, estado: string | null = null, fechaDesde: string | null = null, fechaHasta: string | null = null, texto: string | null = null): Observable<any> {
    let params = new HttpParams().set('idProyecto', idProyecto);
    if (estado) params = params.set('estado', estado);
    if (fechaDesde) params = params.set('fechaDesde', fechaDesde);
    if (fechaHasta) params = params.set('fechaHasta', fechaHasta);
    if (texto) params = params.set('texto', texto);
    return this.http.get<any>(`${this.apiUrl}/listar-guias-remision`, { params, withCredentials: true });
  }
}
