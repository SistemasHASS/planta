import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { Acopio, AcopioDetalle, TipoProcesoEmpacado } from '../../../../shared/interfaces/catalogo.interface';

type Row = Acopio & { _pk?: any };

export interface AcopiosModalResult {
  serieGuia: string;
  seleccionados: string[];
  value: Row;
}

@Component({
  selector: 'app-acopios-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './acopios-modal.component.html',
  styleUrl: './acopios-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AcopiosModalComponent {
  @Input() value: Row | null = null;
  @Input() tipos: TipoProcesoEmpacado[] = [];
  @Input() detalles: AcopioDetalle[] = [];

  @Output() cerrar = new EventEmitter<void>();
  @Output() guardar = new EventEmitter<AcopiosModalResult>();

  readonly serieGuia = signal('');
  readonly seleccion = signal<Record<string, boolean>>({});
  readonly filtroTipos = signal('');

  private initialSerie = '';
  private initialSeleccion: Record<string, boolean> = {};

  readonly title = computed(() => `Editar Acopio${this.value?.codigoAcopio ? ' — ' + this.value?.codigoAcopio : ''}`);

  readonly tiposFiltrados = computed(() => {
    const term = String(this.filtroTipos() ?? '').trim().toLowerCase();
    const src = this.tipos ?? [];
    if (!term) return src;
    return src.filter((t: any) => {
      const parts = [t?.codigo, t?.nombre].map(v => String(v ?? '').toLowerCase());
      return parts.some(p => p.includes(term));
    });
  });

  readonly seleccionadosCount = computed(() => {
    const sel = this.seleccion();
    return Object.keys(sel).filter(k => sel[k]).length;
  });

  readonly hasChanges = computed(() => {
    if (this.serieGuia().trim() !== this.initialSerie.trim()) return true;
    const sel = this.seleccion();
    const keys = new Set([...Object.keys(sel), ...Object.keys(this.initialSeleccion)]);
    for (const k of keys) {
      if (!!sel[k] !== !!this.initialSeleccion[k]) return true;
    }
    return false;
  });

  ngOnChanges(): void {
    const v: any = this.value ?? {};
    this.serieGuia.set(String(v?.serieGuia ?? '').trim());
    this.initialSerie = String(v?.serieGuia ?? '').trim();

    const sel: Record<string, boolean> = {};
    for (const d of (this.detalles ?? [])) {
      const codigo = String((d as any)?.codigoTipoProcesoEmpacado ?? '').trim();
      if (!codigo) continue;
      sel[codigo] = (d as any)?.activo !== false;
    }
    this.seleccion.set({ ...sel });
    this.initialSeleccion = { ...sel };
    this.filtroTipos.set('');
  }

  onSerieChange(v: string): void {
    this.serieGuia.set(String(v ?? ''));
  }

  isChecked(codigo: any): boolean {
    return !!this.seleccion()[String(codigo ?? '').trim()];
  }

  toggle(codigo: any, checked: boolean): void {
    const c = String(codigo ?? '').trim();
    if (!c) return;
    this.seleccion.update(s => ({ ...s, [c]: checked }));
  }

  onBackdrop(): void {
    this.cerrar.emit();
  }

  onCerrar(): void {
    this.cerrar.emit();
  }

  onGuardar(): void {
    const sel = this.seleccion();
    const seleccionados = Object.keys(sel).filter(k => sel[k]);
    this.guardar.emit({
      serieGuia: this.serieGuia().trim(),
      seleccionados,
      value: (this.value ?? {}) as Row,
    });
  }
}
