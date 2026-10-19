/**
 * Entrega de archivos generados por la API (PDF, Excel) que funciona en escritorio, Android e iOS (PWA instalada).
 * En iOS y Android un archivo que llega despues de esperar a la API no se puede abrir ni descargar "solo": el navegador
 * exige que la accion salga de un toque de la persona. Por eso en celular se muestra un aviso con un boton
 * y es ese boton el que llama a `abrirOCompartirArchivo`.
 */

/** Celular o tablet con pantalla tactil (incluye iPadOS, que se presenta como Mac). */
export function esDispositivoMovil(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /Android|iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
}

/** Descarga directa (escritorio). */
export function descargarArchivo(blob: Blob, nombre: string): void {
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  enlace.rel = 'noopener';
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * Debe llamarse DIRECTAMENTE desde un toque (sin await antes). Prefiere la hoja de compartir del sistema
 * (permite guardar en Archivos / abrir en otra app); si no existe abre el PDF en otra pestana, y como ultimo recurso descarga.
 */
export function abrirOCompartirArchivo(blob: Blob, nombre: string): void {
  const archivo = new File([blob], nombre, { type: blob.type || 'application/pdf' });
  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
  if (typeof nav.share === 'function' && nav.canShare?.({ files: [archivo] })) {
    nav.share({ files: [archivo], title: nombre }).catch((error: unknown) => {
      // AbortError = la persona cerro la hoja de compartir; cualquier otro fallo cae a abrir el archivo.
      if ((error as { name?: string })?.name !== 'AbortError') abrirEnPestana(blob, nombre);
    });
    return;
  }
  abrirEnPestana(blob, nombre);
}

function abrirEnPestana(blob: Blob, nombre: string): void {
  const url = URL.createObjectURL(blob);
  const ventana = window.open(url, '_blank');
  if (!ventana) descargarArchivo(blob, nombre);
  setTimeout(() => URL.revokeObjectURL(url), 300_000);
}
