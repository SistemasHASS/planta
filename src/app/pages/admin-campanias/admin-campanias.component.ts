import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../shared/services/auth.service';
import { CatalogosRepository } from '../../shared/dexiedb/repository/catalogos.repository';
import { Campania } from '../../shared/interfaces/catalogo.interface';
import { formatDate } from '../../shared/utils/datetime.utils';

@Component({
  selector: 'app-admin-campanias',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './admin-campanias.component.html',
  styleUrl: './admin-campanias.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminCampaniasComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly catalogosRepo = inject(CatalogosRepository);

  readonly nombreCompleto = this.auth.nombreCompleto;

  readonly campanias = signal<Campania[]>([]);
  readonly activeCampaniaId = signal<string | null>(null);

  readonly activeCampania = computed(() => {
    const id = this.activeCampaniaId();
    if (!id) return null;
    return this.campanias().find(c => String(c?.idproyecto ?? '') === String(id)) ?? null;
  });

  readonly activeLabel = computed(() => {
    const c = this.activeCampania();
    if (!c) return '—';
    const left = String(c.idproyecto ?? '').trim();
    const right = String(c.descripcion ?? '').trim();
    if (left && right && left !== right) return `${left} — ${right}`;
    return left || right || '—';
  });

  fmtDate(value: unknown): string {
    return formatDate(value) ?? '—';
  }

  fmtDateRange(inicio: unknown, fin: unknown): string {
    const a = formatDate(inicio);
    const b = formatDate(fin);
    if (a && b) return `${a} — ${b}`;
    return a ?? b ?? '—';
  }

  async ngOnInit(): Promise<void> {
    try {
      await this.cargarDesdeDexie();
      await this.cargarConfiguracion();
    } catch (error) {
      console.log('Error en AdminCampaniasComponent.ngOnInit', error);
    }
  }

  private getNroDocumentoFromUsuario(): string {
    const u: any = this.auth.usuario();
    const v = u?.nrodocumento ?? u?.documentoidentidad ?? u?.documentoIdentidad ?? u?.documento ?? '';
    return String(v ?? '').trim();
  }

  private async cargarDesdeDexie(): Promise<void> {
    try {
      const list = await this.catalogosRepo.campaniaRepo.getAll();
      const arr = Array.isArray(list) ? list : [];
      arr.sort((a, b) => String(b?.fecha_inicio ?? '').localeCompare(String(a?.fecha_inicio ?? '')));
      this.campanias.set(arr);
    } catch (error) {
      console.log('Error cargando campanias desde Dexie', error);
      this.campanias.set([]);
    }
  }

  private async cargarConfiguracion(): Promise<void> {
    try {
      const nro = this.getNroDocumentoFromUsuario();
      if (!nro) {
        this.activeCampaniaId.set(null);
        return;
      }
      const cfg: any = await this.catalogosRepo.configuracionRepo.getByField('nrodocumento', nro);
      const id = String(cfg?.idProyecto ?? cfg?.idCampania ?? '').trim();
      this.activeCampaniaId.set(id ? id : null);
    } catch (error) {
      console.log('Error cargando configuracion desde Dexie', error);
      this.activeCampaniaId.set(null);
    }
  }

  isActive(c: Campania): boolean {
    return String(c?.idproyecto ?? '') === String(this.activeCampaniaId() ?? '');
  }
}
