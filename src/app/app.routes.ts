import { Routes } from '@angular/router';
import { authGuard } from './shared/guards/auth.guard';
import { parametrosConfigChildGuard } from './shared/guards/parametros-config.guard';

const childRoutes: Routes = [
  { path: '', redirectTo: 'parametros', pathMatch: 'full' },
  {
    path: 'parametros/setup',
    loadComponent: () =>
      import('./pages/parametros-setup/parametros-setup.component').then((m) => m.ParametrosSetupComponent),
  },
  {
    path: 'parametros',
    loadComponent: () =>
      import('./pages/parametros/parametros.component').then((m) => m.ParametrosComponent),
  },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./pages/dashboard/dashboard.component').then((m) => m.DashboardComponent),
  },
  {
    path: 'documentacion',
    loadComponent: () =>
      import('./pages/placeholder/placeholder.component').then((m) => m.PlaceholderComponent),
    data: { title: 'Documentación', subtitle: 'Gestión de documentos', icon: 'bi-clipboard-check-fill' }
  },
  {
    path: 'despacho',
    loadComponent: () =>
      import('./pages/placeholder/placeholder.component').then((m) => m.PlaceholderComponent),
    data: { title: 'Documentación', subtitle: 'Gestión de documentos', icon: 'bi-clipboard-check-fill' }
  },
  {
    path: 'reporte-logistica',
    loadComponent: () =>
      import('./pages/placeholder/placeholder.component').then((m) => m.PlaceholderComponent),
    data: { title: 'Reporte Producción', subtitle: 'Reporte de producción logística', icon: 'bi-clipboard-data-fill' }
  },
  {
    path: 'reportes-dashboard',
    loadComponent: () =>
      import('./pages/placeholder/placeholder.component').then((m) => m.PlaceholderComponent),
    data: { title: 'Reporte Diario', subtitle: 'Reporte de producción diaria', icon: 'bi-bar-chart-line-fill' }
  },
  {
    path: 'reportes-secundarios',
    loadComponent: () =>
      import('./pages/placeholder/placeholder.component').then((m) => m.PlaceholderComponent),
    data: { title: 'Reportes Generales', subtitle: 'Reportes semanales, campaña y comparativos', icon: 'bi-file-earmark-bar-graph-fill' }
  },
  {
    path: 'reportes-detallados',
    loadComponent: () =>
      import('./pages/placeholder/placeholder.component').then((m) => m.PlaceholderComponent),
    data: { title: 'Reportes Detallados', subtitle: 'Reportes detallados de producción', icon: 'bi-clipboard-data-fill' }
  },
  {
    path: 'admin/campanias',
    loadComponent: () =>
      import('./pages/admin-campanias/admin-campanias.component').then((m) => m.AdminCampaniasComponent),
  },
  {
    path: 'admin/usuarios',
    loadComponent: () =>
      import('./pages/usuarios/usuarios.component').then((m) => m.UsuariosComponent),
    data: { title: 'Gestión de Usuarios', subtitle: 'Administrar usuarios del sistema', icon: 'bi-people-fill' }
  },
  {
    path: 'admin/destinatarios',
    loadComponent: () =>
      import('./pages/destinatarios/destinatarios.component').then((m) => m.DestinatariosComponent),
    data: { title: 'Gestión de Destinatarios', subtitle: 'Administrar destinatarios de guías', icon: 'bi-geo-alt-fill' }
  },
  {
    path: 'admin/matriz',
    loadComponent: () =>
      import('./pages/matriz-compatibilidad/matriz-compatibilidad.component').then((m) => m.MatrizCompatibilidadComponent),
    data: { title: 'Matriz Compatibilidad', subtitle: 'Configurar compatibilidad de productos', icon: 'bi-diagram-3-fill' }
  },
  {
    path: 'admin/sobrepeso',
    loadComponent: () =>
      import('./pages/sobrepeso/sobrepeso.component').then((m) => m.SobrepesoComponent),
    data: { title: 'Reglas Sobrepeso', subtitle: 'Configurar reglas de sobrepeso', icon: 'bi-speedometer2' }
  },
  {
    path: 'admin/acopio_configuracion',
    loadComponent: () =>
      import('./pages/acopios-config/acopios-config.component').then((m) => m.AcopiosConfigComponent),
    data: { title: 'Acopio Configuración', subtitle: 'Configurar acopio', icon: 'bi-building-gear' }
  },
  {
    path: 'admin/catalogos/:tipo',
    loadComponent: () =>
      import('./pages/catalogos/catalogos.component').then((m) => m.CatalogosComponent),
    data: { title: 'Catálogo', subtitle: 'Gestión de catálogo', icon: 'bi-collection-fill' }
  },
  {
    path: 'procesos',
    loadComponent: () =>
      import('./pages/procesos/procesos.component').then((m) => m.ProcesosComponent),
  },
  {
    path: 'palets',
    loadComponent: () =>
      import('./pages/palets/palets.component').then((m) => m.PaletsComponent),
  },
  {
    path: 'guias',
    loadComponent: () =>
      import('./pages/guias/guias.component').then((m) => m.GuiasComponent),
  },
  {
    path: 'catalogos',
    loadComponent: () =>
      import('./pages/catalogos/catalogos.component').then((m) => m.CatalogosComponent),
  },
];

export const appRoutes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./auth/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: '',
    loadComponent: () =>
      import('./layout/layout.component').then((m) => m.LayoutComponent),
    canActivate: [authGuard],
    canActivateChild: [parametrosConfigChildGuard],
    children: childRoutes,
  },
  { path: '**', redirectTo: '' },
];
