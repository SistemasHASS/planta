import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CatalogoService } from '../services/catalogo.service';
import { ConnectivityService } from '../services/connectivity.service';
import { CatalogosRepository } from '../dexiedb/repository/catalogos.repository';
import { CatalogosOperativosRepository } from '../dexiedb/repository/catalogos-operacionales.repository';

@Injectable({ providedIn: 'root' })
export class CatalogosFacade {
  private readonly catalogoService = inject(CatalogoService);
  private readonly connectivity = inject(ConnectivityService);
  private readonly catalogosRepo = inject(CatalogosRepository);
  private readonly catalogosOperativosRepo = inject(CatalogosOperativosRepository);

  async cargarDestinatarios(): Promise<any[]> {
    if (this.connectivity.isOnline()) {
      try {
        const resp: any = await firstValueFrom(this.catalogoService.listarDestinatarios());
        if (!resp.error) {
          if (resp.data?.length > 0) {
            const dexiedb = await this.catalogosRepo.destinatariosRepo.getAll();
            if (dexiedb.length > 0) await this.catalogosRepo.destinatariosRepo.clear();
            for (const d of resp.data) {
              (d as any).bd = 1;
              await this.catalogosRepo.destinatariosRepo.save(d);
            }
            return resp.data;
          } else {
            const dexiedb = await this.catalogosRepo.destinatariosRepo.getAll();
            if (dexiedb.length > 0) await this.catalogosRepo.destinatariosRepo.clear();
            return [];
          }
        }
        return [];
      } catch (error) {
        console.log('Error obteniendo destinatarios', error);
        return [];
      }
    } else {
      const lista = await this.catalogosRepo.destinatariosRepo.getAll();
      const activos = (lista ?? []).filter((d: any) => {
        const a = d?.activo;
        return a === true || a === 1 || (typeof a === 'string' && (a === '1' || a.toLowerCase() === 'true'));
      });
      return activos;
    }
  }

  async cargarTransportistas(idProyecto: string): Promise<any[]> {
    const idP = String(idProyecto ?? '').trim();
    if (this.connectivity.isOnline()) {
      try {
        const resp: any = await firstValueFrom(this.catalogoService.listarTransportistas(idP));
        if (!resp.error) {
          if (resp.data?.length > 0) {
            const dexiedb = await this.catalogosOperativosRepo.transportistasRepo.getAll();
            if (dexiedb.length > 0) await this.catalogosOperativosRepo.transportistasRepo.clear();
            for (const t of resp.data) {
              (t as any).bd = 1;
              await this.catalogosOperativosRepo.transportistasRepo.save(t);
            }
            return resp.data;
          } else {
            const dexiedb = await this.catalogosOperativosRepo.transportistasRepo.getAll();
            if (dexiedb.length > 0) await this.catalogosOperativosRepo.transportistasRepo.clear();
            return [];
          }
        }
        return [];
      } catch (error) {
        console.log('Error obteniendo transportistas', error);
        return [];
      }
    } else {
      const lista = await this.catalogosOperativosRepo.transportistasRepo.getAll();
      return lista ?? [];
    }
  }

  async cargarConductores(idProyecto: string): Promise<any[]> {
    const idP = String(idProyecto ?? '').trim();
    if (this.connectivity.isOnline()) {
      try {
        const resp: any = await firstValueFrom(this.catalogoService.listarConductores(idP));
        if (!resp.error) {
          if (resp.data?.length > 0) {
            const dexiedb = await this.catalogosOperativosRepo.conductoresRepo.getAll();
            if (dexiedb.length > 0) await this.catalogosOperativosRepo.conductoresRepo.clear();
            for (const c of resp.data) {
              (c as any).bd = 1;
              await this.catalogosOperativosRepo.conductoresRepo.save(c);
            }
            return resp.data;
          } else {
            const dexiedb = await this.catalogosOperativosRepo.conductoresRepo.getAll();
            if (dexiedb.length > 0) await this.catalogosOperativosRepo.conductoresRepo.clear();
            return [];
          }
        }
        return [];
      } catch (error) {
        console.log('Error obteniendo conductores', error);
        return [];
      }
    } else {
      const lista = await this.catalogosOperativosRepo.conductoresRepo.getAll();
      return lista ?? [];
    }
  }

