import { ChangeDetectionStrategy, Component, OnInit, inject, input, output, signal } from '@angular/core';
import { SearchSelectComponent, SearchSelectOption } from '../../../../shared/components/search-select/search-select.component';
import { ConfirmModalService } from '../../../../shared/services/confirm-modal.service';
import { ConnectivityService } from '../../../../shared/services/connectivity.service';
import { FeedbackModalService } from '../../../../shared/services/feedback-modal.service';
import { JornadasAnotadorApiService } from '../../../../shared/services/jornadas-anotador-api.service';
import { LoadingService } from '../../../../shared/services/loading.service';
import { RecoleccionStore } from '../../recoleccion.store';
import { Fila, nombreLinea, refLinea, texto } from '../../jornada.utils';

/** Con qué se abre la ventana: el puesto tocado y lo que está elegido en su línea. */
export interface RegistroCajasInicial {
  linea: Fila;
  puesto: number;
  empacador: Fila;
  formatoId: string;
  tipoEmpaqueId: string;
  tiposEmpaque: SearchSelectOption[];
  /** Cantidad con la que se abre (la que ya tiene registrada; 1 si es nuevo). */
  cantidad: number;
  /** El empacador ya tiene cajas en esta recolección: se edita esa fila en lugar de crear otra. */
  existente: boolean;
  /** Calibre guardado en la fila (para no perderlo si no se cambia el tipo de empaque). */
  calibreNombre: string;
}

const MAX_CAJAS = 99999;

/**
 * Ventana para registrar o editar las cajas del empacador de un puesto. Si ya tiene cajas en la recolección se abre con lo registrado (cantidad, formato y tipo)
 * y al guardar se actualiza esa misma fila. Cambiar el formato o el tipo aquí no cambia la línea ni lo guardado en el equipo.
 */
