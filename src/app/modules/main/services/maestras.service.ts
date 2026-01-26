import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { lastValueFrom, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})

export class MaestrasService {

  private readonly baseUrlMaestros: string = environment.baseUrlMaestros;
  private readonly baseUrl: string = environment.baseUrl;

  constructor(private http: HttpClient) {}

  getAcopios(body: any): Promise<any> {
    const url = `${this.baseUrlMaestros}/api/Maestros/get-acopios`;
    try {
      return lastValueFrom(this.http.post<any>(url, body));
    } catch (error: any) {
      throw new Error(error.error?.message || 'Error obteniendo get_acopios');
    }
  }

  getFundos(body: any): Observable<any> {
    const url = `${this.baseUrlMaestros}/api/Maestros/get-fundos`;
    try {
      return this.http.post<any>(url, body);
    } catch (error: any) {
      throw new Error(error.error?.message || 'Error obteniendo get-fundos');
    }
  }

  getCultivos(body: any): Observable<any> {
    const url = `${this.baseUrlMaestros}/api/Maestros/get-cultivos`;
    try {
      return this.http.post<any>(url, body);
    } catch (error: any) {
      throw new Error(error.error?.message || 'Error obteniendo get_cultivos');
    }
  }

  getClientes(body: any): Observable<any> {
    const url = `${this.baseUrlMaestros}/api/Maestros/clientes/listado`;
    try {
      return this.http.post<any>(url, body);
    } catch (error: any) {
      throw new Error(error.error?.message || 'Error obteniendo clientes');
    }
  }

  getDestinos(body: any): Observable<any> {
    const url = `${this.baseUrlMaestros}/api/Maestros/mercadodestino/listado`;
    try {
      return this.http.post<any>(url, body);
    } catch (error: any) {
      throw new Error(error.error?.message || 'Error obteniendo destinos');
    }
  }

  getLineasProduccion(body: any): Observable<any> {
    const url = `${this.baseUrl}/mantenedoresplanta/lineas/listado`;
    try {
      return this.http.post<any>(url, body);
    } catch (error: any) {
      throw new Error(error.error?.message || 'Error obteniendo lineas de producción');
    }
  }

  crudLineaProduccion(body: any): Observable<any> {
    const url = `${this.baseUrl}/mantenedoresplanta/lineas/crud-linea-produccion`;
    try {
      return this.http.post<any>(url, body);
    } catch (error: any) {
      throw new Error(error.error?.message || 'Error en crud línea producción');
    }
  }

  sincronizarConfiguracionLineas(body: any): Observable<any> {
    const url = `${this.baseUrl}/mantenedoresplanta/configuracion-lineas/sincronizar`;
    try {
      return this.http.post<any>(url, body);
    } catch (error: any) {
      throw new Error(error.error?.message || 'Error sincronizando configuración de líneas');
    }
  }

  getFormatos(body: any): Observable<any> {
    const url = `${this.baseUrlMaestros}/api/Maestros/formato/listado`;
    try {
      return this.http.post<any>(url, body);
    } catch (error: any) {
      throw new Error(error.error?.message || 'Error obteniendo formatos');
    }
  }

  getModulos(body: any): Observable<any> {
    const url = `${this.baseUrlMaestros}/api/Maestros/get-modulos`;
    try {
      return this.http.post<any>(url, body);
    } catch (error: any) {
      throw new Error(error.error?.message || 'Error obteniendo modulos');
    }
  }

  getLotes(idempresa: any): Observable<any> {
    const url = `${this.baseUrlMaestros}/api/Maestros/get-lotes`;
    const body = [{ idempresa: idempresa }];
    try {
      return this.http.post<any>(url, body);
    } catch (error: any) {
      throw new Error(error.error?.message || 'Error obteniendo lotes');
    }
  }

  getTurnos(idempresa: any): Observable<any> {
    const url = `${this.baseUrlMaestros}/api/Maestros/get-turnos`;
    const body = [{ idempresa: idempresa }];
    try {
      return this.http.post<any>(url, body);
    } catch (error: any) {
      throw new Error(error.error?.message || 'Error obteniendo turnos');
    }
  }

  getVariedades(body: any): Observable<any> {
    const url = `${this.baseUrlMaestros}/api/Maestros/get-variedades`;
    try {
      return this.http.post<any>(url, body);
    } catch (error: any) {
      throw new Error(error.error?.message || 'Error obteniendo variedades');
    }
  }

  getOperarios(body: any): Observable<any> {
    const url = `${this.baseUrl}/planta/operarios/listado`;
    try {
      return this.http.post<any>(url, body);
    } catch (error: any) {
      throw new Error(error.error?.message || 'Error obteniendo operarios');
    }
  }

  crudOperario(body: any) {
    const url = `${this.baseUrl}/planta/operarios/crud`;
    try {
      return this.http.post<any>(url, body);
    } catch (error: any) {
      throw new Error(error.error?.message || 'Error en CRUD operario');
    }
  }

}
