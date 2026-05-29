import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Palet, Composicion, AgregarComposicionRequest } from '../interfaces/palet.interface';

@Injectable({ providedIn: 'root' })
export class PaletService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/palets`;

  listarPorProceso(idproceso:string): Observable<any>{
    const json = JSON.stringify({
      idproceso: idproceso,
    });
    return this.http.get<any>(`${this.apiUrl}/get-palets-por-proceso`, { params: { json }, withCredentials: true });
  }
  
  sincronizar(palets:any){
    const payload = JSON.stringify({
      palets: palets
    });
    return this.http.post<any>(`${this.apiUrl}/sincronizar`, payload, { withCredentials: true , headers: { 'Content-Type': 'application/json' }} );
  }

  obtenerPorId(id: number): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/obtener-por-id`, { id }, { withCredentials: true });
  }

  crear(procesoId: number, codigoAcopio: string, usuarioId: number): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/crear`, { procesoId, codigoAcopio, usuarioId }, { withCredentials: true });
  }

  agregarCajas(request: AgregarComposicionRequest): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/agregar-cajas`, request, { withCredentials: true });
  }

  editarCajas(composicionId: number, request: AgregarComposicionRequest): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/editar-cajas`, { composicionId, ...request }, { withCredentials: true });
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
}
