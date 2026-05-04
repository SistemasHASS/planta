import { Component, ChangeDetectionStrategy, inject, signal, OnInit, computed, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PaletService } from '../../shared/services/palet.service';
import { ProcesoService } from '../../shared/services/proceso.service';
import { CatalogoService } from '../../shared/services/catalogo.service';
import { AuthService } from '../../shared/services/auth.service';
import { PermissionService } from '../../shared/services/permission.service';
import { Palet, Composicion, AgregarComposicionRequest } from '../../shared/interfaces/palet.interface';
import { Proceso } from '../../shared/interfaces/proceso.interface';
import { Consignatario, Destino, Formato, Variedad, TipoEmpaque, TipoEmpaqueGuia, Presentacion, TipoCaja, TipoClamshell, LugarProduccion, CodigoRancho, Transporte, TipoProcesoEmpacado, Calibre, Categoria } from '../../shared/interfaces/catalogo.interface';

@Component({
  selector: 'app-palets',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink],
  templateUrl: './palets.component.html',
  styleUrl: './palets.component.scss'
})
export class PaletsComponent implements OnInit, OnDestroy {
  private readonly paletService = inject(PaletService);
  private readonly procesoService = inject(ProcesoService);
  private readonly catalogoService = inject(CatalogoService);
  private readonly auth = inject(AuthService);
  readonly permissions = inject(PermissionService);

  private timerInterval: ReturnType<typeof setInterval> | null = null;

  procesosAbiertos = signal<Proceso[]>([]);
  procesoSeleccionado = signal<Proceso | null>(null);
  palets = signal<Palet[]>([]);
  paletSeleccionado = signal<Palet | null>(null);
  composiciones = signal<Composicion[]>([]);

  // Catalog signals (static - loaded once)  
  consignatarios = signal<Consignatario[]>([]);
  variedades = signal<Variedad[]>([]);
  lugaresProduccion = signal<LugarProduccion[]>([]);
  transportes = signal<Transporte[]>([]);
  calibres = signal<Calibre[]>([]);
  categorias = signal<Categoria[]>([]);
  tiposProcesoEmpacado = signal<TipoProcesoEmpacado[]>([]);
  tiposEmpaque = signal<TipoEmpaque[]>([]);

  // Catalog signals (dynamic - loaded via cascading selects)
  filteredDestinos = signal<any[]>([]);
  filteredFormatos = signal<any[]>([]);
  filteredTiposEmpaqueGuia = signal<any[]>([]);
  filteredPresentaciones = signal<any[]>([]);
  filteredTiposCaja = signal<any[]>([]);
  filteredTiposClamshell = signal<any[]>([]);
  filteredCodigosRancho = signal<any[]>([]);

  // Static catalog signals (for catalog page, not used in cascading)
  destinos = signal<Destino[]>([]);
  formatos = signal<Formato[]>([]);
  tiposEmpaqueGuia = signal<TipoEmpaqueGuia[]>([]);
  presentaciones = signal<Presentacion[]>([]);
  tiposCaja = signal<TipoCaja[]>([]);
  tiposClamshell = signal<TipoClamshell[]>([]);
  codigosRancho = signal<CodigoRancho[]>([]);

  // Form signals for Agregar Cajas modal
  modalAgregarCajasAbierto = signal(false);
  formCajas = signal<Pick<AgregarComposicionRequest, 'consignatarioId' | 'destinoId' | 'formatoId' | 'tipoEmpaqueId' | 'calibreId' | 'categoriaId' | 'tipoEmpaqueGuiaId' | 'tipoCajaId' | 'tipoClamshellId' | 'presentacionId' | 'tipoProcesoEmpacadoId' | 'variedadId' | 'variedadGuiaId' | 'lugarProduccionId' | 'codigoRanchoId' | 'transporteId' | 'cantidadCajas' | 'esReposicion' | 'esEnsayo'>>({
    consignatarioId: 0,
    destinoId: 0,
    formatoId: 0,
    tipoEmpaqueId: 0,
    calibreId: 0,
    categoriaId: 0,
    tipoEmpaqueGuiaId: 0,
    tipoCajaId: 0,
    tipoClamshellId: 0,
    presentacionId: 0,
    tipoProcesoEmpacadoId: 1,
    variedadId: 0,
    variedadGuiaId: 0,
    lugarProduccionId: 0,
    codigoRanchoId: 0,
    transporteId: 1,
    cantidadCajas: 0,
    esReposicion: false,
    esEnsayo: false,
  });

