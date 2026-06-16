import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { GuiaService } from '../services/guia.service';
import { ConnectivityService } from '../services/connectivity.service';
import { GuiasRemisionRepository } from '../dexiedb/repository/guias-remision.repository';
import { ProcesoRepository } from '../dexiedb/repository/proceso.repository';
import { CatalogosRepository } from '../dexiedb/repository/catalogos.repository';

@Injectable({ providedIn: 'root' })
export class GuiaRemisionFacade {
  private readonly guiaService = inject(GuiaService);
  private readonly connectivity = inject(ConnectivityService);
  private readonly guiasRemisionRepo = inject(GuiasRemisionRepository);
  private readonly procesoRepo = inject(ProcesoRepository);
  private readonly catalogosRepo = inject(CatalogosRepository);

  async listarGuiasRemision(idProyecto: string,estado: string | null = null,fechaDesde: string | null = null,fechaHasta: string | null = null,texto: string | null = null): Promise<{ data: any[]; error?: string }> {
    const idProyectoFinal = String(idProyecto ?? '').trim();
    if (!idProyectoFinal) {
      return { data: [], error: 'No se encontró el proyecto.' };
    }

    let guiasRaw: any[] = [];

    if (this.connectivity.isOnline()) {
      let resp: any = await firstValueFrom(this.guiaService.listarGuiasRemision(idProyectoFinal, estado, fechaDesde, fechaHasta, texto));
      if (Array.isArray(resp) && resp.length > 0) {
        resp = resp[0];
      }
      if (resp?.error) {
        return { data: [], error: resp?.mensaje ?? 'Error al listar guías.' };
      }
      const data = resp?.data ?? [];
      guiasRaw = Array.isArray(data) ? data : [];

      // Persistir en Dexie para uso offline
      try {
        const guiasExistentes = await this.guiasRemisionRepo.guiasRepo.getByIdProyecto(idProyectoFinal);
        for (const g of guiasExistentes) {
          const codigo = String(g?.codigoGuiaRemision ?? '').trim();
          const bd = (g as any)?.bd;
          const esOffline = codigo.startsWith('OFF_');
          if (codigo && !esOffline && (bd === 1 || String(bd ?? '').trim() === '1')) {
            await this.guiasRemisionRepo.paletsRepo.clearByCodigoGuiaRemision(codigo);
          }
        }
        // Borrar solo guias sincronizadas (preservar las no sincronizadas creadas offline)
        const keysSync = guiasExistentes
          .filter((g: any) => {
            const codigo = String(g?.codigoGuiaRemision ?? '').trim();
            const bd = g?.bd;
            const esOffline = codigo.startsWith('OFF_');
            return !esOffline && (bd === 1 || String(bd ?? '').trim() === '1');
          })
          .map((g: any) => g?._pk)
          .filter(Boolean);
        if (keysSync?.length) await this.guiasRemisionRepo.guiasRepo.bulkDelete(keysSync);

        for (const guia of guiasRaw) {
          const { detalle, ...guiaSinDetalle } = guia;
          const guiaParaGuardar = {
            ...guiaSinDetalle,
            idProyecto: idProyectoFinal,
            bd: 1,
            fechaCreacion: new Date().toISOString(),
          };
          await this.guiasRemisionRepo.guiasRepo.saveByCodigoGuiaRemision(guiaParaGuardar);

          const detalleItems = Array.isArray(guia.detalle) ? guia.detalle : [];
          for (const palet of detalleItems) {
            await this.guiasRemisionRepo.paletsRepo.save({
              codigoGuiaRemision: String(guia?.codigoGuiaRemision ?? '').trim(),
              transactionId_uuid: String(guia?.transactionId_uuid ?? '').trim(),
              codigoPalet: String(palet?.codigoPalet ?? '').trim(),
              codigoItem: String(palet?.codigoItem ?? '').trim(),
              cantidadCajas: Number(palet?.cantidadCajas ?? 0),
              fechaCreacion: new Date().toISOString(),
              bd: 1,
            });
          }
        }
      } catch (dexieErr) {
        console.error('Error guardando guías en Dexie:', dexieErr);
      }

      // Mergear guías offline (bd:0) al resultado para mostrarlas junto con las del API
      try {
        const codigosApi = new Set(guiasRaw.map(g => String(g?.codigoGuiaRemision ?? '').trim()));
        const guiasDexie = await this.guiasRemisionRepo.guiasRepo.getByIdProyecto(idProyectoFinal);
        for (const g of (guiasDexie ?? [])) {
          const bd = (g as any)?.bd;
          const esOffline = bd === 0 || String(bd ?? '').trim() === '0';
          const codigo = String(g?.codigoGuiaRemision ?? '').trim();
          if (esOffline && !codigosApi.has(codigo)) {
            const palets = await this.guiasRemisionRepo.paletsRepo.getByCodigoGuiaRemision(codigo);
            const guiaOffline = { ...g, detalle: (palets ?? []).map((p: any) => ({ ...p })) };
            guiasRaw.push(guiaOffline);
          }
        }
      } catch (e) {
        console.error('Error mergeando guías offline:', e);
      }
    } else {
      // Offline: leer de Dexie + reconstruir detalle de palets
      const guiasDexie = await this.guiasRemisionRepo.guiasRepo.getByIdProyecto(idProyectoFinal);
      guiasRaw = [];
      for (const g of (guiasDexie ?? [])) {
        const guia = { ...g };
        const palets = await this.guiasRemisionRepo.paletsRepo.getByCodigoGuiaRemision(guia.codigoGuiaRemision);
        guia.detalle = (palets ?? []).map((p: any) => ({ ...p }));
        guiasRaw.push(guia);
      }
    }

    // Aplicar filtros locales comunes
    if (estado) {
      guiasRaw = guiasRaw.filter((g: any) => String(g?.estado ?? '').toUpperCase() === estado.toUpperCase());
    }
    if (fechaDesde || fechaHasta) {
      guiasRaw = guiasRaw.filter((g: any) => {
        const f = String(g?.fechaCreacionWeb ?? g?.fechaCreacion ?? '').trim();
        if (!f) return false;
        const d = new Date(f).getTime();
        if (isNaN(d)) return false;
        if (fechaDesde) {
          const desde = new Date(fechaDesde + 'T00:00:00').getTime();
          if (d < desde) return false;
        }
        if (fechaHasta) {
          const hasta = new Date(fechaHasta + 'T23:59:59').getTime();
          if (d > hasta) return false;
        }
        return true;
      });
    }
    if (texto) {
      const t = texto.toLowerCase();
      guiasRaw = guiasRaw.filter((g: any) => {
        const campos = [
          String(g?.codigoGuiaRemision ?? ''),
          String(g?.serie ?? ''),
          String(g?.numero ?? ''),
          String(g?.nombreProceso ?? ''),
          String(g?.nombreDestinatario ?? ''),
          String(g?.puntoPartida ?? ''),
          String(g?.puntoLlegada ?? ''),
          String(g?.documentoDestinatario ?? ''),
          String(g?.estado ?? ''),
        ];
        return campos.some(c => c.toLowerCase().includes(t));
      });
    }

    return { data: guiasRaw };
  }

