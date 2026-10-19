import { Injectable, inject } from '@angular/core';
import { CatalogosOperativosRepository } from '../dexiedb/repository/catalogos-operacionales.repository';
import { CatalogosRepository } from '../dexiedb/repository/catalogos.repository';
import { AcopioDetalle } from '../interfaces/catalogo.interface';
import { Configuracion } from '../interfaces/administracion.interface';
import { nowPeruDate } from '../utils/date-time.util';
import { CatalogosApiService, SobreSp } from './catalogos-api.service';
import { MaestrosApiService } from './maestros-api.service';
import { ProcesosApiService } from './procesos-api.service';

type Fila = Record<string, any>;
/** Lo minimo que necesita un repositorio de Dexie para reemplazar su contenido. */
interface Repo {
  getAll(): Promise<any[]>;
  clear(): Promise<void>;
  save(item: any): Promise<any>;
}

/**
 * Descarga los catalogos y los guarda en Dexie, tabla por tabla, igual que la pantalla Parametros de la aplicacion anterior:
 * se vacia la tabla y se guardan las filas (con bd = 1 las que vienen de la base propia).
 * Cada tabla es independiente: si una falla se sigue con las demas y se devuelve el nombre de las que fallaron.
 */
@Injectable({ providedIn: 'root' })
export class CatalogosSyncService {
  private readonly api = inject(CatalogosApiService);
  private readonly maestros = inject(MaestrosApiService);
  private readonly procesos = inject(ProcesosApiService);
  private readonly catalogos = inject(CatalogosRepository);
  private readonly operativos = inject(CatalogosOperativosRepository);

  /** Parametros > Sincronizar: fundos, campañas y cultivos de apimaestra. */
  async sincronizarMaestros(): Promise<void> {
    const resultados = await Promise.allSettled([
      this.maestros.fundos().then((f) => this.reemplazarMaestro(this.catalogos.fundoRepo, f)),
      this.maestros.campanias().then((c) => this.reemplazarMaestro(this.catalogos.campaniaRepo, c)),
      this.maestros.cultivos().then((c) => this.reemplazarMaestro(this.catalogos.cultivoRepo, c)),
    ]);
    resultados.forEach((r, i) => r.status === 'rejected' && console.error(`Error sincronizando tarea ${i + 1}`, r.reason));
  }

  /** Parametros > Guardar (cualquier rol): descarga y guarda en Dexie los acopios de la campaña. */
  async sincronizarAcopios(cfg: Configuracion): Promise<string[]> {
    try {
      await this.acopios(cfg.idProyecto);
      return [];
    } catch (error) {
      console.error('Error sincronizando Acopios', error);
      return ['Acopios'];
    }
  }

  /**
   * Parametros > Guardar para el Administrador (ADPLA): solo los maestros que usan los reportes online
   * (Acopios, Variedades, Consignatarios, Calibres, Destinos y Transportes). Se guardan en Dexie.
   */
  async sincronizarMaestrosAdministrador(cfg: Configuracion): Promise<string[]> {
    const cultivo = cfg.codigoCultivo;
    const fallidos: string[] = [];
    const tarea = async (nombre: string, accion: () => Promise<void>) => {
      try {
        await accion();
      } catch (error) {
        console.error(`Error sincronizando ${nombre}`, error);
        fallidos.push(nombre);
      }
    };
    const c = this.catalogos;
    await Promise.all([
      tarea('Acopios', () => this.acopios(cfg.idProyecto)),
      tarea('Variedades', async () => this.listaSp(c.variedadesRepo, await this.api.variedades(), (v) => v['idcultivo'] == cultivo)),
      tarea('Consignatarios', async () => this.listaSp(c.consignatariosRepo, await this.api.consignatarios())),
      tarea('Calibres', async () => this.reemplazarMaestro(c.calibresRepo, (await this.maestros.calibres()) as Fila[], (x) => x['idCultivo'] == cultivo)),
      tarea('Destinos', async () => this.reemplazarMaestro(c.destinosRepo, await this.maestros.paises())),
      tarea('Transportes', async () => this.reemplazarMaestro(c.transportesRepo, await this.maestros.transporte())),
    ]);
    return fallidos;
  }

