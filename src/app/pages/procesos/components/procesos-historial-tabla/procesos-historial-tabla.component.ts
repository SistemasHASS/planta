import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Proceso } from '../../../../shared/interfaces/proceso.interface';
import { PersonalLogistico, Supervisor } from '../../../../shared/interfaces/catalogo.interface';

@Component({
  selector: 'app-procesos-historial-tabla',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './procesos-historial-tabla.component.html',
  styleUrl: './procesos-historial-tabla.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProcesosHistorialTablaComponent {
  @Input({ required: true }) items: Proceso[] = [];
  @Input({ required: true }) perfil: string | null = '';

  @Input({ required: true }) supByProceso: Record<string, Supervisor[]> = {};
  @Input({ required: true }) logByProceso: Record<string, PersonalLogistico[]> = {};

  @Input({ required: true }) puedeReabrir: boolean = false;
  @Input({ required: true }) puedeCerrarAdmin: boolean = false;

  @Input({ required: true }) formatearFechaCorta!: (fecha: string) => string;
  @Input({ required: true }) formatearFechaHora!: (fecha: string | null) => string;

  @Output() reabrir = new EventEmitter<Proceso>();
  @Output() cerrar = new EventEmitter<Proceso>();
  @Output() editar = new EventEmitter<Proceso>();

  modalAbierto = signal(false);
  modalTipo = signal<'SUP' | 'LOG'>('SUP');
  modalProceso = signal<Proceso | null>(null);

  trackById = (_: number, item: Proceso) => item?.id ?? item?.idProceso;

  private asBitBoolean(value: unknown): boolean {
    return value === 1 || value === '1' || value === true || value === 'true';
  }

  sincronizadoLabel(bd: any): string {
    return this.asBitBoolean(bd) ? 'Sincronizado' : 'No sincronizado';
  }

  sincronizadoClass(bd: any): string {
    return this.asBitBoolean(bd) ? 'sp-badge sp-badge-success' : 'sp-badge sp-badge-muted';
  }

  getSupList(p: Proceso): Supervisor[] {
    return this.supByProceso[String(p?.idProceso ?? '').trim()] ?? [];
  }

  getLogList(p: Proceso): PersonalLogistico[] {
    return this.logByProceso[String(p?.idProceso ?? '').trim()] ?? [];
  }

  getPreviewNombres(list: Array<{ nombreCompleto?: string }>, max = 2): { texto: string; hasMore: boolean } {
    const nombres = (Array.isArray(list) ? list : [])
      .map(x => String(x?.nombreCompleto ?? '').trim())
      .filter(x => x.length > 0);

    if (nombres.length === 0) return { texto: '—', hasMore: false };

    const shown = nombres.slice(0, max).join(', ');
    const hasMore = nombres.length > max;
    return { texto: shown, hasMore };
  }

  abrirModal(tipo: 'SUP' | 'LOG', proceso: Proceso): void {
    this.modalTipo.set(tipo);
    this.modalProceso.set(proceso);
    this.modalAbierto.set(true);
  }

  cerrarModal(): void {
    this.modalAbierto.set(false);
    this.modalProceso.set(null);
  }

  onBackdrop(): void {
    this.cerrarModal();
  }

  onReabrir(p: Proceso): void {
    this.reabrir.emit(p);
  }

  onCerrar(p: Proceso): void {
    this.cerrar.emit(p);
  }

  onEditar(p: Proceso): void {
    this.editar.emit(p);
  }
}
