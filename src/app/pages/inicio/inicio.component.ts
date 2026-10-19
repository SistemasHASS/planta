import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  LucideLayoutDashboard,
  LucidePencil,
  LucidePlus,
  LucideRefreshCcw,
  LucideSearch,
  LucideTrash2,
  LucideX,
} from '@lucide/angular';
import { PaginatorComponent } from '../../shared/components/paginator/paginator.component';
import { ConfirmModalService } from '../../shared/services/confirm-modal.service';
import { FeedbackModalService } from '../../shared/services/feedback-modal.service';
import { LoadingService } from '../../shared/services/loading.service';
import { TextViewModalService } from '../../shared/services/text-view-modal.service';
import { crearPaginacion } from '../../shared/utils/paginacion';

interface FilaEjemplo {
  id: number;
  nombre: string;
  detalle: string;
  estado: boolean;
}

/** Datos de ejemplo: solo sirven para ver como queda una tabla con buscador y paginador. */
const FILAS: FilaEjemplo[] = Array.from({ length: 27 }, (_, i) => ({
  id: i + 1,
  nombre: `Registro de ejemplo ${i + 1}`,
  detalle: i % 3 === 0 ? 'Jarra blanca' : i % 3 === 1 ? 'Jarra verde' : 'Descarte',
  estado: i % 4 !== 0,
}));

/**
 * Pantalla de inicio de la base nueva. Muestra los componentes comunes (encabezado, filtros, tabla
 * con paginador, modales de carga / aviso / confirmacion) como referencia para portar las pantallas.
 */
@Component({
  selector: 'app-inicio',
  imports: [
    PaginatorComponent,
    LucideLayoutDashboard,
    LucidePencil,
    LucidePlus,
    LucideRefreshCcw,
    LucideSearch,
    LucideTrash2,
    LucideX,
  ],
  templateUrl: './inicio.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InicioComponent {
  private readonly loading = inject(LoadingService);
  private readonly feedback = inject(FeedbackModalService);
  private readonly confirm = inject(ConfirmModalService);
  private readonly textView = inject(TextViewModalService);

  readonly buscar = signal('');
  readonly filas = computed(() => {
    const texto = this.buscar().trim().toLowerCase();
    return texto ? FILAS.filter((f) => `${f.nombre} ${f.detalle}`.toLowerCase().includes(texto)) : FILAS;
  });
  readonly pag = crearPaginacion(() => this.filas(), 10);

  onBuscar(event: Event): void {
    this.buscar.set((event.target as HTMLInputElement).value);
    this.pag.page.set(1);
  }

  limpiarBusqueda(): void {
    this.buscar.set('');
    this.pag.page.set(1);
  }

  async probarCarga(): Promise<void> {
    this.loading.show('Cargando datos de ejemplo...');
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await this.loading.hideAfterMinimum();
  }

  avisoExito(): void {
    this.feedback.success('La operacion se realizo correctamente.');
  }

  avisoAdvertencia(): void {
    this.feedback.warning('Revisa los datos antes de continuar.');
  }

  avisoError(): void {
    this.feedback.error('No se pudo completar la operacion. Intenta nuevamente.');
  }

  verTexto(): void {
    this.textView.open('Texto largo de ejemplo.\n\nSe usa para mostrar el detalle de un error o una observacion extensa.', 'Detalle');
  }

  async eliminar(fila: FilaEjemplo): Promise<void> {
    const ok = await this.confirm.confirm({
      title: 'Eliminar registro',
      message: `¿Seguro que quieres eliminar "${fila.nombre}"?`,
      detail: 'Esta accion no se puede deshacer.',
      confirmText: 'Si, eliminar',
      cancelText: 'Cancelar',
      tone: 'danger',
    });
    if (ok) this.feedback.success('Registro eliminado (ejemplo, no se borro nada).');
  }
}
