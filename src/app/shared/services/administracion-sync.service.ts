import { Injectable, inject } from '@angular/core';
import { AdministracionRepository } from '../dexiedb/repository/administracion.repository';
import { CatalogosRepository } from '../dexiedb/repository/catalogos.repository';
import { Configuracion, MatrizCompatibilidad } from '../interfaces/administracion.interface';
import { AdministracionApiService } from './administracion-api.service';

type Fila = Record<string, any>;
const texto = (v: unknown): string => String(v ?? '').trim();

/**
 * Matrices de compatibilidad, reglas de sobrepeso y correlativos: se bajan al guardar Parametros para poder
 * trabajar sin conexion. Misma logica de la aplicacion anterior.
 */
@Injectable({ providedIn: 'root' })
export class AdministracionSyncService {
  private readonly api = inject(AdministracionApiService);
  private readonly admin = inject(AdministracionRepository);
  private readonly catalogos = inject(CatalogosRepository);

  /** Devuelve los nombres de lo que no se pudo descargar (vacio si todo salio bien). */
  async descargar(cfg: Configuracion): Promise<string[]> {
    const fallidos: string[] = [];
    const tarea = async (nombre: string, accion: () => Promise<void>): Promise<void> => {
      try {
        await accion();
      } catch (error) {
        console.error(`Error descargando ${nombre}`, error);
        fallidos.push(nombre);
      }
    };
    await tarea('Matrices de compatibilidad', () => this.matrices(cfg));
    await tarea('Reglas de sobrepeso', () => this.reglasSobrepeso(cfg));
    await tarea('Correlativos de documentos', () => this.correlativos());
    return fallidos;
  }

  private async matrices(cfg: Configuracion): Promise<void> {
    const sobre = await this.api.matricesCompatibilidad(cfg.idProyecto, cfg.codigoCultivo);
    const repo = this.admin.matricesCompatibilidadRepository;
    if (sobre.error) {
      await repo.clear();
      throw new Error(sobre.mensaje ?? 'Error al listar las matrices de compatibilidad');
    }
    const filas = await this.normalizarMatrices(sobre.data ?? [], cfg);
    await repo.clear();
    for (const fila of filas) await repo.saveFordec(fila);
  }

  private async reglasSobrepeso(cfg: Configuracion): Promise<void> {
    const sobre = await this.api.reglasSobrepeso(cfg.idProyecto, cfg.codigoCultivo);
    if (sobre.error) throw new Error(sobre.mensaje ?? 'Error al listar reglas de sobrepeso');
    const filas = (sobre.data ?? []).map((r: Fila) => ({
      ...r,
      idProyecto: texto(r['idProyecto'] ?? cfg.idProyecto),
      codigoCultivo: texto(r['codigoCultivo'] ?? cfg.codigoCultivo),
      documentoConsignatario: texto(r['documentoConsignatario'] ?? r['documento_consignatario'] ?? r['consignatarioDocumento'] ?? r['consignatarioId']),
      formatoId: r['formatoId'] == null ? null : Number(r['formatoId']),
      destinoId: texto(r['destinoId']),
      transporteId: texto(r['transporteId']),
      porcentaje: r['porcentaje'] == null ? null : Number(r['porcentaje']),
      vigenciaDesde: texto(r['vigenciaDesde']),
      vigenciaHasta: texto(r['vigenciaHasta']),
      descripcion: r['descripcion'] ?? '',
      activo: r['activo'] !== false,
      bd: 1,
      modo: r['modo'] ?? 'editado',
    }));
    // Igual que antes: las reglas se agregan o actualizan por id, no se vacia la tabla.
    for (const fila of filas) await this.admin.reglasSobrePesoRepository.saveFordec(fila as any);
  }

  private async correlativos(): Promise<void> {
    const sobre = await this.api.correlativosDocumentos();
    if (sobre.error) throw new Error(sobre.mensaje ?? 'Error al listar correlativos de documentos');
    const filas = (sobre.data ?? []).map((r: Fila) => ({ ...r, modo: 'editado', bd: 1 }));
    const repo = this.admin.correlativosDocumentosRepository;
    await repo.clear();
    if (filas.length > 0) await repo.bulkSave(filas as any);
  }

