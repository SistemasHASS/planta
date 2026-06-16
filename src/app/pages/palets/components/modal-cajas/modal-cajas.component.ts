import { Component, ChangeDetectionStrategy, ViewEncapsulation, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Palet, DPalet } from '../../../../shared/interfaces/palet.interface';
import { AdvancedSelectComponent } from '../../../../shared/components/advanced-select/advanced-select.component';

interface FormCajas {
  consignatarioId: string | number;
  destinoId: number | string;
  formatoId: number;
  tipoEmpaqueId: number;
  calibreId: number;
  categoriaId: number;
  tipoEmpaqueGuiaId: number;
  tipoCajaId: number;
  tipoClamshellId: number;
  presentacionId: number;
  tipoProcesoEmpacadoId: number;
  variedadId: number | string;
  variedadGuiaId: number | string;
  lugarProduccionId: number;
  codigoRanchoId: number;
  transporteId: string;
  cantidadCajas: number;
  esReposicion: boolean;
  esEnsayo: boolean;
}

@Component({
  selector: 'app-modal-cajas',
  standalone: true,
  imports: [CommonModule, FormsModule, AdvancedSelectComponent],
  templateUrl: './modal-cajas.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None
})
export class ModalCajasComponent {
  @Input() visible = false;
  @Input() palet: Palet | null = null;
  @Input() composiciones: DPalet[] = [];
  @Input() formCajas!: FormCajas;
  @Input() modoEdicion = false;

  // Catalogs
  @Input() tiposProcesoEmpacadoModal: any[] = [];
  @Input() consignatarios: any[] = [];
  @Input() filteredDestinos: any[] = [];
  @Input() filteredFormatos: any[] = [];
  @Input() filteredTiposEmpaqueGuia: any[] = [];
  @Input() filteredPresentaciones: any[] = [];
  @Input() filteredTiposCaja: any[] = [];
  @Input() filteredTiposClamshell: any[] = [];
  @Input() filteredVariedades: any[] = [];
  @Input() filteredCodigosRancho: any[] = [];
  @Input() lugaresProduccion: any[] = [];
  @Input() transportes: any[] = [];
  @Input() variedades: any[] = [];

  // Disabled states
  @Input() tipoProcesoEmpacadoDisabled = false;
  @Input() formatoDisabled = false;
  @Input() tipoEmpaqueGuiaDisabled = false;
  @Input() presentacionDisabled = false;
  @Input() tipoCajaDisabled = false;
  @Input() tipoClamshellDisabled = false;
  @Input() codigoRanchoDisabled = false;

  @Output() cerrar = new EventEmitter<void>();
  @Output() submit = new EventEmitter<void>();
  @Output() campoChange = new EventEmitter<{ campo: string; valor: any }>();

  get titulo(): string {
    return this.modoEdicion ? 'Editar Cajas del Palet' : 'Agregar Cajas al Palet';
  }

  get textoSubmit(): string {
    return this.modoEdicion ? 'Guardar Cambios' : 'Agregar Cajas';
  }

  get variedadesNoEnsayo(): any[] {
    return (this.variedades ?? []).filter((v: any) => !v.esEnsayo);
  }

  onCampoChange(campo: string, valor: any): void {
    this.campoChange.emit({ campo, valor });
  }

  onCerrar(): void {
    this.cerrar.emit();
  }

  onSubmit(): void {
    this.submit.emit();
  }
}
