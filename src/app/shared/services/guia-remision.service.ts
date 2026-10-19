import { Injectable, inject } from '@angular/core';
import { ConnectivityService } from './connectivity.service';
import { GuiasApiService } from './guias-api.service';
import { PaletsApiService } from './palets-api.service';

/**
 * Guias de remision: todo se pide al servidor. No guarda ni lee guias, palets ni procesos del equipo (Dexie).
 */
@Injectable({ providedIn: 'root' })
export class GuiaRemisionService {
  private readonly api = inject(GuiasApiService);
  private readonly paletsApi = inject(PaletsApiService);
  private readonly connectivity = inject(ConnectivityService);

  /** Lista las guias de la campania tal cual las responde el servidor. */
  async listarGuiasEnLinea(idProyecto: string, estado: string | null = null, fechaDesde: string | null = null, fechaHasta: string | null = null, texto: string | null = null): Promise<{ data: any[]; error?: string }> {
    const idProyectoFinal = String(idProyecto ?? '').trim();
    if (!idProyectoFinal) return { data: [], error: 'No se encontró el proyecto.' };
    if (!this.connectivity.isOnline()) return { data: [], error: 'Se necesita internet para listar las guías.' };
    const resp: any = await this.api.listar({ idProyecto: idProyectoFinal, estado, fechaDesde, fechaHasta, texto });
    if (resp?.error) return { data: [], error: resp?.mensaje ?? 'Error al listar guías.' };
    return { data: Array.isArray(resp?.data) ? resp.data : [] };
  }

  /** Detalle de una guia. Devuelve `{ error, mensaje }` si el servidor informa un error, o null si no se pudo obtener. */
  async getGuiaRemisionDetalle(idProyecto: string, codigoGuiaRemision: string): Promise<any | null> {
    const idP = String(idProyecto ?? '').trim();
    const codigo = String(codigoGuiaRemision ?? '').trim();
    if (!idP || !codigo) return null;
    if (!this.connectivity.isOnline()) return { error: true, mensaje: 'Se necesita internet para ver la guía.' };

    try {
      const resp: any = await this.api.obtener(idP, codigo);
      if (resp?.error) return resp;
      const data = resp?.data ?? [];

      const detalleData = Array.isArray(data) && data.length > 0 ? data[0] : (data || null);
      if (detalleData?.detalle && typeof detalleData.detalle === 'string') {
        try {
          detalleData.detalle = JSON.parse(detalleData.detalle);
        } catch {
          detalleData.detalle = [];
        }
      }
      return detalleData;
    } catch (error) {
      console.error('Error obteniendo guía remisión:', error);
      return null;
    }
  }

  /** Procesos abiertos con sus palets cerrados libres. La pantalla espera [{ error, data, mensaje }]. */
  async cargarProcesosParaGuia(idProyecto: string): Promise<any> {
    return [await this.api.procesos(idProyecto)];
  }

  /**
   * Palets que se pueden elegir al editar una guia: los libres del proceso (los que ya trae el servidor, sin otra guia activa) mas los
   * de la guia actual, reconstruidos desde su detalle. El numero de palet se pide al servidor.
   */
  async obtenerPaletsParaEdicion(codigoProceso: string, detalleCajas: any[], paletsLibres: any[]): Promise<{ palets: any[]; paletsSeleccionados: string[] }> {
    // Numero de palet de cada palet del proceso (para mostrar "#n" en los palets de la guia actual).
    const numeros = new Map<string, any>();
    try {
      const resp: any = await this.paletsApi.porProceso(codigoProceso);
      if (!resp?.error && Array.isArray(resp?.data)) {
        for (const p of resp.data) numeros.set(String(p?.idPalet ?? '').trim(), p);
      }
    } catch (error) {
      console.error('Error obteniendo los palets del proceso:', error);
    }

    // Palets de la guia actual, agrupados por codigoPalet desde el detalle (cajas).
    const paletsDeGuiaActual = new Map<string, any>();
    for (const caja of detalleCajas ?? []) {
      const cp = String(caja?.codigoPalet ?? '').trim();
      if (!cp) continue;
      const cajas = Number(caja?.cantidadCajas ?? 0);
      const peso = cajas * Number(caja?.pesoPorCaja ?? 0);
      const existente = paletsDeGuiaActual.get(cp);
      if (existente) {
        existente.cantidadCajas += cajas;
        existente.pesoTotal += peso;
      } else {
        paletsDeGuiaActual.set(cp, {
          idPalet: cp,
          numeroPalet: numeros.get(cp)?.numeroPalet ?? null,
          cantidadCajas: cajas,
          pesoTotal: peso,
          estado: 'CERRADO_COMPLETO',
          codigoAcopio: caja?.codigoAcopio ?? '',
          idProceso: caja?.codigoTipoProcesoEmpacado ?? codigoProceso,
        });
      }
    }

    // Libres del proceso + los de la guia actual que falten.
    const idsVistos = new Set((paletsLibres ?? []).map((p: any) => String(p?.idPalet ?? '').trim()));
    const paletsVisibles = [...(paletsLibres ?? [])];
    for (const [cp, p] of paletsDeGuiaActual) {
      if (!idsVistos.has(cp)) {
        paletsVisibles.push(p);
        idsVistos.add(cp);
      }
    }

    return { palets: paletsVisibles, paletsSeleccionados: Array.from(paletsDeGuiaActual.keys()).filter(Boolean) };
  }

  async editarGuiaRemision(payload: any): Promise<any> {
    if (!this.connectivity.isOnline()) {
      return { error: true, mensaje: 'No hay conexión a internet.' };
    }
    try {
      const resp: any = await this.api.editar(payload.idProyecto, payload.guias);
      return resp;
    } catch (error: any) {
      console.error('Error editando guía remisión:', error);
      return { error: true, mensaje: error?.error?.message ?? 'Error al editar la guía.' };
    }
  }

  async consultarEstadoSunat(idProyecto: string, codigoGuiaRemision: string): Promise<any> {
    if (!this.connectivity.isOnline()) {
      return { error: true, mensaje: 'No hay conexión a internet.' };
    }
    try {
      const resp: any = await this.api.consultarEstadoSunat(idProyecto, codigoGuiaRemision);
      return resp;
    } catch (error: any) {
      console.error('Error consultando estado SUNAT:', error);
      return { error: true, mensaje: error?.error?.message ?? 'Error al consultar el estado SUNAT.' };
    }
  }
}
