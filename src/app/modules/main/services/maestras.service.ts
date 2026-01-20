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

  async getEmpresas(body: any): Promise<any> {
    const url = `${this.baseUrlMaestros}/api/Maestros/get_empresas`;
    try {
      return  await lastValueFrom(this.http.post<any>(url, body));
    } catch (error: any) {
      throw new Error(error.error?.message || 'Error obteniendo get_empresas');
    }
  }

  async getFundos(body: any): Promise<any> {
    const url = `${this.baseUrlMaestros}/api/Maestros/get-fundos`;
    try {
      return await lastValueFrom(this.http.post<any>(url, body));
    } catch (error: any) {
      throw new Error(error.error?.message || 'Error obteniendo get-fundos');
    }
  }

  async getCultivos(body: any): Promise<any> {
    const url = `${this.baseUrlMaestros}/api/Maestros/get-cultivos`;
    try {
      return await lastValueFrom(this.http.post<any>(url, body));
    } catch (error: any) {
      throw new Error(error.error?.message || 'Error obteniendo get_cultivos');
    }
  }

  async getAcopios(body: any): Promise<any> {
    const url = `${this.baseUrlMaestros}/api/Maestros/get-acopios`;
    try {
      return await lastValueFrom(this.http.post<any>(url, body));
    } catch (error: any) {
      throw new Error(error.error?.message || 'Error obteniendo get_acopios');
    }
  }

  async getLineasProduccion(body: any): Promise<any> {
    const url = `${this.baseUrl}/transporte/mantenedores/lineas/listado`;
    try {
      return await lastValueFrom(this.http.post<any>(url, body));
    } catch (error: any) {
      throw new Error(error.error?.message || 'Error obteniendo lineas de producción');
    }
  }

  crudLineaProduccion(body: any) {
    const url = `${this.baseUrl}/transporte/mantenedores/lineas/crud/sp`;
    try {
      return this.http.post<any>(url, body);
    } catch (error: any) {
      throw new Error(error.error?.message || 'Error en CRUD linea de producción');
    }
  }

  async getClientes(body: any): Promise<any> {
    const url = `${this.baseUrlMaestros}/api/Maestros/clientes/listado`;
    try {
      return await lastValueFrom(this.http.post<any>(url, body));
    } catch (error: any) {
      throw new Error(error.error?.message || 'Error obteniendo clientes');
    }
  }

  async getDestinos(body: any): Promise<any> {
    const url = `${this.baseUrlMaestros}/api/Maestros/mercadodestino/listado`;
    try {
      return await lastValueFrom(this.http.post<any>(url, body));
    } catch (error: any) {
      throw new Error(error.error?.message || 'Error obteniendo destinos');
    }
  }

  async getFormatos(body: any): Promise<any> {
    const url = `${this.baseUrlMaestros}/api/Maestros/formato/listado`;
    try {
      return await lastValueFrom(this.http.post<any>(url, body));
    } catch (error: any) {
      throw new Error(error.error?.message || 'Error obteniendo formatos');
    }
  }

  getModulos(idempresa: any): Observable<any> {
    const url = `${this.baseUrlMaestros}/api/Maestros/get-modulos`;
    const body = [{ idempresa: idempresa }];
    try {
      return this.http.post<any>(url, body);
    } catch (error: any) {
      throw new Error(error.error?.message || 'Error obteniendo modulos');
    }
  }

  getLotes(sociedad: any): Observable<any> {
    const url = `${this.baseUrl}/api/Maestros/get-lotes`;
    const body = [{ sociedad: sociedad }];
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

  async getVariedades(body: any): Promise<any> {
    const url = `${this.baseUrl}/planta/catalogos/variedades`;
    try {
      return await lastValueFrom(this.http.post<any>(url, body));
    } catch (error: any) {
      throw new Error(error.error?.message || 'Error obteniendo variedades');
    }
  }

  async getOperarios(body: any): Promise<any> {
    const url = `${this.baseUrl}/planta/operarios/listado`;
    try {
      return await lastValueFrom(this.http.post<any>(url, body));
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
