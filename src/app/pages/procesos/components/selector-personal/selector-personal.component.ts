import { ChangeDetectionStrategy, Component, inject, input, model } from '@angular/core';
import { LucideUsers } from '@lucide/angular';
import { PersonalLogistico, Supervisor } from '../../../../shared/interfaces/catalogo.interface';
import { FeedbackModalService } from '../../../../shared/services/feedback-modal.service';

export const MAX_SUPERVISORES = 2;
export const MAX_LOGISTICOS = 5;

/**
 * Lista de supervisores y de personal de logística para marcar (con casillas).
 * Solo muestra y controla los máximos: quien la usa decide de dónde salen las listas y qué hace con lo marcado.
 */
@Component({
  selector: 'app-selector-personal',
  imports: [LucideUsers],
  templateUrl: './selector-personal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class SelectorPersonalComponent {
  private readonly feedback = inject(FeedbackModalService);

  /** Personas que se pueden elegir. */
  readonly supervisores = input<Supervisor[]>([]);
  readonly logisticos = input<PersonalLogistico[]>([]);

  /** Mientras es true se muestra "Cargando...". */
  readonly cargando = input(false);

  /** Si trae texto, se muestra en lugar de las listas (por ejemplo: "Seleccione fecha y turno primero."). */
  readonly mensajeInicial = input('');

  /** true = supervisores y logística lado a lado (para ventanas anchas); false = uno debajo del otro. */
  readonly enDosColumnas = input(false);

  /** Personas marcadas. Se pueden enlazar con [(supervisoresSel)] y [(logisticosSel)]. */
  readonly supervisoresSel = model<Supervisor[]>([]);
  readonly logisticosSel = model<PersonalLogistico[]>([]);

  readonly maxSupervisores = MAX_SUPERVISORES;
  readonly maxLogisticos = MAX_LOGISTICOS;

  estaMarcadoSupervisor(supervisor: Supervisor): boolean {
    return this.supervisoresSel().some((x) => x.id === supervisor.id);
  }

  estaMarcadoLogistico(persona: PersonalLogistico): boolean {
    return this.logisticosSel().some((x) => x.id === persona.id);
  }

  cambiarSupervisor(supervisor: Supervisor, evento: Event): void {
    const casilla = evento.target as HTMLInputElement;
    const marcados = this.supervisoresSel();
    const nuevos = casilla.checked ? [...marcados, supervisor] : marcados.filter((x) => x.id !== supervisor.id);

    if (nuevos.length > MAX_SUPERVISORES) {
      this.feedback.warning(`Máximo ${MAX_SUPERVISORES} supervisores permitidos.`, 'Validación');
      casilla.checked = false;
      return;
    }
    this.supervisoresSel.set(nuevos);
  }

  cambiarLogistico(persona: PersonalLogistico, evento: Event): void {
    const casilla = evento.target as HTMLInputElement;
    const marcados = this.logisticosSel();
    const nuevos = casilla.checked ? [...marcados, persona] : marcados.filter((x) => x.id !== persona.id);

    if (nuevos.length > MAX_LOGISTICOS) {
      this.feedback.warning(`Máximo ${MAX_LOGISTICOS} personas de logística permitidas.`, 'Validación');
      casilla.checked = false;
      return;
    }
    this.logisticosSel.set(nuevos);
  }

  /** " (DNI: 123)" si la persona tiene DNI real; vacío si no. */
  conDni(persona: { dni?: string }): string {
    return persona.dni && persona.dni !== 'POR-ASIGNAR' ? ` (DNI: ${persona.dni})` : '';
  }
}
