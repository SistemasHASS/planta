import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { QrScannerModalComponent, ResultadoQr } from '../../../../shared/components/qr-scanner-modal/qr-scanner-modal.component';
import { ConfirmModalService } from '../../../../shared/services/confirm-modal.service';
import { ConnectivityService } from '../../../../shared/services/connectivity.service';
import { FeedbackModalService } from '../../../../shared/services/feedback-modal.service';
import { JornadasAnotadorApiService } from '../../../../shared/services/jornadas-anotador-api.service';
import { LoadingService } from '../../../../shared/services/loading.service';
import { JornadaStore } from '../../jornada.store';
import { Fila, ladosDe, lineaTexto, texto } from '../../jornada.utils';
import { LineaPanelComponent } from '../linea-panel/linea-panel.component';
import { MenuPuestoModalComponent } from '../menu-puesto-modal/menu-puesto-modal.component';
import { SinLineasComponent } from '../sin-lineas/sin-lineas.component';
import { ArrastrePuestos } from './arrastre-puestos';

/**
 * Pestaña "Asignar empacadores": puestos de cada línea tomada. Un puesto vacío se llena escaneando el QR del empacador;
 * uno ocupado se puede mover (tocando el destino o arrastrando), cambiar o quitar.
 */
@Component({
  selector: 'app-asignar-empacadores',
  imports: [LineaPanelComponent, MenuPuestoModalComponent, NgTemplateOutlet, QrScannerModalComponent, SinLineasComponent],
  templateUrl: './asignar-empacadores.component.html',
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AsignarEmpacadoresComponent {
  protected readonly store = inject(JornadaStore);
  /** Lado A y lado B de un curo de máquina (null si es una línea manual). */
  protected readonly ladosDe = ladosDe;
  private readonly connectivity = inject(ConnectivityService);
  private readonly loading = inject(LoadingService);
  private readonly feedback = inject(FeedbackModalService);
  private readonly confirm = inject(ConfirmModalService);
  private readonly jornadasApi = inject(JornadasAnotadorApiService);

  /** Puesto ocupado tocado: pregunta si moverlo, cambiarlo por otro (escanear) o quitarlo. */
  protected readonly menuPuesto = signal<{ linea: Fila; puesto: number; empacador: Fila } | null>(null);
  /** Empacador que se está moviendo (esperando que se toque el puesto de destino). */
  protected readonly moviendo = signal<{ idPuesto: number; nombre: string } | null>(null);
  /** Puesto sobre el que se está escaneando el QR del empacador (null = escáner cerrado). */
  protected readonly puestoEscaneo = signal<{ idLinea: number; linea: string; puesto: number; cantidad: number } | null>(null);
  /** Lo que muestra el escáner tras leer el código (buscando / trabajador / error). */
  protected readonly resultadoQr = signal<ResultadoQr | null>(null);

  private readonly arrastre = new ArrastrePuestos({
    bloqueado: () => !!this.moviendo(),
    alSoltar: (ocupante, destino) => void this.soltarEn(ocupante, destino),
  });
  protected readonly origenArrastre = this.arrastre.origen;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.arrastre.limpiar());
  }

  protected iniciarArrastre(ev: PointerEvent, puesto: number, ocupante: Fila): void {
    this.arrastre.iniciar(ev, puesto, ocupante);
  }

  protected esDestino(linea: Fila, puesto: number): boolean {
    return this.arrastre.destino() === this.store.clave(Number(linea['idLinea']), puesto);
  }

  private async soltarEn(ocupante: Fila, destino: string): Promise<void> {
    const [idLinea, puesto] = destino.split('-').map(Number);
    if (destino === this.store.clave(Number(ocupante['idLinea']), Number(ocupante['puesto']))) return; // mismo puesto
    const linea = this.store.misLineas().find((l) => Number(l['idLinea']) === idLinea);
    if (!linea) return;
    await this.moverA(linea, puesto, { idPuesto: Number(ocupante['idPuesto']), nombre: texto(ocupante['nombreCompleto']) }, this.store.asignados().get(destino));
  }

  // ---- Tocar un puesto ----

  protected tocarPuesto(linea: Fila, puesto: number): void {
    if (this.arrastre.clickSuprimido) return;
    const ocupante = this.store.asignadoEn(linea, puesto);
    const mov = this.moviendo();
    if (mov) {
      if (ocupante && Number(ocupante['idPuesto']) === mov.idPuesto) {
        this.moviendo.set(null); // tocó el mismo puesto: cancela
        return;
      }
      void this.moverA(linea, puesto, mov, ocupante);
      return;
    }
    if (ocupante) this.menuPuesto.set({ linea, puesto, empacador: ocupante });
    else this.abrirEscaner(linea, puesto);
  }

  protected cerrarMenu(): void {
    this.menuPuesto.set(null);
  }

  protected empezarMover(): void {
    const m = this.menuPuesto();
    if (!m) return;
    this.moviendo.set({ idPuesto: Number(m.empacador['idPuesto']), nombre: texto(m.empacador['nombreCompleto']) });
    this.menuPuesto.set(null);
  }

  protected cambiarEmpacador(): void {
    const m = this.menuPuesto();
    if (!m) return;
    this.menuPuesto.set(null);
    this.abrirEscaner(m.linea, m.puesto);
  }

  protected cancelarMovimiento(): void {
    this.moviendo.set(null);
  }

  private async moverA(linea: Fila, puesto: number, mov: { idPuesto: number; nombre: string }, ocupante: Fila | undefined): Promise<void> {
    if (ocupante) {
      const ok = await this.confirm.confirm({
        title: 'Reemplazar empacador',
        eyebrow: 'El puesto está ocupado',
        message: `En ${lineaTexto(linea)}, puesto P${puesto} está ${texto(ocupante['nombreCompleto'])}. ¿Reemplazarlo por ${mov.nombre}?`,
        detail: 'Quien estaba en ese puesto quedará sin puesto.',
        confirmText: 'Sí, reemplazar',
        tone: 'warning',
      });
      if (!ok) return;
    }
    await this.ejecutarPuesto('Moviendo empacador...', 'No se pudo mover al empacador.', () => this.jornadasApi.moverPuesto(mov.idPuesto, Number(linea['idLinea']), puesto));
    this.moviendo.set(null);
  }

  /** Vacía la línea: todos sus empacadores quedan sin puesto (después de confirmar). */
  protected async vaciarLinea(linea: Fila): Promise<void> {
    const cantidad = this.store.asignadosDe(linea);
    if (cantidad === 0) return;
    const ok = await this.confirm.confirm({
      title: 'Vaciar línea',
      eyebrow: 'Confirma la acción',
      message: `¿Quitar a los ${cantidad} empacadores de ${lineaTexto(linea)}?`,
      detail: 'Todos los puestos quedarán libres. La línea sigue siendo tuya.',
      confirmText: 'Sí, vaciar',
      tone: 'warning',
    });
    if (!ok) return;
    await this.ejecutarPuesto('Vaciando línea...', 'No se pudo vaciar la línea.', () => this.jornadasApi.vaciarLinea(Number(linea['idLinea'])));
  }

  protected async quitarEmpacador(): Promise<void> {
    const m = this.menuPuesto();
    if (!m) return;
    this.menuPuesto.set(null);
    const ok = await this.confirm.confirm({
      title: 'Quitar empacador',
      eyebrow: 'Confirma la acción',
      message: `¿Quitar a ${texto(m.empacador['nombreCompleto'])} del puesto P${m.puesto} de ${lineaTexto(m.linea)}?`,
      confirmText: 'Quitar',
      tone: 'warning',
    });
    if (!ok) return;
    await this.ejecutarPuesto('Quitando empacador...', 'No se pudo quitar al empacador.', () => this.jornadasApi.quitarPuesto(Number(m.empacador['idPuesto'])));
  }

  /** Llama al servidor, avisa si falló y vuelve a leer los puestos. */
  private async ejecutarPuesto(mensajeCarga: string, mensajeError: string, accion: () => Promise<{ error?: boolean; mensaje?: string | null }>): Promise<void> {
    if (!this.connectivity.online()) {
      this.feedback.error('No hay conexión a internet');
      return;
    }
    this.loading.show(mensajeCarga);
    try {
      const r = await accion();
      if (r.error) this.feedback.error(r.mensaje || mensajeError);
      await this.store.cargarPuestos();
    } catch {
      this.feedback.error(mensajeError);
    } finally {
      this.loading.hide();
    }
  }

  // ---- Escáner QR ----

  /** Abre el escáner en un puesto. Después de cada empacador asignado pasa solo al siguiente puesto libre. */
  private abrirEscaner(linea: Fila, puesto: number): void {
    this.resultadoQr.set(null);
    this.puestoEscaneo.set({ idLinea: Number(linea['idLinea']), linea: texto(linea['numero']), puesto, cantidad: this.store.puestosDe(linea).length });
  }

  protected cerrarEscaner(): void {
    this.puestoEscaneo.set(null);
    this.resultadoQr.set(null);
  }

  /** "Volver a escanear": reabre la cámara para el mismo puesto (si el escaneo fue un error, el nuevo reemplaza al anterior). */
  protected reescanearPuesto(): void {
    this.resultadoQr.set(null);
  }

  /** "Siguiente": pasa al siguiente puesto libre de la línea y reabre la cámara. */
  protected irAlSiguiente(proximo: number): void {
    const destino = this.puestoEscaneo();
    if (!destino) return;
    this.puestoEscaneo.set({ ...destino, puesto: proximo });
    this.resultadoQr.set(null);
  }

  /** Primer puesto libre de la línea después de `desde` (o, si no hay, el primero libre desde el inicio). */
  private siguienteLibre(idLinea: number, desde: number, cantidad: number): number | null {
    const ocupado = (p: number) => this.store.asignados().has(this.store.clave(idLinea, p));
    for (let p = desde + 1; p <= cantidad; p++) if (!ocupado(p)) return p;
    for (let p = 1; p < desde; p++) if (!ocupado(p)) return p;
    return null;
  }

  /** Busca el trabajador con el número leído, lo asigna al puesto indicado y pasa al siguiente puesto libre. */
  protected async alLeerQr(valor: string): Promise<void> {
    const destino = this.puestoEscaneo();
    if (!destino) return;
    console.log('QR escaneado:', valor, destino);
    const base: ResultadoQr = { codigo: valor, buscando: true, estado: 'Buscando trabajador…', error: '', trabajador: null };
    this.resultadoQr.set(base);

    if (!this.connectivity.online()) {
      this.resultadoQr.set({ ...base, buscando: false, error: 'No hay conexión a internet' });
      return;
    }
    try {
      const r = await this.jornadasApi.buscarTrabajador(valor);
      const trabajador = r.error ? null : (r.data?.[0] ?? null);
      if (!trabajador) {
        this.resultadoQr.set({ ...base, buscando: false, error: r.mensaje || 'No se encontró el trabajador.' });
        return;
      }

      this.resultadoQr.set({ ...base, estado: 'Asignando al puesto…' });
      // Lo guarda el servidor: si el puesto tenía a otro lo reemplaza; si el empacador ya está en otro puesto avisa (para cambiarlo se usa Mover).
      const guardado = await this.jornadasApi.asignarPuesto(destino.idLinea, destino.puesto, {
        numeroDocumento: texto(trabajador['numeroDocumento']),
        nombreCompleto: texto(trabajador['nombreCompleto']),
        apellidoPaterno: texto(trabajador['apellidoPaterno']),
        apellidoMaterno: texto(trabajador['apellidoMaterno']),
      });
      if (guardado.error) {
        this.resultadoQr.set({ ...base, buscando: false, trabajador: null, error: guardado.mensaje || 'No se pudo asignar el empacador.' });
        return;
      }
      await this.store.cargarPuestos();

      const proximo = this.siguienteLibre(destino.idLinea, destino.puesto, destino.cantidad);
      this.resultadoQr.set({
        ...base,
        buscando: false,
        trabajador,
        asignado: `Línea ${destino.linea} · P${destino.puesto}`,
        siguiente: proximo ? '' : 'Línea completa',
        proximo,
      });
      // No avanza solo: el anotador decide si sigue, termina o corrige (volver a escanear este puesto).
    } catch {
      this.resultadoQr.set({ ...base, buscando: false, error: 'No se pudo buscar el trabajador.' });
    }
  }
}
