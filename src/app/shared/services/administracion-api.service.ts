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

  /** Parametro activo de la empresa por nombre (ej. Flujo_Empaque): filas con idparametro, valor y activo; vacio si no existe o esta inactivo. */
  parametro(idParametro: string): Promise<SobreSp<Fila[]>> {
    return this.post('parametro', { idParametro });
  }

  correlativosDocumentos(): Promise<SobreSp<Fila[]>> {
    return this.post('correlativos-documentos', {});
  }

  /** Reporte "Códigos caja": combinaciones de la empresa con el nombre de cada dato y la descripción completa (como el detalle de la guía). */
  codigosCaja(): Promise<SobreSp<Fila[]>> {
    return this.post('codigos-caja', {});
  }

  /** Excel de códigos caja que arma la API con solo las filas indicadas (los id de lo que se ve en la tabla). */
  exportarCodigosCaja(ids: number[]): Promise<Blob> {
    return firstValueFrom(this.http.post(`${this.baseUrl}/codigos-caja/exportar-excel`, { ids }, { responseType: 'blob' }));
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

  /** Líneas (activas e inactivas) de un acopio: [{ id, numero, codigoTipoProcesoEmpacado, cantidadPuestos, activo }]. Solo administrador. */
  acopioLineas(codigoAcopio: string): Promise<SobreSp<Fila[]>> {
    return this.post('acopio-lineas/listar', { codigoAcopio });
  }

  /**
   * Crea o actualiza líneas de un acopio (también activar o desactivar). Solo administrador.
   * json = [{ id, modo: 'nuevo' | 'editado', codigoAcopio, codigoTipoProcesoEmpacado, cantidadPuestos, activo }] (texto JSON).
   * Responde por cada fila: [{ rowNo, id, numero, accion }] (el número lo asigna el servidor).
   */
  sincronizarAcopioLineas(json: string): Promise<SobreSp<Fila[]>> {
    return this.post('acopio-lineas/sincronizar', { json });
  }

  /** Máquinas (activas e inactivas) de un acopio: [{ id, codigo, nombre, cantidadCuros, activo }]. Solo administrador. */
  acopioMaquinas(codigoAcopio: string): Promise<SobreSp<Fila[]>> {
    return this.post('acopio-maquinas/listar', { codigoAcopio });
  }

  /**
   * Crea o actualiza máquinas de un acopio (también activar o desactivar). Solo administrador.
   * json = [{ id, modo: 'nuevo' | 'editado', codigoAcopio, codigo, nombre, cantidadCuros, activo }] (texto JSON).
   * Responde por cada fila: [{ rowNo, id, codigo, accion }].
   */
  sincronizarAcopioMaquinas(json: string): Promise<SobreSp<Fila[]>> {
    return this.post('acopio-maquinas/sincronizar', { json });
  }

  /**
   * Kilos de pago por formato y tipo de empaque (solo con Flujo_Empaque activo; si no, responde error). Solo administrador.
   * Cada fila: { formatoId, formatoCodigo, formatoDescripcion, tipoEmpaqueId, tipoEmpaqueCodigo, tipoEmpaqueDescripcion, pesoReal, kilosPago, configurado }.
   * Si todavía no se configuró, kilosPago no viene (la pantalla lo muestra en 0).
   */
  kilosPago(): Promise<SobreSp<Fila[]>> {
    return this.post('kilos-pago/listar', {});
  }

  /**
   * Guarda los kilos de pago de las combinaciones indicadas (crea o actualiza). Solo administrador, solo con Flujo_Empaque activo.
   * json = [{ formatoId, tipoEmpaqueId, kilosPago }] (texto JSON). Responde por cada fila que cambió: [{ formatoId, tipoEmpaqueId, accion }].
   */
  sincronizarKilosPago(json: string): Promise<SobreSp<Fila[]>> {
    return this.post('kilos-pago/sincronizar', { json });
  }

  /**
   * Excel de control interno en pantalla (solo con Flujo_Empaque activo; si no, responde error). Solo administrador.
   * Fechas AAAA-MM-DD (fecha de apertura de la jornada); codigoAcopio vacío = todas las plantas.
   * data = { columnas: [{ clave, formato, tipoEmpaque, categoria, calibreId, calibre, fueraDeMatriz }], detalle: [{ idJornada, fecha, codigoAcopio, anotador, dni, empacador, formatoId, tipoEmpaqueId, categoriaId, cajas, kilos }] }.
   */
  controlInterno(cuerpo: { fechaDesde: string; fechaHasta: string; codigoAcopio: string }): Promise<SobreSp<{ columnas: Fila[]; detalle: Fila[] }>> {
    return firstValueFrom(this.http.post<SobreSp<{ columnas: Fila[]; detalle: Fila[] }>>(`${this.baseUrl}/control-interno/listar`, cuerpo));
  }

  /** El mismo informe como Excel que arma la API. */
  exportarControlInterno(cuerpo: { fechaDesde: string; fechaHasta: string; codigoAcopio: string }): Promise<Blob> {
    return firstValueFrom(this.http.post(`${this.baseUrl}/control-interno/exportar-excel`, cuerpo, { responseType: 'blob' }));
  }

  /**
   * Historial de kilos de los empacadores en un día (solo con Flujo_Empaque activo; el anotador solo ve su acopio, el administrador todos o el que elija).
   * data = [{ codigoAcopio, dni, nombreCompleto, grupo ('MAQUINA' | 'MANUAL'), tipoProcesoCodigo, tipoProcesoNombre, minutosEnSuProceso, metaKilos | null, totalCajas, totalKilosPago, totalKilosReal }].
   */
  historialKilos(cuerpo: { fecha: string; codigoAcopio: string }): Promise<SobreSp<Fila[]>> {
    return this.post('historial-kilos/listar', cuerpo);
  }

  /**
   * Historial de kilos del administrador: lo mismo que historialKilos pero de todos los anotadores (una fila por acopio + anotador + empacador).
   * Cada fila trae además idUsuarioAnotador y nombreAnotador.
   */
  historialKilosAdmin(cuerpo: { fecha: string; codigoAcopio: string }): Promise<SobreSp<Fila[]>> {
    return this.post('historial-kilos-admin/listar', cuerpo);
  }

  private post(ruta: string, cuerpo: object): Promise<SobreSp<Fila[]>> {
    return firstValueFrom(this.http.post<SobreSp<Fila[]>>(`${this.baseUrl}/${ruta}`, cuerpo));
  }
}
