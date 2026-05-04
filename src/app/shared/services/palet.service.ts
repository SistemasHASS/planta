import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Palet, Composicion, AgregarComposicionRequest } from '../interfaces/palet.interface';

@Injectable({ providedIn: 'root' })
export class PaletService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/palets`;

  listarPorProceso(procesoId: number): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/obtener-por-proceso`, { procesoId });
  }

  obtenerPorId(id: number): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/obtener-por-id`, { id });
  }

  crear(procesoId: number, acopioId: number, usuarioId: number): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/crear`, { procesoId, acopioId, usuarioId });
  }

  agregarCajas(request: AgregarComposicionRequest): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/agregar-cajas`, request);
  }

  editarCajas(composicionId: number, request: AgregarComposicionRequest): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/editar-cajas`, { composicionId, ...request });
  }

  cerrar(id: number, tipoCierre: string, usuarioId: number, observaciones?: string, medidaCorrectiva?: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/cerrar-saldo`, { id, tipoCierre, usuarioId, observaciones, medidaCorrectiva });
  }

  reabrir(id: number): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/reabrir`, { id });
  }

  eliminar(id: number): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/eliminar`, { id });
  }

  eliminarComposicion(composicionId: number): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/eliminar-composicion`, { composicionId });
  }
}
