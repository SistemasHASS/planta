import { Injectable, inject } from '@angular/core';
import { CatalogosOperativosRepository } from '../dexiedb/repository/catalogos-operacionales.repository';
import { ProcesoRepository } from '../dexiedb/repository/proceso.repository';
import { Configuracion } from '../interfaces/administracion.interface';
import { PersonalLogistico, Supervisor } from '../interfaces/catalogo.interface';
import { DProcesoLogistico, DProcesoSupervisor, Proceso } from '../interfaces/proceso.interface';
import { CatalogosSyncService } from './catalogos-sync.service';
import { ConfirmModalService } from './confirm-modal.service';
import { ProcesosApiService } from './procesos-api.service';

const texto = (v: unknown): string => String(v ?? '').trim();
type Fila = Record<string, any>;

interface ProcesoNormalizado {
  proceso: Proceso;
  dProcesoLogisticos: DProcesoLogistico[];
  dProcesoSupervisores: DProcesoSupervisor[];
}

export interface ResultadoDescarga {
  ok: boolean;
  mensaje?: string;
}

/**
 * Descarga de procesos y de personal disponible. Misma logica de la aplicacion anterior:
 * al bajar los procesos se vacian procesos, personal y palets locales, y despues se conservan los
 * pendientes (db = 0) o se reemplazan si la persona lo confirma.
 */
@Injectable({ providedIn: 'root' })
export class ProcesosSyncService {
  private readonly api = inject(ProcesosApiService);
  private readonly repo = inject(ProcesoRepository);
  private readonly operativos = inject(CatalogosOperativosRepository);
  private readonly catalogosSync = inject(CatalogosSyncService);
  private readonly confirm = inject(ConfirmModalService);

  /** Trae los procesos de la campania y los guarda en el equipo. */
  async descargar(cfg: Configuracion): Promise<ResultadoDescarga> {
    const sobre = await this.api.listar(cfg.idProyecto, cfg.codigoCultivo);
    if (sobre?.error) return { ok: false, mensaje: sobre.mensaje || 'No se pudieron obtener los procesos.' };

    const data = Array.isArray(sobre?.data) ? sobre.data : [];
    await this.repo.procesosRepo.clear();
    await this.repo.dProcesoLogisticosRepo.clear();
    await this.repo.dProcesoSupervisoresRepo.clear();
    await this.repo.paletsRepo.clear();

    const normalizados = data.map((x) => this.normalizar(x));
    const idProyecto = texto(cfg.idProyecto);

    const localesNoSync = await this.repo.procesosRepo.getNoSincronizados();
    const idsNoSync = new Set(localesNoSync.map((p) => texto(p.idProceso)));
    const conflictos = Array.from(new Set(normalizados.map((n) => texto(n.proceso.idProceso)).filter((id) => id && idsNoSync.has(id))));

    let aGuardar = normalizados;
    if (conflictos.length > 0) {
      const ejemplo = conflictos.slice(0, 3).join(', ') + (conflictos.length > 3 ? '...' : '');
      const reemplazar = await this.confirm.confirm({
        title: 'Conflicto de procesos',
        eyebrow: 'Datos distintos',
        message: `Hay procesos locales NO sincronizados con el mismo idProceso que viene del servidor (ej: ${ejemplo}). ¿Reemplazar los locales por los del servidor?`,
        detail: 'Aceptar elimina los locales en conflicto. Cancelar mantiene los locales y omite los del servidor.',
        confirmText: 'Reemplazar',
        cancelText: 'Mantener locales',
        tone: 'warning',
      });
      if (reemplazar) {
        for (const id of conflictos) {
          await this.repo.procesosRepo.deleteByIdProceso(id);
          await this.repo.dProcesoLogisticosRepo.deleteByIdProceso(id);
          await this.repo.dProcesoSupervisoresRepo.deleteByIdProceso(id);
        }
      } else {
        aGuardar = normalizados.filter((n) => !conflictos.includes(texto(n.proceso.idProceso)));
      }
    }

    if (idProyecto) {
      const ids = await this.repo.procesosRepo.clearSincronizadosByProyecto(idProyecto);
      await this.repo.dProcesoLogisticosRepo.clearSincronizadosByIdProcesos(ids);
      await this.repo.dProcesoSupervisoresRepo.clearSincronizadosByIdProcesos(ids);
    }

    for (const n of aGuardar) {
      await this.repo.procesosRepo.saveFordec(n.proceso);
      for (const d of n.dProcesoLogisticos) await this.repo.dProcesoLogisticosRepo.saveByCompoundId(d);
      for (const d of n.dProcesoSupervisores) await this.repo.dProcesoSupervisoresRepo.saveByCompoundId(d);
    }
    return { ok: true };
  }

