import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class CatalogoService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/catalogos`;

  sincronizarCatalogos(tabla: string, json: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/sincronizar`, { tabla, json }, { withCredentials: true });
  }

  listarUsuariosAcopios(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/get-listaUsuarios`, { withCredentials: true });
  }

  listarPersonalLogistico(idProyecto: string=''): Observable<any> {
    const json = JSON.stringify({
      idproyecto: idProyecto
    });
    return this.http.get<any>(`${this.apiUrl}/get-personalLogistico`, { params: { json }, withCredentials: true });
  }

  listarSupervisores(idProyecto: string=''): Observable<any> {
    const json = JSON.stringify({
      idproyecto: idProyecto
    });
    return this.http.get<any>(`${this.apiUrl}/get-supervisores`, { params: { json }, withCredentials: true });
  }

  listarTransportistas(idProyecto: string=''): Observable<any> {
    const json = JSON.stringify({
      idproyecto: idProyecto
    });
    return this.http.get<any>(`${this.apiUrl}/get-transportistas`, { params: { json }, withCredentials: true });
  }

  listarVehiculos(idProyecto: string=''): Observable<any> {
    const json = JSON.stringify({
      idproyecto: idProyecto
    });
    return this.http.get<any>(`${this.apiUrl}/get-vehiculos`, { params: { json }, withCredentials: true });
  }

  listarConductores(idProyecto: string=''): Observable<any> {
    const json = JSON.stringify({
      idproyecto: idProyecto
    });
    return this.http.get<any>(`${this.apiUrl}/get-conductores`, { params: { json }, withCredentials: true });
  }

  listarLugaresProduccion(idProyecto: string=''): Observable<any> {
    const json = JSON.stringify({
      idproyecto: idProyecto
    });
    return this.http.get<any>(`${this.apiUrl}/get-lugaresProduccion`, { params: { json }, withCredentials: true });
  }

  listarTiposCaja(codigoCultivo: string = ''): Observable<any> {
    const json = JSON.stringify({
      codigoCultivo: codigoCultivo
    });
    return this.http.get<any>(`${this.apiUrl}/get-tiposCajas`, { params: { json }, withCredentials: true });
  }

  listarPresentaciones(codigoCultivo: string = ''): Observable<any> {
    const json = JSON.stringify({
      codigoCultivo: codigoCultivo
    });
    return this.http.get<any>(`${this.apiUrl}/get-presentaciones`, { params: { json }, withCredentials: true });
  }

  listarTiposEmpaqueGuia(codigoCultivo: string = ''): Observable<any> {
    const json = JSON.stringify({
      codigoCultivo: codigoCultivo
    });
    return this.http.get<any>(`${this.apiUrl}/get-tiposEmpaqueGuia`, { params: { json }, withCredentials: true });
  }
  listarTiposEmpaques(codigoCultivo: string = ''): Observable<any> {
    const json = JSON.stringify({
      codigoCultivo: codigoCultivo
    });
    return this.http.get<any>(`${this.apiUrl}/get-tiposEmpaques`, { params: { json }, withCredentials: true });
  }

  listarCategoria(codigoCultivo: string = ''): Observable<any> {
    const json = JSON.stringify({
      codigoCultivo: codigoCultivo
    });
    return this.http.get<any>(`${this.apiUrl}/get-categoria`, { params: { json }, withCredentials: true });
  }

  listarAcopios(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/get-acopios`, { withCredentials: true });
  }

  listarFundos(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/get-fundos`, { withCredentials: true });
  }

  listarFormatos(codigoCultivo: string=''): Observable<any> {
    const json = JSON.stringify({
      codigoCultivo: codigoCultivo
    });
    return this.http.get<any>(`${this.apiUrl}/get-formatos`,{ params: { json }, withCredentials: true });
  }

  listarClientes(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/get-clientes`, { withCredentials: true });
  }

  listarVariedades(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/get-variedades`, { withCredentials: true });
  }

  listarCultivos(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/get-cultivos`, { withCredentials: true });
  }

  listarCampanias(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/get-campanias`, { withCredentials: true });
  }

  listarPaises(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/get-paises`, { withCredentials: true });
  }

  listarCalibres(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/get-calibres`, { withCredentials: true });
  }

  listarTransporte(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/get-transporte`, { withCredentials: true });
  }

  listarTiposClamshell(codigoCultivo: string = ''): Observable<any> {
    const json = JSON.stringify({
      codigoCultivo: codigoCultivo
    });
    return this.http.get<any>(`${this.apiUrl}/get-tiposClamshell`, { params: { json }, withCredentials: true });
  }

  // ── Catálogos generales (todos los catálogos de una vez) ──
  listarTodos(filtros?: Record<string, unknown>): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/listar`, filtros ?? {});
  }

  listarForTablaCatalogos(tabla: string, codicoCultivo: string = '',idproyecto:string='') {
    console.log(tabla)
    const t = String(tabla ?? '').trim();

    switch (t) {
      case 'Destinos':
        return this.listarPaises()

      case 'PLANTA_PersonalLogistica':
      case 'PersonalLogistica':
        return this.listarPersonalLogistico(idproyecto);

      case 'PLANTA_Supervisores':
      case 'Supervisores':
        return this.listarSupervisores(idproyecto);

      case 'PLANTA_Transportistas':
      case 'Transportistas':
        return this.listarTransportistas(idproyecto);

      case 'PLANTA_Vehiculos':
      case 'Vehiculos':
        return this.listarVehiculos(idproyecto);

      case 'PLANTA_Conductores':
      case 'Conductores':
        return this.listarConductores(idproyecto);

      case 'PLANTA_LugaresProduccion':
      case 'LugaresProduccion':
        return this.listarLugaresProduccion(idproyecto);

      case 'PLANTA_TiposCaja':
      case 'TiposCaja':
        return this.listarTiposCaja(codicoCultivo);

      case 'PLANTA_Presentacion':
      case 'Presentacion':
        return this.listarPresentaciones(codicoCultivo);

      case 'PLANTA_TiposEmpaqueGuia':
      case 'TiposEmpaqueGuia':
        return this.listarTiposEmpaqueGuia(codicoCultivo);

      case 'PLANTA_TiposEmpaque':
      case 'PLANTA_TiposEmpaques':
      case 'TiposEmpaque':
        return this.listarTiposEmpaques(codicoCultivo);

      case 'PLANTA_Categorias':
      case 'Categorias':
        return this.listarCategoria(codicoCultivo);

      case 'PLANTA_Acopio_SerieGuia':
      case 'Acopios':
        return this.listarAcopios();

      case 'Fundos':
        return this.listarFundos();

      case 'PLANTA_Formatos':
        return this.listarFormatos(codicoCultivo);

      case 'Clientes':
        return this.listarClientes();

      case 'Consignatarios':
        return this.listarClientes();

      case 'PLANTA_Variedades':
      case 'Variedades':
        return this.listarVariedades();

      case 'Cultivos':
        return this.listarCultivos();

      case 'Campanias':
        return this.listarCampanias();

      case 'Paises':
        return this.listarPaises();

      case 'PLANTA_Calibres':
      case 'Calibres':
        return this.listarCalibres();

      case 'PLANTA_Transporte':
      case 'Transporte':
        return this.listarTransporte();

      case 'PLANTA_tiposClamshell':
      case 'tiposClamshell':
        return this.listarTiposClamshell(codicoCultivo);

      default:
        return throwError(() => new Error(`Tabla no soportada en listarForTablaCatalogos: ${t}`));
    }
  }

  listarTodosOperarios(filtros?: Record<string, unknown>): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/operarios/listar`, filtros ?? {});
  }


  // ── Cascading selects (MatrizCompatibilidad) ──
  listarDestinos(filtros: { consignatarioId?: number } = {}): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/destinos`, filtros);
  }

  listarTiposDesdeMatriz(filtros: Record<string, unknown> = {}): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/tipos-desde-matriz`, filtros);
  }

  listarCodigosRancho(filtros: { lugarProduccionId?: number; consignatarioId?: number } = {}): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/codigos-rancho`, filtros);
  }

  verificarDriscoll(filtros: { consignatarioId: number }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/verificar-driscoll`, filtros);
  }

  obtenerCampaniaActiva(): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/campania-activa`, {});
  }

  obtenerConfigTipoProceso(filtros: { acopioId?: number } = {}): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/config-tipo-proceso`, filtros);
  }
}