  private async obtenerGuiaDexie(idProyecto: string, codigo: string): Promise<any | null> {
    const guia = await this.guiasRemisionRepo.guiasRepo.getByCodigoGuiaRemision(codigo);
    if (!guia) return null;
    const idProjGuia = String((guia as any)?.idProyecto ?? '').trim();
    if (idProjGuia !== idProyecto) return null;
    const detalleData = { ...guia };
    const palets = await this.guiasRemisionRepo.paletsRepo.getByCodigoGuiaRemision(codigo);
    const codigosCaja = await this.catalogosRepo.codigosCajaRepo.getAll();
    const cajaMap = new Map<string, any>();
    for (const c of (codigosCaja ?? [])) {
      const codItem = String(c?.codigoItem ?? '').trim();
      if (codItem) cajaMap.set(codItem, c);
    }
    detalleData.detalle = (palets ?? []).map((p: any) => {
      const codigoItem = String(p?.codigoItem ?? '').trim();
      const caja = cajaMap.get(codigoItem);
      return {
        ...p,
        codigoItem,
        documentoConsignatario: caja?.documentoConsignatario ?? '',
        idDestino: caja?.idDestino ?? '',
        codigoFormato: caja?.codigoFormato ?? '',
        codigoVariedad: caja?.codigoVariedad ?? '',
        idTipoEmpaqueGuia: caja?.idTipoEmpaqueGuia ?? null,
        codigoRancho: caja?.codigoRancho ?? '',
        idLugarProduccion: caja?.idLugarProduccion ?? null,
        idPresentacion: caja?.idPresentacion ?? null,
        pesoPorCaja: caja?.pesoPorCaja ?? 0,
        idTransporte: caja?.idTransporte ?? '',
      };
    });
    return detalleData;
  }

