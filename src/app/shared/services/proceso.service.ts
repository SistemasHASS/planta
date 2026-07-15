import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Proceso, CrearProcesoRequest } from '../interfaces/proceso.interface';

@Injectable({ providedIn: 'root' })
export class ProcesoService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/procesos`;
  private readonly apiDashboard = `${environment.apiUrl}/palets`;
  


  listarProcesoForAcopio(codigoCultivo:string, idproyecto:string): Observable<any>{
    const json = JSON.stringify({
      codigoCultivo: codigoCultivo,
      idproyecto: idproyecto, 
    });
    return this.http.get<any>(`${this.apiUrl}/get-procesos-acopio`, { params: { json }, withCredentials: true });
  }

  buscar(codigoCultivo: string, turno: string, idproyecto: string, fecha:string): Observable<any> {
    const json = JSON.stringify({
      codigoCultivo: codigoCultivo,
      idproyecto: idproyecto, 
      turno: turno,
      fecha: fecha
    });
    return this.http.get<any>(`${this.apiUrl}/buscar`, { params: { json }, withCredentials: true });
  }

  sincronizar(proceso:any,dProcesoLogisticos:any, dProcesoSupervisores:any, codigoCultivo:string, idproyecto:string, modo:string='nuevo'): Observable<any>{
    const payload = JSON.stringify({
        proceso:  JSON.stringify(proceso),
        dProcesoLogisticos:  JSON.stringify(dProcesoLogisticos),
        dProcesoSupervisores:  JSON.stringify(dProcesoSupervisores),
        codigoCultivo: codigoCultivo,
        idproyecto: idproyecto, 
        modo:modo
    });
    return this.http.post<any>(`${this.apiUrl}/sincronizar`, payload, { withCredentials: true , headers: { 'Content-Type': 'application/json' }} );
  }

  // obtenerPorId(id: number): Observable<any> {
  //   return this.http.post<any>(`${this.apiUrl}/obtener`, { id }, { withCredentials: true });
  // }

  // crear(request: CrearProcesoRequest): Observable<any> {
  //   return this.http.post<any>(`${this.apiUrl}/crear`, request, { withCredentials: true });
  // }

  // cerrar(id: number, usuarioId: number): Observable<any> {
  //   return this.http.post<any>(`${this.apiUrl}/cerrar`, { id, usuarioId }, { withCredentials: true });
  // }

  // reabrir(id: number): Observable<any> {
  //   return this.http.post<any>(`${this.apiUrl}/reabrir`, { id }, { withCredentials: true });
  // }

  // listarPorAcopio(codigoAcopio: string): Observable<any> {
  //   return this.http.post<any>(`${this.apiUrl}/listar-por-acopio`, { codigoAcopio }, { withCredentials: true });
  // }

  obtenerReporteDiario(fecha: string, acopios: string = '', idCampana: string = ''): Observable<any> {
    return this.http.get<any>(`${this.apiDashboard}/reporte-diario`, {
      params: { fecha, acopios, idCampana },
      withCredentials: true,
    });
  }
}