  cerrarPaletTieneObs = signal(false);
  cerrarPaletObservaciones = signal('');
  cerrarPaletMedida = signal('');
  modalCerrarPaletAbierto = signal(false);

  // UI state signals
  isLoading = signal(false);
  successMsg = signal('');
  errorMsg = signal('');
  seccionActivosAbierta = signal(true);
  seccionDespachadosAbierta = signal(true);
  seccionComposicionAbierta = signal(false);
  seccionObservacionesAbierta = signal(false);
  showModalAgregarCajas = computed(() => this.modalAgregarCajasAbierto());
  showModalCerrarPalet = computed(() => this.modalCerrarPaletAbierto());

  readonly paletsActivos = computed(() =>
    this.palets().filter(p => p.Estado !== 'DESPACHADO')
  );

  readonly paletsDespachados = computed(() =>
    this.palets().filter(p => p.Estado === 'DESPACHADO')
  );

  private get userId(): number {
    return this.auth.usuario()?.id ?? 0;
  }

  ngOnInit(): void {
    console.log('🚀 PaletsComponent - Iniciando ngOnInit');
    
    // Load procesos
    console.log('📋 Cargando procesos...');
    this.procesoService.listar({ estado: 'ABIERTO' }).subscribe({
      next: (res) => {
        console.log('✅ Procesos cargados:', res);
        this.procesosAbiertos.set(Array.isArray(res) ? res : (res.data ?? []));
      },
      error: (err) => {
        console.error('❌ Error cargando procesos:', err);
      }
    });
    
    // Load all catalogs at once via SP
    console.log('📋 Cargando catálogos...');
    this.catalogoService.listarTodos().subscribe({
      next: (r: any) => {
        console.log('✅ Catálogos cargados - Raw response:', r);
        const data = r?.data ?? r;
        console.log('✅ Catálogos - Data object:', data);
        console.log('✅ Consignatarios count:', data?.consignatarios?.length ?? 0);
        console.log('✅ First consignatario:', data?.consignatarios?.[0]);
        
        this.consignatarios.set(data?.consignatarios ?? []);
        this.variedades.set(data?.variedades ?? []);
        this.destinos.set(data?.destinos ?? []);
        this.formatos.set(data?.formatos ?? []);
        this.tiposEmpaqueGuia.set(data?.tiposEmpaqueGuia ?? []);
        this.presentaciones.set(data?.presentaciones ?? []);
        this.tiposCaja.set(data?.tiposCaja ?? []);
        this.tiposClamshell.set(data?.tiposClamshell ?? []);
        this.tiposEmpaque.set(data?.tiposEmpaque ?? []);
        this.codigosRancho.set(data?.codigosRancho ?? []);
        console.log(' CodigosRancho loaded:', this.codigosRancho());
        this.lugaresProduccion.set(data?.lugaresProduccion ?? []);
        console.log(' LugaresProduccion loaded:', this.lugaresProduccion());
        this.transportes.set(data?.transportes ?? []);
        this.calibres.set(data?.calibres ?? []);
        this.categorias.set(data?.categorias ?? []);
        this.tiposProcesoEmpacado.set(data?.tiposProcesoEmpacado ?? []);
        
        console.log('🔍 After setting - consignatarios signal length:', this.consignatarios().length);
        console.log('🔍 LugaresProduccion loaded:', this.lugaresProduccion());
        console.log('🔍 LugaresProduccion count:', this.lugaresProduccion().length);
      },
      error: (err: any) => {
        console.error('❌ Error cargando catálogos:', err);
        alert('Error cargando catálogos: ' + JSON.stringify(err));
      }
    });
    
    console.log('🎯 PaletsComponent - ngOnInit completado');
  }

  ngOnDestroy(): void {
    if (this.timerInterval) clearInterval(this.timerInterval);
  }

