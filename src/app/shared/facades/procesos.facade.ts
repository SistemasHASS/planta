import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ProcesoService } from '../services/proceso.service';
import { ConnectivityService } from '../services/connectivity.service';
import { ProcesoRepository } from '../dexiedb/repository/proceso.repository';

@Injectable({ providedIn: 'root' })
export class ProcesosFacade {
  private readonly procesoService = inject(ProcesoService);
  private readonly connectivity = inject(ConnectivityService);
  private readonly procesoRepo = inject(ProcesoRepository);

  async cargarProcesosCatalogo(codigoCultivo: string, idProyecto: string): Promise<any[]> {
    const codCultivo = String(codigoCultivo ?? '').trim();
    const idP = String(idProyecto ?? '').trim();

    if (!codCultivo || !idP) return [];

    if (this.connectivity.isOnline()) {
      try {
        const resp: any = await firstValueFrom(this.procesoService.listarProcesoForAcopio(codCultivo, idP));
        if (!resp?.[0]?.error) {
          const data = resp?.[0]?.data ?? [];
          if (data.length > 0) {
            for (const p of data) {
              (p as any).bd = 1;
              await this.procesoRepo.procesosRepo.saveByIdProceso(p as any);
            }
            return data;
          } else {
            return [];
          }
        }
        return [];
      } catch (error) {
        console.log('Error obteniendo procesos catalogo', error);
        return [];
      }
    } else {
      const lista = await this.procesoRepo.procesosRepo.getAll();
      const filtrados = (lista ?? []).filter((p: any) => {
        const idProj = String(p?.idProyecto ?? '').trim();
        const codCult = String(p?.codigoCultivo ?? '').trim();
        return idProj === idP && (!codCult || codCult === codCultivo);
      });
      return filtrados;
    }
  }
}
