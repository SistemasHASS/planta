import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AlertService } from '../../../../shared/services/alert.service';
import { Acopio } from '../../../../shared/interfaces/catalogo.interface';
import { CatalogosOperativosRepository } from '../../../../shared/dexiedb/repository/catalogos-operacionales.repository';
import { ConnectivityService } from '../../../../shared/services/connectivity.service';
import { AdministracionService } from '../../../../shared/services/administracion.service';
import { AdvancedSelectComponent } from '../../../../shared/components/advanced-select/advanced-select.component';
import { Usuario } from '../../../../shared/interfaces/administracion.interface';

type UsuarioForm = {
  id?: number;
  usuario: string;
  nombre: string;
  contrasena: string;
  idRol: string;
  acopioId?: number;
  codigoAcopio: string;
  acopioNombre: string;
  serieGuia: string;
  activo: boolean;
};

@Component({
  selector: 'app-usuarios-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, AdvancedSelectComponent],
  templateUrl: './usuarios-modal.component.html',
  styleUrl: './usuarios-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsuariosModalComponent {
  private readonly alertService = inject(AlertService);
  private readonly catalogosOperativosRepository = inject(CatalogosOperativosRepository);
  private readonly connectivity = inject(ConnectivityService);
  private readonly administracionService = inject(AdministracionService);

  get online(): boolean {
    return this.connectivity.isOnline();
  }

  @Input() modo: 'nuevo' | 'editado' = 'nuevo';
  @Input() value: Usuario | null = null;

  @Output() cerrar = new EventEmitter<void>();
  @Output() guardar = new EventEmitter<any>();

  readonly submitAttempted = signal(false);
  private readonly initialForm = signal<UsuarioForm | null>(null);

  readonly form = signal<UsuarioForm>({
    usuario: '',
    nombre: '',
    contrasena: '',
    idRol: '',
    acopioId: undefined,
    codigoAcopio: '',
    acopioNombre: '',
    serieGuia: '',
    activo: true,
  });

  readonly acopios = signal<Acopio[]>([]);

  readonly title = computed(() => (this.modo === 'editado' ? 'Editar Usuario' : 'Nuevo Usuario'));

  readonly hasChanges = computed(() => {
    if (this.modo !== 'editado') return true;
    const base = this.initialForm();
    if (!base) return false;
    const f = this.form();
    return (
      base.usuario !== f.usuario ||
      base.nombre !== f.nombre ||
      base.idRol !== f.idRol ||
      (base.acopioId ?? undefined) !== (f.acopioId ?? undefined) ||
      base.codigoAcopio !== f.codigoAcopio ||
      base.acopioNombre !== f.acopioNombre ||
      base.serieGuia !== f.serieGuia ||
      base.activo !== f.activo
    );
  });

  readonly canSave = computed(() => {
    const valid = this.isFormValid();
    if (!valid) return false;
    return this.modo === 'nuevo' ? true : this.hasChanges();
  });

  ngOnChanges(): void {
    void this.cargarAcopiosSiHaceFalta();
    const v = this.value ?? ({} as any);
    const next: UsuarioForm = {
      id: v.id,
      usuario: v.usuario ?? '',
      nombre: v.nombre ?? '',
      contrasena: '',
      idRol: v.idRol ?? '',
      acopioId: typeof v.acopioId === 'number' ? v.acopioId : undefined,
      codigoAcopio: (v.codigoAcopio ?? '') as any,
      acopioNombre: (v.acopioNombre ?? '') as any,
      serieGuia: (v.serieGuia ?? '') as any,
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
    if (this.isEmpty(f.usuario) || this.isEmpty(f.nombre) || this.isEmpty(f.idRol)) return false;
    if (this.modo === 'nuevo' && this.isEmpty(f.contrasena)) return false;
    return true;
  }

  isInvalid(field: keyof UsuarioForm): boolean {
    if (!this.submitAttempted()) return false;
    const f: any = this.form();
    if (field === 'contrasena') return this.modo === 'nuevo' ? this.isEmpty(f[field]) : false;
    if (field === 'usuario' || field === 'nombre' || field === 'idRol') return this.isEmpty(f[field]);
    return false;
  }

  updateField(field: keyof UsuarioForm, value: any): void {
    this.form.update(f => ({ ...f, [field]: value }));
  }

  async cargarAcopiosSiHaceFalta(): Promise<void> {
    if (this.acopios().length > 0) return;
    try {
      const list = await this.catalogosOperativosRepository.acopiosRepo.getAll();
      this.acopios.set([...(list ?? [])].sort((a, b) => String(a?.codigoAcopio ?? '').localeCompare(String(b?.codigoAcopio ?? ''))));

      const f = this.form();
      let acopio: Acopio | undefined;

      if (typeof f.codigoAcopio === 'number') {
        acopio = this.acopios().find(a => Number(a?.id) === Number(f.codigoAcopio));
      } else if (String(f.codigoAcopio ?? '').trim()) {
        const codigo = String(f.codigoAcopio ?? '').trim().toUpperCase();
        acopio = this.acopios().find(a => String(a?.codigoAcopio ?? '').trim().toUpperCase() === codigo);
        if (acopio) {
          this.form.update(cur => ({ ...cur, acopioId: acopio?.id }));
        }
      }

      if (acopio) {
        this.form.update(cur => ({
          ...cur,
          codigoAcopio: cur.codigoAcopio || acopio.codigoAcopio || '',
          acopioNombre: cur.acopioNombre || acopio.acopioNombre || '',
          serieGuia: cur.serieGuia || acopio.serieGuia || '',
        }));

        // Si esto fue autocompletado (por Dexie) al abrir el modal, no debe contar como cambio del usuario.
        if (this.modo === 'editado' && !this.submitAttempted()) {
          const base = this.initialForm();
          const cur = this.form();
          const acopioIdAutofill = (base?.codigoAcopio === undefined || base?.codigoAcopio === null) && typeof cur.codigoAcopio === 'number';
          const codigoAutofill = !String(base?.codigoAcopio ?? '').trim() && !!String(cur.codigoAcopio ?? '').trim();
          const nombreAutofill = !String(base?.acopioNombre ?? '').trim() && !!String(cur.acopioNombre ?? '').trim();
          const guiaAutofill = !String(base?.serieGuia ?? '').trim() && !!String(cur.serieGuia ?? '').trim();

          if (base && (acopioIdAutofill || codigoAutofill || nombreAutofill || guiaAutofill)) {
            this.initialForm.set(structuredClone(cur));
          }
        }
      }
    } catch (err) {
      console.error('Error cargando acopios', err);
      this.acopios.set([]);
    }
  }

  onAcopioChange(rawValue: any): void {
    const acopioId = rawValue === '' || rawValue === null || rawValue === undefined ? undefined : Number(rawValue);
    if (!acopioId) {
      this.form.update(f => ({
        ...f,
        acopioId: undefined,
        codigoAcopio: '',
        acopioNombre: '',
        serieGuia: '',
      }));
      return;
    }

    const acopio = this.acopios().find(a => Number(a?.id) === acopioId);
    this.form.update(f => ({
      ...f,
      acopioId,
      codigoAcopio: acopio?.codigoAcopio ?? '',
      acopioNombre: acopio?.acopioNombre ?? '',
      serieGuia: acopio?.serieGuia ?? '',
    }));
  }

  onAcopioIdChange(value: any | null): void {
    this.onAcopioChange(value);
  }

  perfilLabel(perfil: string): string {
    const p = String(perfil ?? '').trim().toUpperCase();
    if (p === 'ADPLA' || p === 'ADMINISTRADOR') return 'Administrador';
    if (p === 'LOPLA' || p === 'LOGISTICA') return 'Logística';
    if (p === 'MOPLA' || p === 'MONITOR') return 'Monitor';
    if (p === 'GMPLA' || p === 'GUIAS_MANUALES') return 'Guías Manuales';
    if (p === 'COPLA' || p === 'COORDINACION') return 'Coordinación';
    if (p === 'OPPLA' || p === 'OPERACIONES') return 'Operaciones';
    return p || '';
  }

  onGuardar(): void {
    this.submitAttempted.set(true);
    if (!this.isFormValid()) return;
    if (this.modo === 'editado' && !this.hasChanges()) return;

    const f = this.form();
    const payload: any = {
      ...(this.value ?? {}),
      id: f.id ?? (this.value as any)?.id,
      usuario: f.usuario,
      nombre: f.nombre,
      idRol: f.idRol,
      acopioId: typeof f.acopioId === 'number' ? f.acopioId : undefined,
      codigoAcopio: this.isEmpty(f.codigoAcopio) ? null : f.codigoAcopio,
      acopioNombre: this.isEmpty(f.acopioNombre) ? null : f.acopioNombre,
      serieGuia: this.isEmpty(f.serieGuia) ? null : f.serieGuia,
      activo: !!f.activo,
    };

    // La contraseña solo aplica para nuevo (por ahora)
    if (this.modo === 'nuevo') {
      payload.contrasena = f.contrasena;
    }

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