  seleccionarProceso(p: Proceso): void {
    this.procesoSeleccionado.set(p);
    this.paletSeleccionado.set(null);
    this.composiciones.set([]);
    this.isLoading.set(true);
    this.errorMsg.set('');
    
    // Load complete process details (including supervisores and logistics)
    console.log('📋 Cargando detalles completos del proceso:', p.Id);
    this.procesoService.obtenerPorId(p.Id).subscribe({
      next: (res: any) => {
        console.log('✅ Detalles del proceso cargados:', res);
        const procesoCompleto = res?.data ?? res;
        
        // Update selected process with complete data
        this.procesoSeleccionado.set(procesoCompleto);
        
        // Now load palets for this process
        console.log('📋 Cargando palets para proceso:', procesoCompleto.Id);
        this.paletService.listarPorProceso(procesoCompleto.Id).subscribe({
          next: (res) => {
            console.log('✅ Palets cargados para proceso:', res);
            this.palets.set(Array.isArray(res) ? res : (res.data ?? []));
            this.isLoading.set(false);
          },
          error: (err) => {
            console.error('❌ Error cargando palets:', err);
            this.palets.set([]);
            this.isLoading.set(false);
            this.errorMsg.set('Error al cargar palets del proceso');
          }
        });
      },
      error: (err) => {
        console.error('❌ Error cargando detalles del proceso:', err);
        this.isLoading.set(false);
        this.errorMsg.set('Error al cargar detalles del proceso');
      }
    });
  }

  verDetalle(p: Palet): void {
    this.paletSeleccionado.set(p);
    
    // Load palet detail with composiciones
    console.log('📋 Cargando detalle para palet:', p.Id);
    console.log('📋 Palet actual antes de cargar:', p);
    this.paletService.obtenerPorId(p.Id).subscribe({
      next: (res: any) => {
        console.log('✅ Respuesta completa del backend:', res);
        console.log('✅ Data recibida:', res?.data);
        console.log('✅ Palet data:', res?.data?.palet);
        console.log('✅ Composiciones:', res?.data?.composiciones);
        
        const data = res?.data ?? res;
        
        // Update composiciones
        this.composiciones.set(data?.composiciones ?? data?.Composiciones ?? []);
        
        // Update palet data (CantidadCajas, PesoTotal, etc.)
        if (data && (data.Id || data.palet)) {
          const updatedPalet = data.palet || data;
          console.log('✅ Palet actualizado con datos:', updatedPalet);
          console.log('✅ CantidadCajas:', updatedPalet.CantidadCajas);
          console.log('✅ LimiteCajasPorPalet:', updatedPalet.LimiteCajasPorPalet);
          console.log('✅ PorcentajeAvance:', updatedPalet.PorcentajeAvance);
          
          // Update the selected palet with new data
          this.paletSeleccionado.set(updatedPalet);
          
          // Also update the palet in the list
          this.palets.update(palets => 
            palets.map(p => p.Id === updatedPalet.Id ? updatedPalet : p)
          );
          
          console.log('✅ Palet seleccionado después de actualizar:', this.paletSeleccionado());
        }
      },
      error: (err: any) => {
        console.error('❌ Error cargando detalle palet:', err);
        this.composiciones.set([]);
      }
    });
  }

  crearPalet(): void {
    const proceso = this.procesoSeleccionado();
    if (!proceso) {
      this.errorMsg.set('Debe seleccionar un proceso primero');
      return;
    }
    console.log('📋 Creando palet para proceso:', proceso);
    
    this.paletService.crear(proceso.Id, proceso.AcopioId, this.userId).subscribe({
      next: (res) => {
        console.log('✅ Palet creado:', res);
        this.successMsg.set('Palet creado exitosamente');
        // Reload palets for the process
        this.seleccionarProceso(proceso);
      },
      error: (err) => {
        console.error('❌ Error creando palet:', err);
        this.errorMsg.set('Error al crear palet');
      }
    });
  }

  abrirModalAgregarCajas(palet: Palet): void {
    this.paletSeleccionado.set(palet);
    this.modalAgregarCajasAbierto.set(true);
  }

