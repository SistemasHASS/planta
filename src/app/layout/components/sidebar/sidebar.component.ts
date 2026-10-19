import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnInit, Output, computed, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import {
  LucideBuilding2,
  LucideCalendarRange,
  LucideChartColumn,
  LucideChevronDown,
  LucideDownload,
  LucideFileChartColumn,
  LucideFileText,
  LucideGauge,
  LucideLayoutDashboard,
  LucideLibrary,
  LucideMapPin,
  LucideNetwork,
  LucideSettings,
  LucideUsers,
  LucideLeaf,
  LucideLogOut,
  LucideCalendarDays,
  LucidePackage,
  LucideSlidersHorizontal,
  LucideSquarePen,
  LucideTruck,
  LucideX
} from '@lucide/angular';
import { LocalSession } from '../../../shared/interfaces/auth.interface';
import { ROLES, ROLE_LABELS } from '../../../shared/guards/role.guard';
import { AuthService } from '../../../shared/services/auth.service';
import { PendingLogoutModalService } from '../../../shared/services/pending-logout-modal.service';
import { PendingSyncService } from '../../../shared/services/pending-sync.service';
import { LoadingService } from '../../../shared/services/loading.service';
import { ConfirmModalService } from '../../../shared/services/confirm-modal.service';
import { ConnectivityService } from '../../../shared/services/connectivity.service';
import { FeedbackModalService } from '../../../shared/services/feedback-modal.service';
import { ReportesApiService } from '../../../shared/services/reportes-api.service';
import { APP_VERSION } from '../../../version';

interface NavItem {
  label: string;
  path: string;
  /** Nombre del icono: debe existir en el @switch de sidebar.component.html. */
  icon: string;
  /** Si es true, el enlace se deshabilita sin internet (reportes, mapas, etc.). */
  requiresInternet?: boolean;
  /** Si es true, solo lo ve el administrador (ROLES.admin). */
  adminOnly?: boolean;
  /** Roles que ven el enlace (ROLES.*). Sin esto, lo ven todos. */
  roles?: readonly string[];
  /** Subitems: si existen, el item es un submenu desplegable (el path se ignora). */
  children?: NavItem[];
}

interface NavSection {
  key: string;
  /** Si es true, la seccion solo aparece cuando la empresa tiene habilitado el reporte BH / CAO. */
  soloReporteBh?: boolean;
  title: string;
  /** Controla si la seccion inicia desplegada; el usuario siempre puede alternarla. */
  defaultOpen: boolean;
  items: NavItem[];
}

/**
 * MENU DE LA APLICACION: para agregar una pantalla nueva basta con sumar un item aqui
 * (y su ruta en app.routes.ts). Si el icono es nuevo, agregarlo tambien al @switch del html.
 */
