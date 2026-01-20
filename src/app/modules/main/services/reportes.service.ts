import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { lastValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ReportesService {
  private readonly baseUrl: string = environment.baseUrl;

  constructor(private http: HttpClient) {}

  async getReporteLineas(body: any): Promise<any> {
    const url = `${this.baseUrl}/planta/reportes/lineas`;
    try {
      return await lastValueFrom(this.http.post<any>(url, body));
    } catch (error: any) {
      throw new Error(error.error?.message || 'Error obteniendo reporte de líneas');
    }
  }

  async getReportePersonas(body: any): Promise<any> {
    const url = `${this.baseUrl}/planta/reportes/personas`;
    try {
      return await lastValueFrom(this.http.post<any>(url, body));
    } catch (error: any) {
      throw new Error(error.error?.message || 'Error obteniendo reporte de personas');
    }
  }
}