  async cargarVehiculos(idProyecto: string): Promise<any[]> {
    const idP = String(idProyecto ?? '').trim();
    if (this.connectivity.isOnline()) {
      try {
        const resp: any = await firstValueFrom(this.catalogoService.listarVehiculos(idP));
        if (!resp.error) {
          if (resp.data?.length > 0) {
            const dexiedb = await this.catalogosOperativosRepo.vehiculosRepo.getAll();
            if (dexiedb.length > 0) await this.catalogosOperativosRepo.vehiculosRepo.clear();
            for (const v of resp.data) {
              (v as any).bd = 1;
              await this.catalogosOperativosRepo.vehiculosRepo.save(v);
            }
            return resp.data;
          } else {
            const dexiedb = await this.catalogosOperativosRepo.vehiculosRepo.getAll();
            if (dexiedb.length > 0) await this.catalogosOperativosRepo.vehiculosRepo.clear();
            return [];
          }
        }
        return [];
      } catch (error) {
        console.log('Error obteniendo vehiculos', error);
        return [];
      }
    } else {
      const lista = await this.catalogosOperativosRepo.vehiculosRepo.getAll();
      return lista ?? [];
    }
  }

  async cargarTipoProcesoEmpacadosCatalogo(idProyecto: string): Promise<any[]> {
    const idP = String(idProyecto ?? '').trim();
    if (this.connectivity.isOnline()) {
      try {
        const resp: any = await firstValueFrom(this.catalogoService.listarTipoProcesoEmpacado(idP));
        const items = resp?.data ?? (Array.isArray(resp) ? resp : []);
        if (items.length > 0) {
          const dexiedb = await this.catalogosRepo.tipoProcesoEmpacadoRepo.getAll();
          if (dexiedb.length > 0) await this.catalogosRepo.tipoProcesoEmpacadoRepo.clear();
          for (const item of items) { (item as any).bd = 1; await this.catalogosRepo.tipoProcesoEmpacadoRepo.save(item); }
          return items;
        } else {
          await this.catalogosRepo.tipoProcesoEmpacadoRepo.clear();
          return [];
        }
      } catch (error) {
        console.log('Error obteniendo tipoProcesoEmpacado', error);
        return [];
      }
    } else {
      return await this.catalogosRepo.tipoProcesoEmpacadoRepo.getAll() ?? [];
    }
  }

  async cargarConsignatariosCatalogo(): Promise<any[]> {
    if (this.connectivity.isOnline()) {
      try {
        const resp: any = await firstValueFrom(this.catalogoService.listarClientes());
        const items = resp?.data ?? (Array.isArray(resp) ? resp : []);
        if (items.length > 0) {
          const dexiedb = await this.catalogosRepo.consignatariosRepo.getAll();
          if (dexiedb.length > 0) await this.catalogosRepo.consignatariosRepo.clear();
          for (const item of items) { (item as any).bd = 1; await this.catalogosRepo.consignatariosRepo.save(item); }
          return items;
        } else {
          await this.catalogosRepo.consignatariosRepo.clear();
          return [];
        }
      } catch (error) {
        console.log('Error obteniendo consignatarios', error);
        return [];
      }
    } else {
      return await this.catalogosRepo.consignatariosRepo.getAll() ?? [];
    }
  }

  async cargarDestinosCatalogo(): Promise<any[]> {
    if (this.connectivity.isOnline()) {
      try {
        const resp: any = await firstValueFrom(this.catalogoService.listarPaises());
        const items = resp?.data ?? (Array.isArray(resp) ? resp : []);
        if (items.length > 0) {
          const dexiedb = await this.catalogosRepo.destinosRepo.getAll();
          if (dexiedb.length > 0) await this.catalogosRepo.destinosRepo.clear();
          for (const item of items) { (item as any).bd = 1; await this.catalogosRepo.destinosRepo.save(item); }
          return items;
        } else {
          await this.catalogosRepo.destinosRepo.clear();
          return [];
        }
      } catch (error) {
        console.log('Error obteniendo destinos', error);
        return [];
      }
    } else {
      return await this.catalogosRepo.destinosRepo.getAll() ?? [];
    }
  }

