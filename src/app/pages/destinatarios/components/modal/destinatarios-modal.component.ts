import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnInit, Output, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Destinatario, UbigeoDepartamento, UbigeoDistrito, UbigeoProvincia } from '../../../../shared/interfaces/catalogo.interface';
import { CatalogoService } from '../../../../shared/services/catalogo.service';
import { AdvancedSelectComponent } from '../../../../shared/components/advanced-select/advanced-select.component';
import { firstValueFrom } from 'rxjs';

type DestinatarioForm = {
  id?: string;
  documentoFiscal: string;
  nombre: string;
  domicilioFiscal: string;
  puntoLlegada: string;
  domicilioFiscalDepartamento: string;
  domicilioFiscalProvincia: string;
  domicilioFiscalDistrito: string;
  puntoLlegadaDepartamento: string;
  puntoLlegadaProvincia: string;
  puntoLlegadaDistrito: string;
  activo: boolean;
};

@Component({
  selector: 'app-destinatarios-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, AdvancedSelectComponent],
  templateUrl: './destinatarios-modal.component.html',
  styleUrl: './destinatarios-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DestinatariosModalComponent implements OnInit {
  @Input() modo: 'nuevo' | 'editado' = 'nuevo';
  @Input() value: Destinatario | null = null;

  @Output() cerrar = new EventEmitter<void>();
  @Output() guardar = new EventEmitter<any>();

  private readonly catalogoService = inject(CatalogoService);

  readonly submitAttempted = signal(false);
  private readonly initialForm = signal<DestinatarioForm | null>(null);

  readonly form = signal<DestinatarioForm>({
    documentoFiscal: '',
    nombre: '',
    domicilioFiscal: '',
    puntoLlegada: '',
    domicilioFiscalDepartamento: '',
    domicilioFiscalProvincia: '',
    domicilioFiscalDistrito: '',
    puntoLlegadaDepartamento: '',
    puntoLlegadaProvincia: '',
    puntoLlegadaDistrito: '',
    activo: true,
  });

  readonly departamentos = signal<UbigeoDepartamento[]>([]);
  readonly provinciasDomicilio = signal<UbigeoProvincia[]>([]);
  readonly distritosDomicilio = signal<UbigeoDistrito[]>([]);
  readonly provinciasPunto = signal<UbigeoProvincia[]>([]);
  readonly distritosPunto = signal<UbigeoDistrito[]>([]);

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
      base.domicilioFiscalDepartamento !== f.domicilioFiscalDepartamento ||
      base.domicilioFiscalProvincia !== f.domicilioFiscalProvincia ||
      base.domicilioFiscalDistrito !== f.domicilioFiscalDistrito ||
      base.puntoLlegadaDepartamento !== f.puntoLlegadaDepartamento ||
      base.puntoLlegadaProvincia !== f.puntoLlegadaProvincia ||
      base.puntoLlegadaDistrito !== f.puntoLlegadaDistrito ||
      base.activo !== f.activo
    );
  });

  readonly canSave = computed(() => {
    const valid = this.isFormValid();
    if (!valid) return false;
    return this.modo === 'nuevo' ? true : this.hasChanges();
  });

  constructor() {
    effect(() => {
      const f = this.form();
      if (f.domicilioFiscalDepartamento) {
        this.loadProvinciasDomicilio(f.domicilioFiscalDepartamento);
      } else {
        this.provinciasDomicilio.set([]);
        this.distritosDomicilio.set([]);
      }
      if (f.domicilioFiscalProvincia && f.domicilioFiscalDepartamento) {
        this.loadDistritosDomicilio(f.domicilioFiscalDepartamento, f.domicilioFiscalProvincia);
      } else {
        this.distritosDomicilio.set([]);
      }
      if (f.puntoLlegadaDepartamento) {
        this.loadProvinciasPunto(f.puntoLlegadaDepartamento);
      } else {
        this.provinciasPunto.set([]);
        this.distritosPunto.set([]);
      }
      if (f.puntoLlegadaProvincia && f.puntoLlegadaDepartamento) {
        this.loadDistritosPunto(f.puntoLlegadaDepartamento, f.puntoLlegadaProvincia);
      } else {
        this.distritosPunto.set([]);
      }
    }, { allowSignalWrites: true });
  }

  async ngOnInit(): Promise<void> {
    await this.loadDepartamentos();
  }

  ngOnChanges(): void {
    const v = this.value ?? ({} as any);
    const next: DestinatarioForm = {
      id: v.id,
      documentoFiscal: v.documentoFiscal ?? '',
      nombre: v.nombre ?? '',
      domicilioFiscal: v.domicilioFiscal ?? '',
      puntoLlegada: v.puntoLlegada ?? '',
      domicilioFiscalDepartamento: v.domicilioFiscalDepartamento ?? '',
      domicilioFiscalProvincia: v.domicilioFiscalProvincia ?? '',
      domicilioFiscalDistrito: v.domicilioFiscalDistrito ?? '',
      puntoLlegadaDepartamento: v.puntoLlegadaDepartamento ?? '',
      puntoLlegadaProvincia: v.puntoLlegadaProvincia ?? '',
      puntoLlegadaDistrito: v.puntoLlegadaDistrito ?? '',
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
    if (this.isEmpty(f.puntoLlegada) || this.isEmpty(f.puntoLlegadaDistrito)) return false;
    return true;
  }

  isInvalid(field: keyof DestinatarioForm): boolean {
    if (!this.submitAttempted()) return false;
    const f: any = this.form();
    if (field === 'documentoFiscal' || field === 'nombre') return this.isEmpty(f[field]);
    if (field === 'puntoLlegada' || field === 'puntoLlegadaDistrito') return this.isEmpty(f[field]);
    return false;
  }

  updateField(field: keyof DestinatarioForm, value: any): void {
    const needsResetProvincia =
      field === 'domicilioFiscalDepartamento' ||
      field === 'puntoLlegadaDepartamento';
    const needsResetDistrito =
      field === 'domicilioFiscalDepartamento' ||
      field === 'domicilioFiscalProvincia' ||
      field === 'puntoLlegadaDepartamento' ||
      field === 'puntoLlegadaProvincia';

    const updates: Partial<DestinatarioForm> = { [field]: value };

    if (needsResetProvincia) {
      if (field === 'domicilioFiscalDepartamento') updates.domicilioFiscalProvincia = '';
      if (field === 'puntoLlegadaDepartamento') updates.puntoLlegadaProvincia = '';
    }
    if (needsResetDistrito) {
      if (field === 'domicilioFiscalDepartamento' || field === 'domicilioFiscalProvincia') updates.domicilioFiscalDistrito = '';
      if (field === 'puntoLlegadaDepartamento' || field === 'puntoLlegadaProvincia') updates.puntoLlegadaDistrito = '';
    }

    this.form.update(f => ({ ...f, ...updates }));
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
      domicilioFiscalDistrito: f.domicilioFiscalDistrito || null,
      puntoLlegadaDistrito: f.puntoLlegadaDistrito || null,
      activo: !!f.activo,
    };

    this.guardar.emit({ payload, modo: this.modo });
  }

  private async loadDepartamentos(): Promise<void> {
    try {
      const resp: any = await firstValueFrom(this.catalogoService.listarDepartamentos());
      if (!resp?.error) {
        this.departamentos.set(resp?.data ?? []);
      }
    } catch (e) {
      console.error('Error cargando departamentos', e);
    }
  }

  private async loadProvinciasDomicilio(codigoDepartamento: string): Promise<void> {
    try {
      const resp: any = await firstValueFrom(this.catalogoService.listarProvincias(codigoDepartamento));
      this.provinciasDomicilio.set(resp?.data ?? []);
    } catch (e) {
      console.error('Error cargando provincias domicilio', e);
      this.provinciasDomicilio.set([]);
    }
  }

  private async loadDistritosDomicilio(codigoDepartamento: string, codigoProvincia: string): Promise<void> {
    try {
      const resp: any = await firstValueFrom(this.catalogoService.listarDistritos(codigoDepartamento, codigoProvincia));
      this.distritosDomicilio.set(resp?.data ?? []);
    } catch (e) {
      console.error('Error cargando distritos domicilio', e);
      this.distritosDomicilio.set([]);
    }
  }

  private async loadProvinciasPunto(codigoDepartamento: string): Promise<void> {
    try {
      const resp: any = await firstValueFrom(this.catalogoService.listarProvincias(codigoDepartamento));
      this.provinciasPunto.set(resp?.data ?? []);
    } catch (e) {
      console.error('Error cargando provincias punto', e);
      this.provinciasPunto.set([]);
    }
  }

  private async loadDistritosPunto(codigoDepartamento: string, codigoProvincia: string): Promise<void> {
    try {
      const resp: any = await firstValueFrom(this.catalogoService.listarDistritos(codigoDepartamento, codigoProvincia));
      this.distritosPunto.set(resp?.data ?? []);
    } catch (e) {
      console.error('Error cargando distritos punto', e);
      this.distritosPunto.set([]);
    }
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
