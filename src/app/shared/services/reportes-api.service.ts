import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Campania } from '../interfaces/catalogo.interface';
import { SobreSp } from './catalogos-api.service';

type Fila = Record<string, any>;

export interface ReporteDiarioKpis {
  palletsCompletos: number;
  palletsDespachados: number;
  palletsEnProceso: number;
  cajasTotales: number;
  cajasDespachadas: number;
  kgDespachados: number;
  kgTotales: number;
}

export interface ReporteDiarioVariedad {
  variedadId: string;
  variedad: string;
  cajas: number;
  kg: number;
  porcentaje: number;
}

export interface ReporteDiarioAcopioDetalle {
  codigo: string;
  nombre: string;
  kg: number;
}

export interface ReporteDiarioAcopio {
  acopio: string;
  kg: number;
  detalleTipos?: ReporteDiarioAcopioDetalle[];
}

export interface ReporteDiarioConsignatario {
  consignatarioId: string;
  destinoId: string;
  /** Nombre del pais de destino (se completa en el equipo con el catalogo de destinos). */
  destino?: string;
  formato: string;
  consignatario: string;
  cajas: number;
  kg: number;
  porcentaje: number;
}

export interface ReporteDiarioData {
  kpis: ReporteDiarioKpis;
  procesosAbiertos: boolean;
  produccionPorVariedad: ReporteDiarioVariedad[];
  kgPorAcopio: ReporteDiarioAcopio[];
  avancePorConsignatario: ReporteDiarioConsignatario[];
}

export interface ReporteSemanalOpcion {
  id: string;
  nombre: string;
}

export interface ReporteSemanalFiltros {
  semanas: ReporteSemanalOpcion[];
  variedades: ReporteSemanalOpcion[];
  formatos: ReporteSemanalOpcion[];
  destinos: ReporteSemanalOpcion[];
  clientes: ReporteSemanalOpcion[];
  consignatarios: ReporteSemanalOpcion[];
}

export interface ReporteSemanalSeleccion {
  idProyecto: string;
  semanas: string[];
  variedades: string[];
  formatos: string[];
  destinos: string[];
  clientes: string[];
  consignatarios: string[];
}

export interface ReporteSemanalData {
  kpis: { totalCajas: number; totalPesoKg: number };
  pesoPorDiaSemana: { dia: string; pesoKg: number }[];
  pesoPorTipoProcesoEmpaque: { tipo: string; pesoKg: number }[];
  detalleVariedad: { variedadId: string; variedad: string; pesoKg: number; porcentaje: number }[];
  driscollsVsPublicas: { tipo: string; pesoKg: number; porcentaje: number }[];
}

export interface ReporteCampaniaData {
  kpis: { totalCajas: number; totalPesoKg: number };
  pesoPorSemana: { semana: string; pesoKg: number }[];
  pesoPorTipoProcesoEmpaque: { tipo: string; pesoKg: number }[];
  detalleVariedad: { variedadId: string; variedad: string; pesoKg: number; porcentaje: number }[];
  driscollsVsPublicas: { tipo: string; pesoKg: number; porcentaje: number }[];
}

export interface KgAcopioClasificacion {
  clasificacionEnvase: string;
  descripcion: string;
  envios: number;
  cantidadEnvases: number;
  kgBruto: number;
  taraTotalKg: number;
  kgNeto: number;
  porcentajeNeto: number;
}

export interface KgAcopioItem {
  acopio: string;
  nombreAcopio?: string;
  envios: number;
  kgBruto: number;
  taraTotalKg: number;
  kgNeto: number;
  porcentajeNeto: number;
  detalleClasificaciones?: KgAcopioClasificacion[];
}

export interface KgAcopioVariedad {
  variedad: string;
  jarraBlancaKgNeto: number;
  jarraVerdeKgNeto: number;
  descarteKgNeto: number;
  kgNetoTotal: number;
}

export interface ReporteKgAcopioData {
  kpis: {
    kgBrutoTotal: number;
    taraTotalKg: number;
    kgNetoTotal: number;
    enviosTotales: number;
    cantidadEnvases: number;
    acopiosTotales: number;
    detallesSinPesoVacio: number;
  };
  kgPorAcopio: KgAcopioItem[];
  kgPorClasificacion: KgAcopioClasificacion[];
  kgPorVariedad: KgAcopioVariedad[];
}

export interface ReporteKgAcopioPeticion {
  ruc: string;
  fecha: string;
  idProyecto: string;
  codFundo: string;
  acopios: string;
}

export type TipoOrigen = 'PROPIO' | 'EXTERNO' | 'SIN_CLASIFICAR';

