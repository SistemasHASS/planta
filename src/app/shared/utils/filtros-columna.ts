import { computed, signal } from '@angular/core';
import { SearchSelectOption } from '../components/search-select/search-select.component';

/** Una columna filtrable de una lista: de dónde sale su valor y cómo se rotula el filtro. */
export interface ColumnaFiltro<T> {
  clave: string;
  etiqueta: string;
  placeholder: string;
  valor: (fila: T) => string;
}

/**
 * Filtros múltiples por columna, solo sobre lo que ya está listado (no consulta nada al servidor).
 * Las opciones salen de los valores distintos de la lista cargada. Sin nada marcado, o con todo marcado, no filtra.
 */
export function crearFiltrosColumna<T>(filas: () => T[], columnas: ColumnaFiltro<T>[]) {
  const elegidos = signal<Record<string, string[]>>({});

  const opciones = computed<Record<string, SearchSelectOption[]>>(() => {
    const lista = filas();
    return Object.fromEntries(
      columnas.map((c) => {
        const valores = [...new Set(lista.map((f) => c.valor(f)))].sort((a, b) => a.localeCompare(b, 'es', { numeric: true }));
        return [c.clave, valores.map((v) => ({ value: v, label: v }))];
      }),
    );
  });

  const pasa = (fila: T): boolean => {
    const sel = elegidos();
    const ops = opciones();
    return columnas.every((c) => {
      const marcados = sel[c.clave] ?? [];
      return marcados.length === 0 || marcados.length === (ops[c.clave]?.length ?? 0) || marcados.includes(c.valor(fila));
    });
  };

  const elegir = (clave: string, valores: string[]): void => elegidos.update((actual) => ({ ...actual, [clave]: valores }));
  const marcados = (clave: string): string[] => elegidos()[clave] ?? [];
  const limpiar = (): void => elegidos.set({});
  const hayFiltros = computed(() => Object.values(elegidos()).some((v) => v.length > 0));

  return { columnas, elegidos, marcados, opciones, pasa, elegir, limpiar, hayFiltros };
}

/** Lo que devuelve `crearFiltrosColumna` (para pasarlo al panel de filtros). */
export type FiltrosColumna<T> = ReturnType<typeof crearFiltrosColumna<T>>;
