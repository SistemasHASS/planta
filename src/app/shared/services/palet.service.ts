import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { DPalet } from '../interfaces/palet.interface';

@Injectable({ providedIn: 'root' })
export class PaletService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/palets`;

  listarPaletPorProceso(idproceso:string): Observable<any>{
    const json = JSON.stringify({
      idproceso: idproceso,
    });
    return this.http.get<any>(`${this.apiUrl}/get-palets-por-proceso`, { params: { json }, withCredentials: true });
  }

  getTipoProcesoEmpacadoPorAcopio(idproyecto: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/getTipoProcesoEmpacado-Acopio`, { params: { idproyecto }, withCredentials: true });
  }

  getDestinosPorMatrizCompatibilidad(idproyecto: string, documentoConsignatario: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/get-destinos-por-matriz-compatibilidad`, {
      params: { idproyecto, documentoConsignatario },
      withCredentials: true
    });
  }

  getFormatosPorMatriz(codigoCultivo: string, documentoConsignatario: string, destinoId: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/get-formatos-por-matriz`, {
      params: { codigoCultivo, documentoConsignatario, destinoId },
      withCredentials: true
    });
  }

  getTiposEmpaqueGuiaPorMatriz(codigoCultivo: string, documentoConsignatario: string, destinoId: string, formatoId: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/get-tipos-empaque-guia-por-matriz`, {
      params: { codigoCultivo, documentoConsignatario, destinoId, formatoId: String(formatoId) },
      withCredentials: true
    });
  }

  getPresentacionesPorMatriz(codigoCultivo: string, documentoConsignatario: string, destinoId: string, formatoId: number, tipoEmpaqueGuiaId: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/get-presentaciones-por-matriz`, {
      params: { codigoCultivo, documentoConsignatario, destinoId, formatoId: String(formatoId), tipoEmpaqueGuiaId: String(tipoEmpaqueGuiaId) },
      withCredentials: true
    });
  }

  getTiposCajaPorMatriz(codigoCultivo: string, documentoConsignatario: string, destinoId: string, formatoId: number, tipoEmpaqueGuiaId: number, presentacionId?: number): Observable<any> {
    const params: any = { codigoCultivo, documentoConsignatario, destinoId, formatoId: String(formatoId), tipoEmpaqueGuiaId: String(tipoEmpaqueGuiaId) };
    if (presentacionId != null && presentacionId > 0) {
      params.presentacionId = String(presentacionId);
    }
    return this.http.get<any>(`${this.apiUrl}/get-tipos-caja-por-matriz`, {
      params,
      withCredentials: true
    });
  }

  getTiposClamshellPorMatriz(codigoCultivo: string, documentoConsignatario: string, destinoId: string, formatoId: number, tipoEmpaqueGuiaId: number, tipoCajaId?: number, presentacionId?: number): Observable<any> {
    const params: any = { codigoCultivo, documentoConsignatario, destinoId, formatoId: String(formatoId), tipoEmpaqueGuiaId: String(tipoEmpaqueGuiaId) };
    if (tipoCajaId != null && tipoCajaId > 0) {
      params.tipoCajaId = String(tipoCajaId);
    }
    if (presentacionId != null && presentacionId > 0) {
      params.presentacionId = String(presentacionId);
    }
    return this.http.get<any>(`${this.apiUrl}/get-tipos-clamshell-por-matriz`, {
      params,
      withCredentials: true
    });
  }

  getDPaletsPorAcopio(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/get-dpalets-por-acopio`, { withCredentials: true });
  }

  getDPaletsPorPalet(idPalet: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/get-dpalets-por-palet`, { params: { idPalet }, withCredentials: true });
  }

  sincronizar(palets:any){
    const payload = JSON.stringify({
      palets: palets
    });
    return this.http.post<any>(`${this.apiUrl}/sincronizar`, payload, { withCredentials: true , headers: { 'Content-Type': 'application/json' }} );
  }

  sincronizarDPalets(dPalets: any[]) {
    const payload = JSON.stringify({
      DPalets: JSON.stringify(dPalets)
    });
    return this.http.post<any>(`${this.apiUrl}/sincronizar-dpalet`, payload, { withCredentials: true, headers: { 'Content-Type': 'application/json' } });
  }

  obtenerPorId(id: number): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/obtener-por-id`, { id }, { withCredentials: true });
  }

  crear(procesoId: number, codigoAcopio: string, usuarioId: number): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/crear`, { procesoId, codigoAcopio, usuarioId }, { withCredentials: true });
  }

  cerrar(id: number, tipoCierre: string, usuarioId: number, observaciones?: string, medidaCorrectiva?: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/cerrar-saldo`, { id, tipoCierre, usuarioId, observaciones, medidaCorrectiva }, { withCredentials: true });
  }

  reabrir(id: number): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/reabrir`, { id }, { withCredentials: true });
  }

  eliminar(id: number): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/eliminar`, { id }, { withCredentials: true });
  }

  eliminarComposicion(composicionId: number): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/eliminar-composicion`, { composicionId }, { withCredentials: true });
  }

  descargarFichaComposicion(idPalet: string): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/descargar-ficha-composicion`, {
      params: { idPalet },
      responseType: 'blob',
      withCredentials: true
    });
  }

}
