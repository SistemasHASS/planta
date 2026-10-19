/** Un cliente con los datos de su destinatario (domicilio y punto de llegada), tal como lo devuelve el servidor. */
export interface DestinatarioAdmin {
  /** 0 = el cliente todavía no tiene destinatario configurado. */
  id: number;
  idCliente: number;
  documentoFiscal: string;
  documento: string;
  tipoDocumento: string;
  nombre: string;
  esCliente: string;
  domicilioFiscal: string;
  puntoLlegada: string;
  domicilioFiscalDepartamento: string;
  domicilioFiscalProvincia: string;
  domicilioFiscalDistrito: string;
  puntoLlegadaDepartamento: string;
  puntoLlegadaProvincia: string;
  puntoLlegadaDistrito: string;
  activo: boolean;
}

/** Arma lo que espera el servidor para guardar un destinatario (texto JSON de una lista de uno). */
export function destinatarioAJson(d: DestinatarioAdmin): string {
  return JSON.stringify([
    {
      id: d.id,
      idCliente: d.idCliente,
      documentoFiscal: d.documentoFiscal,
      documento: d.documento || d.documentoFiscal,
      domicilioFiscal: d.domicilioFiscal,
      puntoLlegada: d.puntoLlegada,
      domicilioFiscalDistrito: d.domicilioFiscalDistrito,
      puntoLlegadaDistrito: d.puntoLlegadaDistrito,
      activo: d.activo,
      nombre: d.nombre,
      tipoDocumento: d.tipoDocumento,
      esCliente: d.esCliente,
    },
  ]);
}
