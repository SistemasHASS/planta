import { ChangeDetectionStrategy, Component, DestroyRef, EventEmitter, Input, OnInit, Output, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { liveQuery } from 'dexie';
import { from } from 'rxjs';
import { LucideBuilding2, LucideHome, LucideMapPin, LucideMenu, LucideMoon, LucideSun, LucideTag, LucideWifi, LucideWifiOff, LucideX } from '@lucide/angular';
import { CatalogosRepository } from '../../../shared/dexiedb/repository/catalogos.repository';
import { LocalSession } from '../../../shared/interfaces/auth.interface';
import { Campania } from '../../../shared/interfaces/catalogo.interface';
import { AuthService } from '../../../shared/services/auth.service';
import { ConnectivityService } from '../../../shared/services/connectivity.service';
import { ThemeService } from '../../../shared/services/theme.service';

type Pestana = 'CAMPANIA' | 'EMPRESA' | 'ACOPIO';

const texto = (v: unknown): string => String(v ?? '').trim();
const resumen = (valor: string, palabras = 2): string => {
  const partes = valor.split(/\s+/).filter(Boolean);
  return partes.length <= palabras ? valor : `${partes.slice(0, palabras).join(' ')}...`;
};
const fecha = (v: unknown): string => {
  const [y, m, d] = texto(v).split('T')[0].split('-');
  return y && m && d ? `${d}/${m}/${y}` : '—';
};

/** Barra superior: breadcrumb y chips con la campaña elegida, la empresa, el acopio y la conexion (igual que la app anterior). */
@Component({
  selector: 'app-topbar',
  imports: [RouterLink, LucideBuilding2, LucideHome, LucideMapPin, LucideMenu, LucideMoon, LucideSun, LucideTag, LucideWifi, LucideWifiOff, LucideX],
  templateUrl: './topbar.component.html',
  styleUrl: './topbar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TopbarComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly catalogos = inject(CatalogosRepository);
  private readonly destroyRef = inject(DestroyRef);
  readonly connectivity = inject(ConnectivityService);
  readonly tema = inject(ThemeService);

  @Output() menuToggle = new EventEmitter<void>();
  @Input() sidebarOpen = false;

  readonly session = signal<LocalSession | null>(null);
  /** Campania de la configuracion guardada en Parametros (se actualiza sola al guardar o eliminar). */
  readonly campania = signal<Campania | null>(null);
  readonly modal = signal<Pestana | null>(null);

  readonly usuario = computed(() => this.session()?.user ?? null);
  readonly fruta = computed(() => texto(this.campania()?.fruta));
  readonly empresa = computed(() => texto(this.usuario()?.razonSocial));
  readonly tieneAcopio = computed(() => {
    const codigo = texto(this.usuario()?.codigoAcopio);
    return !!codigo && codigo !== '0';
  });
  readonly acopio = computed(() => `${texto(this.usuario()?.acopioNombre)} - ${texto(this.usuario()?.serieGuia)}`);

  readonly frutaCorta = computed(() => resumen(this.fruta()));
  readonly empresaCorta = computed(() => resumen(this.empresa()));
  readonly acopioCorto = computed(() => resumen(texto(this.usuario()?.acopioNombre)));
  readonly periodo = computed(() => `${fecha(this.campania()?.fecha_inicio)} — ${fecha(this.campania()?.fecha_fin)}`);

  async ngOnInit(): Promise<void> {
    this.session.set((await this.auth.getSession()) ?? null);
    const nro = texto(this.usuario()?.documentoIdentidad);
    if (!nro) return;

    from(
      liveQuery(async () => {
        const cfg = await this.catalogos.configuracionRepo.getByField('nrodocumento', nro);
        if (!cfg) return null;
        return (await this.catalogos.campaniaRepo.getByField('idproyecto', cfg.idProyecto)) ?? null;
      }),
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((c) => this.campania.set(c));
  }
}
