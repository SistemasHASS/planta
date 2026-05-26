import { Component, ChangeDetectionStrategy, inject, signal, OnInit } from '@angular/core';
import { GuiaService } from '../../shared/services/guia.service';
import { ProcesoService } from '../../shared/services/proceso.service';
import { PermissionService } from '../../shared/services/permission.service';
import { GuiaRemision } from '../../shared/interfaces/guia.interface';
import { Proceso } from '../../shared/interfaces/proceso.interface';

type ViewPage = 'procesos' | 'guias' | 'detalle';

@Component({
  selector: 'app-guias',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './guias.component.html',
  styleUrl: './guias.component.scss'
})
export class GuiasComponent implements OnInit {
  private readonly guiaService = inject(GuiaService);
  private readonly procesoService = inject(ProcesoService);
  readonly permissions = inject(PermissionService);

  currentView = signal<ViewPage>('procesos');
  procesos = signal<Proceso[]>([]);
  procesoSeleccionado = signal<Proceso | null>(null);
  guias = signal<GuiaRemision[]>([]);
  guiaSeleccionada = signal<GuiaRemision | null>(null);
  isLoading = signal(false);

  ngOnInit(): void {
    this.procesoService.listar().subscribe({
      next: (res) => this.procesos.set(res.data ?? [])
    });
  }

  seleccionarProceso(p: Proceso): void {
    this.procesoSeleccionado.set(p);
    this.currentView.set('guias');
    this.cargarGuias(p.id);
  }

  cargarGuias(procesoId: number): void {
    this.isLoading.set(true);
    this.guiaService.listarPorProceso(procesoId).subscribe({
      next: (res) => { this.guias.set(res.data ?? []); this.isLoading.set(false); },
      error: () => this.isLoading.set(false)
    });
  }

  verDetalle(g: GuiaRemision): void {
    this.guiaService.obtenerPorId(g.Id).subscribe({
      next: (res) => {
        this.guiaSeleccionada.set(res.data);
        this.currentView.set('detalle');
      }
    });
  }

  cerrarGuia(g: GuiaRemision): void {
    this.guiaService.cerrar(g.Id).subscribe({
      next: () => { const p = this.procesoSeleccionado(); if (p) this.cargarGuias(p.id); }
    });
  }

  anularGuia(g: GuiaRemision): void {
    this.guiaService.anular(g.Id).subscribe({
      next: () => { const p = this.procesoSeleccionado(); if (p) this.cargarGuias(p.id); }
    });
  }

  eliminarGuia(g: GuiaRemision): void {
    this.guiaService.eliminar(g.Id).subscribe({
      next: () => { const p = this.procesoSeleccionado(); if (p) this.cargarGuias(p.id); }
    });
  }

  volverAProcesos(): void {
    this.currentView.set('procesos');
    this.procesoSeleccionado.set(null);
  }

  volverAGuias(): void {
    this.currentView.set('guias');
    this.guiaSeleccionada.set(null);
  }
}
