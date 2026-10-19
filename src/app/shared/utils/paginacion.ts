import { computed, signal } from '@angular/core';

/** Paginacion en el cliente: pagina actual (acotada al total), tamano de pagina y los items de esa pagina. */
export function crearPaginacion<T>(source: () => readonly T[], size = 10) {
  const page = signal(1);
  const pageSize = signal(size);
  const lastPage = computed(() => Math.max(1, Math.ceil(source().length / pageSize())));
  const current = computed(() => Math.min(Math.max(1, page()), lastPage()));
  const offset = computed(() => (current() - 1) * pageSize());
  const paged = computed(() => source().slice(offset(), offset() + pageSize()));
  return { page, pageSize, paged, offset, current };
}
