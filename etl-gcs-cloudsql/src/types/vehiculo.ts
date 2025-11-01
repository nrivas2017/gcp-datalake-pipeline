interface PermisoCirculacionData {
  municipalidad?: string;
  fecha_emision?: string;
  fecha_vencimiento?: string;
}

interface SoapData {
  numero_poliza?: number;
  institucion_aseguradora?: string;
  fecha_vencimiento_poliza?: string;
}

interface CertificadoAnotacionesData {
  folio?: string;
  codigo_verificacion?: string;
  fecha_emision?: string;
  limitaciones_al_dominio?: string;
  datos_propietario_actual?: {
    nombre?: string;
    rut?: string;
    fecha_adquisicion?: string;
  };
}