const NAV_SECTIONS: NavSection[] = [
  {
    key: 'configuraciones',
    title: 'Configuraciones',
    defaultOpen: true,
    items: [{ label: 'Parametros', path: '/parametros', icon: 'sliders', roles: [ROLES.logistica, ROLES.admin, ROLES.monitor, ROLES.guiasManuales] }],
  },
  {
    key: 'gestion',
    title: 'Gestión',
    defaultOpen: true,
    items: [
      { label: 'Procesos', path: '/procesos', icon: 'calendar', roles: [ROLES.logistica, ROLES.admin] },
      { label: 'Palets', path: '/palets', icon: 'package', roles: [ROLES.logistica, ROLES.admin] },
      { label: 'Guías', path: '/guias', icon: 'truck', roles: [ROLES.logistica, ROLES.admin, ROLES.monitor] },
      { label: 'Guías Manuales', path: '/guias-manuales', icon: 'pencil', roles: [ROLES.logistica, ROLES.admin, ROLES.monitor, ROLES.guiasManuales] },
    ],
  },
  {
    key: 'administracion',
    title: 'Administración',
    defaultOpen: true,
    items: [
      { label: 'Acopio Configuración', path: '/admin/acopio_configuracion', icon: 'building', adminOnly: true },
      { label: 'Gestión de Usuarios', path: '/admin/usuarios', icon: 'users', adminOnly: true },
      { label: 'Gestión de Destinatarios', path: '/admin/destinatarios', icon: 'map-pin', adminOnly: true },
      { label: 'Matriz Compatibilidad', path: '/admin/matriz', icon: 'network', adminOnly: true },
      { label: 'Reglas Sobrepeso', path: '/admin/sobrepeso', icon: 'gauge', adminOnly: true },
      { label: 'Series GRE', path: '/admin/correlativos-documentos', icon: 'file-text', adminOnly: true },
      {
        label: 'Catálogos',
        path: '#catalogos',
        icon: 'library',
        adminOnly: true,
        children: [
          { label: 'Tipo Proceso Empacado', path: '/admin/catalogos/tipoProcesoEmpacado', icon: 'dot' },
          { label: 'Grupo Clientes', path: '/admin/catalogos/clientes', icon: 'dot' },
          { label: 'Consignatarios - Maestro', path: '/admin/catalogos-consignatarios', icon: 'dot' },
          { label: 'Destinos - Maestro', path: '/admin/catalogos/destinos', icon: 'dot' },
          { label: 'Formatos', path: '/admin/catalogos/formatos', icon: 'dot' },
          { label: 'Calibres - Maestro', path: '/admin/catalogos/calibres', icon: 'dot' },
          { label: 'Categorías', path: '/admin/catalogos/categorias', icon: 'dot' },
          { label: 'Tipos de Empaque', path: '/admin/catalogos/tiposEmpaque', icon: 'dot' },
          { label: 'Tipos Empaque Guía', path: '/admin/catalogos/tiposEmpaqueGuia', icon: 'dot' },
          { label: 'Presentaciones', path: '/admin/catalogos/presentaciones', icon: 'dot' },
          { label: 'Tipos de Caja', path: '/admin/catalogos/tiposCaja', icon: 'dot' },
          { label: 'Tipos de Clamshell', path: '/admin/catalogos/tiposClamshell', icon: 'dot' },
          { label: 'Variedades - Maestro', path: '/admin/catalogos-variedades-maestro', icon: 'dot' },
          { label: 'Lugares de Producción', path: '/admin/catalogos/lugaresProduccion', icon: 'dot' },
          { label: 'Transportes - Maestro', path: '/admin/catalogos/transportes', icon: 'dot' },
          { label: 'Códigos Rancho', path: '/admin/catalogos/codigosRancho', icon: 'dot' },
        ],
      },
      {
        label: 'Catálogos Operativos',
        path: '#catalogos-operativos',
        icon: 'settings',
        adminOnly: true,
        children: [
          { label: 'Conductores', path: '/admin/catalogos/conductores', icon: 'dot' },
          { label: 'Vehículos', path: '/admin/catalogos/vehiculos', icon: 'dot' },
          { label: 'Transportistas', path: '/admin/catalogos/transportistas', icon: 'dot' },
          { label: 'Supervisores', path: '/admin/catalogos/supervisores', icon: 'dot' },
          { label: 'Personal Logística', path: '/admin/catalogos/personalLogistica', icon: 'dot' },
        ],
      },
    ],
  },
  {
    key: 'reportes',
    title: 'Reportes',
    defaultOpen: true,
    items: [
      { label: 'Reporte Diario', path: '/reportes-dashboard-diario', icon: 'chart', roles: [ROLES.admin, ROLES.monitor], requiresInternet: true },
      { label: 'KG Ingresados Acopio', path: '/reporte-kg-ingresados-acopio', icon: 'download', roles: [ROLES.admin, ROLES.monitor], requiresInternet: true },
      {
        label: 'Reportes Generales',
        path: '#reportes-generales',
        icon: 'file-chart',
        roles: [ROLES.admin, ROLES.monitor],
        children: [
          { label: 'Semana', path: '/reporte-semanal', icon: 'dot', requiresInternet: true },
          { label: 'Campaña', path: '/reporte-campania', icon: 'dot', requiresInternet: true },
        ],
      },
    ],
  },
  {
    key: 'reportes-bh-cao',
    title: 'Reportes BH / CAO',
    defaultOpen: true,
    soloReporteBh: true,
    items: [
      { label: 'Reporte Diario', path: '/reportes-dashboard-diario-propio-externo', icon: 'chart', roles: [ROLES.admin, ROLES.monitor], requiresInternet: true },
    ],
  },
];

