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

  getGuiaRemision(idProyecto: string, codigoGuiaRemision: string): Observable<any> {
    const params = new HttpParams()
      .set('idProyecto', idProyecto)
      .set('codigoGuiaRemision', codigoGuiaRemision);
    return this.http.get<any>(`${this.apiUrl}/get-guia-remision`, { params, withCredentials: true });
  }

  eliminarGuiaRemision(idProyecto: string, codigoGuiaRemision: string): Observable<any> {
    const params = new HttpParams()
      .set('idProyecto', idProyecto)
      .set('codigoGuiaRemision', codigoGuiaRemision);
    return this.http.post<any>(`${this.apiUrl}/eliminar-guia-remision`, null, { params, withCredentials: true });
  }

  emitirGuiaRemision(idProyecto: string, codigoGuiaRemision: string): Observable<any> {
    const params = new HttpParams()
      .set('idProyecto', idProyecto)
      .set('codigoGuiaRemision', codigoGuiaRemision);
    return this.http.get<any>(`${this.apiUrl}/emitir-guia-remision`, { params, withCredentials: true });
  }

  consultarEstadoSunat(idProyecto: string, codigoGuiaRemision: string): Observable<any> {
    const params = new HttpParams()
      .set('idProyecto', idProyecto)
      .set('codigoGuiaRemision', codigoGuiaRemision);
    return this.http.get<any>(`${this.apiUrl}/consultar-estado-sunat`, { params, withCredentials: true });
  }

  anularGuiaRemision(idProyecto: string, codigoGuiaRemision: string): Observable<any> {
    const params = new HttpParams()
      .set('idProyecto', idProyecto)
      .set('codigoGuiaRemision', codigoGuiaRemision);
    return this.http.delete<any>(`${this.apiUrl}/anular-guia-remision`, { params, withCredentials: true });
  }

  editarGuiaRemision(payload: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/editar-guia-remision`, payload, { withCredentials: true });
  }
}
