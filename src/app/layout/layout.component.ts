import { Component, ChangeDetectionStrategy, signal, computed, inject } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { liveQuery } from 'dexie';
import { AuthService } from '../shared/services/auth.service';
import { PermissionService } from '../shared/services/permission.service';
import { ConnectivityService } from '../shared/services/connectivity.service';
import { AlertService } from '../shared/services/alert.service';
import { GlobalErrorService } from '../shared/services/global-error.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs/operators';
import { from, of } from 'rxjs';
import { CatalogosRepository } from '../shared/dexiedb/repository/catalogos.repository';
import { Campania } from '../shared/interfaces/catalogo.interface';
import { Configuracion } from '../shared/interfaces/administracion.interface';
import { formatDate } from '../shared/utils/datetime.utils';

interface NavItem {
  label: string;
  path: string;
  icon: string;
  roles?: string[];
  submenu?: NavItem[];
}

@Component({
  selector: 'app-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.scss'
})
export class LayoutComponent {
  private readonly auth = inject(AuthService);
  private readonly permissions = inject(PermissionService);
  private readonly connectivity = inject(ConnectivityService);
  private readonly alertService = inject(AlertService);
  private readonly globalError = inject(GlobalErrorService);
  private readonly catalogosRepo = inject(CatalogosRepository);

  readonly currentYear = new Date().getFullYear();

  readonly sidebarOpen = signal(false);
  readonly perfil = this.auth.perfil;
  readonly perfilName= computed(() => {
    return this.perfil() === 'ADMINISTRADOR' ? 'Administrador' :
           this.perfil() === 'LOGISTICA' ? 'Logística' :
           this.perfil() === 'COORDINACION' ? 'Coordinación' :
           this.perfil() === 'OPERACIONES' ? 'Operaciones' :
           (this.perfil() ?? '');
  })
  readonly nombreCompleto = this.auth.nombreCompleto;
  readonly inicialUsuario = this.auth.inicialUsuario;
  readonly usuario = this.auth.usuario;
  readonly userDropdownOpen = signal(false);
  readonly submenuOpen = signal<string | null>(null);

  readonly savedConfig = signal<Configuracion | null>(null);
  readonly selectedCampania = signal<Campania | null>(null);

  readonly topbarInfoModalAbierto = signal(false);
  readonly topbarInfoModalTab = signal<'CAMPANIA' | 'ACOPIO'>('CAMPANIA');

  readonly campaniaFrutaLabel = computed(() => {
    const fruta = String(this.selectedCampania()?.fruta ?? '').trim();
    return fruta ? fruta : null;
  });

  fmtDate(value: unknown): string {
    return formatDate(value) ?? '—';
  }

  getCampaniaResumen(maxWords = 2): string {
    const fruta = String(this.campaniaFrutaLabel() ?? '').trim();
    const parts = fruta.split(/\s+/).filter(Boolean);
    if (parts.length <= maxWords) return fruta;
    return `${parts.slice(0, maxWords).join(' ')}...`;
  }

  getAcopioResumen(maxWords = 2): string {
    const nombre = String((this.usuario() as any)?.acopioNombre ?? '').trim();
    const parts = nombre.split(/\s+/).filter(Boolean);
    if (parts.length <= maxWords) return nombre;
    return `${parts.slice(0, maxWords).join(' ')}...`;
  }

  abrirTopbarModal(tab: 'CAMPANIA' | 'ACOPIO'): void {
    this.topbarInfoModalTab.set(tab);
    this.topbarInfoModalAbierto.set(true);
  }

  cerrarTopbarModal(): void {
    this.topbarInfoModalAbierto.set(false);
  }

  constructor() {
    this.globalError.forbidden$
      .pipe(takeUntilDestroyed())
      .subscribe((message) => {
        const m = (message ?? '').toString().trim();
        if (!m) return;
        this.alertService.showAlert('Sin permisos', m, 'warning');
      });

    from(liveQuery(async () => {
      const u: any = this.auth.usuario();
      const nro = String(u?.nrodocumento ?? u?.documentoidentidad ?? u?.documentoIdentidad ?? u?.documento ?? '').trim();
      if (!nro) return null;
      return await this.catalogosRepo.configuracionRepo.getByField('nrodocumento', nro) ?? null;
    }))
      .pipe(
        takeUntilDestroyed(),
        switchMap((cfg) => {
          this.savedConfig.set(cfg as any);
          const idProyecto = String((cfg as any)?.idProyecto ?? (cfg as any)?.idCampania ?? '').trim();
          if (!idProyecto) return of(null);
          return from(liveQuery(async () => {
            return await this.catalogosRepo.campaniaRepo.getByField('idproyecto', idProyecto) ?? null;
          }));
        })
      )
      .subscribe((camp: Campania | null) => {
        this.selectedCampania.set(camp as any);
      });
  }

