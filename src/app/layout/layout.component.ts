import { Component, ChangeDetectionStrategy, signal, computed, inject } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../shared/services/auth.service';
import { PermissionService } from '../shared/services/permission.service';

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

  readonly sidebarOpen = signal(false);
  readonly perfil = this.auth.perfil;
  readonly nombreCompleto = this.auth.nombreCompleto;
  readonly inicialUsuario = this.auth.inicialUsuario;
  readonly usuario = this.auth.usuario;
  readonly userDropdownOpen = signal(false);
  readonly submenuOpen = signal<string | null>(null);

  readonly navSections = computed(() => {
    const p = this.perfil();
    const sections: { title?: string; items: NavItem[] }[] = [];

    if (p === 'ADMINISTRADOR') {
      sections.push({
        items: [{ label: 'Dashboard', path: '/dashboard', icon: 'bi-grid-1x2-fill' }]
      });
      sections.push({
        title: 'Gestión',
        items: [
          { label: 'Gestión de Palets', path: '/palets', icon: 'bi-box-seam-fill' },
          { label: 'Gestión de Procesos', path: '/procesos', icon: 'bi-calendar-event-fill' },
          { label: 'Despachos / Guías', path: '/guias', icon: 'bi-truck' },
          { label: 'Alertas Despacho', path: '/alertas-despacho', icon: 'bi-alarm-fill' },
        ]
      });
      sections.push({
        title: 'Administración',
        items: [
          { label: 'Campañas', path: '/admin/campanias', icon: 'bi-calendar-range-fill' },
          { label: 'Gestión de Usuarios', path: '/admin/usuarios', icon: 'bi-people-fill' },
          { label: 'Matriz Compatibilidad', path: '/admin/matriz', icon: 'bi-diagram-3-fill' },
          { label: 'Reglas Sobrepeso', path: '/admin/sobrepeso', icon: 'bi-speedometer2' },
          {
            label: 'Catálogos',
            path: '#catalogos',
            icon: 'bi-collection-fill',
            submenu: [
              { label: 'Clientes', path: '/admin/catalogos/clientes', icon: 'bi-dot' },
              { label: 'Consignatarios', path: '/admin/catalogos/consignatarios', icon: 'bi-dot' },
              { label: 'Destinos', path: '/admin/catalogos/destinos', icon: 'bi-dot' },
              { label: 'Formatos', path: '/admin/catalogos/formatos', icon: 'bi-dot' },
              { label: 'Calibres', path: '/admin/catalogos/calibres', icon: 'bi-dot' },
              { label: 'Categorías', path: '/admin/catalogos/categorias', icon: 'bi-dot' },
              { label: 'Tipos de Empaque', path: '/admin/catalogos/tiposempaque', icon: 'bi-dot' },
              { label: 'Tipos Empaque Guía', path: '/admin/catalogos/tiposempaqueguia', icon: 'bi-dot' },
              { label: 'Presentaciones', path: '/admin/catalogos/presentaciones', icon: 'bi-dot' },
              { label: 'Tipos de Caja', path: '/admin/catalogos/tiposcaja', icon: 'bi-dot' },
              { label: 'Tipos de Clamshell', path: '/admin/catalogos/tiposclamshell', icon: 'bi-dot' },
              { label: 'Variedades', path: '/admin/catalogos/variedades', icon: 'bi-dot' },
              { label: 'Lugares de Producción', path: '/admin/catalogos/lugaresproduccion', icon: 'bi-dot' },
              { label: 'Transporte', path: '/admin/catalogos/transporte', icon: 'bi-dot' },
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
              { label: 'Personal Logística', path: '/admin/catalogos/personallogistica', icon: 'bi-dot' },
              { label: 'Acopios', path: '/admin/catalogos/acopios', icon: 'bi-dot' },
            ]
          },
        ]
      });
      sections.push({
        title: 'Reportes',
        items: [
          { label: 'Generar Excel', path: '/excel-export', icon: 'bi-file-earmark-spreadsheet-fill' },
          { label: 'Reporte Diario', path: '/reportes-dashboard', icon: 'bi-bar-chart-line-fill' },
          {
            label: 'Reportes Generales',
            path: '#reportes-generales',
            icon: 'bi-file-earmark-bar-graph-fill',
            submenu: [
              { label: 'Semana', path: '/reportes-secundarios#tabSemana', icon: 'bi-dot' },
              { label: 'Campaña', path: '/reportes-secundarios#tabCampania', icon: 'bi-dot' },
              { label: 'Comparativo', path: '/reportes-secundarios#tabComparativo', icon: 'bi-dot' },
            ]
          },
          {
            label: 'Reportes Detallados',
            path: '#reportes-detallados',
            icon: 'bi-clipboard-data-fill',
            submenu: [
              { label: 'Producción por Día', path: '/reportes-detallados#tabProdDia', icon: 'bi-dot' },
              { label: 'Producción por Acopio', path: '/reportes-detallados#tabProdAcopio', icon: 'bi-dot' },
              { label: 'KG por Destino', path: '/reportes-detallados#tabKgDestino', icon: 'bi-dot' },
              { label: 'Despachos (Guías)', path: '/reportes-detallados#tabDespachos', icon: 'bi-dot' },
              { label: 'Formatos x Consignatario', path: '/reportes-detallados#tabFormatos', icon: 'bi-dot' },
              { label: 'Sobrepeso', path: '/reportes-detallados#tabSobrepeso', icon: 'bi-dot' },
              { label: 'Reposiciones', path: '/reportes-detallados#tabReposiciones', icon: 'bi-dot' },
            ]
          },
        ]
      });
    } else if (p === 'LOGISTICA') {
      sections.push({
        items: [
          { label: 'Dashboard', path: '/dashboard', icon: 'bi-grid-1x2-fill' },
          { label: 'Procesos', path: '/procesos', icon: 'bi-calendar-event-fill' },
          { label: 'Palets', path: '/palets', icon: 'bi-box-seam-fill' },
          { label: 'Guías', path: '/guias', icon: 'bi-truck' },
          { label: 'Reporte Producción', path: '/reporte-logistica', icon: 'bi-clipboard-data-fill' },
          { label: 'Documentación', path: '/despacho', icon: 'bi-clipboard-check-fill' },
        ]
      });
    } else if (p === 'COORDINACION') {
      sections.push({
        items: [
          { label: 'Dashboard', path: '/dashboard', icon: 'bi-grid-1x2-fill' },
          { label: 'Procesos', path: '/procesos', icon: 'bi-calendar-event-fill' },
          { label: 'Documentación', path: '/despacho', icon: 'bi-clipboard-check-fill' },
          { label: 'Alertas Despacho', path: '/alertas-despacho', icon: 'bi-alarm-fill' },
          { label: 'Generar Excel', path: '/excel-export', icon: 'bi-file-earmark-spreadsheet-fill' },
          { label: 'Reporte Diario', path: '/reportes-dashboard', icon: 'bi-bar-chart-line-fill' },
          {
            label: 'Reportes Generales',
            path: '#reportes-generales',
            icon: 'bi-file-earmark-bar-graph-fill',
            submenu: [
              { label: 'Semana', path: '/reportes-secundarios#tabSemana', icon: 'bi-dot' },
              { label: 'Campaña', path: '/reportes-secundarios#tabCampania', icon: 'bi-dot' },
              { label: 'Comparativo', path: '/reportes-secundarios#tabComparativo', icon: 'bi-dot' },
            ]
          },
          {
            label: 'Reportes Detallados',
            path: '#reportes-detallados',
            icon: 'bi-clipboard-data-fill',
            submenu: [
              { label: 'Producción por Día', path: '/reportes-detallados#tabProdDia', icon: 'bi-dot' },
              { label: 'Producción por Acopio', path: '/reportes-detallados#tabProdAcopio', icon: 'bi-dot' },
              { label: 'KG por Destino', path: '/reportes-detallados#tabKgDestino', icon: 'bi-dot' },
              { label: 'Despachos (Guías)', path: '/reportes-detallados#tabDespachos', icon: 'bi-dot' },
              { label: 'Formatos x Consignatario', path: '/reportes-detallados#tabFormatos', icon: 'bi-dot' },
              { label: 'Sobrepeso', path: '/reportes-detallados#tabSobrepeso', icon: 'bi-dot' },
              { label: 'Reposiciones', path: '/reportes-detallados#tabReposiciones', icon: 'bi-dot' },
            ]
          },
        ]
      });
    } else if (p === 'OPERACIONES') {
      sections.push({
        title: 'Reportes',
        items: [
          { label: 'Reporte Diario', path: '/reportes-dashboard', icon: 'bi-bar-chart-line-fill' },
          {
            label: 'Reportes Generales',
            path: '#reportes-generales',
            icon: 'bi-file-earmark-bar-graph-fill',
            submenu: [
              { label: 'Semana', path: '/reportes-secundarios#tabSemana', icon: 'bi-dot' },
              { label: 'Campaña', path: '/reportes-secundarios#tabCampania', icon: 'bi-dot' },
              { label: 'Comparativo', path: '/reportes-secundarios#tabComparativo', icon: 'bi-dot' },
            ]
          },
          { label: 'Generar Excel', path: '/excel-export', icon: 'bi-file-earmark-spreadsheet-fill' },
        ]
      });
    } else {
      sections.push({
        items: [
          { label: 'Dashboard', path: '/dashboard', icon: 'bi-grid-1x2-fill' },
          { label: 'Procesos', path: '/procesos', icon: 'bi-calendar-event-fill' },
          { label: 'Palets', path: '/palets', icon: 'bi-box-seam-fill' },
          { label: 'Guías', path: '/guias', icon: 'bi-truck' },
          { label: 'Catálogos', path: '/catalogos', icon: 'bi-collection-fill' },
        ]
      });
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

  logout(): void {
    this.auth.logout();
  }
}