  async getGuiaRemisionDetalle(idProyecto: string, codigoGuiaRemision: string): Promise<any | null> {
    const idP = String(idProyecto ?? '').trim();
    const codigo = String(codigoGuiaRemision ?? '').trim();
    if (!idP || !codigo) return null;

    // Si es una guía offline (prefijo OFF_), siempre leer desde Dexie
    if (codigo.startsWith('OFF_')) {
      return await this.obtenerGuiaDexie(idP, codigo);
    }

    if (this.connectivity.isOnline()) {
      try {
        let resp: any = await firstValueFrom(this.guiaService.getGuiaRemision(idP, codigo));
        if (Array.isArray(resp) && resp.length > 0) {
          resp = resp[0];
        }
        if (resp?.error) return null;
        const data = resp?.data ?? [];
        const detalleData = Array.isArray(data) && data.length > 0 ? data[0] : (data || null);
        if (detalleData?.detalle && typeof detalleData.detalle === 'string') {
          try {
            detalleData.detalle = JSON.parse(detalleData.detalle);
          } catch {
            detalleData.detalle = [];
          }
        }
        // Guardar en Dexie para edicion offline
        if (detalleData) {
          await this.guiasRemisionRepo.guiasRepo.saveByCodigoGuiaRemision(detalleData);
          const detalle = Array.isArray(detalleData?.detalle) ? detalleData.detalle : [];
          for (const palet of detalle) {
            await this.guiasRemisionRepo.paletsRepo.saveByCodigoGuiaRemision({
              ...palet,
              codigoGuiaRemision: codigo,
            });
          }
        }
        return detalleData;
      } catch (error) {
        console.error('Error obteniendo guía remisión:', error);
        // Fallback a Dexie si el API falla
        return await this.obtenerGuiaDexie(idP, codigo);
      }
    } else {
      return await this.obtenerGuiaDexie(idP, codigo);
    }
  }

  async cargarProcesosParaGuia(codigoGuiaRemisionExcluir?: string): Promise<any> {
    if (this.connectivity.isOnline()) {
       let pro= await firstValueFrom(this.guiaService.listarProcesosGuia());
       return pro
    }

    const procesos = await this.procesoRepo.procesosRepo.getAll();
    const abiertos = (procesos ?? []).filter((p: any) => String(p?.estado ?? '').trim().toUpperCase() === 'ABIERTO');

    const excluir = String(codigoGuiaRemisionExcluir ?? '').trim();

    // Obtener palets que ya estan en guias activas (no anuladas ni eliminadas)
    const todasGuias = await this.guiasRemisionRepo.guiasRepo.getAll();
    const guiasActivas = (todasGuias ?? []).filter((g: any) => {
      const estado = String(g?.estado ?? '').trim().toUpperCase();
      const eliminado = !!(g as any)?.eliminado;
      return estado !== 'ANULADA' && estado !== 'ELIMINADA' && !eliminado;
    });

    const paletsEnGuiasActivas = new Set<string>();
    for (const g of guiasActivas) {
      const codigoGuia = String(g?.codigoGuiaRemision ?? '').trim();
      if (codigoGuia === excluir) continue;
      if (!codigoGuia) continue;
      const paletsGuia = await this.guiasRemisionRepo.paletsRepo.getByCodigoGuiaRemision(codigoGuia);
      for (const pg of (paletsGuia ?? [])) {
        const codigo = String(pg?.codigoPalet ?? pg?.idPalet ?? '').trim();
        if (codigo) paletsEnGuiasActivas.add(codigo);
      }
    }

    const resultado: any[] = [];
    for (const pro of abiertos) {
      const idProceso = String((pro as any)?.idProceso ?? '').trim();
      if (!idProceso) continue;

      const palets = await this.procesoRepo.paletsRepo.getByIdProceso(idProceso);
      const paletsCerrados = (palets ?? []).filter((p: any) => {
        const estado = String(p?.estado ?? '').trim().toUpperCase();
        const eliminado = !!(p as any)?.eliminado;
        if (!(estado === 'CERRADO_COMPLETO' || estado === 'CERRADO_SALDO') || eliminado) return false;
        const idPalet = String(p?.idPalet ?? p?.codigoPalet ?? '').trim();
        return !paletsEnGuiasActivas.has(idPalet);
      });

      if (paletsCerrados.length > 0) {
        resultado.push({
          ...pro,
          nroPalets: paletsCerrados.length,
          palets: paletsCerrados,
        });
      }
    }

    return [
      {
        error: false,
        mensaje: 'Procesos obtenidos correctamente.',
        data: resultado,
      },
    ];
  }

