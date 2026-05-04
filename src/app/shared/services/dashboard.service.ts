import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface DashboardKPIs {
  kgDespachados: number;
  kgEnProceso: number;
  kgEnAcopio: number;
  kgTotales: number;
  paletsDespachados: number;
  paletsTotales: number;
}

export interface AlertaPalet {
  NumeroPalet: number;
  AcopioCodigo: string;
  Turno: string;
  CantidadCajas: number;
  Estado: string;
  MinutosTranscurridos: number;
}

export interface AlertasResponse {
  success: boolean;
  alertas: AlertaPalet[];
}

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  obtenerKPIsAdmin(): Observable<{ success: boolean; data: DashboardKPIs }> {
    return this.http.get<{ success: boolean; data: DashboardKPIs }>(`${this.apiUrl}/dashboard/kpis-admin`);
  }

  obtenerAlertasPaletsVencidos(): Observable<AlertasResponse> {
    return this.http.get<AlertasResponse>(`${this.apiUrl}/dashboard/alertas-palets-vencidos`);
  }
}
