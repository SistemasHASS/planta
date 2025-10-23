import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})

export class MaestrasService {

  private readonly baseUrl: string = environment.baseUrl;

  constructor(private http: HttpClient) {}

  getFundos(sociedad: any): Observable<any> {
    const url = `${this.baseUrl}/maestras/fundos/${sociedad}`;
    try {
      return this.http.get<any>(url);
    } catch (error: any) {
      throw new Error(error.error?.message || 'Error obteniendo fundos');
    }
  }

  getCultivos(sociedad: any): Observable<any> {
    const url = `${this.baseUrl}/maestras/cultivos/${sociedad}`;
    try {
      return this.http.get<any>(url);
    } catch (error: any) {
      throw new Error(error.error?.message || 'Error obteniendo cultivos');
    }
  }

  getGrupos(params: any): Observable<any> {
    const url = `${this.baseUrl}/maestras/grupos/${params.ruc}/${params.idproyecto}/${params.nrodocumento}`;
    try {
      return this.http.get<any>(url);
    } catch (error: any) {
      throw new Error(error.error?.message || 'Error obteniendo grupos');
    }
  }

  getTapas(): Observable<any> {
    const url = `${this.baseUrl}/maestras/tapas`;
    try {
      return this.http.get<any>(url);
    } catch (error: any) {
      throw new Error(error.error?.message || 'Error obteniendo tapas');
    }
  }

  getModulos(sociedad: any): Observable<any> {
    const url = `${this.baseUrl}/maestras/modulos/${sociedad}`;
    try {
      return this.http.get<any>(url);
    } catch (error: any) {
      throw new Error(error.error?.message || 'Error obteniendo modulos');
    }
  }

  getLotes(sociedad: any): Observable<any> {
    const url = `${this.baseUrl}/maestras/lotes/${sociedad}`;
    try {
      return this.http.get<any>(url);
    } catch (error: any) {
      throw new Error(error.error?.message || 'Error obteniendo lotes');
    }
  }

  getTurnos(sociedad: any): Observable<any> {
    const url = `${this.baseUrl}/maestras/turnos/${sociedad}`;
    try {
      return this.http.get<any>(url);
    } catch (error: any) {
      throw new Error(error.error?.message || 'Error obteniendo turnos');
    }
  }

  getVariedades(sociedad: any): Observable<any> {
    const url = `${this.baseUrl}/maestras/variedades/${sociedad}`;
    try {
      return this.http.get<any>(url);
    } catch (error: any) {
      throw new Error(error.error?.message || 'Error obteniendo variedades');
    }
  }

  getEnvases(): Observable<any> {
    const url = `${this.baseUrl}/maestras/envases`;
    try {
      return this.http.get<any>(url);
    } catch (error: any) {
      throw new Error(error.error?.message || 'Error obteniendo envases');
    }
  }

  getCosechadores(params: any): Observable<any> {
    const url = `${this.baseUrl}/maestras/cosechadores/${params.nrodocumento}`;
    try {
      return this.http.get<any>(url);
    } catch (error: any) {
      throw new Error(error.error?.message || 'Error obteniendo cosechadores');
    }
  }

  getAcopios(sociedad: any): Observable<any>{
    const url = `${this.baseUrl}/maestras/acopios/${sociedad}`;
    try{
      return this.http.get<any>(url);
    }catch(error:any){
      throw new Error(error.error?.message || 'Error al obtener los acopios');
    }
  }

  getCecos(params: any): Observable<any>{
    const url = `${this.baseUrl}/tareo/cecos`;
    try{
      let httpParams = new HttpParams();
      const paramsString = JSON.stringify(params)
      httpParams = httpParams.set('parametros', paramsString);
      return this.http.get<any>(url, { params: httpParams });
    }catch(error:any){
      throw new Error(error.error?.message || 'Error al obtener los cecos');
    }
  }

  getLabores(params: any): Observable<any>{
    const url = `${this.baseUrl}/tareo/labor`;
    try{
      let httpParams = new HttpParams();
      const paramsString = JSON.stringify(params)
      httpParams = httpParams.set('parametros', paramsString);
      return this.http.get<any>(url, { params: httpParams });
    }catch(error:any){
      throw new Error(error.error?.message || 'Error al obtener las labores');
    }
  }

  getMonedas(params: any): Observable<any>{
    const url = `${this.baseUrl}/tareo/monedas`;
    try{
      let httpParams = new HttpParams();
      const paramsString = JSON.stringify(params)
      httpParams = httpParams.set('parametros', paramsString);
      return this.http.get<any>(url, { params: httpParams });
    }catch(error:any){
      throw new Error(error.error?.message || 'Error al obtener las monedas');
    }
  }

  getActividades(params: any): Observable<any>{
    const url = `${this.baseUrl}/tareo/labor`;
    try{
      let httpParams = new HttpParams();
      const paramsString = JSON.stringify(params)
      httpParams = httpParams.set('parametros', paramsString);
      return this.http.get<any>(url, { params: httpParams });
    }catch(error:any){
      throw new Error(error.error?.message || 'Error al obtener las labores');
    }
  }

  getIncidencias(params: any): Observable<any>{
    const url = `${this.baseUrl}/tareo/incidencias`;
    try{
      let httpParams = new HttpParams();
      const paramsString = JSON.stringify(params)
      httpParams = httpParams.set('parametros', paramsString);
      return this.http.get<any>(url, { params: httpParams });
    }catch(error:any){
      throw new Error(error.error?.message || 'Error al obtener las labores');
    }
  }

  getMotivosSalida(params: any): Observable<any> {
    const url = `${this.baseUrl}/tareo/motivosalida`;
    try{
      let httpParams = new HttpParams();
      const paramsString = JSON.stringify(params)
      httpParams = httpParams.set('parametros', paramsString);
      return this.http.get<any>(url, { params: httpParams });
    }catch(error:any){
      throw new Error(error.error?.message || 'Error al obtener las labores');
    }
  }
}
