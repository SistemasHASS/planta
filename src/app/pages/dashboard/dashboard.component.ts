import { Component, ChangeDetectionStrategy, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ProcesoService } from '../../shared/services/proceso.service';
import { AuthService } from '../../shared/services/auth.service';
import { DashboardService, DashboardKPIs, AlertaPalet } from '../../shared/services/dashboard.service';
import { Proceso } from '../../shared/interfaces/proceso.interface';

@Component({
  selector: 'app-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit, OnDestroy {
  private readonly procesoService = inject(ProcesoService);
  private readonly auth = inject(AuthService);
  private readonly dashboardService = inject(DashboardService);
  private alertasInterval?: number;

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

  readonly procesos = signal<Proceso[]>([]);
  readonly procesosAbiertos = computed(() => this.procesos().filter(p => p.estado === 'ABIERTO'));
  readonly procesosCerrados = computed(() => this.procesos().filter(p => p.estado === 'CERRADO'));
  
  readonly kpis = signal<DashboardKPIs | null>(null);
  readonly alertas = signal<AlertaPalet[]>([]);
  readonly mostrarAlertas = computed(() => this.alertas().length > 0);

  readonly quickCards = computed(() => {
    const p = this.perfil();
    const cards: { title: string; desc: string; icon: string; color: string; bg: string; link: string }[] = [];

    if (p === 'ADMINISTRADOR') {
      cards.push(
        { title: 'Procesos', desc: 'Gestionar procesos', icon: 'bi-calendar-event-fill', color: 'var(--color-primary)', bg: 'var(--color-primary-light)', link: '/procesos' },
        { title: 'Palets', desc: 'Gestionar palets', icon: 'bi-box-seam-fill', color: 'var(--color-success)', bg: 'var(--color-success-light)', link: '/palets' },
        { title: 'Guías de Remisión', desc: 'Gestionar guías', icon: 'bi-truck', color: 'var(--color-warning)', bg: 'var(--color-warning-light)', link: '/guias' },
        { title: 'Catálogos', desc: 'Administrar catálogos', icon: 'bi-collection-fill', color: 'var(--color-info)', bg: 'var(--color-info-light)', link: '/catalogos' }
      );
    } else if (p === 'LOGISTICA') {
      cards.push(
        { title: 'Procesos', desc: 'Abrir / cerrar procesos', icon: 'bi-calendar-event-fill', color: 'var(--color-primary)', bg: 'var(--color-primary-light)', link: '/procesos' },
        { title: 'Palets', desc: 'Crear y gestionar palets', icon: 'bi-box-seam-fill', color: 'var(--color-success)', bg: 'var(--color-success-light)', link: '/palets' },
        { title: 'Guías de Remisión', desc: 'Gestionar guías', icon: 'bi-truck', color: 'var(--color-warning)', bg: 'var(--color-warning-light)', link: '/guias' }
      );
    } else if (p === 'COORDINACION') {
      cards.push(
        { title: 'Procesos', desc: 'Ver procesos abiertos / cerrados', icon: 'bi-calendar-event-fill', color: 'var(--color-primary)', bg: 'var(--color-primary-light)', link: '/procesos' },
        { title: 'Palets', desc: 'Seguimiento de palets', icon: 'bi-box-seam-fill', color: 'var(--color-success)', bg: 'var(--color-success-light)', link: '/palets' },
        { title: 'Guías', desc: 'Ver guías de remisión', icon: 'bi-truck', color: 'var(--color-warning)', bg: 'var(--color-warning-light)', link: '/guias' }
      );
    } else {
      cards.push(
        { title: 'Procesos', desc: 'Ver procesos', icon: 'bi-calendar-event-fill', color: 'var(--color-primary)', bg: 'var(--color-primary-light)', link: '/procesos' }
      );
    }
    return cards;
  });

  ngOnInit(): void {
    // this.procesoService.listar().subscribe({
    //   next: (res) => this.procesos.set(res.data ?? []),
    //   error: (err: unknown) => console.error('Error cargando procesos:', err)
    // });

    // if (this.perfil() === 'ADMINISTRADOR') {
    //   this.cargarKPIsAdmin();
    // }

    // this.cargarAlertas();
    // this.alertasInterval = window.setInterval(() => this.cargarAlertas(), 60000);
  }

  ngOnDestroy(): void {
    if (this.alertasInterval) {
      clearInterval(this.alertasInterval);
    }
  }

  private cargarKPIsAdmin(): void {
    this.dashboardService.obtenerKPIsAdmin().subscribe({
      next: (res) => {
        if (res.success) {
          this.kpis.set(res.data);
        }
      },
      error: (err: unknown) => console.error('Error cargando KPIs:', err)
    });
  }

  private cargarAlertas(): void {
    this.dashboardService.obtenerAlertasPaletsVencidos().subscribe({
      next: (res) => {
        if (res.success) {
          this.alertas.set(res.alertas || []);
        }
      },
      error: (err: unknown) => console.error('Error cargando alertas:', err)
    });
  }

  formatearTiempo(minutos: number): string {
    const h = Math.floor(minutos / 60);
    const m = minutos % 60;
    return h > 0 ? `${h}h ${m}min` : `${m}min`;
  }
}
