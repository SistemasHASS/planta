import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdvancedSelectComponent } from '../../../../shared/components/advanced-select/advanced-select.component';
import { MatrizCompatibilidad } from '../../../../shared/interfaces/administracion.interface';

type MatrizCompatibilidadForm = {
  documentoCliente: string | null;
  documentoConsignatario: string | null;
  destinoId: string | null;
  formatoId: number | null;
  calibreId: string | null;
  tiposEmpaqueId: number | null;
  tipoEmpaqueGuiaId: number | null;
  tipoCajaId: number | null;
  tipoClamshellId: number | null;
  presentacionId: number | null;
  categoriaId: number | null;
  activo: boolean;
};

@Component({
  selector: 'app-matriz-compatibilidad-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, AdvancedSelectComponent],
  templateUrl: './matriz-compatibilidad-modal.component.html',
  styleUrl: './matriz-compatibilidad-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MatrizCompatibilidadModalComponent {
  @Input() modo: 'nuevo' | 'editado' = 'nuevo';
  @Input() value: MatrizCompatibilidad | null = null;
  @Input() tiposEmpaqueGuiaList: any[] = [];
  @Input() tiposEmpaqueList: any[] = [];
  @Input() categoriasList: any[] = [];
  @Input() calibresList: any[] = [];

  @Output() cerrar = new EventEmitter<void>();
  @Output() guardar = new EventEmitter<any>();

  readonly submitAttempted = signal(false);
  private readonly initialForm = signal<MatrizCompatibilidadForm | null>(null);
  readonly form = signal<MatrizCompatibilidadForm>({
    documentoCliente: null,
    documentoConsignatario: null,
    destinoId: null,
    formatoId: null,
    calibreId: null,
    tiposEmpaqueId: null,
    tipoEmpaqueGuiaId: null,
    tipoCajaId: null,
    tipoClamshellId: null,
    presentacionId: null,
    categoriaId: null,
    activo: true,
  });

  readonly displayNames = signal({
    tipoEmpaqueNombre: '',
    categoriaNombre: '',
    calibreNombre: '',
  });

  readonly title = computed(() => (this.modo === 'editado' ? 'Editar Combinación' : 'Nueva Combinación'));

  readonly hasChanges = computed(() => {
    if (this.modo !== 'editado') return true;
    const base = this.initialForm();
    if (!base) return false;
    const f = this.form();
    return (
      base.documentoCliente !== f.documentoCliente ||
      base.documentoConsignatario !== f.documentoConsignatario ||
      base.destinoId !== f.destinoId ||
      base.formatoId !== f.formatoId ||
      base.calibreId !== f.calibreId ||
      base.tiposEmpaqueId !== f.tiposEmpaqueId ||
      base.tipoEmpaqueGuiaId !== f.tipoEmpaqueGuiaId ||
      base.tipoCajaId !== f.tipoCajaId ||
      base.tipoClamshellId !== f.tipoClamshellId ||
      base.presentacionId !== f.presentacionId ||
      base.categoriaId !== f.categoriaId ||
      base.activo !== f.activo
    );
  });

  readonly canSave = computed(() => {
    const valid = this.isFormValid();
    if (!valid) return false;
    return this.modo === 'nuevo' ? true : this.hasChanges();
  });

  ngOnInit(): void {
    this.initFromValue();
  }

  ngOnChanges(): void {
    this.initFromValue();
  }

  private initFromValue(): void {
    const v = this.value ?? ({} as any);
    const next: MatrizCompatibilidadForm = {
      documentoCliente: v.documentoCliente ?? null,
      documentoConsignatario: v.documentoConsignatario ?? null,
      destinoId: v.destinoId ?? null,
      formatoId: v.formatoId ?? null,
      calibreId: v.calibreId ?? null,
      tiposEmpaqueId: v.tiposEmpaqueId ?? null,
      tipoEmpaqueGuiaId: v.tipoEmpaqueGuiaId ?? null,
      tipoCajaId: v.tipoCajaId ?? null,
      tipoClamshellId: v.tipoClamshellId ?? null,
      presentacionId: v.presentacionId ?? null,
      categoriaId: v.categoriaId ?? null,
      activo: typeof v.activo === 'boolean' ? v.activo : true,
    };
    this.form.set(next);
    this.initialForm.set(structuredClone(next));
    this.submitAttempted.set(false);
    this.resolverDisplayNames(next.tipoEmpaqueGuiaId);
  }

  private resolverDisplayNames(tipoEmpaqueGuiaId: number | null): void {
    if (!tipoEmpaqueGuiaId) {
      this.displayNames.set({ tipoEmpaqueNombre: '', categoriaNombre: '', calibreNombre: '' });
      return;
    }
    const teg = this.tiposEmpaqueGuiaList.find((c: any) => Number(c?.id ?? 0) === Number(tipoEmpaqueGuiaId));
    if (!teg) {
      this.displayNames.set({ tipoEmpaqueNombre: '', categoriaNombre: '', calibreNombre: '' });
      return;
    }
    const te = this.tiposEmpaqueList.find((c: any) => String(c?.codigo ?? '') === String(teg.codigoTipoEmpaque ?? ''));
    const cat = this.categoriasList.find((c: any) => String(c?.codigo ?? '') === String(te?.codigoCategoria ?? ''));
    const cal = this.calibresList.find((c: any) => String(c?.id ?? '') === String(cat?.calibreId ?? ''));
    this.displayNames.set({
      tipoEmpaqueNombre: te?.descripcion ?? te?.nombre ?? '',
      categoriaNombre: cat?.nombre ?? '',
      calibreNombre: cal?.calibre ?? '',
    });
  }

  onBackdrop(): void {
    this.cerrar.emit();
  }

  onCerrar(): void {
    this.cerrar.emit();
  }

  private isEmpty(v: any): boolean {
    return v === null || v === undefined || v === '';
  }

  isFormValid(): boolean {
    const f = this.form();
    return !(
      this.isEmpty(f?.documentoCliente) ||
      this.isEmpty(f?.documentoConsignatario) ||
      this.isEmpty(f?.destinoId) ||
      this.isEmpty(f?.formatoId) ||
      this.isEmpty(f?.calibreId) ||
      this.isEmpty(f?.tiposEmpaqueId) ||
      this.isEmpty(f?.tipoEmpaqueGuiaId) ||
      this.isEmpty(f?.tipoCajaId) ||
      this.isEmpty(f?.tipoClamshellId)
    );
  }

  isInvalid(field: string): boolean {
    if (!this.submitAttempted()) return false;
    return this.isEmpty((this.form() as any)?.[field]);
  }

  onTipoEmpaqueGuiaChange(id: string | number | null): void {
    const nid = id ? Number(id) : null;
    if (!nid) {
      this.form.update(f => ({
        ...f,
        tipoEmpaqueGuiaId: null,
        tiposEmpaqueId: null,
        categoriaId: null,
        calibreId: null,
      }));
      this.displayNames.set({ tipoEmpaqueNombre: '', categoriaNombre: '', calibreNombre: '' });
      return;
    }
    const teg = this.tiposEmpaqueGuiaList.find((c: any) => Number(c?.id ?? 0) === nid);
    if (!teg) return;
    const te = this.tiposEmpaqueList.find((c: any) => String(c?.codigo ?? '') === String(teg.codigoTipoEmpaque ?? ''));
    const cat = this.categoriasList.find((c: any) => String(c?.codigo ?? '') === String(te?.codigoCategoria ?? ''));
    const cal = this.calibresList.find((c: any) => String(c?.id ?? '') === String(cat?.calibreId ?? ''));
    this.form.update(f => ({
      ...f,
      tipoEmpaqueGuiaId: nid,
      tiposEmpaqueId: te?.id ?? null,
      categoriaId: cat?.id ?? null,
      calibreId: cal?.id ?? '',
    }));
    this.displayNames.set({
      tipoEmpaqueNombre: te?.descripcion ?? te?.nombre ?? '',
      categoriaNombre: cat?.nombre ?? '',
      calibreNombre: cal?.calibre ?? '',
    });
  }

  onGuardar(): void {
    this.submitAttempted.set(true);
    if (!this.isFormValid()) return;
    if (this.modo === 'editado' && !this.hasChanges()) return;
    this.guardar.emit({ payload: { ...(this.value ?? {}), ...this.form() }, modo: this.modo, _pk: (this.value as any)?._pk });
  }

  updateField(field: string, value: any): void {
    console.log(field)
    console.log(value)
    this.form.update(f => ({ ...f, [field]: value }));
  }

}