  cerrarModalAgregarCajas(): void {
    this.modalAgregarCajasAbierto.set(false);
    // Reset filtered cascading signals
    this.filteredDestinos.set([]);
    this.filteredFormatos.set([]);
    this.filteredTiposEmpaqueGuia.set([]);
    this.filteredPresentaciones.set([]);
    this.filteredTiposCaja.set([]);
    this.filteredTiposClamshell.set([]);
    this.filteredCodigosRancho.set([]);
    this._matrizResults = [];
    this.errorMsg.set('');
    this.formCajas.set({
      consignatarioId: 0,
      destinoId: 0,
      formatoId: 0,
      tipoEmpaqueId: 0,
      calibreId: 0,
      categoriaId: 0,
      tipoEmpaqueGuiaId: 0,
      tipoCajaId: 0,
      tipoClamshellId: 0,
      presentacionId: 0,
      tipoProcesoEmpacadoId: 0,
      variedadId: 0,
      variedadGuiaId: 0,
      lugarProduccionId: 0,
      codigoRanchoId: 0,
      transporteId: 1,
      cantidadCajas: 0,
      esReposicion: false,
      esEnsayo: false,
    });
  }

  submitAgregarCajas(): void {
    const palet = this.paletSeleccionado();
    if (!palet) return;

    const f = this.formCajas();
    
    // Validación básica (calibreId/tipoEmpaqueId son auto-filled desde MatrizCompatibilidad)
    if (!f.consignatarioId || !f.destinoId || !f.formatoId || !f.variedadId || !f.cantidadCajas) {
      this.errorMsg.set('Complete todos los campos requeridos');
      return;
    }
    if (!f.tipoEmpaqueGuiaId || !f.tipoCajaId || !f.tipoClamshellId) {
      this.errorMsg.set('Complete la selección de empaque (Tipo Empaque Guía, Tipo Caja, Tipo Clamshell)');
      return;
    }
    if (!f.lugarProduccionId || !f.codigoRanchoId) {
      this.errorMsg.set('Seleccione Lugar de Producción y Código de Rancho');
      return;
    }

    // Obtener pesoPorCaja del formato seleccionado
    const formatoSel = this.filteredFormatos().find((fmt: any) => fmt.Id === f.formatoId);
    const pesoPorCaja = formatoSel?.PesoPorCaja ?? 10;

    const request: AgregarComposicionRequest = {
      paletId: palet.Id,
      consignatarioId: f.consignatarioId,
      destinoId: f.destinoId,
      formatoId: f.formatoId,
      tipoEmpaqueId: f.tipoEmpaqueId || 1,
      calibreId: f.calibreId || null,
      categoriaId: f.categoriaId || null,
      tipoEmpaqueGuiaId: f.tipoEmpaqueGuiaId,
      tipoCajaId: f.tipoCajaId,
      tipoClamshellId: f.tipoClamshellId,
      presentacionId: f.presentacionId || null,
      tipoProcesoEmpacadoId: f.tipoProcesoEmpacadoId || 1,
      variedadId: f.variedadId,
      variedadGuiaId: f.esEnsayo ? (f.variedadGuiaId || null) : null,
      lugarProduccionId: f.lugarProduccionId,
      codigoRanchoId: f.codigoRanchoId,
      transporteId: f.transporteId || 1,
      cantidadCajas: f.cantidadCajas,
      pesoPorCaja: pesoPorCaja,
      pesoTotal: f.cantidadCajas * pesoPorCaja,
      esReposicion: f.esReposicion,
      esEnsayo: f.esEnsayo,
      usuarioId: this.userId
    };

    console.log('📋 Agregando cajas - Request completo:', JSON.stringify(request, null, 2));
    console.log('📋 Formulario actual:', JSON.stringify(f, null, 2));
    console.log('📋 Peso por caja:', pesoPorCaja);
    
    this.paletService.agregarCajas(request).subscribe({
      next: (res: any) => {
        console.log('✅ Cajas agregadas:', res);
        console.log('✅ Respuesta de agregar cajas:', res);
        console.log('✅ Palet antes de recargar:', palet);
        this.successMsg.set('Cajas agregadas exitosamente');
        this.cerrarModalAgregarCajas();
        // Reload palet details
        console.log('📋 Llamando a verDetalle después de agregar cajas...');
        this.verDetalle(palet);
      },
      error: (err: any) => {
        console.error('❌ Error agregando cajas:', err);
        console.error('❌ Error status:', err.status);
        console.error('❌ Error message:', err.message);
        console.error('❌ Error completo:', JSON.stringify(err, null, 2));
        
        if (err.error && typeof err.error === 'object') {
          console.error('❌ Error backend:', err.error);
          this.errorMsg.set(err.error.message || 'Error al agregar cajas');
        } else {
          this.errorMsg.set('Error al agregar cajas');
        }
      }
    });
  }

