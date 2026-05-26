import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Proceso, CrearProcesoRequest, PersonalDisponible } from '../interfaces/proceso.interface';

@Injectable({ providedIn: 'root' })
export class ProcesoService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/procesos`;

  listar(filtros?: Record<string, unknown>): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/listar`, filtros ?? {}, { withCredentials: true });
  }

  obtenerPorId(id: number): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/obtener`, { id }, { withCredentials: true });
  }

  crear(request: CrearProcesoRequest): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/crear`, request, { withCredentials: true });
  }

  cerrar(id: number, usuarioId: number): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/cerrar`, { id, usuarioId }, { withCredentials: true });
  }

  reabrir(id: number): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/reabrir`, { id }, { withCredentials: true });
  }

  obtenerPersonalDisponible(fecha: string, turno: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/personal-disponible`, { fecha, turno }, { withCredentials: true });
  }

  listarPorAcopio(acopioId: number): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/listar-por-acopio`, { acopioId }, { withCredentials: true });
  }
}
