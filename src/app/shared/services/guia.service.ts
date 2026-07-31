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

  sincronizarGuiaRemisionManual(payload: { idProyecto: string; guias: any[]; }): Observable<any> {
    return this.http.post<any>(`${environment.apiUrl}/guias-remision-manual/sincronizar-guia-remision-manual`, payload, { withCredentials: true });
  }

  listarGuiasRemisionManual(idProyecto: string, estado: string | null = null, fechaDesde: string | null = null, fechaHasta: string | null = null, texto: string | null = null): Observable<any> {
    let params = new HttpParams().set('idProyecto', idProyecto);
    if (estado) params = params.set('estado', estado);
    if (fechaDesde) params = params.set('fechaDesde', fechaDesde);
    if (fechaHasta) params = params.set('fechaHasta', fechaHasta);
    if (texto) params = params.set('texto', texto);
    return this.http.get<any>(`${environment.apiUrl}/guias-remision-manual/listar-guias-remision-manual`, { params, withCredentials: true });
  }

  getGuiaRemisionManual(idProyecto: string, codigoGuiaRemision: string): Observable<any> {
    let params = new HttpParams().set('idProyecto', idProyecto).set('codigoGuiaRemision', codigoGuiaRemision);
    return this.http.get<any>(`${environment.apiUrl}/guias-remision-manual/get-guia-remision-manual`, { params, withCredentials: true });
  }

  editarGuiaRemisionManual(idProyecto: string, payload: any): Observable<any> {
    let params = new HttpParams().set('idProyecto', idProyecto);
    return this.http.post<any>(`${environment.apiUrl}/guias-remision-manual/editar-guia-remision-manual`, payload, { params, withCredentials: true });
  }

  eliminarGuiaRemisionManual(idProyecto: string, codigoGuiaRemision: string): Observable<any> {
    let params = new HttpParams().set('idProyecto', idProyecto).set('codigoGuiaRemision', codigoGuiaRemision);
    return this.http.get<any>(`${environment.apiUrl}/guias-remision-manual/eliminar-guia-remision-manual`, { params, withCredentials: true });
  }

  emitirGuiaRemisionManual(idProyecto: string, codigoGuiaRemision: string): Observable<any> {
    let params = new HttpParams().set('idProyecto', idProyecto).set('codigoGuiaRemision', codigoGuiaRemision);
    return this.http.get<any>(`${environment.apiUrl}/guias-remision-manual/emitir-guia-remision-manual`, { params, withCredentials: true });
  }

  reenviarGuiaRemisionManual(idProyecto: string, codigoGuiaRemision: string): Observable<any> {
    let params = new HttpParams().set('idProyecto', idProyecto).set('codigoGuiaRemision', codigoGuiaRemision);
    return this.http.get<any>(`${environment.apiUrl}/guias-remision-manual/reenviar-guia-remision-manual`, { params, withCredentials: true });
  }

  consultarEstadoSunatGuiaRemisionManual(idProyecto: string, codigoGuiaRemision: string): Observable<any> {
    let params = new HttpParams().set('idProyecto', idProyecto).set('codigoGuiaRemision', codigoGuiaRemision);
    return this.http.get<any>(`${environment.apiUrl}/guias-remision-manual/consultar-estado-sunat-guia-remision-manual`, { params, withCredentials: true });
  }

  anularGuiaRemisionManual(idProyecto: string, codigoGuiaRemision: string): Observable<any> {
    let params = new HttpParams().set('idProyecto', idProyecto).set('codigoGuiaRemision', codigoGuiaRemision);
    return this.http.get<any>(`${environment.apiUrl}/guias-remision-manual/anular-guia-remision-manual`, { params, withCredentials: true });
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

  anularGuiaRemision(idProyecto: string, codigoGuiaRemision: string, codigoAcopio: string): Observable<any> {
    const params = new HttpParams()
      .set('idProyecto', idProyecto)
      .set('codigoGuiaRemision', codigoGuiaRemision)
      .set('codigoAcopio', codigoAcopio);
    return this.http.get<any>(`${this.apiUrl}/anular-guia-remision`, { params, withCredentials: true });
  }

  exportarGuiasRemisionExcel(idProyecto: string, estado: string | null = null, fechaDesde: string | null = null, fechaHasta: string | null = null, texto: string | null = null, codigoCultivo: string | null = null): Observable<Blob> {
    let params = new HttpParams().set('idProyecto', idProyecto);
    if (estado) params = params.set('estado', estado);
    if (fechaDesde) params = params.set('fechaDesde', fechaDesde);
    if (fechaHasta) params = params.set('fechaHasta', fechaHasta);
    if (texto) params = params.set('texto', texto);
    if (codigoCultivo) params = params.set('codigoCultivo', codigoCultivo);
    return this.http.get(`${this.apiUrl}/exportar-guias-remision-excel`, { params, responseType: 'blob', withCredentials: true });
  }

  editarGuiaRemision(payload: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/editar-guia-remision`, payload, { withCredentials: true });
  }
}
