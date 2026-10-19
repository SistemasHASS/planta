import type { SearchSelectOption } from '../components/search-select/search-select.component';

type Fila = Record<string, any>;

/**
 * Convierte filas de un catalogo en opciones de `app-search-select`: el valor es el campo `idField` y el texto une los
 * `labelFields` con contenido (si ninguno tiene, usa el id).
 */
export function opcionesDe(filas: Fila[] | null | undefined, idField: string, labelFields: string[] = ['descripcion', 'nombre']): SearchSelectOption[] {
  return (filas ?? []).map((f) => {
    const partes = labelFields.map((c) => String(f?.[c] ?? '').trim()).filter(Boolean);
    const label = partes[0] ? partes.join(' — ') : String(f?.[idField] ?? '').trim();
    return { label, value: String(f?.[idField] ?? '').trim() };
  });
}
