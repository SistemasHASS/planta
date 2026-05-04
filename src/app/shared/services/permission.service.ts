import { inject, Injectable, computed } from '@angular/core';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class PermissionService {
  private readonly auth = inject(AuthService);

  readonly perfil = this.auth.perfil;

  readonly esAdmin = computed(() => this.perfil() === 'ADMINISTRADOR');
  readonly esLogistica = computed(() => this.perfil() === 'LOGISTICA');
  readonly esCoordinacion = computed(() => this.perfil() === 'COORDINACION');
  readonly esOperaciones = computed(() => this.perfil() === 'OPERACIONES');

  readonly esAdminOLogistica = computed(() => 
    this.esAdmin() || this.esLogistica()
  );

  puedeCrearProceso(): boolean {
    return this.esAdminOLogistica();
  }

  puedeCerrarProceso(): boolean {
    return this.esAdminOLogistica();
  }

  puedeReabrirProceso(): boolean {
    return this.esAdmin();
  }

  puedeCrearPalet(): boolean {
    return this.esAdminOLogistica();
  }

  puedeAgregarCajas(): boolean {
    return this.esAdminOLogistica();
  }

  puedeCerrarPalet(): boolean {
    return this.esAdminOLogistica();
  }

  puedeReabrirPalet(): boolean {
    return this.esAdminOLogistica();
  }

  puedeEliminarPalet(): boolean {
    return this.esAdminOLogistica();
  }

  puedeEliminarComposicion(): boolean {
    return this.esAdminOLogistica();
  }

  puedeCrearGuia(): boolean {
    return this.esAdminOLogistica();
  }

  puedeCerrarGuia(): boolean {
    return this.esAdminOLogistica();
  }

  puedeAnularGuia(): boolean {
    return this.esAdminOLogistica();
  }

  puedeEliminarGuia(): boolean {
    return this.esAdminOLogistica();
  }

  puedeGestionarCatalogos(): boolean {
    return this.esAdmin();
  }
}
