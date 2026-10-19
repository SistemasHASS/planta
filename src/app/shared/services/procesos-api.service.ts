import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SobreSp } from './catalogos-api.service';

type Fila = Record<string, any>;

/** Filtros opcionales del listado del administrador. Vacio = sin filtrar. Fechas yyyy-MM-dd. */
export interface FiltrosProcesos {
  fechaDesde?: string;
  fechaHasta?: string;
  turno?: string;
  codigoAcopio?: string;
  estado?: string;
}

/**
 * Procesos de empacado (API: POST api/procesos/...). Empresa, RUC, usuario, rol y acopio salen del token.
 * Devuelven el sobre del SP { error, data, mensaje } sin tocarlo: cada pantalla decide que hacer con el error.
 */
@Injectable({ providedIn: 'root' })
export class ProcesosApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/api/procesos`;

  /** Procesos de la campania (el administrador recibe los de todos los acopios). */
  listar(idProyecto: string, codigoCultivo: string, filtros: FiltrosProcesos = {}): Promise<SobreSp<Fila[]>> {
    return this.post('listar', { idProyecto, codigoCultivo, ...filtros });
  }

  /** Ya existe un proceso para esa fecha (yyyy-MM-dd) y turno? */
  buscar(idProyecto: string, codigoCultivo: string, turno: string, fecha: string): Promise<SobreSp<Fila[]>> {
    return this.post('buscar', { idProyecto, codigoCultivo, turno, fecha });
  }

  supervisoresDisponibles(idProyecto: string, fecha: string): Promise<SobreSp<Fila[]>> {
    return this.post('supervisores-disponibles', { idProyecto, fecha });
  }

  personalLogisticoDisponible(idProyecto: string, fecha: string): Promise<SobreSp<Fila[]>> {
    return this.post('personal-logistico-disponible', { idProyecto, fecha });
  }

  /** Tipos de proceso de empacado configurados para el acopio del usuario. */
  tipoProcesoEmpacadoAcopio(idProyecto: string): Promise<SobreSp<Fila[]>> {
    return this.post('tipo-proceso-empacado-acopio', { idProyecto });
  }

  /** Envia un proceso con su personal. modo: 'nuevo' (por defecto), 'cerrar', 'reabrir' o 'editar'. */
  sincronizarProceso(
    proceso: unknown,
    dProcesoLogisticos: unknown,
    dProcesoSupervisores: unknown,
    codigoCultivo: string,
    idProyecto: string,
    modo = 'nuevo',
  ): Promise<SobreSp> {
    return this.post('sincronizar', {
      modo,
      idProyecto,
      codigoCultivo,
      jsonProceso: JSON.stringify(proceso),
      jsonDprocesoLogisticos: JSON.stringify(dProcesoLogisticos),
      jsonDprocesoSupervisores: JSON.stringify(dProcesoSupervisores),
    });
  }

  private post<T>(ruta: string, cuerpo: Record<string, unknown>): Promise<SobreSp<T>> {
    return firstValueFrom(this.http.post<SobreSp<T>>(`${this.baseUrl}/${ruta}`, cuerpo));
  }
}
