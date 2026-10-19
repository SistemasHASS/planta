import { Injectable, inject } from '@angular/core';
import { CatalogosOperativosRepository } from '../dexiedb/repository/catalogos-operacionales.repository';
import { CatalogosRepository } from '../dexiedb/repository/catalogos.repository';
import { ProcesoRepository } from '../dexiedb/repository/proceso.repository';
import { CatalogosApiService } from './catalogos-api.service';
import { ConnectivityService } from './connectivity.service';
import { GuiasApiService } from './guias-api.service';
import { ProcesosApiService } from './procesos-api.service';
import { ProcesosSyncService } from './procesos-sync.service';

type Sobre = { error?: boolean; data?: unknown } | null | undefined;
type RepoLista = { getAll(): Promise<any[]>; clear(): Promise<void>; save(item: any): Promise<any> };

const texto = (v: unknown): string => String(v ?? '').trim();

/**
 * Catalogos que usan las pantallas de guias (normal y manual). Igual que la aplicacion anterior: con internet se piden al servidor y
 * se guardan en Dexie (bd = 1); sin internet se leen de Dexie.
 */
@Injectable({ providedIn: 'root' })
export class CatalogosGuiaService {
  private readonly catalogosApi = inject(CatalogosApiService);
  private readonly guiasApi = inject(GuiasApiService);
  private readonly procesosApi = inject(ProcesosApiService);
  private readonly procesosSync = inject(ProcesosSyncService);
  private readonly connectivity = inject(ConnectivityService);
  private readonly catalogosRepo = inject(CatalogosRepository);
  private readonly operativosRepo = inject(CatalogosOperativosRepository);
  private readonly procesoRepo = inject(ProcesoRepository);

  /** Destinatarios activos. Con internet reemplaza lo guardado; sin internet devuelve solo los activos guardados. */
  async destinatarios(): Promise<any[]> {
    if (this.connectivity.isOnline()) {
      return this.descargar(() => this.catalogosApi.destinatarios(), this.catalogosRepo.destinatariosRepo, true, 'destinatarios');
    }
    const lista = await this.catalogosRepo.destinatariosRepo.getAll();
    return (lista ?? []).filter((d: any) => {
      const a = d?.activo;
      return a === true || a === 1 || (typeof a === 'string' && (a === '1' || a.toLowerCase() === 'true'));
    });
  }

  /** Destinatarios tal cual los devuelve el servidor, sin guardarlos en el equipo (para solo mostrar nombres en listados). */
  async destinatariosEnLinea(): Promise<any[]> {
    if (!this.connectivity.isOnline()) return this.destinatarios();
    try {
      const sobre = await this.catalogosApi.destinatarios();
      return !sobre?.error && Array.isArray(sobre?.data) ? sobre.data : [];
    } catch (error) {
      console.error('Error obteniendo destinatarios', error);
      return [];
    }
  }

  transportistas(idProyecto: string): Promise<any[]> {
    return this.cargar(() => this.catalogosApi.porProyecto('transportistas', texto(idProyecto)), this.operativosRepo.transportistasRepo, true, 'transportistas');
  }

  conductores(idProyecto: string): Promise<any[]> {
    return this.cargar(() => this.catalogosApi.porProyecto('conductores', texto(idProyecto)), this.operativosRepo.conductoresRepo, true, 'conductores');
  }

  vehiculos(idProyecto: string): Promise<any[]> {
    return this.cargar(() => this.catalogosApi.porProyecto('vehiculos', texto(idProyecto)), this.operativosRepo.vehiculosRepo, true, 'vehiculos');
  }

  codigosCaja(): Promise<any[]> {
    return this.cargar(() => this.guiasApi.codigosCaja(), this.catalogosRepo.codigosCajaRepo, false, 'codigosCaja');
  }

  motivosTraslado(): Promise<any[]> {
    return this.cargar(() => this.catalogosApi.motivosTraslado(), this.catalogosRepo.motivosTrasladoRepo, false, 'motivosTraslado');
  }

  /** Establecimiento emisor de la empresa (siempre del servidor; el que parte la guia). */
  async establecimientoEmisor(): Promise<any> {
    const sobre = await this.catalogosApi.establecimientoEmisor();
    if (sobre.error) throw new Error(sobre.mensaje || 'No se pudo cargar el establecimiento emisor.');
    const establecimiento = Array.isArray(sobre.data) ? sobre.data[0] : sobre.data;
    if (!establecimiento) throw new Error('No se encontró el establecimiento emisor.');
    return establecimiento;
  }

  async establecimientos(): Promise<any[]> {
    const sobre = await this.catalogosApi.establecimientos();
    if (sobre.error) throw new Error(sobre.mensaje || 'No se pudieron cargar los establecimientos.');
    return Array.isArray(sobre.data) ? sobre.data : [];
  }

  /** Procesos de la campaña (para mostrar "fecha - turno" en cada guia). Sin internet usa los guardados. */
  async procesos(codigoCultivo: string, idProyecto: string): Promise<any[]> {
    const cultivo = texto(codigoCultivo);
    const proyecto = texto(idProyecto);
    if (!cultivo || !proyecto) return [];

    if (this.connectivity.isOnline()) {
      try {
        const sobre = await this.procesosApi.listar(proyecto, cultivo);
        if (sobre?.error || !Array.isArray(sobre?.data)) return [];
        return sobre.data.map((x) => this.procesosSync.normalizar(x).proceso);
      } catch (error) {
        console.error('Error obteniendo procesos', error);
        return [];
      }
    }
    const lista = await this.procesoRepo.procesosRepo.getAll();
    return (lista ?? []).filter((p: any) => {
      const codCultivo = texto(p?.codigoCultivo);
      return texto(p?.idProyecto) === proyecto && (!codCultivo || codCultivo === cultivo);
    });
  }

  // ───────── Utilidades ─────────

  private cargar(pedir: () => Promise<Sobre>, repo: RepoLista, validarError: boolean, nombre: string): Promise<any[]> {
    if (!this.connectivity.isOnline()) return repo.getAll().then((l) => l ?? []);
    return this.descargar(pedir, repo, validarError, nombre);
  }

  /**
   * Pide el catalogo y reemplaza lo guardado. Con respuesta vacia vacia la tabla local.
   * `validarError`: si el servidor informa error devuelve [] sin tocar lo guardado.
   */
  private async descargar(pedir: () => Promise<Sobre>, repo: RepoLista, validarError: boolean, nombre: string): Promise<any[]> {
    try {
      const sobre = await pedir();
      if (validarError && sobre?.error) return [];
      const items = Array.isArray(sobre?.data) ? (sobre!.data as any[]) : [];
      await repo.clear();
      for (const item of items) {
        item.bd = 1;
        await repo.save(item);
      }
      return items;
    } catch (error) {
      console.error(`Error obteniendo ${nombre}`, error);
      return [];
    }
  }
}
