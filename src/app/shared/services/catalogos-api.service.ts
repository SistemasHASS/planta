import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

/** Respuesta estandar de los SP: { error, data, mensaje }. */
export interface SobreSp<T = unknown> {
  error: boolean;
  data: T;
  mensaje?: string | null;
}

export type CatalogoPorProyecto = 'tiposProcesoEmpacado' | 'codigosRancho' | 'lugaresProduccion' | 'conductores' | 'vehiculos' | 'transportistas' | 'supervisores' | 'personalLogistico';
export type CatalogoPorCultivo = 'formatos' | 'tiposClamshell' | 'tiposCaja' | 'presentaciones' | 'tiposEmpaqueGuia' | 'categorias' | 'tiposEmpaque';

type Fila = Record<string, any>;

/**
 * Catalogos de la base de datos propia (API: POST api/catalogos/...). Empresa y RUC salen del token.
 * Cada metodo devuelve la respuesta del SP { error, data, mensaje } sin tocarla.
 */
@Injectable({ providedIn: 'root' })
export class CatalogosApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/api/catalogos`;

  clientes(): Promise<SobreSp<Fila[]>> {
    return this.pedir('clientes');
  }

  porProyecto(catalogo: CatalogoPorProyecto, idProyecto: string): Promise<SobreSp<Fila[]>> {
    return this.pedir(`proyecto/${catalogo}`, { idProyecto });
  }

  porCultivo(catalogo: CatalogoPorCultivo, codigoCultivo: string): Promise<SobreSp<Fila[]>> {
    return this.pedir(`cultivo/${catalogo}`, { codigoCultivo });
  }

  destinatarios(): Promise<SobreSp<Fila[]>> {
    return this.pedir('destinatarios');
  }

  consignatarios(): Promise<SobreSp<Fila[]>> {
    return this.pedir('consignatarios');
  }

  variedades(): Promise<SobreSp<Fila[]>> {
    return this.pedir('variedades');
  }

  acopios(idProyecto: string): Promise<SobreSp<Fila[]>> {
    return this.pedir('acopios', { idProyecto });
  }

  motivosTraslado(): Promise<SobreSp<Fila[]>> {
    return this.pedir('motivos-traslado');
  }

  /** Establecimiento emisor de la empresa (para el punto de partida de la guía). */
  establecimientoEmisor(): Promise<SobreSp<Fila[] | Fila>> {
    return this.pedir('establecimiento-emisor') as Promise<SobreSp<Fila[] | Fila>>;
  }

  establecimientos(): Promise<SobreSp<Fila[]>> {
    return this.pedir('establecimientos');
  }

  departamentos(): Promise<SobreSp<Fila[]>> {
    return this.pedir('departamentos');
  }

  provincias(codigoDepartamento: string): Promise<SobreSp<Fila[]>> {
    return this.pedir('provincias', { codigoDepartamento });
  }

  distritos(codigoDepartamento: string, codigoProvincia: string): Promise<SobreSp<Fila[]>> {
    return this.pedir('distritos', { codigoDepartamento, codigoProvincia });
  }

  /** Unidades de medida de los ítems de una guía manual. */
  unidadesMedida(): Promise<SobreSp<Fila[]>> {
    return this.pedir('unidades-medida');
  }

  /** Tipos de locación (puerto o aeropuerto) para traslados por exportación. */
  tiposLocacion(): Promise<SobreSp<Fila[]>> {
    return this.pedir('tipos-locacion');
  }

  puertos(): Promise<SobreSp<Fila[]>> {
    return this.pedir('puertos');
  }

  aeropuertos(): Promise<SobreSp<Fila[]>> {
    return this.pedir('aeropuertos');
  }

  private pedir(ruta: string, cuerpo: Record<string, unknown> = {}): Promise<SobreSp<Fila[]>> {
    return firstValueFrom(this.http.post<SobreSp<Fila[]>>(`${this.baseUrl}/${ruta}`, cuerpo));
  }
}
