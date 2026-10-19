import { ChangeDetectionStrategy, Component, HostListener, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { LucideWifiOff } from '@lucide/angular';
import { filter, map, startWith } from 'rxjs';
import { ConnectivityService } from '../shared/services/connectivity.service';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { TopbarComponent } from './components/topbar/topbar.component';

@Component({
  selector: 'app-layout',
  imports: [RouterOutlet, LucideWifiOff, SidebarComponent, TopbarComponent],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LayoutComponent {
  private readonly router = inject(Router);
  private readonly connectivity = inject(ConnectivityService);

  /** true si la pantalla actual se marco con `data: { requiresInternet: true }` en app.routes.ts. */
  private readonly pageRequiresInternet = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      startWith(null),
      map(() => {
        let route = this.router.routerState.snapshot.root;
        while (route.firstChild) route = route.firstChild;
        return route.data['requiresInternet'] === true;
      }),
    ),
    { initialValue: false },
  );

  /** Pantalla solo online abierta sin conexion: se muestra el aviso en lugar de la pantalla. */
  readonly offlineBlocked = () => this.pageRequiresInternet() && !this.connectivity.online();

  readonly currentYear = new Date().getFullYear();
  // En escritorio el menú inicia expandido; en pantallas pequeñas se conserva
  // como panel lateral cerrado para no cubrir el contenido al cargar.
  readonly sidebarOpen = signal(
    typeof window !== 'undefined' && window.innerWidth > 1024,
  );
  private wasDesktop = typeof window !== 'undefined' && window.innerWidth > 1024;

  toggleSidebar(): void {
    this.sidebarOpen.update((value) => !value);
  }

  closeSidebar(): void {
    // En escritorio los enlaces no deben contraer el menú; el cierre al
    // seleccionar una opción solo aplica al panel superpuesto de móvil.
    if (typeof window !== 'undefined' && window.innerWidth <= 1024) {
      this.sidebarOpen.set(false);
    }
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    const isDesktop = window.innerWidth > 1024;
    if (isDesktop === this.wasDesktop) return;

    this.wasDesktop = isDesktop;
    this.sidebarOpen.set(isDesktop);
  }
}