  async cargarPresentacionesCatalogo(codigoCultivo: string): Promise<any[]> {
    const codC = String(codigoCultivo ?? '').trim();
    if (this.connectivity.isOnline()) {
      try {
        const resp: any = await firstValueFrom(this.catalogoService.listarPresentaciones(codC));
        const items = resp?.data ?? (Array.isArray(resp) ? resp : []);
        if (items.length > 0) {
          const dexiedb = await this.catalogosRepo.presentacionesRepo.getAll();
          if (dexiedb.length > 0) await this.catalogosRepo.presentacionesRepo.clear();
          for (const item of items) { (item as any).bd = 1; await this.catalogosRepo.presentacionesRepo.save(item); }
          return items;
        } else {
          await this.catalogosRepo.presentacionesRepo.clear();
          return [];
        }
      } catch (error) {
        console.log('Error obteniendo presentaciones', error);
        return [];
      }
    } else {
      return await this.catalogosRepo.presentacionesRepo.getAll() ?? [];
    }
  }

  async cargarFormatosCatalogo(codigoCultivo: string): Promise<any[]> {
    const codC = String(codigoCultivo ?? '').trim();
    if (this.connectivity.isOnline()) {
      try {
        const resp: any = await firstValueFrom(this.catalogoService.listarFormatos(codC));
        const items = resp?.data ?? (Array.isArray(resp) ? resp : []);
        if (items.length > 0) {
          const dexiedb = await this.catalogosRepo.formatosRepo.getAll();
          if (dexiedb.length > 0) await this.catalogosRepo.formatosRepo.clear();
          for (const item of items) { (item as any).bd = 1; await this.catalogosRepo.formatosRepo.save(item); }
          return items;
        } else {
          await this.catalogosRepo.formatosRepo.clear();
          return [];
        }
      } catch (error) {
        console.log('Error obteniendo formatos', error);
        return [];
      }
    } else {
      return await this.catalogosRepo.formatosRepo.getAll() ?? [];
    }
  }

  async cargarVariedadesCatalogo(): Promise<any[]> {
    if (this.connectivity.isOnline()) {
      try {
        const resp: any = await firstValueFrom(this.catalogoService.listarVariedades());
        const items = resp?.data ?? (Array.isArray(resp) ? resp : []);
        if (items.length > 0) {
          const dexiedb = await this.catalogosRepo.variedadesRepo.getAll();
          if (dexiedb.length > 0) await this.catalogosRepo.variedadesRepo.clear();
          for (const item of items) { (item as any).bd = 1; await this.catalogosRepo.variedadesRepo.save(item); }
          return items;
        } else {
          await this.catalogosRepo.variedadesRepo.clear();
          return [];
        }
      } catch (error) {
        console.log('Error obteniendo variedades', error);
        return [];
      }
    } else {
      return await this.catalogosRepo.variedadesRepo.getAll() ?? [];
    }
  }

  async cargarTiposEmpaqueGuiaCatalogo(codigoCultivo: string): Promise<any[]> {
    const codC = String(codigoCultivo ?? '').trim();
    if (this.connectivity.isOnline()) {
      try {
        const resp: any = await firstValueFrom(this.catalogoService.listarTiposEmpaqueGuia(codC));
        const items = resp?.data ?? (Array.isArray(resp) ? resp : []);
        if (items.length > 0) {
          const dexiedb = await this.catalogosRepo.tiposEmpaqueGuiaRepo.getAll();
          if (dexiedb.length > 0) await this.catalogosRepo.tiposEmpaqueGuiaRepo.clear();
          for (const item of items) { (item as any).bd = 1; await this.catalogosRepo.tiposEmpaqueGuiaRepo.save(item); }
          return items;
        } else {
          await this.catalogosRepo.tiposEmpaqueGuiaRepo.clear();
          return [];
        }
      } catch (error) {
        console.log('Error obteniendo tiposEmpaqueGuia', error);
        return [];
      }
    } else {
      return await this.catalogosRepo.tiposEmpaqueGuiaRepo.getAll() ?? [];
    }
  }

  async cargarCodigosRanchoCatalogo(idProyecto: string): Promise<any[]> {
    const idP = String(idProyecto ?? '').trim();
    if (this.connectivity.isOnline()) {
      try {
        const resp: any = await firstValueFrom(this.catalogoService.listarCodigosRanchoCatalogo(idP));
        const items = resp?.data ?? (Array.isArray(resp) ? resp : []);
        if (items.length > 0) {
          const dexiedb = await this.catalogosRepo.codigosRanchoRepo.getAll();
          if (dexiedb.length > 0) await this.catalogosRepo.codigosRanchoRepo.clear();
          for (const item of items) { (item as any).bd = 1; await this.catalogosRepo.codigosRanchoRepo.save(item); }
          return items;
        } else {
          await this.catalogosRepo.codigosRanchoRepo.clear();
          return [];
        }
      } catch (error) {
        console.log('Error obteniendo codigosRancho', error);
        return [];
      }
    } else {
      return await this.catalogosRepo.codigosRanchoRepo.getAll() ?? [];
    }
  }

