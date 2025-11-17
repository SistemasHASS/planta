import { Routes } from '@angular/router';
import { Error404PageComponent } from './shared/pages/error404-page/error404-page.component';
import { LayoutComponent } from './modules/main/pages/layout/layout.component';
import { ParametrosComponent } from './modules/main/pages/parametros/parametros.component';
import { AuthGuard } from './modules/auth/guard/auth.guard';
import { DashboardComponent } from './modules/main/pages/dashboard/dashboard';
import { MantenedorLineasComponent } from './modules/main/pages/mantenedor-lineas/mantenedor-lineas';
import { AsignacionComponent } from './modules/main/pages/asignacion/asignacion';
import { ConteoComponent } from './modules/main/pages/conteo/conteo';

export const routes: Routes = [
  {
    path: 'auth',
    loadChildren: () => import('./modules/auth/auth.module').then(m => m.AuthModule),
  },
  {
    path: '404',
    component: Error404PageComponent,
  },
  {
    path: '',
    redirectTo: 'auth/login',
    pathMatch: 'full'
  },
  {
    path: 'main',
    component: LayoutComponent,
    children: [
      { path: 'parametros', component: ParametrosComponent },
      { path: 'dashboard', component: DashboardComponent },
      { path: 'mantenedor-lineas', component: MantenedorLineasComponent },
      { path: 'asignacion', component: AsignacionComponent },
      { path: 'conteo', component: ConteoComponent },
      { path: '**', redirectTo: 'auth/login' }
    ],
    // canActivate: [AuthGuard]
  },
  {
    path: '**',
    redirectTo: '404',
  }
];
