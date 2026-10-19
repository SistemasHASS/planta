import { ChangeDetectionStrategy, Component, OnInit, inject, input, output, signal } from '@angular/core';
import { LucideCalendar, LucideMoon, LucideSave, LucideSun, LucideUsers, LucideX } from '@lucide/angular';
import { Configuracion } from '../../../../shared/interfaces/administracion.interface';
import { PersonalLogistico, Supervisor } from '../../../../shared/interfaces/catalogo.interface';
import { Proceso } from '../../../../shared/interfaces/proceso.interface';
import { ConnectivityService } from '../../../../shared/services/connectivity.service';
import { FeedbackModalService } from '../../../../shared/services/feedback-modal.service';
import { LoadingService } from '../../../../shared/services/loading.service';
import { ProcesosApiService } from '../../../../shared/services/procesos-api.service';
import { portalToBody } from '../../../../shared/utils/portal';
import { SelectorPersonalComponent } from '../selector-personal/selector-personal.component';

const texto = (valor: unknown): string => String(valor ?? '').trim();

/**
 * Ventana para cambiar el personal de un proceso abierto (solo administrador, solo en línea).
 * Pide al servidor el personal disponible de la fecha y envía los cambios; no guarda nada en el equipo.
 * Al terminar avisa a la pantalla con saved(mensaje); si se cancela, con closed().
 */
@Component({
  selector: 'app-editar-personal-modal',
  imports: [SelectorPersonalComponent, LucideCalendar, LucideMoon, LucideSave, LucideSun, LucideUsers, LucideX],
  templateUrl: './editar-personal-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditarPersonalModalComponent implements OnInit {
  constructor() {
    portalToBody();
  }

  private readonly api = inject(ProcesosApiService);
  private readonly connectivity = inject(ConnectivityService);
  private readonly loading = inject(LoadingService);
  private readonly feedback = inject(FeedbackModalService);

  /** Proceso que se edita, la configuración (campaña y cultivo) y el personal que ya tiene. */
  readonly proceso = input.required<Proceso>();
  readonly cfg = input.required<Configuracion>();
  readonly supervisoresActuales = input<Supervisor[]>([]);
  readonly logisticosActuales = input<PersonalLogistico[]>([]);

  /** saved: se guardó bien (la pantalla recarga la lista). closed: se canceló. */
  readonly saved = output<string>();
  readonly closed = output<void>();

  readonly supervisoresDisponibles = signal<Supervisor[]>([]);
  readonly logisticosDisponibles = signal<PersonalLogistico[]>([]);
  readonly supervisoresMarcados = signal<Supervisor[]>([]);
  readonly logisticosMarcados = signal<PersonalLogistico[]>([]);
  readonly cargando = signal(false);

  async ngOnInit(): Promise<void> {
    this.supervisoresMarcados.set([...this.supervisoresActuales()]);
    this.logisticosMarcados.set([...this.logisticosActuales()]);
    await this.cargarDisponibles();
  }

  fecha(): string {
    return texto(this.proceso().fechaProceso).split('T')[0];
  }

  /** Fecha del proceso como día/mes/año para mostrarla. */
  fechaMostrada(): string {
    const [anio, mes, dia] = this.fecha().split('-');
    return anio && mes && dia ? `${dia}/${mes}/${anio}` : this.fecha() || '—';
  }

  esDia(): boolean {
    return texto(this.proceso().turno).toUpperCase() === 'DIA';
  }

  /** Pide al servidor quién está libre en la fecha del proceso. */
  private async cargarDisponibles(): Promise<void> {
    if (!this.connectivity.online()) {
      this.feedback.error('Error de conexión: necesitas internet para cargar el personal.', 'Sin conexión');
      return;
    }

    this.cargando.set(true);
    this.loading.show('Cargando personal disponible...');
    try {
      const idProyecto = this.cfg().idProyecto;
      const [respSupervisores, respLogisticos] = await Promise.all([
        this.api.supervisoresDisponibles(idProyecto, this.fecha()),
        this.api.personalLogisticoDisponible(idProyecto, this.fecha()),
      ]);

      // El personal que ya es de este proceso no debe verse como ocupado.
      const idsSupervisores = this.supervisoresActuales().map((s) => s.id);
      const idsLogisticos = this.logisticosActuales().map((l) => l.id);

      const supervisores = this.soloActivos<Supervisor>(respSupervisores?.error ? [] : respSupervisores?.data);
      const logisticos = this.soloActivos<PersonalLogistico>(respLogisticos?.error ? [] : respLogisticos?.data);

      this.supervisoresDisponibles.set(supervisores.map((s) => ({ ...s, ocupado: idsSupervisores.includes(s.id) ? false : s.ocupado })));
      this.logisticosDisponibles.set(logisticos.map((l) => ({ ...l, ocupado: idsLogisticos.includes(l.id) ? false : l.ocupado })));
    } catch {
      this.feedback.error('Error de conexión: no se pudo cargar el personal disponible.', 'Sin conexión');
    } finally {
      this.cargando.set(false);
      await this.loading.hideAfterMinimum();
    }
  }

  private soloActivos<T extends { activo?: unknown }>(filas: unknown): T[] {
    if (!Array.isArray(filas)) return [];
    return (filas as T[]).filter((fila) => fila.activo === true || Number(fila.activo) === 1);
  }

  async guardar(): Promise<void> {
    if (!this.connectivity.online()) {
      this.feedback.warning('Necesitas internet para editar el personal.', 'Sin conexión');
      return;
    }
    const supervisoresNuevos = this.supervisoresMarcados();
    const logisticosNuevos = this.logisticosMarcados();
    if (supervisoresNuevos.length < 1 || logisticosNuevos.length < 1) {
      this.feedback.warning('Debe quedar al menos 1 supervisor y 1 persona de logística.', 'Validación');
      return;
    }

    const idProceso = texto(this.proceso().idProceso);

    // Los marcados se envían con eliminado = 0; los que tenía y ya no están, con eliminado = 1.
    const supervisores = [
      ...supervisoresNuevos.map((s) => ({ idProceso, idSupervisor: s.id, eliminado: 0 })),
      ...this.supervisoresActuales()
        .filter((antes) => !supervisoresNuevos.some((s) => s.id === antes.id))
        .map((antes) => ({ idProceso, idSupervisor: antes.id, eliminado: 1 })),
    ];
    const logisticos = [
      ...logisticosNuevos.map((l) => ({ idProceso, idLogistico: l.id, eliminado: 0 })),
      ...this.logisticosActuales()
        .filter((antes) => !logisticosNuevos.some((l) => l.id === antes.id))
        .map((antes) => ({ idProceso, idLogistico: antes.id, eliminado: 1 })),
    ];

    this.loading.show('Guardando cambios...');
    try {
      const respuesta = await this.api.sincronizarProceso(
        { ...this.proceso(), db: 0 },
        logisticos,
        supervisores,
        this.cfg().codigoCultivo,
        this.cfg().idProyecto,
        'editar',
      );
      if (respuesta.error) {
        this.loading.hide();
        this.feedback.error(respuesta.mensaje ?? 'Error al actualizar el proceso.');
        return;
      }
      this.loading.hide();
      this.saved.emit('Proceso actualizado correctamente.');
    } catch {
      this.loading.hide();
      this.feedback.error('Ocurrió un error inesperado al guardar.');
    }
  }
}
