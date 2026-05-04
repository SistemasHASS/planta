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
    return this.http.post<any>(`${this.apiUrl}/listar`, filtros ?? {});
  }

  obtenerPorId(id: number): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/obtener`, { id });
  }

  crear(request: CrearProcesoRequest): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/crear`, request);
  }

  cerrar(id: number, usuarioId: number): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/cerrar`, { id, usuarioId });
  }

  reabrir(id: number): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/reabrir`, { id });
  }

  obtenerPersonalDisponible(fecha: string, turno: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/personal-disponible`, { fecha, turno });
  }

  listarPorAcopio(acopioId: number): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/listar-por-acopio`, { acopioId });
  }
}
