import { Injectable } from '@angular/core';
import Swal, { SweetAlertIcon } from 'sweetalert2';

@Injectable({
  providedIn: 'root'
})
export class AlertService {

  showAlertAcept(title: string, message: string, icon: SweetAlertIcon): void {
    Swal.fire({
      title: title,
      html: message,
      icon: icon,
      confirmButtonText: 'Aceptar',
      allowOutsideClick: false
    });
  }

  showAlert(title: string, message: string, icon: SweetAlertIcon): void {
    Swal.fire({
      title: title,
      html: message,
      icon: icon,
      timer: 5000,
      showConfirmButton: false
    });
  }

  mostrarModalCarga(): void {
    Swal.fire({
      title: 'Espere, por favor...',
      html: '',
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });
  }

  cerrarModalCarga(): void {
    Swal.close();
  }

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

  showOptions(
    title: string,
    message: string,
    icon: SweetAlertIcon,
    confirmText: string,
    cancelText: string
  ): Promise<boolean> {
    return Swal.fire({
      title,
      html: message,
      icon,
      showCancelButton: true,
      allowOutsideClick: false,
      confirmButtonText: confirmText,
      cancelButtonText: cancelText,
    }).then((result) => result.isConfirmed);
  }
}
