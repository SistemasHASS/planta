import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, effect, inject, input, output, signal, viewChild } from '@angular/core';
import { LucideQrCode, LucideX } from '@lucide/angular';
import jsQR from 'jsqr';
import { portalToBody } from '../../utils/portal';

/** API nativa del navegador para leer códigos (aún no viene en los tipos de TypeScript). */
interface DetectorBarras {
  detect(fuente: HTMLVideoElement): Promise<{ rawValue: string }[]>;
}
interface DetectorBarrasConstructor {
  new (opciones?: { formats: string[] }): DetectorBarras;
}

/** Lo que el padre muestra en la ventana después de leer el código: buscando, error, o el trabajador encontrado. */
export interface ResultadoQr {
  codigo: string;
  buscando: boolean;
  /** Texto que se muestra junto al indicador de carga mientras `buscando` (ej. "Buscando trabajador…"). */
  estado?: string;
  error: string;
  trabajador: Record<string, any> | null;
  /** Texto "Línea 3 · P5" cuando el trabajador ya quedó asignado a ese puesto. */
  asignado?: string;
  /** Qué pasa después de asignar ("Siguiente: P6" o "Línea completa"). */
  siguiente?: string;
  /** Próximo puesto libre de la línea (null = la línea quedó completa). */
  proximo?: number | null;
}

/**
 * Ventana para escanear un código QR con la cámara. Lee solo (sin botón): al detectar un código apaga la cámara y avisa con scanned(valor).
 * También se puede escribir el documento y buscar (sirve si el QR no se lee o no hay cámara): avisa igual con scanned(valor).
 * Usa el BarcodeDetector del navegador cuando existe (Chrome / Edge en Android o Mac) y jsQR en el resto (Chrome en Windows / Linux, Firefox, Safari).
 * Sin permiso de cámara o sin https, muestra el motivo.
 * No guarda nada. Avisa con scanned(valor) o closed().
 */