  /** Agrega a cada fila de la matriz los nombres de los catalogos que ya estan en el equipo. */
  private async normalizarMatrices(datos: Fila[], cfg: Configuracion): Promise<MatrizCompatibilidad[]> {
    const c = this.catalogos;
    const buscar = async (repo: { getByField: (campo: string, valor: any) => Promise<any> }, campo: string, valor: unknown): Promise<any> =>
      valor ? repo.getByField(campo, valor) : undefined;

    const filas: MatrizCompatibilidad[] = [];
    for (const item of datos) {
      const cliente = await buscar(c.clientesRepo as any, 'id', item['documentoCliente'] ? Number(item['documentoCliente']) : 0);
      const consignatario = await buscar(c.consignatariosRepo as any, 'documento', item['documentoConsignatario']);
      const destino = await buscar(c.destinosRepo as any, 'id', item['destinoId']);
      const formato = await buscar(c.formatosRepo as any, 'id', item['formatoId']);
      const tipoEmpaque = await buscar(c.tiposEmpaqueRepo as any, 'id', item['tiposEmpaqueId']);
      const tipoEmpaqueGuia = await buscar(c.tiposEmpaqueGuiaRepo as any, 'id', item['tipoEmpaqueGuiaId']);
      const calibre = await buscar(c.calibresRepo as any, 'id', item['calibreId']);
      const tipoCaja = await buscar(c.tiposCajaRepo as any, 'id', item['tipoCajaId']);
      const tipoClamshell = await buscar(c.tiposClamshellRepo as any, 'id', item['tipoClamshellId']);
      const presentacion = await buscar(c.presentacionesRepo as any, 'id', item['presentacionId']);
      const categoria = await buscar(c.categoriasRepo as any, 'id', item['categoriaId']);

      filas.push({
        id: Number(item['id'] ?? 0),
        idProyecto: item['idProyecto'] ?? cfg.idProyecto,
        codigoCultivo: item['codigoCultivo'] ?? cfg.codigoCultivo,
        documentoCliente: item['documentoCliente'] ?? '',
        clienteNombre: cliente?.razonSocial ?? cliente?.nombre ?? cliente?.descripcion,
        documentoConsignatario: item['documentoConsignatario'] ?? '',
        consignatarioNombre: consignatario?.razonSocial ?? consignatario?.nombre ?? consignatario?.descripcion,
        destinoId: item['destinoId'] ?? '',
        destinoNombre: destino?.pais ?? destino?.nacionalidad,
        formatoId: Number(item['formatoId'] ?? 0),
        formatoNombre: formato?.descripcion ?? formato?.descripcion2,
        formatoCodigo: formato?.descripcion2,
        tiposEmpaqueId: Number(item['tiposEmpaqueId'] ?? 0),
        tipoEmpaqueNombre: tipoEmpaque?.descripcion ?? tipoEmpaque?.codigo,
        tipoEmpaqueGuiaId: Number(item['tipoEmpaqueGuiaId'] ?? 0),
        tipoEmpaqueGuiaNombre: tipoEmpaqueGuia?.nombre ?? tipoEmpaqueGuia?.descripcion,
        calibreId: item['calibreId'] ?? '',
        calibreNombre: calibre?.calibre ?? calibre?.calibreId,
        tipoCajaId: Number(item['tipoCajaId'] ?? 0),
        tipoCajaNombre: tipoCaja?.nombre ?? tipoCaja?.descripcion,
        tipoClamshellId: Number(item['tipoClamshellId'] ?? 0),
        tipoClamshellNombre: tipoClamshell?.nombre ?? tipoClamshell?.descripcion,
        presentacionId: Number(item['presentacionId'] ?? 0),
        presentacionNombre: presentacion?.nombre ?? presentacion?.descripcion,
        categoriaId: Number(item['categoriaId'] ?? 0),
        categoriaNombre: categoria?.nombre ?? categoria?.descripcion,
        activo: !!item['activo'],
        fechaCreacion: item['fechaCreacion'],
        modo: item['modo'] ?? 'editado',
        bd: 1,
      });
    }
    return filas;
  }
}