  async cargarLugaresProduccionCatalogo(idProyecto: string): Promise<any[]> {
    const idP = String(idProyecto ?? '').trim();
    if (this.connectivity.isOnline()) {
      try {
        const resp: any = await firstValueFrom(this.catalogoService.listarLugaresProduccion(idP));
        const items = resp?.data ?? (Array.isArray(resp) ? resp : []);
        if (items.length > 0) {
          const dexiedb = await this.catalogosRepo.lugaresProduccionRepo.getAll();
          if (dexiedb.length > 0) await this.catalogosRepo.lugaresProduccionRepo.clear();
          for (const item of items) { (item as any).bd = 1; await this.catalogosRepo.lugaresProduccionRepo.save(item); }
          return items;
        } else {
          await this.catalogosRepo.lugaresProduccionRepo.clear();
          return [];
        }
      } catch (error) {
        console.log('Error obteniendo lugaresProduccion', error);
        return [];
      }
    } else {
      return await this.catalogosRepo.lugaresProduccionRepo.getAll() ?? [];
    }
  }

  async cargarTransportesCatalogo(): Promise<any[]> {
    if (this.connectivity.isOnline()) {
      try {
        const resp: any = await firstValueFrom(this.catalogoService.listarTransporte());
        const items = resp?.data ?? (Array.isArray(resp) ? resp : []);
        if (items.length > 0) {
          const dexiedb = await this.catalogosRepo.transportesRepo.getAll();
          if (dexiedb.length > 0) await this.catalogosRepo.transportesRepo.clear();
          for (const item of items) { (item as any).bd = 1; await this.catalogosRepo.transportesRepo.save(item); }
          return items;
        } else {
          await this.catalogosRepo.transportesRepo.clear();
          return [];
        }
      } catch (error) {
        console.log('Error obteniendo transportes', error);
        return [];
      }
    } else {
      return await this.catalogosRepo.transportesRepo.getAll() ?? [];
    }
  }

  async cargarCampaniasCatalogo(): Promise<any[]> {
    if (this.connectivity.isOnline()) {
      try {
        const resp: any = await firstValueFrom(this.catalogoService.listarCampanias());
        const items = resp?.data ?? (Array.isArray(resp) ? resp : []);
        if (items.length > 0) {
          const dexiedb = await this.catalogosRepo.campaniaRepo.getAll();
          if (dexiedb.length > 0) await this.catalogosRepo.campaniaRepo.clear();
          for (const item of items) { (item as any).bd = 1; await this.catalogosRepo.campaniaRepo.save(item); }
          return items;
        } else {
          await this.catalogosRepo.campaniaRepo.clear();
          return [];
        }
      } catch (error) {
        console.log('Error obteniendo campanias', error);
        return [];
      }
    } else {
      return await this.catalogosRepo.campaniaRepo.getAll() ?? [];
    }
  }

  async cargarCodigosCajaCatalogo(): Promise<any[]> {
    if (this.connectivity.isOnline()) {
      try {
        let resp: any = await firstValueFrom(this.catalogoService.listarCodigosCaja());
        if (Array.isArray(resp) && resp.length > 0) {
          resp = resp[0];
        }
        const items = resp?.data ?? [];
        if (items.length > 0) {
          const dexiedb = await this.catalogosRepo.codigosCajaRepo.getAll();
          if (dexiedb.length > 0) await this.catalogosRepo.codigosCajaRepo.clear();
          for (const item of items) { (item as any).bd = 1; await this.catalogosRepo.codigosCajaRepo.save(item); }
          return items;
        } else {
          await this.catalogosRepo.codigosCajaRepo.clear();
          return [];
        }
      } catch (error) {
        console.log('Error obteniendo codigosCaja', error);
        return [];
      }
    } else {
      return await this.catalogosRepo.codigosCajaRepo.getAll() ?? [];
    }
  }
}