  abrirModalCerrarPalet(palet: Palet): void {
    this.paletSeleccionado.set(palet);
    this.modalCerrarPaletAbierto.set(true);
    this.cerrarPaletTieneObs.set(false);
    this.cerrarPaletObservaciones.set('');
    this.cerrarPaletMedida.set('');
  }

  cerrarModalCerrarPalet(): void {
    this.modalCerrarPaletAbierto.set(false);
  }

  confirmarCerrarPalet(): void {
    const palet = this.paletSeleccionado();
    if (!palet) return;

    const tieneObs = this.cerrarPaletTieneObs();
    const obs = this.cerrarPaletObservaciones();
    const medida = this.cerrarPaletMedida();

    console.log('📋 Cerrando palet:', palet, { tieneObs, obs, medida });
    
    this.paletService.cerrar(palet.Id, 'NORMAL', this.userId, tieneObs ? obs : undefined, medida || undefined).subscribe({
      next: (res) => {
        console.log('✅ Palet cerrado:', res);
        this.cerrarModalCerrarPalet();
        // Reload palet details
        this.verDetalle(palet);
      },
      error: (err) => {
        console.error('❌ Error cerrando palet:', err);
      }
    });
  }

  abrirModalEliminarPalet(palet: Palet): void {
    if (confirm(`¿Está seguro que desea eliminar el palet #${palet.Id}?`)) {
      this.eliminarPalet(palet);
    }
  }

  eliminarPalet(palet: Palet): void {
    console.log('📋 Eliminando palet:', palet);
    
    this.paletService.eliminar(palet.Id).subscribe({
      next: (res) => {
        console.log('✅ Palet eliminado:', res);
        // Reload palets for the process
        const proceso = this.procesoSeleccionado();
        if (proceso) {
          this.seleccionarProceso(proceso);
        }
      },
      error: (err) => {
        console.error('❌ Error eliminando palet:', err);
      }
    });
  }

  reabrirPalet(palet: Palet): void {
    if (confirm(`¿Está seguro que desea reabrir el palet #${palet.Id}?`)) {
      console.log('📋 Reabriendo palet:', palet);
      
      this.paletService.reabrir(palet.Id).subscribe({
        next: (res) => {
          console.log('✅ Palet reabierto:', res);
          // Reload palet details
          this.verDetalle(palet);
        },
        error: (err) => {
          console.error('❌ Error reabriendo palet:', err);
        }
      });
    }
  }

  eliminarComposicion(composicion: Composicion): void {
    if (confirm(`¿Está seguro que desea eliminar esta composición?`)) {
      console.log('📋 Eliminando composición:', composicion);
      
      this.paletService.eliminarComposicion(composicion.Id).subscribe({
        next: (res) => {
          console.log('✅ Composición eliminada:', res);
          // Reload composiciones for the palet
          const palet = this.paletSeleccionado();
          if (palet) {
            this.verDetalle(palet);
          }
        },
        error: (err) => {
          console.error('❌ Error eliminando composición:', err);
        }
      });
    }
  }

  // UI helpers
  updateFormCajas(field: string, value: unknown): void {
    this.formCajas.update(f => ({ ...f, [field]: value }));
  }

  // ═══════ CASCADING SELECTS (MatrizCompatibilidad) ═══════

  // 1️⃣ CONSIGNATARIO → DESTINOS
  onConsignatarioChange(value: string): void {
    const consignatarioId = parseInt(value) || 0;
    this.updateFormCajas('consignatarioId', consignatarioId);
    // Reset all dependent fields
    this.filteredDestinos.set([]);
    this.filteredFormatos.set([]);
    this.filteredTiposEmpaqueGuia.set([]);
    this.filteredPresentaciones.set([]);
    this.filteredTiposCaja.set([]);
    this.filteredTiposClamshell.set([]);
    this.filteredCodigosRancho.set([]);
    this.updateFormCajas('destinoId', 0);
    this.updateFormCajas('formatoId', 0);
    this.updateFormCajas('tipoEmpaqueGuiaId', 0);
    this.updateFormCajas('presentacionId', 0);
    this.updateFormCajas('tipoCajaId', 0);
    this.updateFormCajas('tipoClamshellId', 0);
    this.updateFormCajas('calibreId', 0);
    this.updateFormCajas('categoriaId', 0);
    this.updateFormCajas('tipoEmpaqueId', 0);
    this.updateFormCajas('codigoRanchoId', 0);

    if (!consignatarioId) return;
    this.catalogoService.listarDestinos({ consignatarioId }).subscribe({
      next: (r: any) => { this.filteredDestinos.set(Array.isArray(r) ? r : r?.data ?? []); },
      error: () => { this.filteredDestinos.set([]); }
    });
    // Also reload codigos rancho if LDP already selected
    if (this.formCajas().lugarProduccionId) {
      this.loadCodigosRancho(this.formCajas().lugarProduccionId, consignatarioId);
    }
  }

