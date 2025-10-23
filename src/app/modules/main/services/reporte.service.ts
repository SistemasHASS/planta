import { inject, Injectable } from '@angular/core';
import { HttpClient,HttpParams } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { lastValueFrom } from 'rxjs';
import { DexieService } from 'src/app/shared/dixiedb/dexie-db.service';

@Injectable({
  providedIn: 'root'
})

export class ReporteService {
  private dexieService = inject( DexieService );
  private readonly baseUrl: string = environment.baseUrl;

  constructor(private http: HttpClient) {}

  async getReporte1(params: any): Promise<any> {
    const url = `${this.baseUrl}/tareo/reporte1`;
    try {
      let httpParams = new HttpParams();
      const paramsString = JSON.stringify(params)
      httpParams = httpParams.set('parametros', paramsString);
      return await lastValueFrom(this.http.get<any>(url, { params: httpParams }));
    } catch(error:any) {
      throw new Error(error.error?.message || 'Error al obtener el reporte');
    }
  }
}
