import { Injectable } from '@angular/core';
import Swal, { SweetAlertIcon } from 'sweetalert2';

@Injectable({
  providedIn: 'root'
})
export class AlertService {

  constructor() { }

  /**
   * Muestra una alerta SweetAlert2.
   * @param title Título de la alerta.
   * @param message Mensaje de la alerta.
   * @param icon Tipo de icono (success, error, warning, info, question).
   */
  showAlertAcept(title: string, message: string, icon: SweetAlertIcon) {
    Swal.fire({
      title: title,
      html: message,
      icon: icon,
      confirmButtonText: 'Aceptar',
      allowOutsideClick: false
    });
  }

  showAlert(title: string, message: string, icon: SweetAlertIcon) {
    Swal.fire({
      title: title,
      html: message,
      icon: icon,
      timer: 2000,
      showConfirmButton: false
    })
  }

  mostrarModalCarga() {
    Swal.fire({
      title: 'Espere, por favor...',
      html: ``,
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });
  }

  cerrarModalCarga() {
    Swal.close();
  }

  /**
   * Muestra una alerta de confirmación con botones.
   * @param title Título de la alerta.
   * @param message Mensaje de la alerta.
   * @param icon Tipo de icono.
   * @returns Una promesa que devuelve `true` si se confirma o `false` si se cancela.
   */
  showConfirm(title: string, message: string, icon: SweetAlertIcon): Promise<boolean> {
    return Swal.fire({
      title: title,
      text: message,
      icon: icon,
      showCancelButton: true,
      cancelButtonText: 'Cancelar',
      confirmButtonText: 'Aceptar',
      allowOutsideClick: false
    }).then((result) => {
      return result.isConfirmed;
    });
  }
}