  async obtenerPaletsParaEdicion(idProyecto: string, codigoProceso: string, codigoGuiaRemision: string, detalleCajas: any[]): Promise<{ palets: any[]; paletsSeleccionados: string[] }> {
    // 1. Todos los palets del proceso desde Dexie
    const todosPalets = await this.procesoRepo.paletsRepo.getByIdProceso(codigoProceso);

    // 2. Palets ocupados en otras guias activas del proyecto
    const guias = await this.guiasRemisionRepo.guiasRepo.getByIdProyecto(idProyecto);

    const guiasActivas = (guias ?? []).filter((g: any) => {
      const estado = String(g?.estado ?? '').trim().toUpperCase();
      const eliminado = !!(g as any)?.eliminado;
      return estado !== 'ANULADA' && estado !== 'ELIMINADA' && !eliminado;
    });

    const paletsOcupados = new Set<string>();

    for (const g of guiasActivas) {
      const cg = String(g?.codigoGuiaRemision ?? '').trim();
      if (cg === codigoGuiaRemision) {
        continue;
      }
      const paletsGuia = await this.guiasRemisionRepo.paletsRepo.getByCodigoGuiaRemision(cg);
      for (const pg of (paletsGuia ?? [])) {
        const cp = String(pg?.codigoPalet ?? pg?.idPalet ?? '').trim();
        if (cp) paletsOcupados.add(cp);
      }
    }
    
    // 3. Palets libres del proceso (sin otra guía activa)
    const paletsLibres = (todosPalets ?? []).filter((p: any) => {
      if(p.estado === 'CERRADO_COMPLETO' || p.estado === 'CERRADO_SALDO') {
        const cp = String(p?.idPalet ?? '').trim();
        return !paletsOcupados.has(cp);
      }
      return false;
    });
        
    // 4. Reconstruir palets de la guía actual desde el detalle (cajas), agrupando por codigoPalet
    const paletsDeGuiaActual = new Map<string, any>();
    for (const caja of (detalleCajas ?? [])) {
      const cp = String(caja?.codigoPalet ?? '').trim();
      if (!cp) continue;
      const existente = paletsDeGuiaActual.get(cp);
      if (existente) {
        existente.cantidadCajas += Number(caja?.cantidadCajas ?? 0);
        existente.pesoTotal += Number(caja?.cantidadCajas ?? 0) * Number(caja?.pesoPorCaja ?? 0);
      } else {
        // Buscar numeroPalet en la tabla palet de Dexie
        const paletEncontrado = (todosPalets ?? []).find((tp: any) => String(tp?.idPalet ?? '').trim() === cp);
        paletsDeGuiaActual.set(cp, {
          idPalet: cp,
          numeroPalet: paletEncontrado?.numeroPalet ?? null,
          cantidadCajas: Number(caja?.cantidadCajas ?? 0),
          pesoTotal: Number(caja?.cantidadCajas ?? 0) * Number(caja?.pesoPorCaja ?? 0),
          estado: 'CERRADO_COMPLETO',
          codigoAcopio: caja?.codigoAcopio ?? '',
          idProceso: caja?.codigoTipoProcesoEmpacado ?? codigoProceso,
        });
      }
    }

    // 5. Merge: palets libres del proceso + palets reconstruidos de la guía actual (si faltan)
    const idsVistos = new Set(paletsLibres.map((p: any) => String(p?.idPalet ?? '').trim()));
    const paletsVisibles = [...paletsLibres];
    for (const [cp, p] of paletsDeGuiaActual) {
      if (!idsVistos.has(cp)) {
        paletsVisibles.push(p);
        idsVistos.add(cp);
      }
    }

    const paletsSeleccionados = Array.from(paletsDeGuiaActual.keys()).filter(Boolean);

    return { palets: paletsVisibles, paletsSeleccionados };
  }

