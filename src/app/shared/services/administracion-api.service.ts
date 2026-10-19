import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SobreSp } from './catalogos-api.service';

type Fila = Record<string, any>;

/**
 * Listados de administracion que el equipo descarga para trabajar sin conexion (API: POST api/administracion/...).
 * Empresa y RUC salen del token.
 */
@Injectable({ providedIn: 'root' })
export class AdministracionApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/api/administracion`;

  matricesCompatibilidad(idProyecto?: string, codigoCultivo?: string): Promise<SobreSp<Fila[]>> {
    return this.post('matrices-compatibilidad', { idProyecto, codigoCultivo });
  }

  reglasSobrepeso(idProyecto?: string, codigoCultivo?: string): Promise<SobreSp<Fila[]>> {
    return this.post('reglas-sobrepeso', { idProyecto, codigoCultivo });
  }

  correlativosDocumentos(): Promise<SobreSp<Fila[]>> {
    return this.post('correlativos-documentos', {});
  }

  /**
   * Guarda la serie de guia y los tipos de proceso empacado de uno o varios acopios.
   * json = [{ codigoAcopio, acopioNombre, serieGuia }], jsonDetalle = [{ codigoAcopio, codigoTipoProcesoEmpacado, activo }] (texto JSON).
   */
  sincronizarAcopiosConfig(json: string, jsonDetalle: string): Promise<SobreSp<Fila[]>> {
    return this.post('acopios-config/sincronizar', { json, jsonDetalle });
  }

  /** Usuarios de la aplicación con el acopio y la serie de guía que tienen asignados. */
  usuarios(): Promise<SobreSp<Fila[]>> {
    return this.post('usuarios/listar', {});
  }

  /** Asigna acopio y serie a usuarios. json = [{ id, modo: 'editado', usuario, documentoIdentidad, nombre, idRol, codigoAcopio, acopioNombre, serieGuia }] (texto JSON). */
  sincronizarUsuarios(json: string): Promise<SobreSp<Fila[]>> {
    return this.post('usuarios/sincronizar', { json });
  }

  /** Crea o actualiza destinatarios (también activar o desactivar). json = lista de destinatarios (texto JSON). */
  sincronizarDestinatarios(json: string): Promise<SobreSp<Fila[]>> {
    return this.post('destinatarios/sincronizar', { json });
  }

  /** Asigna el grupo cliente y los códigos rancho de un consignatario. json = [{ documento, nombre, codigoGrupoCliente, codigosRancho: [{ codigo, activo }] }] (texto JSON). */
  sincronizarConsignatarios(json: string): Promise<SobreSp<Fila[]>> {
    return this.post('consignatarios/sincronizar', { json });
  }

  /** Crea variedades de ensayo o edita su nombre y la procedencia de cualquier variedad. json = [{ id (vacío si es nueva), cultivo, idcultivo, variedad, procedencia, esEnsayo, eliminado }] (texto JSON). */
  sincronizarVariedades(json: string): Promise<SobreSp<Fila[]>> {
    return this.post('variedades/sincronizar', { json });
  }

  /** Crea o actualiza (también activar o desactivar) un registro de catálogo. tabla = la tabla del catálogo (PLANTA_Conductores, PLANTA_Formatos, etc.); json = lista de una fila (texto JSON). */
  sincronizarCatalogo(tabla: string, json: string): Promise<SobreSp<Fila[]>> {
    return this.post('catalogos-operativos/sincronizar', { tabla, json });
  }

  /** Crea una serie de guía o la activa/desactiva. json = [{ id, modo: 'nuevo' | 'editado', serie, numero, eliminado }] (texto JSON). */
  sincronizarCorrelativos(json: string): Promise<SobreSp<Fila[]>> {
    return this.post('correlativos-documentos/sincronizar', { json });
  }

  /** Crea o actualiza reglas de sobrepeso (también activar o desactivar). json = lista de reglas (texto JSON). */
  sincronizarReglasSobrepeso(json: string): Promise<SobreSp<Fila[]>> {
    return this.post('reglas-sobrepeso/sincronizar', { json });
  }

  /** Crea o actualiza combinaciones de la matriz (también activar o desactivar). json = lista de combinaciones (texto JSON). */
  sincronizarMatricesCompatibilidad(json: string): Promise<SobreSp<Fila[]>> {
    return this.post('matrices-compatibilidad/sincronizar', { json });
  }

  private post(ruta: string, cuerpo: object): Promise<SobreSp<Fila[]>> {
    return firstValueFrom(this.http.post<SobreSp<Fila[]>>(`${this.baseUrl}/${ruta}`, cuerpo));
  }
}