@Component({
  selector: 'app-registro-cajas-modal',
  imports: [SearchSelectComponent],
  templateUrl: './registro-cajas-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegistroCajasModalComponent implements OnInit {
  protected readonly recoleccion = inject(RecoleccionStore);
  protected readonly nombreLinea = nombreLinea;
  private readonly connectivity = inject(ConnectivityService);
  private readonly confirm = inject(ConfirmModalService);
  private readonly loading = inject(LoadingService);
  private readonly feedback = inject(FeedbackModalService);
  private readonly jornadasApi = inject(JornadasAnotadorApiService);

  readonly datos = input.required<RegistroCajasInicial>();
  /** Se pide cerrar la ventana (cancelar, tocar fuera o guardar con éxito). */
  readonly closed = output<void>();

  protected readonly formatoId = signal('');
  protected readonly tipoEmpaqueId = signal('');
  protected readonly tiposEmpaque = signal<SearchSelectOption[]>([]);
  protected readonly cantidad = signal(1);
  protected readonly guardando = signal(false);

  ngOnInit(): void {
    const d = this.datos();
    this.formatoId.set(d.formatoId);
    this.tipoEmpaqueId.set(d.tipoEmpaqueId);
    this.tiposEmpaque.set(d.tiposEmpaque);
    this.cantidad.set(d.cantidad);
  }

  /** Cambia el formato solo en esta ventana: se piden los tipos de empaque que la matriz permite para él y se vuelve a elegir el tipo. */
  protected async elegirFormato(opcion: SearchSelectOption): Promise<void> {
    if (opcion.value === this.formatoId()) return;
    if (!opcion.value) {
      this.formatoId.set('');
      this.tipoEmpaqueId.set('');
      this.tiposEmpaque.set([]);
      return;
    }
    if (!this.connectivity.online()) {
      this.feedback.error('No hay conexión a internet');
      return;
    }
    this.loading.show('Cargando tipos de empaque...');
    try {
      const tipos = await this.recoleccion.tiposEmpaqueDeFormato(opcion.value);
      this.formatoId.set(opcion.value);
      this.tipoEmpaqueId.set('');
      this.tiposEmpaque.set(tipos);
      if (tipos.length === 0) this.feedback.warning('La matriz de compatibilidad no tiene tipos de empaque para este formato.', 'Sin tipos de empaque');
    } catch (e) {
      this.feedback.error(e instanceof Error && e.message ? e.message : 'No se pudieron consultar los tipos de empaque.');
    } finally {
      this.loading.hide();
    }
  }

  protected elegirTipo(opcion: SearchSelectOption): void {
    this.tipoEmpaqueId.set(opcion.value);
  }

  protected cerrar(): void {
    if (this.guardando()) return;
    this.closed.emit();
  }

  /** Botones − y +. */
  protected sumar(delta: number): void {
    this.cantidad.update((c) => Math.min(MAX_CAJAS, Math.max(1, c + delta)));
  }

  /** Lo que se escribe en el campo: solo enteros entre 1 y el máximo (vacío se deja en 1 al salir del campo). */
  protected escribir(campo: HTMLInputElement): void {
    // Solo dígitos: se descartan el signo, la "e", el punto, las comas y cualquier otro carácter (también al pegar).
    const digitos = campo.value.replace(/\D/g, '');
    if (digitos === '') {
      campo.value = ''; // mientras borra para escribir otro número no se pisa el valor guardado
      return;
    }
    const n = Math.min(MAX_CAJAS, parseInt(digitos, 10));
    if (n < 1) {
      campo.value = ''; // 0 no es una cantidad válida
      return;
    }
    campo.value = String(n);
    this.cantidad.set(n);
  }

  /** Bloquea al teclear lo que no es dígito (las teclas de control, flechas y atajos como Ctrl+V siguen funcionando). */
  protected soloDigitos(e: KeyboardEvent): void {
    if (e.ctrlKey || e.metaKey || e.altKey || e.key.length > 1) return;
    if (!/^\d$/.test(e.key)) e.preventDefault();
  }

  /** Quita al empacador de la recolección: su fila de cajas se anula y el stock se devuelve (después de confirmar). */
  protected async quitar(): Promise<void> {
    if (this.guardando()) return;
    const { linea, puesto, empacador } = this.datos();
    const ok = await this.confirm.confirm({
      title: 'Quitar cajas',
      eyebrow: 'Confirma la acción',
      message: `¿Quitar las cajas de ${texto(empacador['nombreCompleto'])} de esta recolección?`,
      detail: 'Su registro queda anulado y el stock se corrige.',
      confirmText: 'Sí, quitar',
      tone: 'warning',
    });
    if (!ok) return;
    if (!this.connectivity.online()) {
      this.feedback.error('No hay conexión a internet');
      return;
    }
    this.guardando.set(true);
    this.loading.show('Quitando cajas...');
    try {
      const resp = await this.jornadasApi.quitarCajas({ ...refLinea(linea), puesto });
      if (resp.error) {
        this.feedback.error(resp.mensaje || 'No se pudieron quitar las cajas.');
        try { await this.recoleccion.cargarRecolecciones(); await this.recoleccion.cargarCajas(); } catch { /* el aviso de arriba ya informa */ }
        return;
      }
      try { await this.recoleccion.cargarRecolecciones(); await this.recoleccion.cargarCajas(); } catch { /* ya se quitaron; se actualiza en la próxima carga */ }
      this.closed.emit();
      this.feedback.success(`Se quitaron las cajas de ${texto(empacador['nombreCompleto'])}.`, 'Cajas quitadas');
    } catch {
      this.feedback.error('No se pudieron quitar las cajas.');
    } finally {
      this.loading.hide();
      this.guardando.set(false);
    }
  }

  protected async guardar(): Promise<void> {
    if (this.guardando()) return;
    const { linea, puesto, empacador } = this.datos();
    const formatoId = this.formatoId();
    const tipoEmpaqueId = this.tipoEmpaqueId();
    const cantidad = this.cantidad();
    if (!formatoId || !tipoEmpaqueId) {
      this.feedback.warning('Elige el formato y el tipo de empaque.', 'Falta elegir');
      return;
    }
    if (!this.connectivity.online()) {
      this.feedback.error('No hay conexión a internet');
      return;
    }
    this.guardando.set(true);
    this.loading.show('Registrando cajas...');
    try {
      const resp = await this.recoleccion.registrarCajas({
        ...refLinea(linea),
        puesto,
        formatoId,
        tipoEmpaqueId,
        cantidad,
        calibreNombre: this.recoleccion.calibreDe(tipoEmpaqueId) || (tipoEmpaqueId === this.datos().tipoEmpaqueId ? this.datos().calibreNombre : ''),
      });
      if (resp.error) {
        this.feedback.error(resp.mensaje || 'No se pudieron registrar las cajas.');
        return;
      }
      this.closed.emit();
      const numero = texto(resp.data?.[0]?.['numeroRecoleccion'] ?? this.recoleccion.miRecoleccion()?.['numero']);
      const nombre = texto(empacador['nombreCompleto']);
      switch (texto(resp.data?.[0]?.['accion'])) {
        case 'UPDATE':
          this.feedback.success(`Ahora ${nombre} tiene ${cantidad} caja(s) en la recolección ${numero}.`, 'Cajas actualizadas');
          break;
        case 'SINCAMBIOS':
          this.feedback.success(`No hubo cambios en las cajas de ${nombre}.`, 'Sin cambios');
          break;
        default:
          this.feedback.success(`${cantidad} caja(s) de ${nombre} registradas en la recolección ${numero}.`, 'Cajas registradas');
      }
    } catch {
      this.feedback.error('No se pudieron registrar las cajas.');
    } finally {
      this.loading.hide();
      this.guardando.set(false);
    }
  }
}
