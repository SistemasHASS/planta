import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideArrowLeft, LucideClipboardCheck, LucideFilePlus, LucideFlag, LucideLoader, LucideRoute, LucideTriangleAlert, LucideX } from '@lucide/angular';
import { portalToBody } from '../../../../shared/utils/portal';

export type SiNo = 'si' | 'no';

export interface InspeccionData {
  temperatura: number | null;
  numeroViaje: number | null;
  ultimoViaje: boolean;
  libreOlores: SiNo;
  libreInsectos: SiNo;
  libreMateriasExtranas: SiNo;
  unidadLimpia: SiNo;
  observaciones: string;
  medidaCorrectiva: string;
}

type ClavePregunta = 'libreOlores' | 'libreInsectos' | 'libreMaterias' | 'unidadLimpia';

/**
 * Segundo paso al crear una guia: inspeccion de la unidad de transporte. Solo muestra y valida; la guia la crea la pantalla Guias
 * cuando recibe `confirmar`.
 */
@Component({
  selector: 'app-modal-inspeccion',
  imports: [FormsModule, LucideArrowLeft, LucideClipboardCheck, LucideFilePlus, LucideFlag, LucideLoader, LucideRoute, LucideTriangleAlert, LucideX],
  templateUrl: './modal-inspeccion.component.html',
  styleUrl: './modal-inspeccion.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModalInspeccionComponent {
  constructor() {
    portalToBody();
  }

  readonly guiaPayload = input<any>(null);
  readonly guardando = input(false);

  readonly cerrar = output<void>();
  readonly atras = output<void>();
  readonly confirmar = output<{ guia: any; inspeccion: InspeccionData }>();

  readonly preguntas: { clave: ClavePregunta; texto: string }[] = [
    { clave: 'libreOlores', texto: '¿Libre de olores extraños?' },
    { clave: 'libreInsectos', texto: '¿Libre de insectos/plagas?' },
    { clave: 'libreMaterias', texto: '¿Libre de materias extrañas/aceites/combustible?' },
    { clave: 'unidadLimpia', texto: '¿Unidad limpia / buen estado?' },
  ];

  readonly temperatura = signal('');
  readonly numeroViaje = signal('');
  readonly ultimoViaje = signal(false);
  readonly respuestas = signal<Record<ClavePregunta, SiNo>>({ libreOlores: 'si', libreInsectos: 'si', libreMaterias: 'si', unidadLimpia: 'si' });
  readonly observaciones = signal('');
  readonly medidaCorrectiva = signal('');
  readonly submitAttempted = signal(false);

  readonly hayAlgunoNo = computed(() => Object.values(this.respuestas()).includes('no'));

  readonly temperaturaNum = computed(() => {
    const v = parseFloat(this.temperatura());
    return isNaN(v) ? null : v;
  });

  readonly numeroViajeNum = computed(() => {
    const v = parseInt(this.numeroViaje(), 10);
    return isNaN(v) || v < 1 ? null : v;
  });

  readonly isValid = computed(() => {
    if (this.temperaturaNum() === null || this.numeroViajeNum() === null) return false;
    if (this.hayAlgunoNo()) return !!this.observaciones().trim() && !!this.medidaCorrectiva().trim();
    return true;
  });

  responder(clave: ClavePregunta, valor: SiNo): void {
    this.respuestas.update((r) => ({ ...r, [clave]: valor }));
  }

  onCerrar(): void {
    if (!this.guardando()) this.cerrar.emit();
  }

  onAtras(): void {
    if (!this.guardando()) this.atras.emit();
  }

  onConfirmar(): void {
    if (this.guardando()) return;
    this.submitAttempted.set(true);
    if (!this.isValid()) return;

    const r = this.respuestas();
    this.confirmar.emit({
      guia: this.guiaPayload(),
      inspeccion: {
        temperatura: this.temperaturaNum(),
        numeroViaje: this.numeroViajeNum(),
        ultimoViaje: this.ultimoViaje(),
        libreOlores: r.libreOlores,
        libreInsectos: r.libreInsectos,
        libreMateriasExtranas: r.libreMaterias,
        unidadLimpia: r.unidadLimpia,
        observaciones: this.observaciones().trim(),
        medidaCorrectiva: this.medidaCorrectiva().trim(),
      },
    });
  }

  invalidTemperatura(): boolean {
    return this.submitAttempted() && this.temperaturaNum() === null;
  }

  /** Mensaje bajo N° de viaje: con un valor menor a 1 al instante; "Requerido" solo al intentar guardar. */
  mensajeViaje(): string {
    const crudo = this.numeroViaje() as unknown;
    const escrito = crudo !== '' && crudo !== null && crudo !== undefined;
    if (escrito && !(Number(crudo) >= 1)) return 'El valor mínimo es 1.';
    return this.invalidNumeroViaje() ? 'Requerido' : '';
  }

  /** Temperatura: se permiten decimales y negativos, pero no e, E ni +. */
  bloquearTeclaTemperatura(ev: KeyboardEvent): void {
    if (['e', 'E', '+'].includes(ev.key)) ev.preventDefault();
  }

  /** N° de viaje: entero positivo; no se permite e, E, +, -, ni decimales. */
  bloquearTeclaViaje(ev: KeyboardEvent): void {
    if (['e', 'E', '+', '-', '.', ','].includes(ev.key)) ev.preventDefault();
  }

  invalidNumeroViaje(): boolean {
    return this.submitAttempted() && this.numeroViajeNum() === null;
  }

  invalidObservaciones(): boolean {
    return this.submitAttempted() && this.hayAlgunoNo() && !this.observaciones().trim();
  }

  invalidMedida(): boolean {
    return this.submitAttempted() && this.hayAlgunoNo() && !this.medidaCorrectiva().trim();
  }
}
