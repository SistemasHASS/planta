import { DestroyRef, ElementRef, afterNextRender, inject } from '@angular/core';

/**
 * Mueve el elemento host del componente al final de <body>. Los modales quedan fuera del contenedor
 * con scroll de la pagina: Safari / iOS crea ahi un contexto de apilamiento y el modal no cubria el
 * menu superior ni el lateral (se veia "corto"). Llamar desde el constructor.
 *
 * Dentro de un @if / @for Angular inserta el elemento en su lugar DESPUES de crear el componente, y deshace el movimiento hecho
 * en el constructor: la ventana quedaba dentro de su padre (y un `position: fixed` dentro de un padre con `transform`, como el
 * .modal-box de daisyUI, mide como ese padre y no como la pantalla: el visor de fotos se veia cortado). Por eso se vuelve a
 * mover cuando termina el primer render.
 */
export function portalToBody(): void {
  const el = inject(ElementRef<HTMLElement>).nativeElement as HTMLElement;
  const destroyRef = inject(DestroyRef);
  el.classList.add('portal-modal');
  document.body.appendChild(el);
  afterNextRender(() => {
    if (el.parentElement !== document.body) document.body.appendChild(el);
  });
  destroyRef.onDestroy(() => el.remove());
}