export interface BhResumenOrigen extends ReporteDiarioKpis {
  tipoOrigen: TipoOrigen;
  esExterno: boolean | null;
}

export interface BhVariedad {
  tipoOrigen: TipoOrigen;
  variedadId: string;
  variedad: string;
  codigoCultivo: string;
  cajas: number;
  kg: number;
}

export interface BhAcopio {
  tipoOrigen: TipoOrigen;
  acopio: string;
  kg: number;
}

export interface BhConsignatario {
  tipoOrigen: TipoOrigen;
  consignatarioId: string;
  consignatario: string;
  destinoId: string;
  /** Nombre del pais de destino (se completa en el equipo con el catalogo de destinos). */
  destino?: string;
  formatoId: string;
  formato: string;
  cajas: number;
  kg: number;
}

export interface ReporteBhData {
  kpis: ReporteDiarioKpis;
  resumenOrigen: BhResumenOrigen[];
  procesosAbiertos: boolean;
  produccionPorVariedad: BhVariedad[];
  kgPorAcopio: BhAcopio[];
  avancePorConsignatario: BhConsignatario[];
}

export interface ReporteBhPeticion {
  fecha: string;
  idProyecto: string;
  acopios: string;
  /** BH, CAO o ambos separados por coma; vacio = ambos. */
  origenes: string;
}

/**
 * Reportes del administrador (API: POST api/reportes/...). Pantallas solo online: nada se guarda en Dexie.
 * Empresa y RUC salen del token. Devuelve el sobre del SP { error, data, mensaje } sin tocarlo.
 */
@Injectable({ providedIn: 'root' })
export class ReportesApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/api/reportes`;

  /** Reporte diario de produccion: KPIs, por variedad, por acopio y avance por consignatario. */
  reporteDiario(fecha: string, idProyecto: string, acopios: string): Promise<SobreSp<ReporteDiarioData | Fila[]>> {
    return this.post('reporte-diario', { fecha, idProyecto, acopios });
  }

  /** Opciones de los filtros del reporte semanal de una campaña. */
  reporteSemanalFiltros(idProyecto: string): Promise<SobreSp<ReporteSemanalFiltros>> {
    return this.post('reporte-semanal/filtros', { idProyecto });
  }

  /** Reporte semanal. Una lista vacia significa "todos". */
  reporteSemanal(seleccion: ReporteSemanalSeleccion): Promise<SobreSp<ReporteSemanalData>> {
    return this.post('reporte-semanal', seleccion);
  }

  /** Reporte de campaña (acumulado). Mismos filtros que el semanal; una lista vacia significa "todos". */
  reporteCampania(seleccion: ReporteSemanalSeleccion): Promise<SobreSp<ReporteCampaniaData>> {
    return this.post('reporte-campania', seleccion);
  }

  /** RUC de la empresa externa que el usuario puede consultar en KG ingresados (null si no tiene). */
  async kgAcopioRucExterno(): Promise<string | null> {
    const resp = await firstValueFrom(this.http.post<{ rucExterno: string | null }>(`${this.baseUrl}/reporte-kg-acopio/empresa-externa`, {}));
    return resp?.rucExterno?.trim() || null;
  }

  /** Campañas de la empresa propia o de la externa autorizada. */
  async kgAcopioCampanias(ruc: string): Promise<Campania[]> {
    const resp = await firstValueFrom(this.http.post<Campania[]>(`${this.baseUrl}/reporte-kg-acopio/campanias`, { ruc }));
    return Array.isArray(resp) ? resp : [];
  }

  /** KG de materia prima ingresada a los acopios en un dia. `acopios` vacio = todos. */
  reporteKgAcopio(peticion: ReporteKgAcopioPeticion): Promise<SobreSp<ReporteKgAcopioData>> {
    return this.post('reporte-kg-acopio', peticion);
  }

  /** true si la empresa tiene habilitado el reporte BH / CAO (parametro REPORTE_BH): muestra el menu. */
  async reporteBhHabilitado(): Promise<boolean> {
    const resp = await firstValueFrom(this.http.post<{ habilitado: boolean }>(`${this.baseUrl}/reporte-bh/habilitado`, {}));
    return resp?.habilitado === true;
  }

  /** Reporte diario separado por origen: BH (propio) y CAO (externo). */
  reporteDiarioPropioExterno(peticion: ReporteBhPeticion): Promise<SobreSp<ReporteBhData | Fila[]>> {
    return this.post('reporte-diario-propio-externo', peticion);
  }

  private post<T>(path: string, body: unknown): Promise<SobreSp<T>> {
    return firstValueFrom(this.http.post<SobreSp<T>>(`${this.baseUrl}/${path}`, body));
  }
}