  /**
   * Procesos para la pantalla Palets: se reemplazan los sincronizados de la campania y se conservan los pendientes
   * (con confirmacion si chocan con los del servidor). No se tocan palets ni personal locales.
   */
  async descargarParaPalets(cfg: Configuracion): Promise<ResultadoDescarga> {
    const sobre = await this.api.listar(cfg.idProyecto, cfg.codigoCultivo);
    if (sobre?.error) return { ok: false, mensaje: sobre.mensaje || 'Error al obtener los procesos.' };
    const data = Array.isArray(sobre?.data) ? sobre.data : [];
    if (data.length === 0) return { ok: false, mensaje: 'No se encontraron procesos para la campaña activa.' };

    const normalizados = data.map((x) => this.normalizar(x).proceso);
    const localesNoSync = await this.repo.procesosRepo.getNoSincronizados();
    const idsNoSync = new Set(localesNoSync.map((p) => texto(p.idProceso)));
    const conflictos = Array.from(new Set(normalizados.map((p) => texto(p.idProceso)).filter((id) => id && idsNoSync.has(id))));

    let aGuardar = normalizados;
    if (conflictos.length > 0) {
      const ejemplo = conflictos.slice(0, 3).join(', ') + (conflictos.length > 3 ? '...' : '');
      const reemplazar = await this.confirm.confirm({
        title: 'Conflicto de procesos',
        eyebrow: 'Datos distintos',
        message: `Hay procesos locales NO sincronizados con el mismo idProceso que viene del servidor (ej: ${ejemplo}). ¿Reemplazar los locales por los del servidor?`,
        detail: 'Aceptar elimina los locales en conflicto. Cancelar mantiene los locales y omite los del servidor.',
        confirmText: 'Reemplazar',
        cancelText: 'Mantener locales',
        tone: 'warning',
      });
      if (reemplazar) {
        for (const id of conflictos) {
          await this.repo.procesosRepo.deleteByIdProceso(id);
          await this.repo.dProcesoLogisticosRepo.deleteByIdProceso(id);
          await this.repo.dProcesoSupervisoresRepo.deleteByIdProceso(id);
        }
      } else {
        aGuardar = normalizados.filter((p) => !conflictos.includes(texto(p.idProceso)));
      }
    }

    const idProyecto = texto(cfg.idProyecto);
    if (idProyecto) {
      const ids = await this.repo.procesosRepo.clearSincronizadosByProyecto(idProyecto);
      await this.repo.dProcesoLogisticosRepo.clearSincronizadosByIdProcesos(ids);
      await this.repo.dProcesoSupervisoresRepo.clearSincronizadosByIdProcesos(ids);
    }
    for (const p of aGuardar) await this.repo.procesosRepo.saveFordec(p);
    return { ok: true };
  }