@Component({
  selector: 'app-sidebar',
  imports: [
    RouterLink,
    RouterLinkActive,
    NgTemplateOutlet,
    LucideBuilding2,
    LucideCalendarRange,
    LucideChartColumn,
    LucideChevronDown,
    LucideDownload,
    LucideFileChartColumn,
    LucideFileText,
    LucideGauge,
    LucideLayoutDashboard,
    LucideLibrary,
    LucideMapPin,
    LucideNetwork,
    LucideSettings,
    LucideUsers,
    LucideLeaf,
    LucideLogOut,
    LucideCalendarDays,
    LucidePackage,
    LucideSlidersHorizontal,
    LucideSquarePen,
    LucideTruck,
    LucideX
  ],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SidebarComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly loading = inject(LoadingService);
  private readonly confirm = inject(ConfirmModalService);
  private readonly connectivity = inject(ConnectivityService);
  private readonly feedback = inject(FeedbackModalService);
  private readonly pendingLogoutModal = inject(PendingLogoutModalService);
  private readonly pendingSync = inject(PendingSyncService);
  private readonly reportesApi = inject(ReportesApiService);
  private readonly router = inject(Router);

  @Input() open = false;
  @Output() closed = new EventEmitter<void>();

  readonly sectionOpen = signal<ReadonlySet<string>>(new Set());
  readonly session = signal<LocalSession | null>(null);
  readonly loadingLogout = signal(false);
  readonly online = this.connectivity.online;
  readonly appVersion = APP_VERSION;

  readonly user = computed(() => this.session()?.user ?? null);
  readonly roleId = computed(() => String(this.user()?.idRol ?? this.user()?.rol ?? '').trim().toUpperCase());
  readonly isAdmin = computed(() => this.roleId() === ROLES.admin);
  readonly displayName = computed(() => String(this.user()?.nombre ?? this.user()?.usuario ?? 'Usuario').trim());
  readonly roleName = computed(() => ROLE_LABELS[this.roleId()] ?? (String(this.user()?.rol ?? '').trim() || this.roleId() || 'Usuario'));

  /** Menu visible para el usuario actual (oculta lo marcado adminOnly si no es admin). */
  readonly navSections = computed<NavSection[]>(() =>
    NAV_SECTIONS
      .filter((section) => !section.soloReporteBh || this.reporteBhHabilitado())
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => this.canSee(item)),
      }))
      .filter((section) => section.items.length > 0),
  );

  private canSee(item: NavItem): boolean {
    if (item.adminOnly && !this.isAdmin()) return false;
    return !item.roles || item.roles.includes(this.roleId());
  }

  /** Empresa con el parametro REPORTE_BH activo: muestra la seccion Reportes BH / CAO. Se recuerda el ultimo valor para verla sin internet. */
  readonly reporteBhHabilitado = signal(false);

  /** Submenus desplegados (por path del item padre). */
  readonly submenuOpen = signal<ReadonlySet<string>>(new Set());

  toggleSubmenu(path: string): void {
    const next = new Set(this.submenuOpen());
    if (next.has(path)) next.delete(path);
    else next.add(path);
    this.submenuOpen.set(next);
  }

  isSubmenuOpen(path: string): boolean {
    return this.submenuOpen().has(path);
  }

  async ngOnInit(): Promise<void> {
    this.session.set((await this.auth.getSession()) ?? null);
    this.sectionOpen.set(new Set(NAV_SECTIONS.filter((section) => section.defaultOpen).map((section) => section.key)));
    void this.cargarReporteBh();
  }

  /** Consulta si la empresa tiene habilitado el reporte BH / CAO (solo administrador y monitor). */
  private async cargarReporteBh(): Promise<void> {
    if (this.roleId() !== ROLES.admin && this.roleId() !== ROLES.monitor) return;
    const clave = `reporte-bh:${this.user()?.ruc ?? ''}`;
    try {
      this.reporteBhHabilitado.set(localStorage.getItem(clave) === '1');
    } catch { /* sin almacenamiento: se queda oculto hasta consultar */ }
    if (!this.online()) return;
    try {
      const habilitado = await this.reportesApi.reporteBhHabilitado();
      this.reporteBhHabilitado.set(habilitado);
      try { localStorage.setItem(clave, habilitado ? '1' : '0'); } catch { /* no critico */ }
    } catch (error) {
      console.error('Error consultando el reporte BH / CAO', error);
    }
  }

  /** Pantalla solo online abierta sin conexion: no se bloquea el click, se avisa. */
  avisarSoloOnline(): void {
    this.feedback.warning('Esta pantalla solo esta disponible de manera online.');
  }

  close(): void {
    this.closed.emit();
  }

  toggleSection(key: string): void {
    const next = new Set(this.sectionOpen());
    if (next.has(key)) next.delete(key);
    else next.add(key);
    this.sectionOpen.set(next);
  }

  isSectionOpen(key: string): boolean {
    return this.sectionOpen().has(key);
  }

  async logout(): Promise<void> {
    if (this.loadingLogout()) return;

    this.loadingLogout.set(true);
    this.loading.show('Verificando conexión segura...');
    let closingStarted = false;
    try {
      if (!(await this.connectivity.checkConnection())) {
        await this.loading.hideAfterMinimum();
        this.feedback.warning(
          'Conéctate a internet para sincronizar tus datos pendientes y revocar la sesión de forma segura. No se eliminó ningún dato de este dispositivo.',
          'No puedes cerrar sesión sin conexión',
        );
        return;
      }

      this.loading.show('Revisando datos pendientes de sincronizar...');
      const pending = await this.pendingSync.getSummary();
      await this.loading.hideAfterMinimum();
      if (pending.total > 0) {
        if (!(await this.pendingLogoutModal.confirm(pending))) {
          return;
        }
      } else if (!(await this.confirm.confirm({
        title: 'Cerrar sesión',
        message: '¿Seguro que quieres cerrar sesión?',
        detail: 'Tendrás que iniciar sesión nuevamente para continuar.',
        confirmText: 'Sí, cerrar sesión',
        cancelText: 'No, continuar',
        tone: 'warning',
      }))) {
        return;
      }

      this.loading.show('Cerrando sesión...');
      closingStarted = true;
      await this.auth.logoutManual();
      await this.auth.deleteLocalDatabase();
      await this.router.navigateByUrl('/login');
    } finally {
      if (closingStarted) {
        await this.loading.hideAfterMinimum();
      } else {
        this.loading.hide();
      }
      this.loadingLogout.set(false);
    }
  }
}
