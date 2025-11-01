interface HojaVidaData {
  persona?: {
    run?: string;
    comuna?: string;
    nombre?: string;
    domicilio?: string;
    fechaNacimiento?: string;
    restriccionesLicencia?: {
      fechaAnotacion?: string;
      bloqueRestriccionLicencia?: string;
    }[];
    duracionesRestringidas?: {
      fechaAnotacion?: string;
      bloqueDuracionRestringida?: string;
    }[];
    infraccionesRegistradas?: {
      año?: string;
      nroParte?: string;
      tribunal?: string;
      vehiculo?: string;
      upolicial?: string;
      infraccion?: string;
      resolucion?: string;
      fechaDenuncia?: string;
      procesoNumero?: string;
      fechaResolucion?: string;
    }[];
  };
  certificado?: {
    folio?: string;
    fechaEmision?: string;
    codigoVerificacion?: string;
  };
}

interface LicenciaFrontalData {
  clase?: string[];
  nombre?: string;
  apellidos?: string;
  rut?: string;
  municipalidad?: string;
  direccion?: string;
  fecha_ultimo_control?: string;
  fecha_de_control?: string;
}

interface LicenciaReversoData {
  codigo?: string;
  restricciones?: string;
}