  /**
   * Descarga de procesos al guardar Parametros (igual que la aplicacion anterior): con error o sin procesos se vacian las
   * tablas locales; si hay procesos se reemplazan todas (procesos, personal y palets). Devuelve los idProceso guardados.
   */
  async descargarParaParametros(cfg: Configuracion): Promise<string[]> {
    const sobre = await this.api.listar(cfg.idProyecto, cfg.codigoCultivo);
    await this.repo.procesosRepo.clear();
    await this.repo.dProcesoLogisticosRepo.clear();
    await this.repo.dProcesoSupervisoresRepo.clear();
    await this.repo.paletsRepo.clear();
    if (sobre?.error || !Array.isArray(sobre?.data)) return [];

    const ids: string[] = [];
    for (const n of sobre.data.map((x) => this.normalizar(x))) {
      await this.repo.procesosRepo.saveFordec(n.proceso);
      for (const d of n.dProcesoLogisticos) await this.repo.dProcesoLogisticosRepo.saveByCompoundId(d);
      for (const d of n.dProcesoSupervisores) await this.repo.dProcesoSupervisoresRepo.saveByCompoundId(d);
      ids.push(texto(n.proceso.idProceso));
    }
    return ids;
  }

  /**
   * Supervisores y personal de logistica disponibles para una fecha. Con internet reemplaza lo guardado
   * (solo si el servidor devolvio algo) y devuelve los activos; sin internet devuelve lo guardado.
   */
  async personalDisponible(cfg: Configuracion, fecha: string, online: boolean): Promise<{ supervisores: Supervisor[]; logisticos: PersonalLogistico[] }> {
    if (!online) return this.personalLocal();

    const hayS = await this.catalogosSync.supervisoresDisponibles(cfg.idProyecto, fecha);
    const hayL = await this.catalogosSync.personalLogisticoDisponible(cfg.idProyecto, fecha);
    const local = await this.personalLocal();
    return { supervisores: hayS ? local.supervisores : [], logisticos: hayL ? local.logisticos : [] };
  }

  async personalLocal(): Promise<{ supervisores: Supervisor[]; logisticos: PersonalLogistico[] }> {
    const [supervisores, logisticos] = await Promise.all([
      this.operativos.supervisoresRepo.getActivos(),
      this.operativos.personalLogisticoRepo.getActivos(),
    ]);
    return { supervisores, logisticos };
  }

  normalizar(origen: Fila): ProcesoNormalizado {
    const proceso: Proceso = {
      id: origen?.['id'] ?? undefined,
      idProceso: texto(origen?.['idProceso']),
      idProyecto: texto(origen?.['idProyecto']),
      codigoAcopio: texto(origen?.['codigoAcopio']),
      acopioNombre: texto(origen?.['acopioNombre']),
      fechaProceso: texto(origen?.['fechaProceso']),
      estado: texto(origen?.['estado']),
      fechaApertura: texto(origen?.['fechaApertura']),
      fechaCierre: origen?.['fechaCierre'] ?? null,
      turno: texto(origen?.['turno']),
      idUsuarioApertura: origen?.['idUsuarioApertura'] ?? undefined,
      idRolApertura: origen?.['idRolApertura'] ?? undefined,
      idUsuarioCierre: origen?.['idUsuarioCierre'] ?? undefined,
      idRolCierre: origen?.['idRolCierre'] ?? undefined,
      db: 1,
    };

    const lista = (clave: string): Fila[] => (Array.isArray(origen?.[clave]) ? origen[clave] : []);
    const dProcesoLogisticos: DProcesoLogistico[] = lista('logisticos').map((it) => ({
      id: it['id'] ?? undefined,
      idProceso: texto(it['idProceso'] ?? proceso.idProceso),
      idLogistico: Number(it['idLogistico'] ?? 0),
      fechaCreacion: it['fechaCreacion'] ?? undefined,
      db: 1,
      eliminado: Number(it['eliminado'] ?? 0),
    }));
    const dProcesoSupervisores: DProcesoSupervisor[] = lista('supervisores').map((it) => ({
      id: it['id'] ?? undefined,
      idProceso: texto(it['idProceso'] ?? proceso.idProceso),
      idSupervisor: Number(it['idSupervisor'] ?? 0),
      fechaCreacion: it['fechaCreacion'] ?? undefined,
      db: 1,
      eliminado: Number(it['eliminado'] ?? 0),
    }));
    return { proceso, dProcesoLogisticos, dProcesoSupervisores };
  }
}