  // 2️⃣ DESTINO → FORMATOS
  onDestinoChange(value: string): void {
    const destinoId = parseInt(value) || 0;
    this.updateFormCajas('destinoId', destinoId);
    this.filteredFormatos.set([]);
    this.filteredTiposEmpaqueGuia.set([]);
    this.filteredPresentaciones.set([]);
    this.filteredTiposCaja.set([]);
    this.filteredTiposClamshell.set([]);
    this.updateFormCajas('formatoId', 0);
    this.updateFormCajas('tipoEmpaqueGuiaId', 0);
    this.updateFormCajas('presentacionId', 0);
    this.updateFormCajas('tipoCajaId', 0);
    this.updateFormCajas('tipoClamshellId', 0);
    this.updateFormCajas('calibreId', 0);
    this.updateFormCajas('tipoEmpaqueId', 0);

    if (!destinoId) return;
    const consignatarioId = this.formCajas().consignatarioId;
    this.catalogoService.listarFormatos({ consignatarioId, destinoId }).subscribe({
      next: (r: any) => { this.filteredFormatos.set(Array.isArray(r) ? r : r?.data ?? []); },
      error: () => { this.filteredFormatos.set([]); }
    });
  }

  // 3️⃣ FORMATO → TIPOS EMPAQUE GUÍA
  onFormatoChange(value: string): void {
    const formatoId = parseInt(value) || 0;
    this.updateFormCajas('formatoId', formatoId);
    this.filteredTiposEmpaqueGuia.set([]);
    this.filteredPresentaciones.set([]);
    this.filteredTiposCaja.set([]);
    this.filteredTiposClamshell.set([]);
    this.updateFormCajas('tipoEmpaqueGuiaId', 0);
    this.updateFormCajas('presentacionId', 0);
    this.updateFormCajas('tipoCajaId', 0);
    this.updateFormCajas('tipoClamshellId', 0);
    this.updateFormCajas('calibreId', 0);
    this.updateFormCajas('tipoEmpaqueId', 0);

    if (!formatoId) return;
    const f = this.formCajas();
    this.catalogoService.listarTiposEmpaqueGuia({ consignatarioId: f.consignatarioId, destinoId: f.destinoId, formatoId }).subscribe({
      next: (r: any) => { this.filteredTiposEmpaqueGuia.set(Array.isArray(r) ? r : r?.data ?? []); },
      error: () => { this.filteredTiposEmpaqueGuia.set([]); }
    });
  }

  // 4️⃣ TIPO EMPAQUE GUÍA → PRESENTACIONES
  onTipoEmpaqueGuiaChange(value: string): void {
    const tipoEmpaqueGuiaId = parseInt(value) || 0;
    this.updateFormCajas('tipoEmpaqueGuiaId', tipoEmpaqueGuiaId);
    this.filteredPresentaciones.set([]);
    this.filteredTiposCaja.set([]);
    this.filteredTiposClamshell.set([]);
    this.updateFormCajas('presentacionId', 0);
    this.updateFormCajas('tipoCajaId', 0);
    this.updateFormCajas('tipoClamshellId', 0);
    this.updateFormCajas('calibreId', 0);
    this.updateFormCajas('tipoEmpaqueId', 0);

    if (!tipoEmpaqueGuiaId) return;
    const f = this.formCajas();
    this.catalogoService.listarPresentaciones({ consignatarioId: f.consignatarioId, destinoId: f.destinoId, formatoId: f.formatoId, tipoEmpaqueGuiaId }).subscribe({
      next: (r: any) => {
        const items = Array.isArray(r) ? r : r?.data ?? [];
        this.filteredPresentaciones.set(items);
        // Auto-select if only one or none
        if (items.length === 1) {
          const autoVal = items[0].Id ?? 0;
          this.updateFormCajas('presentacionId', autoVal);
          this.loadTiposCajaDinamicos(autoVal);
        } else if (items.length === 0) {
          this.updateFormCajas('presentacionId', 0);
          this.loadTiposCajaDinamicos(null);
        }
      },
      error: () => { this.filteredPresentaciones.set([]); }
    });
  }