@Component({
  selector: 'app-qr-scanner-modal',
  imports: [LucideQrCode, LucideX],
  templateUrl: './qr-scanner-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QrScannerModalComponent {
  constructor() {
    portalToBody();
    afterNextRender(() => void this.iniciar());
    inject(DestroyRef).onDestroy(() => this.detener());

    // Cuando el padre quita el resultado ("Escanear otro"), la cámara se vuelve a abrir.
    let hubo = false;
    effect(() => {
      const mostrando = this.resultado() !== null;
      if (hubo && !mostrando) {
        this.dni.set('');
        void this.iniciar();
      }
      hubo = mostrando;
    });
  }

  readonly titulo = input('Cosechador');
  readonly subtitulo = input('Escanea su código QR');
  /** Destino que se resalta en grande (ej. línea "1" y puesto 2). */
  readonly linea = input('');
  /** Rótulo sobre el destino: "Línea" o, en el curo de una máquina, "Kato 1 · Curo". */
  readonly lineaEtiqueta = input('Línea');
  readonly puesto = input<number | null>(null);

  /** Resultado de la búsqueda del código leído (null = se está escaneando). */
  readonly resultado = input<ResultadoQr | null>(null);

  readonly scanned = output<string>();
  /** Volver a escanear para el mismo puesto. */
  readonly reintentar = output<void>();
  /** Pasar al siguiente puesto libre (lleva su número). */
  readonly siguiente = output<number>();
  readonly closed = output<void>();

  readonly error = signal('');
  readonly iniciando = signal(true);

  /** Documento escrito a mano (alternativa a escanear el QR). */
  readonly dni = signal('');

  /** Zoom por software (1 = sin zoom): solo cuando la cámara no permite zoom propio (la mayoría de webcams de PC). */
  readonly zoomSoftware = signal(1);
  private static readonly ZOOM = 2;

  private readonly video = viewChild.required<ElementRef<HTMLVideoElement>>('video');
  private flujo: MediaStream | null = null;
  private temporizador: ReturnType<typeof setTimeout> | null = null;
  private activo = true;

  private async iniciar(): Promise<void> {
    this.activo = true;
    this.error.set('');
    this.iniciando.set(true);
    if (!navigator.mediaDevices?.getUserMedia) {
      this.fallar('La cámara solo está disponible en una conexión segura (https).');
      return;
    }

    try {
      this.flujo = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      if (!this.activo) {
        this.detener();
        return;
      }
      const video = this.video().nativeElement;
      video.srcObject = this.flujo;
      await video.play();
      await this.aplicarZoom();
      this.iniciando.set(false);
      this.leer(this.crearDetector());
    } catch (e) {
      const nombre = e instanceof DOMException ? e.name : '';
      this.fallar(nombre === 'NotAllowedError' ? 'Permite el acceso a la cámara para escanear.' : 'No se pudo abrir la cámara.');
    }
  }

  /** Acerca la imagen: zoom real de la cámara si lo trae (celulares); si no, se amplía el centro por software. */
  private async aplicarZoom(): Promise<void> {
    this.zoomSoftware.set(1);
    const pista = this.flujo?.getVideoTracks()[0];
    const zoom = (pista?.getCapabilities?.() as (MediaTrackCapabilities & { zoom?: { min: number; max: number } }) | undefined)?.zoom;
    if (pista && zoom) {
      try {
        const objetivo = Math.min(zoom.max, Math.max(zoom.min, QrScannerModalComponent.ZOOM));
        await pista.applyConstraints({ advanced: [{ zoom: objetivo } as MediaTrackConstraintSet] });
        return;
      } catch {
        // Si no lo acepta, se usa el zoom por software.
      }
    }
    this.zoomSoftware.set(QrScannerModalComponent.ZOOM);
  }

  /** Revisa la imagen de la cámara unas 6 veces por segundo hasta encontrar un código. */
  private leer(detector: DetectorBarras | null): void {
    const paso = async (): Promise<void> => {
      if (!this.activo) return;
      try {
        const video = this.video().nativeElement;
        const crudo = detector ? ((await detector.detect(video))[0]?.rawValue ?? '') : this.leerConJsQr(video);
        const valor = crudo.trim();
        if (valor) {
          this.detener();
          this.scanned.emit(valor);
          return;
        }
      } catch {
        // Un cuadro que no se pudo leer no es un error: se intenta con el siguiente.
      }
      this.temporizador = setTimeout(() => void paso(), 160);
    };
    void paso();
  }

  /** Detector nativo si el navegador lo trae (en Windows / Linux de escritorio no existe: ahí se usa jsQR). */
  private crearDetector(): DetectorBarras | null {
    const Detector = (window as unknown as { BarcodeDetector?: DetectorBarrasConstructor }).BarcodeDetector;
    if (!Detector) return null;
    try {
      return new Detector({ formats: ['qr_code'] });
    } catch {
      return null;
    }
  }

  private canvas: HTMLCanvasElement | null = null;

  private leerConJsQr(video: HTMLVideoElement): string {
    if (video.readyState < 2 || !video.videoWidth) return '';
    // Con zoom por software solo se lee el centro, que es lo que se ve en pantalla.
    const z = this.zoomSoftware();
    const sw = video.videoWidth / z;
    const sh = video.videoHeight / z;
    const sx = (video.videoWidth - sw) / 2;
    const sy = (video.videoHeight - sh) / 2;
    const escala = Math.min(1, 640 / Math.max(sw, sh));
    const ancho = Math.round(sw * escala);
    const alto = Math.round(sh * escala);
    const canvas = (this.canvas ??= document.createElement('canvas'));
    canvas.width = ancho;
    canvas.height = alto;
    const contexto = canvas.getContext('2d', { willReadFrequently: true });
    if (!contexto) return '';
    contexto.drawImage(video, sx, sy, sw, sh, 0, 0, ancho, alto);
    const imagen = contexto.getImageData(0, 0, ancho, alto);
    return jsQR(imagen.data, ancho, alto, { inversionAttempts: 'dontInvert' })?.data ?? '';
  }

  escribirDni(evento: Event): void {
    this.dni.set((evento.target as HTMLInputElement).value);
  }

  /** Busca con el documento escrito, igual que si lo hubiera leído el QR. */
  buscarManual(): void {
    const valor = this.dni().trim();
    if (!valor) return;
    this.detener();
    this.scanned.emit(valor);
  }

  private fallar(mensaje: string): void {
    this.iniciando.set(false);
    this.error.set(mensaje);
  }

  private detener(): void {
    this.activo = false;
    if (this.temporizador) clearTimeout(this.temporizador);
    this.flujo?.getTracks().forEach((t) => t.stop());
    this.flujo = null;
  }
}