  /**
   * Parametros > Guardar: los catalogos que descargaba la aplicacion anterior.
   * Logistica (LOPLA) trae los supervisores y el personal disponibles de hoy; Administrador y Monitor (ADPLA, MOPLA) traen todos.
   */
  async sincronizarLogistica(cfg: Configuracion, todosLosOperativos = false): Promise<string[]> {
    const proyecto = cfg.idProyecto;
    const cultivo = cfg.codigoCultivo;
    const fallidos: string[] = [];
    const tarea = async (nombre: string, accion: () => Promise<void>) => {
      try {
        await accion();
      } catch (error) {
        console.error(`Error sincronizando ${nombre}`, error);
        fallidos.push(nombre);
      }
    };

    const c = this.catalogos;
    const o = this.operativos;
    await Promise.all([
      tarea('Acopios', () => this.acopios(proyecto)),
      tarea('Tipos de proceso de empacado', async () => this.listaSp(c.tipoProcesoEmpacadoRepo, await this.api.porProyecto('tiposProcesoEmpacado', proyecto))),
      tarea('Formatos', async () => this.listaSpSiempre(c.formatosRepo, await this.api.porCultivo('formatos', cultivo))),
      tarea('Variedades', async () => this.listaSp(c.variedadesRepo, await this.api.variedades(), (v) => v['idcultivo'] == cultivo)),
      tarea('Clientes', async () => this.clientes(await this.api.clientes())),
      tarea('Consignatarios', async () => this.listaSp(c.consignatariosRepo, await this.api.consignatarios())),
      tarea('Destinos', async () => this.reemplazarMaestro(c.destinosRepo, await this.maestros.paises())),
      tarea('Calibres', async () => this.reemplazarMaestro(c.calibresRepo, (await this.maestros.calibres()) as Fila[], (x) => x['idCultivo'] == cultivo)),
      tarea('Transportes', async () => this.reemplazarMaestro(c.transportesRepo, await this.maestros.transporte())),
      tarea('Códigos de rancho', async () => this.listaSp(c.codigosRanchoRepo, await this.api.porProyecto('codigosRancho', proyecto))),
      tarea('Tipos de clamshell', async () => this.listaSpSiempre(c.tiposClamshellRepo, await this.api.porCultivo('tiposClamshell', cultivo))),
      tarea('Categorías', async () => this.listaSp(c.categoriasRepo, await this.api.porCultivo('categorias', cultivo))),
      tarea('Tipos de empaque', async () => this.listaSp(c.tiposEmpaqueRepo, await this.api.porCultivo('tiposEmpaque', cultivo))),
      tarea('Tipos de empaque (guía)', async () => this.listaSp(c.tiposEmpaqueGuiaRepo, await this.api.porCultivo('tiposEmpaqueGuia', cultivo))),
      tarea('Presentaciones', async () => this.listaSp(c.presentacionesRepo, await this.api.porCultivo('presentaciones', cultivo))),
      tarea('Tipos de caja', async () => this.listaSp(c.tiposCajaRepo, await this.api.porCultivo('tiposCaja', cultivo))),
      tarea('Lugares de producción', async () => this.listaSp(c.lugaresProduccionRepo, await this.api.porProyecto('lugaresProduccion', proyecto))),
      tarea('Conductores', async () => this.listaSp(o.conductoresRepo, await this.api.porProyecto('conductores', proyecto))),
      tarea('Vehículos', async () => this.listaSp(o.vehiculosRepo, await this.api.porProyecto('vehiculos', proyecto))),
      tarea('Transportistas', async () => this.listaSp(o.transportistasRepo, await this.api.porProyecto('transportistas', proyecto))),
      tarea('Destinatarios', async () => this.listaSp(c.destinatariosRepo, await this.api.destinatarios())),
      ...(todosLosOperativos
        ? [
            tarea('Supervisores', async () => this.listaSp(o.supervisoresRepo, await this.api.porProyecto('supervisores', proyecto))),
            tarea('Personal de logística', async () => this.listaSp(o.personalLogisticoRepo, await this.api.porProyecto('personalLogistico', proyecto))),
          ]
        : [
            // Disponibles para hoy: la pantalla Procesos los vuelve a pedir segun la fecha del turno.
            tarea('Supervisores disponibles', async () => void (await this.supervisoresDisponibles(proyecto, nowPeruDate()))),
            tarea('Personal de logística disponible', async () => void (await this.personalLogisticoDisponible(proyecto, nowPeruDate()))),
          ]),
    ]);
    return fallidos;
  }