  // 5️⃣ PRESENTACIÓN → TIPOS CAJA (via TiposDesdeMatriz)
  onPresentacionChange(value: string): void {
    const presentacionId = (!value || value === 'NA' || value === '0') ? null : parseInt(value);
    this.updateFormCajas('presentacionId', presentacionId ?? 0);
    this.filteredTiposCaja.set([]);
    this.filteredTiposClamshell.set([]);
    this.updateFormCajas('tipoCajaId', 0);
    this.updateFormCajas('tipoClamshellId', 0);
    this.updateFormCajas('calibreId', 0);
    this.updateFormCajas('tipoEmpaqueId', 0);
    this.loadTiposCajaDinamicos(presentacionId);
  }

  private loadTiposCajaDinamicos(presentacionId: number | null): void {
    const f = this.formCajas();
    this.catalogoService.listarTiposDesdeMatriz({
      consignatarioId: f.consignatarioId, destinoId: f.destinoId,
      formatoId: f.formatoId, tipoEmpaqueGuiaId: f.tipoEmpaqueGuiaId,
      presentacionId: presentacionId
    }).subscribe({
      next: (r: any) => {
        const items = Array.isArray(r) ? r : r?.data ?? [];
        // Extract unique TipoCaja from matrix results
        const cajaMap = new Map<number, any>();
        items.forEach((i: any) => { if (i.TipoCajaId) cajaMap.set(i.TipoCajaId, { Id: i.TipoCajaId, Nombre: i.TipoCajaNombre }); });
        this.filteredTiposCaja.set(Array.from(cajaMap.values()));
        // Store full matrix results for later filtering
        this._matrizResults = items;
      },
      error: () => { this.filteredTiposCaja.set([]); }
    });
  }

  private _matrizResults: any[] = [];

  // 6️⃣ TIPO CAJA → TIPOS CLAMSHELL (filter from matrix results)
  onTipoCajaChange(value: string): void {
    const tipoCajaId = parseInt(value) || 0;
    this.updateFormCajas('tipoCajaId', tipoCajaId);
    this.filteredTiposClamshell.set([]);
    this.updateFormCajas('tipoClamshellId', 0);
    this.updateFormCajas('calibreId', 0);
    this.updateFormCajas('tipoEmpaqueId', 0);

    if (!tipoCajaId) return;
    const clamshellMap = new Map<number, any>();
    this._matrizResults
      .filter((i: any) => i.TipoCajaId === tipoCajaId)
      .forEach((i: any) => { if (i.TipoClamshellId) clamshellMap.set(i.TipoClamshellId, { Id: i.TipoClamshellId, Nombre: i.TipoClamshellNombre }); });
    this.filteredTiposClamshell.set(Array.from(clamshellMap.values()));
  }

  // 7️⃣ TIPO CLAMSHELL → AUTO-FILL calibre, tipoEmpaque
  onTipoClamshellChange(value: string): void {
    const tipoClamshellId = parseInt(value) || 0;
    this.updateFormCajas('tipoClamshellId', tipoClamshellId);

    if (!tipoClamshellId) {
      this.updateFormCajas('calibreId', 0);
      this.updateFormCajas('categoriaId', 0);
      this.updateFormCajas('tipoEmpaqueId', 0);
      return;
    }
    const tipoCajaId = this.formCajas().tipoCajaId;
    const match = this._matrizResults.find((i: any) => i.TipoCajaId === tipoCajaId && i.TipoClamshellId === tipoClamshellId);
    if (match) {
      this.updateFormCajas('calibreId', match.CalibreId || 0);
      this.updateFormCajas('tipoEmpaqueId', match.TipoEmpaqueId || 0);
    }
  }

  onVariedadChange(value: string): void {
    this.updateFormCajas('variedadId', parseInt(value) || 0);
  }

