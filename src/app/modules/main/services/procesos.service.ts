import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { lastValueFrom } from 'rxjs';
import { Asignacion, Conteo } from '@/app/shared/interfaces/Tables';

@Injectable({
  providedIn: 'root'
})
export class ProcesosService {
  private readonly baseUrl: string = environment.baseUrl;

  constructor(private http: HttpClient) {}

  async getAsignaciones(body: any): Promise<any> {
    const url = `${this.baseUrl}/planta/asignaciones/listado`;
    try {
      return await lastValueFrom(this.http.post<any>(url, body));
    } catch (error: any) {
      throw new Error(error.error?.message || 'Error obteniendo asignaciones');
    }
  }

  async syncAsignaciones(asignaciones: Asignacion[]): Promise<any> {
    const url = `${this.baseUrl}/planta/asignaciones/sync`;
    try {
      return await lastValueFrom(this.http.post<any>(url, asignaciones));
    } catch (error: any) {
      throw new Error(error.error?.message || 'Error sincronizando asignaciones');
    }
  }

  async getConteos(body: any): Promise<any> {
    const url = `${this.baseUrl}/planta/conteos/listado`;
    try {
      return await lastValueFrom(this.http.post<any>(url, body));
    } catch (error: any) {
      throw new Error(error.error?.message || 'Error obteniendo conteos');
    }
  }

  async syncConteos(conteos: Conteo[]): Promise<any> {
    const url = `${this.baseUrl}/planta/conteos/sync`;
    try {
      return await lastValueFrom(this.http.post<any>(url, conteos));
    } catch (error: any) {
      throw new Error(error.error?.message || 'Error sincronizando conteos');
    }
  }
}
