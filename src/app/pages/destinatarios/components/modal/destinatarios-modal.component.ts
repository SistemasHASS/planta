import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Destinatario } from '../../../../shared/interfaces/catalogo.interface';

type DestinatarioForm = {
  id?: string;
  documentoFiscal: string;
  nombre: string;
  domicilioFiscal: string;
  puntoLlegada: string;
  activo: boolean;
};

@Component({
  selector: 'app-destinatarios-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './destinatarios-modal.component.html',
  styleUrl: './destinatarios-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DestinatariosModalComponent {
  @Input() modo: 'nuevo' | 'editado' = 'nuevo';
  @Input() value: Destinatario | null = null;

  @Output() cerrar = new EventEmitter<void>();
  @Output() guardar = new EventEmitter<any>();

  readonly submitAttempted = signal(false);
  private readonly initialForm = signal<DestinatarioForm | null>(null);

  readonly form = signal<DestinatarioForm>({
    documentoFiscal: '',
    nombre: '',
    domicilioFiscal: '',
    puntoLlegada: '',
    activo: true,
  });

  readonly title = computed(() => (this.modo === 'editado' ? 'Editar Destinatario' : 'Nuevo Destinatario'));

  readonly hasChanges = computed(() => {
    if (this.modo !== 'editado') return true;
    const base = this.initialForm();
    if (!base) return false;
    const f = this.form();
    return (
      base.documentoFiscal !== f.documentoFiscal ||
      base.nombre !== f.nombre ||
      base.domicilioFiscal !== f.domicilioFiscal ||
      base.puntoLlegada !== f.puntoLlegada ||
      base.activo !== f.activo
    );
  });

  readonly canSave = computed(() => {
    const valid = this.isFormValid();
    if (!valid) return false;
    return this.modo === 'nuevo' ? true : this.hasChanges();
  });

  ngOnChanges(): void {
    const v = this.value ?? ({} as any);
    const next: DestinatarioForm = {
      id: v.id,
      documentoFiscal: v.documentoFiscal ?? '',
      nombre: v.nombre ?? '',
      domicilioFiscal: v.domicilioFiscal ?? '',
      puntoLlegada: v.puntoLlegada ?? '',
      activo: typeof v.activo === 'boolean' ? v.activo : true,
    };
    this.form.set(next);
    this.initialForm.set(structuredClone(next));
    this.submitAttempted.set(false);
  }

  onBackdrop(): void {
    this.cerrar.emit();
  }

  onCerrar(): void {
    this.cerrar.emit();
  }

  private isEmpty(v: any): boolean {
    return v === null || v === undefined || String(v).trim() === '';
  }

  isFormValid(): boolean {
    const f = this.form();
    if (this.isEmpty(f.documentoFiscal) || this.isEmpty(f.nombre)) return false;
    return true;
  }

  isInvalid(field: keyof DestinatarioForm): boolean {
    if (!this.submitAttempted()) return false;
    const f: any = this.form();
    if (field === 'documentoFiscal' || field === 'nombre') return this.isEmpty(f[field]);
    return false;
  }

  updateField(field: keyof DestinatarioForm, value: any): void {
    this.form.update(f => ({ ...f, [field]: value }));
  }

  onGuardar(): void {
    this.submitAttempted.set(true);
    if (!this.isFormValid()) return;
    if (this.modo === 'editado' && !this.hasChanges()) return;

    const f = this.form();
    const payload: any = {
      ...(this.value ?? {}),
      id: f.id ?? (this.value as any)?.id,
      documentoFiscal: f.documentoFiscal,
      nombre: f.nombre,
      domicilioFiscal: f.domicilioFiscal || null,
      puntoLlegada: f.puntoLlegada || null,
      activo: !!f.activo,
    };

    this.guardar.emit({ payload, modo: this.modo });
  }

  estadoClass(activo: any): string {
    return this.asBitBoolean(activo) ? 'sp-badge sp-badge-success' : 'sp-badge sp-badge-muted';
  }

  estadoLabel(activo: any): string {
    return this.asBitBoolean(activo) ? 'Activo' : 'Inactivo';
  }

  sincronizadoClass(bd: any): string {
    return this.estadoClass(bd);
  }

  sincronizadoLabel(bd: any): string {
    return this.asBitBoolean(bd) ? 'Sincronizado' : 'No sincronizado';
  }

  private asBitBoolean(value: unknown): boolean {
    if (value === true) return true;
    if (value === false) return false;
    if (value === 1) return true;
    if (value === 0) return false;
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') {
      const v = value.trim().toLowerCase();
      if (v === '1' || v === 'true' || v === 'si' || v === 'sí' || v === 'y') return true;
      if (v === '0' || v === 'false' || v === 'no' || v === 'n' || v === '') return false;
    }
    return !!value;
  }
}
