import { Injectable, inject } from '@angular/core';
import { CatalogosRepository } from '../dexiedb/repository/catalogos.repository';
import { ProcesoRepository } from '../dexiedb/repository/proceso.repository';
import { DPalet } from '../interfaces/palet.interface';
import { PaletsApiService } from './palets-api.service';

const texto = (v: unknown): string => String(v ?? '').trim();

/** Descarga de palets y de sus detalles al equipo (para trabajar sin conexion). Misma logica de la aplicacion anterior. */
@Injectable({ providedIn: 'root' })
export class PaletsSyncService {
  private readonly api = inject(PaletsApiService);
  private readonly repo = inject(ProcesoRepository);
  private readonly catalogos = inject(CatalogosRepository);

  /** Palets de cada proceso: reemplaza los sincronizados y conserva los pendientes. Un proceso que falla no detiene a los demas. */
  async descargarPaletsDeProcesos(idsProceso: string[]): Promise<void> {
    for (const id of idsProceso.map(texto).filter(Boolean)) {
      try {
        const sobre = await this.api.porProceso(id);
        if (sobre?.error) continue;
        await this.repo.paletsRepo.clearSincronizadosByIdProceso(id);
        for (const p of sobre.data ?? []) await this.repo.paletsRepo.saveByIdPalet({ ...p, bd: 1 } as any);
      } catch (error) {
        console.error('Error obteniendo palets para proceso', id, error);
      }
    }
  }

  /**
   * Detalles de palets del acopio. Se borran los sincronizados del equipo y se guardan los del servidor (los pendientes no se tocan).
   * `limpiarSiVacio`: al guardar Parametros tambien se borran cuando el servidor no devuelve nada; en la pantalla Palets no.
   */
  async descargarDPaletsPorAcopio(limpiarSiVacio: boolean): Promise<void> {
    try {
      const sobre = await this.api.dPaletsPorAcopio();
      if (sobre?.error) {
        console.error('Error obteniendo DPalets por acopio:', sobre.mensaje);
        return;
      }
      const items = sobre.data ?? [];
      if (!items.length && !limpiarSiVacio) return;

      const locales = await this.repo.dPaletsRepo.getAll();
      for (const d of (locales ?? []).filter((x: any) => (x.bd ?? 0) === 1)) {
        if ((d as any)._pk != null) await this.repo.dPaletsRepo.delete((d as any)._pk);
      }
      if (!items.length) return;

      for (const d of await this.resolverNombres(items)) await this.repo.dPaletsRepo.saveByIdDPalet({ ...d, bd: 1 });
    } catch (error) {
      console.error('Error sincronizando DPalets por acopio:', error);
    }
  }

  /**
   * Nombres del detalle de un palet. Formato, presentacion, lugar de produccion, codigo de rancho, tipo de empaque guia y tipo de proceso ya los trae el SP;
   * el resto (consignatario, destino, variedad y transporte) se cruza con los catalogos guardados en el equipo, sin tocar palets ni detalles.
   */
  async resolverNombres(dpalets: any[]): Promise<DPalet[]> {
    const c = this.catalogos;
    const [consignatarios, destinos, variedades, transportes] = await Promise.all([
      c.consignatariosRepo.getAll(),
      c.destinosRepo.getAll(),
      c.variedadesRepo.getAll(),
      c.transportesRepo.getAll(),
    ]);

    const consig = new Map(consignatarios.map((x) => [texto(x.documento), x.nombre]));
    const dest = new Map(destinos.map((x) => [texto(x.id), x.pais]));
    const vari = new Map(variedades.map((x) => [texto(x.codigo), x.variedad]));
    const trans = new Map(transportes.map((x) => [texto(x.id), x.transporte]));

    return dpalets.map(
      (d: any) =>
        ({
          ...d,
          consignatarioNombre: consig.get(texto(d.documentoConsignatario)) ?? d.consignatarioNombre ?? '',
          destinoNombre: dest.get(texto(d.destinoId)) ?? d.destinoNombre ?? '',
          formatoNombre: d.formato ?? d.formatoNombre ?? '',
          presentacionNombre: d.presentacion ?? d.presentacionNombre ?? '',
          variedadNombre: vari.get(texto(d.variedadId)) ?? d.variedadNombre ?? '',
          lugarProduccionNombre: d.lugarProduccion ?? d.lugarProduccionNombre ?? '',
          codigoRanchoNombre: d.codigoRancho ?? d.codigoRanchoNombre ?? '',
          tipoEmpaqueGuiaNombre: d.tipoEmpaqueGuia ?? d.tipoEmpaqueGuiaNombre ?? '',
          transporteNombre: trans.get(texto(d.transporteId)) ?? d.transporteNombre ?? '',
          tipoProcesoEmpacadoNombre: d.tipoProcesoEmpacado ?? d.tipoProcesoEmpacadoNombre ?? '',
        }) as DPalet,
    );
  }
}
