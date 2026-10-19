import { Injectable, inject } from '@angular/core';
import { CatalogosRepository } from '../dexiedb/repository/catalogos.repository';
import { DPalet } from '../interfaces/palet.interface';

const texto = (v: unknown): string => String(v ?? '').trim();

/** Nombres del detalle de un palet. Los palets y sus detalles se piden siempre a la API; aqui no se guardan en el equipo. */
@Injectable({ providedIn: 'root' })
export class PaletsSyncService {
  private readonly catalogos = inject(CatalogosRepository);

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
