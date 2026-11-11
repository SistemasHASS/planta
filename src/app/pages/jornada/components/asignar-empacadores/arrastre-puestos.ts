import { signal } from '@angular/core';
import { Fila } from '../../jornada.utils';

export interface OpcionesArrastre {
  /** No se puede empezar a arrastrar (p. ej. ya hay un movimiento por toque en curso). */
  bloqueado: () => boolean;
  /** Se soltó un empacador sobre un puesto ("claveLinea|puesto"). */
  alSoltar: (ocupante: Fila, destino: string) => void;
}

/**
 * Arrastrar un empacador a otro puesto: mantener pulsado y arrastrar (sirve con dedo y mouse, sin librerías).
 * Es una clase simple (no un componente) para que `AsignarEmpacadoresComponent` solo se ocupe de la pantalla.
 */
export class ArrastrePuestos {
  /** idPuesto del empacador que se está arrastrando (su puesto se ve atenuado). */
  readonly origen = signal<number | null>(null);
  /** Puesto ("claveLinea|puesto") sobre el que está el puntero mientras se arrastra (se pinta con borde azul). */
  readonly destino = signal<string | null>(null);

  private arrastre: {
    id: number;
    tipo: string;
    x0: number;
    y0: number;
    x: number;
    y: number;
    el: HTMLElement;
    puesto: number;
    ocupante: Fila;
    activo: boolean;
    timer: ReturnType<typeof setTimeout> | null;
    scroller: HTMLElement | null;
  } | null = null;
  private vista: HTMLElement | null = null;
  private autoScroll: ReturnType<typeof setInterval> | null = null;
  private suprimirClick = false;

  constructor(private readonly opciones: OpcionesArrastre) {}

  /** El clic que el navegador dispara al soltar un arrastre no debe abrir el menú del puesto. */
  get clickSuprimido(): boolean {
    return this.suprimirClick;
  }

  iniciar(ev: PointerEvent, puesto: number, ocupante: Fila): void {
    if (this.opciones.bloqueado() || (ev.pointerType === 'mouse' && ev.button !== 0)) return;
    this.limpiar();
    this.arrastre = {
      id: ev.pointerId,
      tipo: ev.pointerType,
      x0: ev.clientX,
      y0: ev.clientY,
      x: ev.clientX,
      y: ev.clientY,
      el: ev.currentTarget as HTMLElement,
      puesto,
      ocupante,
      activo: false,
      timer: null,
      scroller: null,
    };
    // Con el dedo hay que mantener pulsado un momento (si no, es un scroll); con el mouse basta con mover.
    if (ev.pointerType !== 'mouse') this.arrastre.timer = setTimeout(() => this.activar(), 350);
    window.addEventListener('pointermove', this.alMover);
    window.addEventListener('pointerup', this.alSoltar);
    window.addEventListener('pointercancel', this.limpiar);
  }

  /** Quita los listeners y la tarjeta flotante (también se llama al destruir el componente). */
  readonly limpiar = (): void => {
    const a = this.arrastre;
    if (a?.timer) clearTimeout(a.timer);
    if (this.autoScroll) clearInterval(this.autoScroll);
    this.autoScroll = null;
    this.vista?.remove();
    this.vista = null;
    window.removeEventListener('pointermove', this.alMover);
    window.removeEventListener('pointerup', this.alSoltar);
    window.removeEventListener('pointercancel', this.limpiar);
    window.removeEventListener('touchmove', this.bloquearScroll);
    this.arrastre = null;
    this.origen.set(null);
    this.destino.set(null);
  };

  private readonly alMover = (e: PointerEvent): void => {
    const a = this.arrastre;
    if (!a || e.pointerId !== a.id) return;
    a.x = e.clientX;
    a.y = e.clientY;
    if (!a.activo) {
      const distancia = Math.hypot(a.x - a.x0, a.y - a.y0);
      if (a.tipo === 'mouse') {
        if (distancia > 5) this.activar();
      } else if (distancia > 10) {
        this.limpiar(); // movió el dedo antes de tiempo: es un scroll
      }
      return;
    }
    e.preventDefault();
    this.moverVista();
    this.buscarDestino();
  };

  private readonly bloquearScroll = (e: TouchEvent): void => {
    if (e.cancelable) e.preventDefault();
  };

  private activar(): void {
    const a = this.arrastre;
    if (!a || a.activo) return;
    a.activo = true;
    if (a.timer) clearTimeout(a.timer);
    a.timer = null;

    // Tarjeta flotante que sigue al puntero.
    const caja = a.el.getBoundingClientRect();
    const vista = a.el.cloneNode(true) as HTMLElement;
    vista.removeAttribute('data-puesto');
    vista.removeAttribute('data-linea');
    vista.classList.remove('opacity-40', 'ring-4', 'ring-blue-500');
    vista.style.cssText = `position:fixed;z-index:9999;pointer-events:none;width:${caja.width}px;height:${caja.height}px;margin:0;box-shadow:0 14px 30px rgba(15,23,42,.35);transform:scale(1.08);opacity:.95;`;
    document.body.appendChild(vista);
    this.vista = vista;

    this.origen.set(Number(a.ocupante['idPuesto']));
    navigator.vibrate?.(30);
    window.addEventListener('touchmove', this.bloquearScroll, { passive: false });

    // Si se acerca al borde de la pantalla, la lista se desplaza sola.
    a.scroller = this.contenedorConScroll(a.el);
    this.autoScroll = setInterval(() => {
      const cur = this.arrastre;
      if (!cur) return;
      const paso = cur.y < 90 ? -14 : cur.y > window.innerHeight - 90 ? 14 : 0;
      if (paso === 0) return;
      if (cur.scroller) cur.scroller.scrollBy(0, paso);
      else window.scrollBy(0, paso);
      this.buscarDestino();
    }, 30);

    this.moverVista();
    this.buscarDestino();
  }

  private moverVista(): void {
    const a = this.arrastre;
    const v = this.vista;
    if (!a || !v) return;
    v.style.left = `${a.x - v.offsetWidth / 2}px`;
    v.style.top = `${a.y - v.offsetHeight / 2}px`;
  }

  private buscarDestino(): void {
    const a = this.arrastre;
    if (!a) return;
    const el = document.elementFromPoint(a.x, a.y)?.closest<HTMLElement>('[data-puesto]');
    const clave = el ? `${el.dataset['linea']}|${el.dataset['puesto']}` : null;
    if (clave !== this.destino()) this.destino.set(clave);
  }

  private contenedorConScroll(el: HTMLElement): HTMLElement | null {
    for (let p = el.parentElement; p; p = p.parentElement) {
      const o = getComputedStyle(p).overflowY;
      if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight) return p;
    }
    return null;
  }

  private readonly alSoltar = (e: PointerEvent): void => {
    const a = this.arrastre;
    if (!a || e.pointerId !== a.id) return;
    const activo = a.activo;
    const destino = this.destino();
    this.limpiar();
    if (!activo) return; // fue un toque corto: sigue el clic normal (menú / escáner)

    // El clic que el navegador dispara al soltar no debe abrir el menú.
    this.suprimirClick = true;
    setTimeout(() => (this.suprimirClick = false), 80);
    if (destino) this.opciones.alSoltar(a.ocupante, destino);
  };
}
