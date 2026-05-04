import { Component, ChangeDetectionStrategy, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CatalogoService } from '../../shared/services/catalogo.service';
import { PermissionService } from '../../shared/services/permission.service';

type CatalogoActivo = 'acopios' | 'formatos' | 'clientes' | 'destinos' | 'consignatarios' | 'variedades' | 'tiposEmpaque' | 'calibres' | 'campanias';

interface TabItem {
  key: CatalogoActivo;
  label: string;
}

@Component({
  selector: 'app-catalogos',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  templateUrl: './catalogos.component.html',
  styleUrl: './catalogos.component.scss'
})
export class CatalogosComponent implements OnInit {
  private readonly catalogoService = inject(CatalogoService);
  readonly permissions = inject(PermissionService);

  readonly tabs: TabItem[] = [
    { key: 'acopios', label: 'Acopios' },
    { key: 'formatos', label: 'Formatos' },
    { key: 'clientes', label: 'Clientes' },
    { key: 'destinos', label: 'Destinos' },
    { key: 'consignatarios', label: 'Consignatarios' },
    { key: 'variedades', label: 'Variedades' },
    { key: 'tiposEmpaque', label: 'Tipos Empaque' },
    { key: 'calibres', label: 'Calibres' },
    { key: 'campanias', label: 'Campanias' },
  ];

  catalogoActivo = signal<CatalogoActivo>('acopios');
  isLoading = signal(false);

  acopios = signal<any[]>([]);
  formatos = signal<any[]>([]);
  clientes = signal<any[]>([]);
  destinos = signal<any[]>([]);
  consignatarios = signal<any[]>([]);
  variedades = signal<any[]>([]);
  tiposEmpaque = signal<any[]>([]);
  calibres = signal<any[]>([]);
  campanias = signal<any[]>([]);

  ngOnInit(): void {
    this.cargarTodosCatalogos();
  }

  cargarTodosCatalogos(): void {
    this.isLoading.set(true);
    this.catalogoService.listarTodos().subscribe({
      next: (r: any) => {
        const data = r?.data ?? r;
        this.acopios.set(data?.acopios ?? []);
        this.formatos.set(data?.formatos ?? []);
        this.clientes.set(data?.clientes ?? []);
        this.destinos.set(data?.destinos ?? []);
        this.consignatarios.set(data?.consignatarios ?? []);
        this.variedades.set(data?.variedades ?? []);
        this.tiposEmpaque.set(data?.tiposEmpaque ?? []);
        this.calibres.set(data?.calibres ?? []);
        this.campanias.set(data?.campanias ?? []);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false)
    });
  }

  cambiarTab(tab: CatalogoActivo): void {
    this.catalogoActivo.set(tab);
  }

  // TODO: Implementar CRUD individual cuando se creen los SPs correspondientes
  eliminarItem(tipo: CatalogoActivo, id: number): void {
    console.warn('Eliminar no implementado aún para:', tipo, id);
  }
}
