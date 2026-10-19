import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { LucideDownload, LucideFileText, LucideX } from '@lucide/angular';
import { portalToBody } from '../../../../shared/utils/portal';

/** Ventana que muestra el PDF de SUNAT de una guía (solo escritorio; en celular el PDF se abre en otra pestaña). */
@Component({
  selector: 'app-modal-pdf-sunat',
  imports: [LucideDownload, LucideFileText, LucideX],
  templateUrl: './modal-pdf-sunat.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModalPdfSunatComponent {
  constructor() {
    portalToBody();
  }

  private readonly sanitizer = inject(DomSanitizer);

  /** Dirección del PDF. */
  readonly url = input.required<string>();

  /** Se emite al cerrar la ventana. */
  readonly closed = output<void>();

  /** Mientras el PDF carga se muestra un círculo de espera. */
  readonly cargando = signal(true);

  /** Angular exige marcar la dirección como segura para usarla dentro de un iframe. */
  readonly urlSegura = computed<SafeResourceUrl>(() => this.sanitizer.bypassSecurityTrustResourceUrl(this.url()));

  alTerminarDeCargar(): void {
    this.cargando.set(false);
  }
}