  get online(): boolean {
    return this.connectivity.isOnline();
  }

  readonly navSections = computed(() => {
    const p = this.perfil();
    const sections: { title?: string; items: NavItem[] }[] = [];
    if (p === 'ADMINISTRADOR') { //Administrador
      sections.push({
        items: [{ label: 'Parametros', path: '/parametros', icon: 'bi bi-sliders' }]
      });
      // sections.push({
      //   items: [{ label: 'Dashboard', path: '/dashboard', icon: 'bi-grid-1x2-fill' }]
      // });
      sections.push({
        title: 'Gestión',
        items: [
          { label: 'Gestión de Palets', path: '/palets', icon: 'bi-box-seam-fill' },
          { label: 'Gestión de Procesos', path: '/procesos', icon: 'bi-calendar-event-fill' },
          { label: 'Despachos / Guías', path: '/guias', icon: 'bi-truck' },
          // { label: 'Alertas Despacho', path: '/alertas-despacho', icon: 'bi-alarm-fill' },
        ]
      });
      sections.push({
        title: 'Administración',
        items: [
          { label: 'Campañas', path: '/admin/campanias', icon: 'bi-calendar-range-fill' },
          { label: 'Acopio Configuración', path: '/admin/acopio_configuracion', icon: 'bi-building-gear' },
          { label: 'Gestión de Usuarios', path: '/admin/usuarios', icon: 'bi-people-fill' },
          { label: 'Gestión de Destinatarios', path: '/admin/destinatarios', icon: 'bi-geo-alt-fill' },
          { label: 'Matriz Compatibilidad', path: '/admin/matriz', icon: 'bi-diagram-3-fill' },
          { label: 'Reglas Sobrepeso', path: '/admin/sobrepeso', icon: 'bi-speedometer2' },
          {
            label: 'Catálogos',
            path: '#catalogos',
            icon: 'bi-collection-fill',
            submenu: [
              { label: 'Tipo Proceso Empacado', path: '/admin/catalogos/tipoProcesoEmpacado', icon: 'bi-dot' },
              { label: 'Clientes - Maestro', path: '/admin/catalogos/clientes', icon: 'bi-dot' },
              { label: 'Consignatarios - Maestro', path: '/admin/catalogos/consignatarios', icon: 'bi-dot' },
              { label: 'Destinos - Maestro', path: '/admin/catalogos/destinos', icon: 'bi-dot' },
              { label: 'Formatos', path: '/admin/catalogos/formatos', icon: 'bi-dot' },
              { label: 'Calibres - Maestro', path: '/admin/catalogos/calibres', icon: 'bi-dot' },
              { label: 'Categorías', path: '/admin/catalogos/categorias', icon: 'bi-dot' },
              { label: 'Tipos de Empaque', path: '/admin/catalogos/tiposEmpaque', icon: 'bi-dot' },
              { label: 'Tipos Empaque Guía', path: '/admin/catalogos/tiposEmpaqueGuia', icon: 'bi-dot' },
              { label: 'Presentaciones', path: '/admin/catalogos/presentaciones', icon: 'bi-dot' },
              { label: 'Tipos de Caja', path: '/admin/catalogos/tiposCaja', icon: 'bi-dot' },
              { label: 'Tipos de Clamshell', path: '/admin/catalogos/tiposClamshell', icon: 'bi-dot' },
              { label: 'Variedades - Maestro', path: '/admin/catalogos/variedades', icon: 'bi-dot' },
              { label: 'Lugares de Producción', path: '/admin/catalogos/lugaresProduccion', icon: 'bi-dot' },
              { label: 'Transportes - Maestro', path: '/admin/catalogos/transportes', icon: 'bi-dot' },
              { label: 'Códigos Rancho', path: '/admin/catalogos/codigosRancho', icon: 'bi-dot' },
            ]
          },
          {
            label: 'Catálogos Operativos',
            path: '#catalogos-operativos',
            icon: 'bi-gear-fill',
            submenu: [
              { label: 'Conductores', path: '/admin/catalogos/conductores', icon: 'bi-dot' },
              { label: 'Vehículos', path: '/admin/catalogos/vehiculos', icon: 'bi-dot' },
              { label: 'Transportistas', path: '/admin/catalogos/transportistas', icon: 'bi-dot' },
              { label: 'Supervisores', path: '/admin/catalogos/supervisores', icon: 'bi-dot' },
              { label: 'Personal Logística', path: '/admin/catalogos/personalLogistica', icon: 'bi-dot' },
              // { label: 'Acopios - Maestro', path: '/admin/catalogos/acopios', icon: 'bi-dot' },
            ]
          },
        ]
      });
      // sections.push({
      //   title: 'Reportes',
      //   items: [
      //     { label: 'Generar Excel', path: '/excel-export', icon: 'bi-file-earmark-spreadsheet-fill' },
      //     { label: 'Reporte Diario', path: '/reportes-dashboard', icon: 'bi-bar-chart-line-fill' },
      //     {
      //       label: 'Reportes Generales',
      //       path: '#reportes-generales',
      //       icon: 'bi-file-earmark-bar-graph-fill',
      //       submenu: [
      //         { label: 'Semana', path: '/reportes-secundarios#tabSemana', icon: 'bi-dot' },
      //         { label: 'Campaña', path: '/reportes-secundarios#tabCampania', icon: 'bi-dot' },
      //         { label: 'Comparativo', path: '/reportes-secundarios#tabComparativo', icon: 'bi-dot' },
      //       ]
      //     },
      //     {
      //       label: 'Reportes Detallados',
      //       path: '#reportes-detallados',
      //       icon: 'bi-clipboard-data-fill',
      //       submenu: [
      //         { label: 'Producción por Día', path: '/reportes-detallados#tabProdDia', icon: 'bi-dot' },
      //         { label: 'Producción por Acopio', path: '/reportes-detallados#tabProdAcopio', icon: 'bi-dot' },
      //         { label: 'KG por Destino', path: '/reportes-detallados#tabKgDestino', icon: 'bi-dot' },
      //         { label: 'Despachos (Guías)', path: '/reportes-detallados#tabDespachos', icon: 'bi-dot' },
      //         { label: 'Formatos x Consignatario', path: '/reportes-detallados#tabFormatos', icon: 'bi-dot' },
      //         { label: 'Sobrepeso', path: '/reportes-detallados#tabSobrepeso', icon: 'bi-dot' },
      //         { label: 'Reposiciones', path: '/reportes-detallados#tabReposiciones', icon: 'bi-dot' },
      //       ]
      //     }
      //   ]
      // });
    } else if (p === 'LOGISTICA') { //Logistica
      sections.push({
        items: [{ label: 'Parametros', path: '/parametros', icon: 'bi bi-sliders' }]
      });
      sections.push({
        items: [
          // { label: 'Dashboard', path: '/dashboard', icon: 'bi-grid-1x2-fill' },
          { label: 'Procesos', path: '/procesos', icon: 'bi-calendar-event-fill' },
          { label: 'Palets', path: '/palets', icon: 'bi-box-seam-fill' },
          { label: 'Guías', path: '/guias', icon: 'bi-truck' },
          // { label: 'Reporte Producción', path: '/reporte-logistica', icon: 'bi-clipboard-data-fill' },
          // { label: 'Documentación', path: '/despacho', icon: 'bi-clipboard-check-fill' },
        ]
      });
    } else if (p === 'COORDINACION') { //Coordinacion
      sections.push({
        items: [{ label: 'Parametros', path: '/parametros', icon: 'bi bi-sliders' }]
      });
      sections.push({
        items: [
          // { label: 'Dashboard', path: '/dashboard', icon: 'bi-grid-1x2-fill' },
          { label: 'Procesos', path: '/procesos', icon: 'bi-calendar-event-fill' },
          // { label: 'Documentación', path: '/despacho', icon: 'bi-clipboard-check-fill' },
          // { label: 'Alertas Despacho', path: '/alertas-despacho', icon: 'bi-alarm-fill' },
          // { label: 'Generar Excel', path: '/excel-export', icon: 'bi-file-earmark-spreadsheet-fill' },
          // { label: 'Reporte Diario', path: '/reportes-dashboard', icon: 'bi-bar-chart-line-fill' },
          // {
          //   label: 'Reportes Generales',
          //   path: '#reportes-generales',
          //   icon: 'bi-file-earmark-bar-graph-fill',
          //   submenu: [
          //     { label: 'Semana', path: '/reportes-secundarios#tabSemana', icon: 'bi-dot' },
          //     { label: 'Campaña', path: '/reportes-secundarios#tabCampania', icon: 'bi-dot' },
          //     { label: 'Comparativo', path: '/reportes-secundarios#tabComparativo', icon: 'bi-dot' },
          //   ]
          // },
          // {
          //   label: 'Reportes Detallados',
          //   path: '#reportes-detallados',
          //   icon: 'bi-clipboard-data-fill',
          //   submenu: [
          //     { label: 'Producción por Día', path: '/reportes-detallados#tabProdDia', icon: 'bi-dot' },
          //     { label: 'Producción por Acopio', path: '/reportes-detallados#tabProdAcopio', icon: 'bi-dot' },
          //     { label: 'KG por Destino', path: '/reportes-detallados#tabKgDestino', icon: 'bi-dot' },
          //     { label: 'Despachos (Guías)', path: '/reportes-detallados#tabDespachos', icon: 'bi-dot' },
          //     { label: 'Formatos x Consignatario', path: '/reportes-detallados#tabFormatos', icon: 'bi-dot' },
          //     { label: 'Sobrepeso', path: '/reportes-detallados#tabSobrepeso', icon: 'bi-dot' },
          //     { label: 'Reposiciones', path: '/reportes-detallados#tabReposiciones', icon: 'bi-dot' },
          //   ]
          // },
        ]
      });
    } else if (p === 'OPERACIONES') { //Operaciones
      sections.push({
        items: [{ label: 'Parametros', path: '/parametros', icon: 'bi bi-sliders' }]
      });
      // sections.push({
      //   title: 'Reportes',
      //   items: [
      //     { label: 'Reporte Diario', path: '/reportes-dashboard', icon: 'bi-bar-chart-line-fill' },
      //     {
      //       label: 'Reportes Generales',
      //       path: '#reportes-generales',
      //       icon: 'bi-file-earmark-bar-graph-fill',
      //       submenu: [
      //         { label: 'Semana', path: '/reportes-secundarios#tabSemana', icon: 'bi-dot' },
      //         { label: 'Campaña', path: '/reportes-secundarios#tabCampania', icon: 'bi-dot' },
      //         { label: 'Comparativo', path: '/reportes-secundarios#tabComparativo', icon: 'bi-dot' },
      //       ]
      //     },
      //     { label: 'Generar Excel', path: '/excel-export', icon: 'bi-file-earmark-spreadsheet-fill' },
      //   ]
      // });
    } else {
      sections.push({
        items: [{ label: 'Parametros', path: '/parametros', icon: 'bi bi-sliders' }]
      });
      // sections.push({
      //   items: [
      //     { label: 'Dashboard', path: '/dashboard', icon: 'bi-grid-1x2-fill' },
      //     { label: 'Procesos', path: '/procesos', icon: 'bi-calendar-event-fill' },
      //     { label: 'Palets', path: '/palets', icon: 'bi-box-seam-fill' },
      //     { label: 'Guías', path: '/guias', icon: 'bi-truck' },
      //     { label: 'Catálogos', path: '/catalogos', icon: 'bi-collection-fill' },
      //   ]
      // });
    }

    return sections;
  });

  toggleSidebar(): void {
    this.sidebarOpen.update(v => !v);
  }

  closeSidebar(): void {
    this.sidebarOpen.set(false);
  }

  toggleUserDropdown(): void {
    this.userDropdownOpen.update(v => !v);
  }

  toggleSubmenu(key: string): void {
    this.submenuOpen.update(current => current === key ? null : key);
  }

  async logout(): Promise<void> {
    await this.auth.logout();
  }
}
