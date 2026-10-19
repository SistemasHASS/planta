import { Injectable, inject } from '@angular/core';
import { CatalogosApiService } from './catalogos-api.service';

type Sobre = { error?: boolean; data?: unknown } | null | undefined;

const texto = (v: unknown): string => String(v ?? '').trim();

/**
 * Catalogos que usan las pantallas de guias (normal y manual). Destinatarios, transportistas, conductores, vehiculos y motivos de
 * traslado se piden siempre al servidor y no se guardan en el equipo.
 */
@Injectable({ providedIn: 'root' })
export class CatalogosGuiaService {
  private readonly catalogosApi = inject(CatalogosApiService);

  /** Destinatarios activos, siempre del servidor. */
  destinatarios(): Promise<any[]> {
    return this.pedirLista(() => this.catalogosApi.destinatarios(), true, 'destinatarios');
  }

  /** Destinatarios tal cual los devuelve el servidor, sin guardarlos en el equipo (para solo mostrar nombres en listados). */
  async destinatariosEnLinea(): Promise<any[]> {
    try {
      const sobre = await this.catalogosApi.destinatarios();
      return !sobre?.error && Array.isArray(sobre?.data) ? sobre.data : [];
    } catch (error) {
      console.error('Error obteniendo destinatarios', error);
      return [];
    }
  }

  transportistas(idProyecto: string): Promise<any[]> {
    return this.pedirLista(() => this.catalogosApi.porProyecto('transportistas', texto(idProyecto)), true, 'transportistas');
  }

  conductores(idProyecto: string): Promise<any[]> {
    return this.pedirLista(() => this.catalogosApi.porProyecto('conductores', texto(idProyecto)), true, 'conductores');
  }

  vehiculos(idProyecto: string): Promise<any[]> {
    return this.pedirLista(() => this.catalogosApi.porProyecto('vehiculos', texto(idProyecto)), true, 'vehiculos');
  }

  motivosTraslado(): Promise<any[]> {
    return this.pedirLista(() => this.catalogosApi.motivosTraslado(), false, 'motivosTraslado');
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

  // ───────── Utilidades ─────────

  /** Pide el catalogo al servidor y lo devuelve tal cual. `validarError`: si el servidor informa error devuelve []. */
  private async pedirLista(pedir: () => Promise<Sobre>, validarError: boolean, nombre: string): Promise<any[]> {
    try {
      const sobre = await pedir();
      if (validarError && sobre?.error) return [];
      return Array.isArray(sobre?.data) ? (sobre!.data as any[]) : [];
    } catch (error) {
      console.error(`Error obteniendo ${nombre}`, error);
      return [];
    }
  }
}