  async sincronizarGuiasOffline(idProyecto: string): Promise<{ success: boolean; mensaje: string; guiasSincronizadas: number }> {
    const idP = String(idProyecto ?? '').trim();
    if (!idP) {
      return { success: false, mensaje: 'No se encontró el proyecto.', guiasSincronizadas: 0 };
    }
    if (!this.connectivity.isOnline()) {
      return { success: false, mensaje: 'No hay conexión a internet.', guiasSincronizadas: 0 };
    }

    const guiasDexie = await this.guiasRemisionRepo.guiasRepo.getByIdProyecto(idP);
    const guiasOffline = (guiasDexie ?? []).filter((g: any) => {
      const bd = g?.bd;
      return bd === 0 || String(bd ?? '').trim() === '0';
    });

    if (guiasOffline.length === 0) {
      return { success: true, mensaje: 'No hay guías pendientes de sincronización.', guiasSincronizadas: 0 };
    }

    const guiasPayload: any[] = [];
    for (const g of guiasOffline) {
      const palets = await this.guiasRemisionRepo.paletsRepo.getByCodigoGuiaRemision(g.codigoGuiaRemision);
      const detallePalets = (palets ?? []).map((p: any) => ({
        codigoGuiaRemision: String(g?.codigoGuiaRemision ?? '').trim(),
        transactionId_uuid: String(g?.transactionId_uuid ?? '').trim(),
        codigoPalet: String(p?.codigoPalet ?? p?.idPalet ?? '').trim(),
      }));

      const guiaPayload = {
        ...g,
        detallePalets,
      };
      // Eliminar campos internos de Dexie que no van al API
      delete (guiaPayload as any)._pk;
      delete (guiaPayload as any).bd;
      delete (guiaPayload as any).sincroniza;
      delete (guiaPayload as any).fechaCreacion;
      guiasPayload.push(guiaPayload);
    }

    const syncPayload = {
      idProyecto: idP,
      guias: guiasPayload,
    };

    try {
      const resp: any = await firstValueFrom(this.guiaService.sincronizarGuiasRemision(syncPayload));
      if (resp?.error) {
        return { success: false, mensaje: resp?.mensaje ?? 'Error al sincronizar guías.', guiasSincronizadas: 0 };
      }

      // Actualizar guías en Dexie: marcar como sincronizadas
      for (const g of guiasOffline) {
        const codigo = String(g?.codigoGuiaRemision ?? '').trim();
        if (!codigo) continue;
        await this.guiasRemisionRepo.guiasRepo.saveByCodigoGuiaRemision({
          ...g,
          bd: 1,
          sincroniza: 'sincronizado',
        });
      }

      return { success: true, mensaje: 'Guías sincronizadas correctamente.', guiasSincronizadas: guiasOffline.length };
    } catch (error: any) {
      console.error('Error sincronizando guías offline:', error);
      return { success: false, mensaje: error?.error?.message ?? 'Error al sincronizar guías.', guiasSincronizadas: 0 };
    }
  }

  async editarGuiaRemision(payload: any): Promise<any> {
    if (!this.connectivity.isOnline()) {
      return { error: true, mensaje: 'No hay conexión a internet.' };
    }
    try {
      let resp: any = await firstValueFrom(this.guiaService.editarGuiaRemision(payload));
      if (Array.isArray(resp) && resp.length > 0) {
        resp = resp[0];
      }
      return resp;
    } catch (error: any) {
      console.error('Error editando guía remisión:', error);
      return { error: true, mensaje: error?.error?.message ?? 'Error al editar la guía.' };
    }
  }
}
