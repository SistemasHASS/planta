import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface InspeccionData {
  temperatura: number | null;
  numeroViaje: number | null;
  ultimoViaje: boolean;
  libreOlores: 'si' | 'no';
  libreInsectos: 'si' | 'no';
  libreMateriasExtranas: 'si' | 'no';
  unidadLimpia: 'si' | 'no';
  observaciones: string;
  medidaCorrectiva: string;
}

@Component({
  selector: 'app-modal-inspeccion',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './modal-inspeccion.component.html',
  styleUrl: './modal-inspeccion.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModalInspeccionComponent {
  @Input() guiaPayload: any = null;

  @Output() cerrar = new EventEmitter<void>();
  @Output() confirmar = new EventEmitter<{ guia: any; inspeccion: InspeccionData }>();

  readonly temperatura = signal<string>('');
  readonly numeroViaje = signal<string>('');
  readonly ultimoViaje = signal(false);

  readonly libreOlores = signal<'si' | 'no'>('si');
  readonly libreInsectos = signal<'si' | 'no'>('si');
  readonly libreMaterias = signal<'si' | 'no'>('si');
  readonly unidadLimpia = signal<'si' | 'no'>('si');

  readonly observaciones = signal('');
  readonly medidaCorrectiva = signal('');

  readonly submitAttempted = signal(false);

  readonly hayAlgunoNo = computed(() => {
    return this.libreOlores() === 'no' ||
           this.libreInsectos() === 'no' ||
           this.libreMaterias() === 'no' ||
           this.unidadLimpia() === 'no';
  });

  readonly temperaturaNum = computed(() => {
    const v = parseFloat(this.temperatura());
    return isNaN(v) ? null : v;
  });

  readonly numeroViajeNum = computed(() => {
    const v = parseInt(this.numeroViaje(), 10);
    return isNaN(v) || v < 1 ? null : v;
  });

  readonly isValid = computed(() => {
    if (this.temperaturaNum() === null) return false;
    if (this.numeroViajeNum() === null) return false;
    if (this.hayAlgunoNo()) {
      if (!this.observaciones().trim()) return false;
      if (!this.medidaCorrectiva().trim()) return false;
    }
    return true;
  });

  onCerrar(): void {
    this.cerrar.emit();
  }

  onConfirmar(): void {
    this.submitAttempted.set(true);
    if (!this.isValid()) return;

    const inspeccion: InspeccionData = {
      temperatura: this.temperaturaNum(),
      numeroViaje: this.numeroViajeNum(),
      ultimoViaje: this.ultimoViaje(),
      libreOlores: this.libreOlores(),
      libreInsectos: this.libreInsectos(),
      libreMateriasExtranas: this.libreMaterias(),
      unidadLimpia: this.unidadLimpia(),
      observaciones: this.observaciones().trim(),
      medidaCorrectiva: this.medidaCorrectiva().trim(),
    };

    this.confirmar.emit({ guia: this.guiaPayload, inspeccion });
  }

  isInvalidTemperatura(): boolean {
    return this.submitAttempted() && this.temperaturaNum() === null;
  }

  isInvalidNumeroViaje(): boolean {
    return this.submitAttempted() && this.numeroViajeNum() === null;
  }

  isInvalidObservaciones(): boolean {
    return this.submitAttempted() && this.hayAlgunoNo() && !this.observaciones().trim();
  }

  isInvalidMedida(): boolean {
    return this.submitAttempted() && this.hayAlgunoNo() && !this.medidaCorrectiva().trim();
  }
}
