import { Injectable } from '@angular/core';
import moment from 'moment';

@Injectable({
  providedIn: 'root'
})
export class UtilsService {

  constructor() { }

  logMessage(message: string): void {
    console.log(`[LOG]: ${message}`);
  }

  FormatoHorasDecimal(horas: string) {
    const [horasStr, minutosStr] = horas.split(":");
    const horastotal = parseInt(horasStr, 10);
    const minutos = parseInt(minutosStr, 10);
    if (isNaN(horastotal) || isNaN(minutos)) {
      throw new Error("Formato de hora inválido. Debe ser 'HH:mm'.");
    }
    const resultado = horastotal + minutos / 60;
    return Number(resultado.toFixed(2) || 0);
  }

  formatDate1(date:any){
    return date?moment(date).format('DD/MM/YYYY'):'';
  }

  convertirFechaAISO(date: string): string {
    return date?moment(date, 'DD/MM/YYYY').format('YYYY-MM-DD'):'';
  }

  formatDate2(date:any){
    return date?moment(date).format('YYYY-DD-MM'):'';
  }

  formatDate3(date:any){
    return date?moment(date).format('YYYY-MM-DD'):'';
  }

  formatoHora(date:any){
    return date?moment(date).format('HH:mm'):''
  }

  formatoTotalMinutos(date:any){
    return date?moment(date).format('HH:mm'):0
  }

  formatoAnioMesDia(date?: any) {
    return date?moment(date).format('YYYYMMDD'):moment(new Date()).format('YYYYMMDD')
  }

  formatoAnioMesDiaHoraMinSec() {
    return moment(new Date()).format('YYYYMMDDhhmmss')
  }

  formatDateSec(date?:any){
    return date?moment(date).format('YYYY-DD-MM hh:mm:ss'):moment(new Date()).format('YYYY-DD-MM hh:mm:ss');
  }

  bajarLetras(text: string): string {
    return text.toLowerCase(); 
  }

}