  onEsEnsayoChange(checked: boolean): void {
    this.updateFormCajas('esEnsayo', checked);
  }

  onLugarProduccionChange(value: string): void {
    const lugarProduccionId = parseInt(value) || 0;
    this.updateFormCajas('lugarProduccionId', lugarProduccionId);
    this.loadCodigosRancho(lugarProduccionId, this.formCajas().consignatarioId);
  }

  loadCodigosRancho(lugarProduccionId: number, consignatarioId: number): void {
    console.log('📋 Cargando códigos rancho para:', { lugarProduccionId, consignatarioId });
    console.log(this.lugaresProduccion())
    console.log(this.consignatarios())
    
    if (!lugarProduccionId || !consignatarioId) {
      this.filteredCodigosRancho.set([]);
      this.updateFormCajas('codigoRanchoId', 0);
      return;
    }

    const formato = {
      lugarProduccionId,
      consignatarioId
    };

    this.catalogoService.listarCodigosRancho(formato).subscribe({
      next: (r: any) => {
        console.log('✅ Códigos rancho response:', r);
        
        // Manejar respuesta como el sistema original: {success: true, codigosRancho: [...]}
        const codigos = r?.codigosRancho || r?.data || r || [];
        const codigosArray = Array.isArray(codigos) ? codigos : [];
        
        console.log('✅ Códigos rancho procesados:', codigosArray);
        this.filteredCodigosRancho.set(codigosArray);
        
        if (codigosArray.length === 1) {
          // Auto-seleccionar y deshabilitar (como en el código jQuery)
          const codigo = codigosArray[0];
          console.log('🔒 Auto-seleccionando único código:', codigo);
          this.updateFormCajas('codigoRanchoId', codigo.Id);
        } else if (codigosArray.length === 0) {
          // Sin códigos disponibles
          console.log('⚠️ Sin códigos disponibles');
          this.updateFormCajas('codigoRanchoId', 0);
        } else {
          // Múltiples códigos - permitir selección
          console.log('📋 Múltiples códigos disponibles, permitiendo selección');
          this.updateFormCajas('codigoRanchoId', 0);
        }
      },
      error: (err: any) => {
        console.error('❌ Error cargando códigos rancho:', err);
        this.filteredCodigosRancho.set([]);
        this.updateFormCajas('codigoRanchoId', 0);
      }
    });
  }

  // Computed properties for form validation
  readonly destinoDisabled = computed(() => !this.formCajas().consignatarioId);
  readonly formatoDisabled = computed(() => !this.formCajas().destinoId);
  readonly tipoEmpaqueGuiaDisabled = computed(() => !this.formCajas().formatoId);
  readonly presentacionDisabled = computed(() => !this.formCajas().tipoEmpaqueGuiaId);
  readonly tipoCajaDisabled = computed(() => this.filteredTiposCaja().length === 0);
  readonly tipoClamshellDisabled = computed(() => this.filteredTiposClamshell().length === 0);
  readonly codigoRanchoDisabled = computed(() => !this.formCajas().lugarProduccionId || !this.formCajas().consignatarioId);

  // UI helpers
  toggleSeccionActivos(): void {
    this.seccionActivosAbierta.update(abierta => !abierta);
  }

  toggleSeccionDespachados(): void {
    this.seccionDespachadosAbierta.update(abierta => !abierta);
  }

  toggleSeccionComposicion(): void {
    this.seccionComposicionAbierta.update(abierta => !abierta);
  }

  toggleSeccionObservaciones(): void {
    this.seccionObservacionesAbierta.update(abierta => !abierta);
  }

  formatearFechaLarga(fecha: string): string {
    if (!fecha) return '';
    try {
      const date = new Date(fecha);
      return date.toLocaleDateString('es-ES', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return fecha;
    }
  }

  getEstadoBadgeClass(estado: string): string {
    switch (estado) {
      case 'ABIERTO': return 'bg-blue-100 text-blue-800';
      case 'CERRADO': return 'bg-purple-100 text-purple-800';
      case 'DESPACHADO': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  getEstadoLabel(estado: string): string {
    switch (estado) {
      case 'ABIERTO': return 'ABIERTO';
      case 'CERRADO': return 'CERRADO';
      case 'DESPACHADO': return 'DESPACHADO';
      default: return 'DESCONOCIDO';
    }
  }
}
