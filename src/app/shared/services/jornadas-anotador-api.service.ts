import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SobreSp } from './catalogos-api.service';

type Fila = Record<string, any>;

/** Cómo se identifica lo que toma el anotador: idLinea (línea manual) o idMaquina + curo (curo de una máquina); los que no aplican van en 0. */
export interface RefLinea {
  idLinea: number;
  idMaquina: number;
  curo: number;
}

/**
 * Jornadas del anotador (API: POST api/jornadas-anotador/..., solo rol ANPLA). Los datos viajan como JSON ([{...}]) y el SP los convierte a filas;
 * empresa, RUC, usuario, rol, acopio y nombre salen del token.
 * Devuelven el sobre del SP { error, data, mensaje } sin tocarlo.
 */
@Injectable({ providedIn: 'root' })
export class JornadasAnotadorApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/api/jornadas-anotador`;

  /** Jornada abierta del anotador (o todas las suyas con soloAbierta = false). */
  listar(soloAbierta = true): Promise<SobreSp<Fila[]>> {
    return this.post('listar', { soloAbierta });
  }

  /** Abre una jornada sobre un proceso abierto del acopio del anotador. */
  abrir(idProyecto: string, idProceso: string): Promise<SobreSp<Fila[]>> {
    return this.post('sincronizar', { modo: 'nuevo', idProyecto, idProceso });
  }

  /** Cierra la jornada indicada. */
  cerrar(id: number): Promise<SobreSp<Fila[]>> {
    return this.post('sincronizar', { modo: 'editado', id });
  }

  /** Lineas del acopio con su situacion en el proceso de la jornada abierta: LIBRE, MIA u OCUPADA (con el nombre de quien la tomo). */
  lineas(): Promise<SobreSp<Fila[]>> {
    return this.postSinCuerpo('lineas/listar');
  }

  /** Toma la linea manual o el curo de una maquina (modo nuevo). */
  tomarLinea(linea: RefLinea): Promise<SobreSp<Fila[]>> {
    return this.post('lineas/sincronizar', { modo: 'nuevo', ...linea });
  }

  /** Suelta una linea tomada (modo editado); id = idTomada de la lista. */
  soltarLinea(id: number): Promise<SobreSp<Fila[]>> {
    return this.post('lineas/sincronizar', { modo: 'editado', id });
  }

  /** Busca un trabajador activo de la empresa por su numero de documento (lo que trae el QR). */
  buscarTrabajador(numeroDocumento: string): Promise<SobreSp<Fila[]>> {
    return this.post('trabajador/buscar', { numeroDocumento });
  }

  /** Empacadores asignados a los puestos de las lineas del acopio (jornada abierta). */
  puestos(): Promise<SobreSp<Fila[]>> {
    return this.postSinCuerpo('puestos/listar');
  }

  /** Asigna un empacador a un puesto; si el puesto tenia a otro, lo reemplaza. */
  asignarPuesto(linea: RefLinea, puesto: number, trabajador: { numeroDocumento: string; nombreCompleto: string; apellidoPaterno: string; apellidoMaterno: string }): Promise<SobreSp<Fila[]>> {
    return this.post('puestos/sincronizar', { modo: 'nuevo', ...linea, puesto, ...trabajador });
  }

  /** Mueve al empacador (id = idPuesto) a otro puesto; si el destino tenia a otro, lo reemplaza. */
  moverPuesto(id: number, linea: RefLinea, puesto: number): Promise<SobreSp<Fila[]>> {
    return this.post('puestos/sincronizar', { modo: 'mover', id, ...linea, puesto });
  }

  /** Quita al empacador del puesto (id = idPuesto). */
  quitarPuesto(id: number): Promise<SobreSp<Fila[]>> {
    return this.post('puestos/sincronizar', { modo: 'editado', id });
  }

  /** Vacia la linea: libera a todos sus empacadores (la linea sigue tomada). */
  vaciarLinea(linea: RefLinea): Promise<SobreSp<Fila[]>> {
    return this.post('puestos/sincronizar', { modo: 'vaciar', ...linea });
  }

  /** Tipos de empaque que la matriz de compatibilidad asocia al formato. */
  tiposEmpaque(codigoCultivo: string, formatoId: number): Promise<SobreSp<Fila[]>> {
    return this.post('tipos-empaque/listar', { codigoCultivo, formatoId });
  }

  /** Recolecciones de cajas de la jornada abierta del acopio (mia = 1 en las del usuario). */
  recolecciones(): Promise<SobreSp<Fila[]>> {
    return this.postSinCuerpo('recolecciones/listar');
  }

  /** Historial: mis recolecciones de la jornada con su total de cajas (idRecoleccion = 0) o el detalle de cajas de una recolección mía. */
  historialRecolecciones(idRecoleccion = 0): Promise<SobreSp<Fila[]>> {
    return this.post('recolecciones/cajas/historial', { idRecoleccion });
  }

  /** Cajas registradas por empacador (numeroDocumento) en la recolección abierta del usuario. */
  resumenCajas(): Promise<SobreSp<Fila[]>> {
    return this.postSinCuerpo('recolecciones/cajas/resumen');
  }

  /** Stock actual del anotador: sus cajas que Logística aún no consumió en palets, por formato y tipo de empaque (cada anotador ve solo lo suyo). */
  stockAnotador(): Promise<SobreSp<Fila[]>> {
    return this.postSinCuerpo('stock');
  }

  /** Producción del día: cajas de todos los empacadores en el proceso de la jornada abierta, una fila por anotación (empacador + recolección). */
  produccionDia(): Promise<SobreSp<Fila[]>> {
    return this.postSinCuerpo('produccion');
  }

  /**
   * Movimientos de stock de las cajas del anotador en un día (tipos vacío = todos: ENTRADA, CORRECCION, AJUSTE, SALIDA_PALET).
   * data = { resumen: [{ tipoMovimiento, movimientos, cajas }], movimientos: [{ id, fechaMovimiento, tipoMovimiento, idProceso, fechaProceso, turno, formatoDescripcion, tipoEmpaqueDescripcion,
   * categoriaNombre, calibreNombre, cajas (con signo), numeroRecoleccion, numeroPalet, empacadorDocumento, empacador, observaciones, cajasMovimiento }] }.
   */
  movimientosStock(cuerpo: { fecha: string; tipos: string[] }): Promise<SobreSp<{ resumen: Fila[]; movimientos: Fila[] }>> {
    return this.post('movimientos-stock/listar', cuerpo);
  }

  /**
   * Corrige una anotación (id del registro de cajas): la cantidad y, si se envía `producto`, también el formato y el tipo de empaque (con el calibre del tipo elegido).
   * La base no deja quitar cajas que ya están en palets (ni mover a otro producto cajas que ya salieron a un palet).
   */
  corregirCajas(id: number, cantidadCajas: number, observaciones: string, producto?: { formatoId: number; tipoEmpaqueId: number; calibreNombre: string }): Promise<SobreSp<Fila[]>> {
    return this.post('produccion/corregir', { id, cantidadCajas, observaciones, ...(producto ?? {}) });
  }

  /** Quita al empacador de la recolección abierta: su fila de cajas queda anulada y el stock se devuelve. */
  quitarCajas(cuerpo: RefLinea & { puesto: number }): Promise<SobreSp<Fila[]>> {
    return this.post('recolecciones/cajas/sincronizar', { modo: 'anular', ...cuerpo });
  }

  /** Registra las cajas de un empacador (el del puesto) con el formato y tipo de empaque de la linea, en la recoleccion abierta. */
  registrarCajas(cuerpo: RefLinea & { puesto: number; formatoId: number; tipoEmpaqueId: number; cantidadCajas: number; calibreNombre: string }): Promise<SobreSp<Fila[]>> {
    return this.post('recolecciones/cajas/sincronizar', { modo: 'nuevo', ...cuerpo });
  }

  /** Inicia una recoleccion del anotador (el servidor le pone el numero correlativo). */
  iniciarRecoleccion(): Promise<SobreSp<Fila[]>> {
    return this.post('recolecciones/sincronizar', { modo: 'nuevo' });
  }

  /** Cierra la recoleccion (solo su dueno). */
  cerrarRecoleccion(id: number): Promise<SobreSp<Fila[]>> {
    return this.post('recolecciones/sincronizar', { modo: 'editado', id });
  }

  /** Manda los datos como JSON (arreglo de un elemento: [{...}]); el API lo pasa tal cual al SP, que lo convierte a filas. */
  private post<T>(ruta: string, datos: Record<string, unknown>): Promise<SobreSp<T>> {
    return firstValueFrom(this.http.post<SobreSp<T>>(`${this.baseUrl}/${ruta}`, [datos]));
  }

  /** Consultas que no llevan datos del cliente (todo sale del token). */
  private postSinCuerpo<T>(ruta: string): Promise<SobreSp<T>> {
    return firstValueFrom(this.http.post<SobreSp<T>>(`${this.baseUrl}/${ruta}`, {}));
  }
}