  /** Supervisores disponibles de una fecha. Si el servidor no devuelve nada no se toca lo guardado (igual que antes). */
  async supervisoresDisponibles(idProyecto: string, fecha: string): Promise<boolean> {
    return this.disponibles(this.operativos.supervisoresRepo, await this.procesos.supervisoresDisponibles(idProyecto, fecha));
  }

  async personalLogisticoDisponible(idProyecto: string, fecha: string): Promise<boolean> {
    return this.disponibles(this.operativos.personalLogisticoRepo, await this.procesos.personalLogisticoDisponible(idProyecto, fecha));
  }

  private async disponibles(repo: Repo, sobre: SobreSp<Fila[]>): Promise<boolean> {
    if (sobre?.error || !Array.isArray(sobre.data) || sobre.data.length === 0) return false;
    await this.reemplazar(repo, sobre.data.map((f) => ({ ...f, bd: 1 })));
    return true;
  }

  // ───────── Patrones de reemplazo (los mismos de la aplicacion anterior) ─────────

  /** SP con { error, data }: con error no se toca nada; sin filas se vacia la tabla; con filas se reemplaza (bd = 1). */
  private async listaSp(repo: Repo, sobre: SobreSp<Fila[]>, filtro?: (f: Fila) => boolean): Promise<void> {
    if (sobre.error) return;
    const filas = Array.isArray(sobre.data) ? sobre.data : [];
    if (filas.length === 0) {
      await this.vaciar(repo);
      return;
    }
    await this.reemplazar(repo, (filtro ? filas.filter(filtro) : filas).map((f) => ({ ...f, bd: 1 })));
  }

  /** Formatos y tipos de clamshell: con error o sin filas se vacia; si no, se reemplaza siempre. */
  private async listaSpSiempre(repo: Repo, sobre: SobreSp<Fila[]>): Promise<void> {
    if (sobre.error) {
      await this.vaciar(repo);
      return;
    }
    await this.reemplazar(repo, (sobre.data ?? []).map((f) => ({ ...f, bd: 1 })));
  }

  /** Clientes: la aplicacion anterior no revisaba el error del SP. */
  private async clientes(sobre: SobreSp<Fila[]>): Promise<void> {
    const filas = Array.isArray(sobre?.data) ? sobre.data : [];
    if (filas.length > 0) await this.reemplazar(this.catalogos.clientesRepo, filas.map((f) => ({ ...f, bd: 1 })));
    else await this.vaciar(this.catalogos.clientesRepo);
  }

  /** Maestros de apimaestra (llegan como arreglo): sin filas se vacia; con filas se reemplaza (sin bd). */
  private async reemplazarMaestro(repo: Repo, filas: Fila[] | unknown[], filtro?: (f: Fila) => boolean): Promise<void> {
    const lista = filas as Fila[];
    if (lista.length === 0) {
      await this.vaciar(repo);
      return;
    }
    await this.reemplazar(repo, filtro ? lista.filter(filtro) : lista);
  }

  /** Acopios con sus tipos de proceso de empacado (tablas acopios y acopiosDetalles). */
  private async acopios(idProyecto: string): Promise<void> {
    const sobre = await this.api.acopios(idProyecto);
    const acopiosRepo = this.operativos.acopiosRepo;
    const detallesRepo = this.operativos.acopiosDetallesRepo;
    if ((await acopiosRepo.getAll()).length > 0) {
      await acopiosRepo.clear();
      await detallesRepo.clear();
    }
    if (sobre.error) return;

    for (const a of sobre.data ?? []) {
      await acopiosRepo.save({ ...a, bd: 1 } as any);
      for (const ad of a['tiposProcesoEmpacado'] ?? []) {
        const detalle: AcopioDetalle = {
          id: ad.id,
          codigoAcopio: a['codigoAcopio'],
          codigoTipoProcesoEmpacado: ad.codigo,
          nombreTipoProcesoEmpacado: ad.nombre,
          fechaCreacion: ad.fechaCreacion,
          activo: ad.activo,
          bd: 1,
        };
        await detallesRepo.save(detalle);
      }
    }
  }

  private async vaciar(repo: Repo): Promise<void> {
    if ((await repo.getAll()).length > 0) await repo.clear();
  }

  private async reemplazar(repo: Repo, filas: Fila[]): Promise<void> {
    await this.vaciar(repo);
    for (const fila of filas) await repo.save(fila);
  }
}
