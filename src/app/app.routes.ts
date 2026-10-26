import { Routes } from "@angular/router";
import { authGuard } from "./shared/guards/auth.guard";
import { parametrosConfigChildGuard } from "./shared/guards/parametros-config.guard";
import { ROLES, roleChildGuard, roleGuard } from "./shared/guards/role.guard";

/**
 * Rutas de la aplicacion. Todas las pantallas cargan "lazy" (loadComponent) para que el
 * bundle inicial sea pequeño.
 *
 * Para agregar una pantalla: crear pages/<modulo>/<modulo>.component.ts, agregar su ruta en
 * `children` y su enlace en layout/components/sidebar/sidebar.component.ts (NAV_SECTIONS).
 * Para restringirla por rol: canActivate: [roleGuard(ROLES.admin)] (ver shared/guards/role.guard.ts).
 * Para pantallas que solo funcionan online: data: { requiresInternet: true }.
 */
export const routes: Routes = [
  {
    path: "login",
    loadComponent: () =>
      import("./auth/login/login.component").then((m) => m.LoginComponent),
  },
  {
    path: "",
    loadComponent: () =>
      import("./layout/layout.component").then((m) => m.LayoutComponent),
    canActivate: [authGuard],
    canActivateChild: [roleChildGuard, parametrosConfigChildGuard],
    children: [
      { path: "", redirectTo: "parametros", pathMatch: "full" },
      {
        path: "palets",
        canActivate: [roleGuard(ROLES.logistica, ROLES.admin)],
        loadComponent: () =>
          import("./pages/palets/palets.component").then((m) => m.PaletsComponent),
      },
      {
        path: "guias",
        canActivate: [roleGuard(ROLES.logistica, ROLES.admin, ROLES.monitor)],
        loadComponent: () =>
          import("./pages/guias/guias.component").then((m) => m.GuiasComponent),
      },
      {
        path: "guias-manuales",
        canActivate: [roleGuard(ROLES.logistica, ROLES.admin, ROLES.monitor, ROLES.guiasManuales)],
        loadComponent: () =>
          import("./pages/guias-manuales/guias-manuales.component").then((m) => m.GuiasManualesComponent),
      },
      {
        path: "procesos",
        canActivate: [roleGuard(ROLES.logistica, ROLES.admin)],
        loadComponent: () =>
          import("./pages/procesos/procesos.component").then((m) => m.ProcesosComponent),
      },
      {
        path: "parametros",
        canActivate: [roleGuard(ROLES.logistica, ROLES.admin, ROLES.monitor, ROLES.guiasManuales)],
        loadComponent: () =>
          import("./pages/parametros/parametros.component").then((m) => m.ParametrosComponent),
      },
      // Administrador (ADPLA): pantallas pendientes de portar; por ahora muestran el aviso de que se están migrando.
      {
        path: "admin/acopio_configuracion",
        canActivate: [roleGuard(ROLES.admin)],
        data: { titulo: "Acopio Configuración" },
        loadComponent: () =>
          import("./pages/acopios-config/acopios-config.component").then((m) => m.AcopiosConfigComponent),
      },
      {
        path: "admin/usuarios",
        canActivate: [roleGuard(ROLES.admin)],
        data: { titulo: "Gestión de Usuarios" },
        loadComponent: () => import("./pages/usuarios/usuarios.component").then((m) => m.UsuariosComponent),
      },
      {
        path: "admin/destinatarios",
        canActivate: [roleGuard(ROLES.admin)],
        data: { titulo: "Gestión de Destinatarios" },
        loadComponent: () => import("./pages/destinatarios/destinatarios.component").then((m) => m.DestinatariosComponent),
      },
      {
        path: "admin/matriz",
        canActivate: [roleGuard(ROLES.admin)],
        data: { titulo: "Matriz Compatibilidad" },
        loadComponent: () => import("./pages/matriz-compatibilidad/matriz-compatibilidad.component").then((m) => m.MatrizCompatibilidadComponent),
      },
      {
        path: "admin/sobrepeso",
        canActivate: [roleGuard(ROLES.admin)],
        data: { titulo: "Reglas Sobrepeso" },
        loadComponent: () => import("./pages/sobrepeso/sobrepeso.component").then((m) => m.SobrepesoComponent),
      },
      {
        path: "admin/correlativos-documentos",
        canActivate: [roleGuard(ROLES.admin)],
        data: { titulo: "Series GRE" },
        loadComponent: () => import("./pages/series-gre/series-gre.component").then((m) => m.SeriesGreComponent),
      },
      {
        path: "admin/codigos-caja",
        canActivate: [roleGuard(ROLES.admin)],
        data: { titulo: "Códigos Caja" },
        loadComponent: () => import("./pages/codigos-caja/codigos-caja.component").then((m) => m.CodigosCajaComponent),
      },
      {
        path: "admin/catalogos/conductores",
        canActivate: [roleGuard(ROLES.admin)],
        data: { titulo: "Conductores", catalogo: "conductores" },
        loadComponent: () => import("./pages/catalogos/catalogo.component").then((m) => m.CatalogoComponent),
      },
      {
        path: "admin/catalogos/vehiculos",
        canActivate: [roleGuard(ROLES.admin)],
        data: { titulo: "Vehículos", catalogo: "vehiculos" },
        loadComponent: () => import("./pages/catalogos/catalogo.component").then((m) => m.CatalogoComponent),
      },
      {
        path: "admin/catalogos/transportistas",
        canActivate: [roleGuard(ROLES.admin)],
        data: { titulo: "Transportistas", catalogo: "transportistas" },
        loadComponent: () => import("./pages/catalogos/catalogo.component").then((m) => m.CatalogoComponent),
      },
      {
        path: "admin/catalogos/supervisores",
        canActivate: [roleGuard(ROLES.admin)],
        data: { titulo: "Supervisores", catalogo: "supervisores" },
        loadComponent: () => import("./pages/catalogos/catalogo.component").then((m) => m.CatalogoComponent),
      },
      {
        path: "admin/catalogos/personalLogistica",
        canActivate: [roleGuard(ROLES.admin)],
        data: { titulo: "Personal Logística", catalogo: "personalLogistica" },
        loadComponent: () => import("./pages/catalogos/catalogo.component").then((m) => m.CatalogoComponent),
      },
      {
        path: "admin/catalogos/tipoProcesoEmpacado",
        canActivate: [roleGuard(ROLES.admin)],
        data: { titulo: "Tipo Proceso Empacado", catalogo: "tipoProcesoEmpacado" },
        loadComponent: () => import("./pages/catalogos/catalogo.component").then((m) => m.CatalogoComponent),
      },
      {
        path: "admin/catalogos/clientes",
        canActivate: [roleGuard(ROLES.admin)],
        data: { titulo: "Grupo Clientes", catalogo: "clientes" },
        loadComponent: () => import("./pages/catalogos/catalogo.component").then((m) => m.CatalogoComponent),
      },
      {
        path: "admin/catalogos/formatos",
        canActivate: [roleGuard(ROLES.admin)],
        data: { titulo: "Formatos", catalogo: "formatos" },
        loadComponent: () => import("./pages/catalogos/catalogo.component").then((m) => m.CatalogoComponent),
      },
      {
        path: "admin/catalogos/presentaciones",
        canActivate: [roleGuard(ROLES.admin)],
        data: { titulo: "Presentaciones", catalogo: "presentaciones" },
        loadComponent: () => import("./pages/catalogos/catalogo.component").then((m) => m.CatalogoComponent),
      },
      {
        path: "admin/catalogos/tiposCaja",
        canActivate: [roleGuard(ROLES.admin)],
        data: { titulo: "Tipos de Caja", catalogo: "tiposCaja" },
        loadComponent: () => import("./pages/catalogos/catalogo.component").then((m) => m.CatalogoComponent),
      },
      {
        path: "admin/catalogos/tiposClamshell",
        canActivate: [roleGuard(ROLES.admin)],
        data: { titulo: "Tipos de Clamshell", catalogo: "tiposClamshell" },
        loadComponent: () => import("./pages/catalogos/catalogo.component").then((m) => m.CatalogoComponent),
      },
      {
        path: "admin/catalogos/lugaresProduccion",
        canActivate: [roleGuard(ROLES.admin)],
        data: { titulo: "Lugares de Producción", catalogo: "lugaresProduccion" },
        loadComponent: () => import("./pages/catalogos/catalogo.component").then((m) => m.CatalogoComponent),
      },
      {
        path: "admin/catalogos/codigosRancho",
        canActivate: [roleGuard(ROLES.admin)],
        data: { titulo: "Códigos Rancho", catalogo: "codigosRancho" },
        loadComponent: () => import("./pages/catalogos/catalogo.component").then((m) => m.CatalogoComponent),
      },
      {
        path: "admin/catalogos/categorias",
        canActivate: [roleGuard(ROLES.admin)],
        data: { titulo: "Categorías", catalogo: "categorias" },
        loadComponent: () => import("./pages/catalogos/catalogo.component").then((m) => m.CatalogoComponent),
      },
      {
        path: "admin/catalogos/tiposEmpaque",
        canActivate: [roleGuard(ROLES.admin)],
        data: { titulo: "Tipos de Empaque", catalogo: "tiposEmpaque" },
        loadComponent: () => import("./pages/catalogos/catalogo.component").then((m) => m.CatalogoComponent),
      },
      {
        path: "admin/catalogos/tiposEmpaqueGuia",
        canActivate: [roleGuard(ROLES.admin)],
        data: { titulo: "Tipos Empaque Guía", catalogo: "tiposEmpaqueGuia" },
        loadComponent: () => import("./pages/catalogos/catalogo.component").then((m) => m.CatalogoComponent),
      },
      {
        path: "admin/catalogos/destinos",
        canActivate: [roleGuard(ROLES.admin)],
        data: { titulo: "Destinos - Maestro", catalogo: "destinos" },
        loadComponent: () => import("./pages/catalogos/catalogo.component").then((m) => m.CatalogoComponent),
      },
      {
        path: "admin/catalogos/calibres",
        canActivate: [roleGuard(ROLES.admin)],
        data: { titulo: "Calibres - Maestro", catalogo: "calibres" },
        loadComponent: () => import("./pages/catalogos/catalogo.component").then((m) => m.CatalogoComponent),
      },
      {
        path: "admin/catalogos/transportes",
        canActivate: [roleGuard(ROLES.admin)],
        data: { titulo: "Transportes - Maestro", catalogo: "transportes" },
        loadComponent: () => import("./pages/catalogos/catalogo.component").then((m) => m.CatalogoComponent),
      },
      {
        path: "admin/catalogos/:catalogo",
        canActivate: [roleGuard(ROLES.admin)],
        data: { titulo: "Catálogos" },
        loadComponent: () => import("./pages/proximamente/proximamente.component").then((m) => m.ProximamenteComponent),
      },
      {
        path: "admin/catalogos-consignatarios",
        canActivate: [roleGuard(ROLES.admin)],
        data: { titulo: "Consignatarios - Maestro" },
        loadComponent: () => import("./pages/consignatarios/consignatarios.component").then((m) => m.ConsignatariosComponent),
      },
      {
        path: "admin/catalogos-categorias",
        canActivate: [roleGuard(ROLES.admin)],
        data: { titulo: "Categorías" },
        loadComponent: () => import("./pages/proximamente/proximamente.component").then((m) => m.ProximamenteComponent),
      },
      {
        path: "admin/catalogos-tipos-empaque",
        canActivate: [roleGuard(ROLES.admin)],
        data: { titulo: "Tipos de Empaque" },
        loadComponent: () => import("./pages/proximamente/proximamente.component").then((m) => m.ProximamenteComponent),
      },
      {
        path: "admin/catalogos-tipos-empaque-guia",
        canActivate: [roleGuard(ROLES.admin)],
        data: { titulo: "Tipos Empaque Guía" },
        loadComponent: () => import("./pages/proximamente/proximamente.component").then((m) => m.ProximamenteComponent),
      },
      {
        path: "admin/catalogos-variedades-maestro",
        canActivate: [roleGuard(ROLES.admin)],
        data: { titulo: "Variedades - Maestro" },
        loadComponent: () => import("./pages/variedades/variedades.component").then((m) => m.VariedadesComponent),
      },
      {
        path: "reportes-dashboard-diario",
        canActivate: [roleGuard(ROLES.admin, ROLES.monitor)],
        loadComponent: () =>
          import("./pages/reportes/reporte-diario/reporte-diario.component").then((m) => m.ReporteDiarioComponent),
      },
      {
        path: "reporte-kg-ingresados-acopio",
        canActivate: [roleGuard(ROLES.admin, ROLES.monitor)],
        loadComponent: () =>
          import("./pages/reportes/reporte-kg-acopio/reporte-kg-acopio.component").then((m) => m.ReporteKgAcopioComponent),
      },
      {
        path: "reportes-dashboard-diario-propio-externo",
        canActivate: [roleGuard(ROLES.admin, ROLES.monitor)],
        loadComponent: () =>
          import("./pages/reportes/reporte-bh/reporte-bh.component").then((m) => m.ReporteBhComponent),
      },
      {
        path: "reporte-semanal",
        canActivate: [roleGuard(ROLES.admin, ROLES.monitor)],
        loadComponent: () =>
          import("./pages/reportes/reporte-semanal/reporte-semanal.component").then((m) => m.ReporteSemanalComponent),
      },
      {
        path: "reporte-campania",
        canActivate: [roleGuard(ROLES.admin, ROLES.monitor)],
        loadComponent: () =>
          import("./pages/reportes/reporte-campania/reporte-campania.component").then((m) => m.ReporteCampaniaComponent),
      },
    ],
  },
  { path: "**", redirectTo: "" },
];
