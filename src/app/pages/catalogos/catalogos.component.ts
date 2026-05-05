import { Component, ChangeDetectionStrategy, inject, signal, OnInit, computed, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CatalogoService } from '../../shared/services/catalogo.service';
import { PermissionService } from '../../shared/services/permission.service';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { finalize, map } from 'rxjs';
import { isCatalogoKey } from './catalogos.utils';
import { CatalogoKey } from './catalogos.type';
import { CATALOGOS_CONFIG } from './catalogos.config';
import { CatalogoTablaComponent, EstadoFiltro } from './components/tabla/catalogo-tabla.component';
import { CatalogoModalComponent } from './components/modal/catalogo-modal.component';
import { CatalogosRepository } from '../../shared/dixiedb/repository/catalogos.repository';
import { CatalogosOperacionalesRepository } from '../../shared/dixiedb/repository/catalogos-operacionales.repository';

const OPERARIOS_KEYS = new Set<CatalogoKey>([
  'conductores',
  'vehiculos',
  'transportistas',
  'supervisores',
  'personallogistica',
  'acopios',
]);

const CATALOGO_DATA_KEY_MAP: Record<CatalogoKey, string> = {
  acopios: 'acopios',
  formatos: 'formatos',
  clientes: 'clientes',
  destinos: 'destinos',
  consignatarios: 'consignatarios',
  variedades: 'variedades',
  tiposempaque: 'tiposEmpaque',
  tiposempaqueguia: 'tiposEmpaqueGuia',
  presentaciones: 'presentaciones',
  tiposcaja: 'tiposCaja',
  tiposclamshell: 'tiposClamshell',
  lugaresproduccion: 'lugaresProduccion',
  transporte: 'transportes',
  calibres: 'calibres',
  categorias: 'categorias',
  conductores: 'conductores',
  vehiculos: 'vehiculos',
  transportistas: 'transportistas',
  supervisores: 'supervisores',
  personallogistica: 'personalLogistica',
};

@Component({
  selector: 'app-catalogos',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, CatalogoTablaComponent, CatalogoModalComponent],
  templateUrl: './catalogos.component.html',
  styleUrl: './catalogos.component.scss'
})



export class CatalogosComponent implements OnInit {

  private readonly catalogoService = inject(CatalogoService);
  private readonly route = inject(ActivatedRoute);
  readonly permissions = inject(PermissionService);
  readonly tipo = toSignal(
    this.route.paramMap.pipe(
      map(params => params.get('tipo')),
      map(tipo => isCatalogoKey(tipo) ? tipo : 'clientes')
    ),
    { initialValue: 'clientes' as CatalogoKey }
  );
  readonly config = computed(() => CATALOGOS_CONFIG[this.tipo()]);

  isLoading = signal(false);

  readonly searchTerm = signal('');
  readonly estadoFiltro = signal<EstadoFiltro>('todos');

  readonly modalAbierto = signal(false);
  readonly modalModo = signal<'nuevo' | 'editar'>('nuevo');
  readonly modalValue = signal<any>(null);
  private catalogosBaseCargados = false;
  private catalogosOperariosCargados = false;
  private readonly data = signal<Record<string, any[]>>({});

  readonly items = computed(() => {
    const t = this.tipo();
    const d = this.data();

    const mapKey: Partial<Record<CatalogoKey, string>> = {
      acopios: 'acopios',
      formatos: 'formatos',
      clientes: 'clientes',
      destinos: 'destinos',
      consignatarios: 'consignatarios',
      variedades: 'variedades',
      tiposempaque: 'tiposEmpaque',
      tiposempaqueguia: 'tiposEmpaqueGuia',
      presentaciones: 'presentaciones',
      tiposcaja: 'tiposCaja',
      tiposclamshell: 'tiposClamshell',
      lugaresproduccion: 'lugaresProduccion',
      transporte: 'transportes',
      calibres: 'calibres',
      categorias: 'categorias',
      conductores: 'conductores',
      vehiculos: 'vehiculos',
      transportistas: 'transportistas',
      supervisores: 'supervisores',
      personallogistica: 'personalLogistica',
    };

    const key = mapKey[t] ?? t;
    let e = d?.[key] ?? [];
    return e
  });

  readonly puedeCrear = computed(() => {
    const c = this.config();
    return !c?.noCrear;
  });

  async ngOnInit(): Promise<void> {
    return;
  }

  constructor(
    private catalogosRepo: CatalogosRepository,
    private catalogosOperacionales: CatalogosOperacionalesRepository
  ) {
    effect(() => {
      const tipo = this.tipo();
      if (OPERARIOS_KEYS.has(tipo)) {
        this.cargarCatalogosOperariosSiHaceFalta();
      } else {
        this.cargarCatalogosBaseSiHaceFalta();
      }
    });
  }

  private cargarCatalogosBaseSiHaceFalta(): void {
    if (this.catalogosBaseCargados) return;

    this.isLoading.set(true);

    this.catalogoService.listarTodos()
      .pipe(
        finalize(() => this.isLoading.set(false))
      )
      .subscribe({
        next: (r: any) => {
          console.log('r', r);
          const data = r?.data ?? r;

          this.data.update(current => ({
            ...current,
            ...(data ?? {})
          }));

          this.catalogosBaseCargados = true;
        },
        error: (err) => {
          console.error('Error cargando catálogos base', err);
        }
      });
  }

  private cargarCatalogosOperariosSiHaceFalta(): void {
    if (this.catalogosOperariosCargados) return;

    this.isLoading.set(true);

    this.catalogoService.listarTodosOperarios()
      .pipe(
        finalize(() => this.isLoading.set(false))
      )
      .subscribe({
        next: (r: any) => {
          const data = r?.data ?? r;

          this.data.update(current => ({
            ...current,
            ...(data ?? {})
          }));

          this.catalogosOperariosCargados = true;
        },
        error: (err) => {
          console.error('Error cargando catálogos operarios', err);
        }
      });
  }

  onSearchChange(value: string): void {
    this.searchTerm.set(value);
  }

  setEstadoFiltro(f: EstadoFiltro): void {
    this.estadoFiltro.set(f);
  }

  abrirNuevo(): void {
    this.modalModo.set('nuevo');
    this.modalValue.set(null);
    this.modalAbierto.set(true);
  }

  abrirEditar(item: any): void {
    this.modalModo.set('editar');
    this.modalValue.set(item);
    this.modalAbierto.set(true);
  }

  cerrarModal(): void {
    this.modalAbierto.set(false);
  }

  guardarModal(payload: any): void {
    console.warn('Guardar no implementado aún', { tipo: this.tipo(), payload });
    this.modalAbierto.set(false);
  }

  onDesactivar(item: any): void {
    console.warn('Desactivar no implementado aún', { tipo: this.tipo(), item });
  }

  onEliminar(item: any): void {
    console.warn('Eliminar no implementado aún', { tipo: this.tipo(), item });
  }
}
