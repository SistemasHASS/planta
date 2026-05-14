import { HttpClient, HttpParams } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { environment } from "../../../environments/environment";
import { Observable } from "rxjs";


@Injectable({ providedIn: 'root' })
export class AdministracionService {
    private readonly http = inject(HttpClient);
    private readonly apiUrl = `${environment.apiUrl}/administracion`;

    private readonly apiUrlMatricesCompatibilidad = `${this.apiUrl}/matrices-compatibilidad`;
    private readonly apiUrlUsuarios = `${this.apiUrl}/usuarios`;
    private readonly apiUrlReglasSobrePeso = `${this.apiUrl}/reglas-sobrepeso`;

    // ------ Matriz de compatibilidad ------
    listarMatricesCompatibilidad(payload: any): Observable<any> {
          const params = new HttpParams().set('json', JSON.stringify(payload));
        return this.http.get<any>(`${this.apiUrlMatricesCompatibilidad}/listar`, { params, withCredentials: true });
    }

    sincronizarMatricesCompatibilidad(json: any): Observable<any> {
        return this.http.post<any>(`${this.apiUrlMatricesCompatibilidad}/sincronizar`, json,{ withCredentials: true });
    }

    //-------- Usuarios --------
    listarUsuarios(payload: any): Observable<any> {
        const params = new HttpParams().set('json', JSON.stringify(payload));
        return this.http.get<any>(`${this.apiUrlUsuarios}/listar`, { params, withCredentials: true });
    }

    sincronizarUsuarios(json: any): Observable<any> {
        return this.http.post<any>(`${this.apiUrlUsuarios}/sincronizar`, json, { withCredentials: true });
    }

    resetearPasswordUsuario(json: any): Observable<any> {
        return this.http.post<any>(`${this.apiUrlUsuarios}/reset-password`, json);
    }
    
    //---------- Reglas Sobrepso------

    listarReglasSobrePeso(payload: any): Observable<any> {
        const params = new HttpParams().set('json', JSON.stringify(payload));
        return this.http.get<any>(`${this.apiUrlReglasSobrePeso}/listar`, { params });
    }

    sincronizarReglasSobrePeso(json: any): Observable<any> {
        return this.http.post<any>(`${this.apiUrlReglasSobrePeso}/sincronizar`, json);
    }

}