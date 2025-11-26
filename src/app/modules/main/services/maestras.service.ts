import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { lastValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root'
})

export class MaestrasService {

  private readonly baseUrlMaestros: string = environment.baseUrlMaestros;

  constructor(private http: HttpClient) {}

  async getEmpresas(body: any): Promise<any> {
    const url = `${this.baseUrlMaestros}/maestras/empresas`;
    try {
      return  await lastValueFrom(this.http.post<any>(url, body));
    } catch (error: any) {
      throw new Error(error.error?.message || 'Error obteniendo empresas');
    }
  }

  async getFundos(body: any): Promise<any> {
    const url = `${this.baseUrlMaestros}/maestras/fundos`;
    try {
      return await lastValueFrom(this.http.post<any>(url, body));
    } catch (error: any) {
      throw new Error(error.error?.message || 'Error obteniendo fundos');
    }
  }

  async getCultivos(body: any): Promise<any> {
    const url = `${this.baseUrlMaestros}/maestras/cultivos`;
    try {
      return await lastValueFrom(this.http.post<any>(url, body));
    } catch (error: any) {
      throw new Error(error.error?.message || 'Error obteniendo cultivos');
    }
  }

  async getAcopios(body: any): Promise<any> {
    const url = `${this.baseUrlMaestros}/maestras/acopios`;
    try {
      return await lastValueFrom(this.http.post<any>(url, body));
    } catch (error: any) {
      throw new Error(error.error?.message || 'Error obteniendo acopios');
    }
  }

  async getHorarios(body: any): Promise<any> {
    const url = `${this.baseUrlMaestros}/maestras/horarios`;
    try {
      return await lastValueFrom(this.http.post<any>(url, body));
    } catch (error: any) {
      throw new Error(error.error?.message || 'Error obteniendo horarios');
    }
  }

}
