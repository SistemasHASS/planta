type Fila = Record<string, any>;

const texto = (valor: unknown): string => String(valor ?? '').trim();

/** Los catálogos que se cruzan en la matriz (se piden al servidor solo al abrir la ventana de nueva/editar). */
export interface CatalogosMatriz {
  clientes: Fila[];
  consignatarios: Fila[];
  destinos: Fila[];
  formatos: Fila[];
  tiposEmpaqueGuia: Fila[];
  tiposEmpaque: Fila[];
  categorias: Fila[];
  calibres: Fila[];
  tiposCaja: Fila[];
  tiposClamshell: Fila[];
  presentaciones: Fila[];
}

export const catalogosVacios = (): CatalogosMatriz => ({
  clientes: [], consignatarios: [], destinos: [], formatos: [], tiposEmpaqueGuia: [], tiposEmpaque: [],
  categorias: [], calibres: [], tiposCaja: [], tiposClamshell: [], presentaciones: [],
});

/** Una combinación de la matriz. Los ids van como texto (así los usan los buscadores); al guardar se envían como número. */
export interface MatrizFila {
  id: number;
  documentoCliente: string;
  documentoConsignatario: string;
  destinoId: string;
  formatoId: string;
  tiposEmpaqueId: string;
  tipoEmpaqueGuiaId: string;
  calibreId: string;
  categoriaId: string;
  tipoCajaId: string;
  tipoClamshellId: string;
  /** '' = sin presentación. */
  presentacionId: string;
  activo: boolean;
  clienteNombre: string;
  consignatarioNombre: string;
  destinoNombre: string;
  formatoNombre: string;
  tipoEmpaqueNombre: string;
  tipoEmpaqueGuiaNombre: string;
  calibreNombre: string;
  tipoCajaNombre: string;
  tipoClamshellNombre: string;
  presentacionNombre: string;
  categoriaNombre: string;
}

/** Del tipo de empaque guía salen el tipo de empaque, la categoría y el calibre (no se eligen aparte). */
export function derivarDeGuia(c: CatalogosMatriz, tipoEmpaqueGuiaId: string) {
  const guia = c.tiposEmpaqueGuia.find((g) => texto(g['id']) === tipoEmpaqueGuiaId);
  const empaque = guia ? c.tiposEmpaque.find((e) => texto(e['codigo']) === texto(guia['codigoTipoEmpaque'])) : undefined;
  const categoria = empaque ? c.categorias.find((k) => texto(k['codigo']) === texto(empaque['codigoCategoria'])) : undefined;
  const calibre = categoria ? c.calibres.find((l) => texto(l['id']) === texto(categoria['calibreId'])) : undefined;
  return {
    guia,
    tiposEmpaqueId: texto(empaque?.['id']),
    tipoEmpaqueNombre: texto(empaque?.['descripcion'] ?? empaque?.['nombre']),
    categoriaId: texto(categoria?.['id']),
    categoriaNombre: texto(categoria?.['nombre']),
    calibreId: texto(calibre?.['id']),
    calibreNombre: texto(calibre?.['calibre']),
  };
}

/** Catálogos que vienen de una API externa y ya están en el equipo (se cruzan para mostrar el nombre). */
export interface CatalogosExternos {
  clientes: Fila[];
  consignatarios: Fila[];
  destinos: Fila[];
  calibres: Fila[];
}

/**
 * Arma una fila de la lista. Cliente, consignatario, destino y calibre (API externa) se cruzan con lo guardado en el
 * equipo; los demás nombres vienen del SP (formatoNombre, tipoEmpaqueNombre, tipoEmpaqueGuiaNombre, tipoCajaNombre,
 * tipoClamshellNombre, presentacionNombre, categoriaNombre).
 */
export function armarFila(fila: Fila, ext: CatalogosExternos): MatrizFila {
  const por = (lista: Fila[], campo: string, valor: unknown) => lista.find((x) => texto(x[campo]) === texto(valor));
  const cliente = por(ext.clientes, 'id', fila['documentoCliente']);
  const consignatario = por(ext.consignatarios, 'documento', fila['documentoConsignatario']);
  const destino = por(ext.destinos, 'id', fila['destinoId']);
  const calibre = por(ext.calibres, 'id', fila['calibreId']);
  const local = (x: Fila | undefined, campo: string) => texto(x?.[campo]) || '—';
  const nombre = (...campos: string[]) => campos.map((k) => texto(fila[k])).find(Boolean) || '—';
  const esVerdadero = (v: unknown) => (typeof v === 'string' ? ['1', 'true', 'si', 'sí'].includes(v.trim().toLowerCase()) : v === true || v === 1);
  return {
    id: Number(fila['id'] ?? 0),
    documentoCliente: texto(fila['documentoCliente']),
    documentoConsignatario: texto(fila['documentoConsignatario']),
    destinoId: texto(fila['destinoId']),
    formatoId: texto(fila['formatoId']),
    tiposEmpaqueId: texto(fila['tiposEmpaqueId']),
    tipoEmpaqueGuiaId: texto(fila['tipoEmpaqueGuiaId']),
    calibreId: texto(fila['calibreId']),
    categoriaId: texto(fila['categoriaId']),
    tipoCajaId: texto(fila['tipoCajaId']),
    tipoClamshellId: texto(fila['tipoClamshellId']),
    presentacionId: texto(fila['presentacionId']),
    activo: esVerdadero(fila['activo']),
    clienteNombre: texto(fila['nombreCliente']) || local(cliente, 'nombre'),
    consignatarioNombre: local(consignatario, 'nombre'),
    destinoNombre: local(destino, 'pais'),
    formatoNombre: nombre('formatoNombre', 'formato'),
    tipoEmpaqueNombre: nombre('tipoEmpaqueNombre', 'tipoEmpaque'),
    tipoEmpaqueGuiaNombre: nombre('tipoEmpaqueGuiaNombre', 'tipoEmpaqueGuia'),
    calibreNombre: local(calibre, 'calibre'),
    tipoCajaNombre: nombre('tipoCajaNombre', 'tipoCaja'),
    tipoClamshellNombre: nombre('tipoClamshellNombre', 'tipoClamshell'),
    presentacionNombre: texto(fila['presentacionId']) ? nombre('presentacionNombre', 'presentacion') : '—',
    categoriaNombre: nombre('categoriaNombre', 'categoria'),
  };
}

/** Arma lo que espera el servidor para guardar una combinación (texto JSON de una lista de una). */
export function matrizAJson(m: MatrizFila, modo: 'nuevo' | 'editado', idProyecto: string, codigoCultivo: string): string {
  const numero = (valor: string): number | null => (texto(valor) === '' ? null : Number(valor));
  return JSON.stringify([
    {
      id: modo === 'nuevo' ? 0 : m.id,
      modo,
      idProyecto,
      codigoCultivo,
      destinoId: m.destinoId,
      documentoCliente: m.documentoCliente,
      documentoConsignatario: m.documentoConsignatario,
      formatoId: numero(m.formatoId),
      tiposEmpaqueId: numero(m.tiposEmpaqueId),
      calibreId: m.calibreId,
      tipoCajaId: numero(m.tipoCajaId),
      tipoClamshellId: numero(m.tipoClamshellId),
      presentacionId: numero(m.presentacionId),
      activo: m.activo,
      tipoEmpaqueGuiaId: numero(m.tipoEmpaqueGuiaId),
      categoriaId: numero(m.categoriaId),
    },
  ]);
}
