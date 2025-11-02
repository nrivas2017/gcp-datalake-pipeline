-- Crear procedimiento para actualizar columnas 'date_updated'
CREATE OR REPLACE FUNCTION update_timestamp()
	RETURNS TRIGGER
	LANGUAGE plpgsql
AS $function$
BEGIN
	NEW.date_updated := now();
	RETURN NEW;
END;
$function$
;

----------------------------------------------------------------------------------
CREATE TABLE tipo_empresa
(
    carrier_type_id SERIAL PRIMARY KEY,
    carrier_type TEXT NOT NULL,
    date_created TIMESTAMP WITH TIME ZONE DEFAULT (now() AT TIME ZONE 'UTC'::text),
    date_updated TIMESTAMP WITH TIME ZONE DEFAULT (now() AT TIME ZONE 'UTC'::text)
);

CREATE TRIGGER trigger_date_updated_tipo_empresa
BEFORE UPDATE ON tipo_empresa
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

CREATE TABLE empresa
(
    carrier_id SERIAL PRIMARY KEY,
    carrier_name TEXT NOT NULL,
    carrier_rut TEXT NOT NULL,
    carrier_bp TEXT NOT NULL,
    carrier_type_id INTEGER CONSTRAINT fk_tipo_empresa REFERENCES tipo_empresa (carrier_type_id),
    date_created TIMESTAMP WITH TIME ZONE DEFAULT (now() AT TIME ZONE 'UTC'::text),
    date_updated TIMESTAMP WITH TIME ZONE DEFAULT (now() AT TIME ZONE 'UTC'::text),
    CONSTRAINT uq_carrier_bp UNIQUE (carrier_bp)
);

CREATE TRIGGER trigger_date_updated_empresa
BEFORE UPDATE ON empresa
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();
----------------------------------------------------------------------------------


----------------------------------------------------------------------------------
CREATE TABLE tipo_designacion
(
    vehicle_designation_id SERIAL PRIMARY KEY,
    vehicle_designation TEXT NOT NULL,
    date_created TIMESTAMP WITH TIME ZONE DEFAULT (now() AT TIME ZONE 'UTC'::text),
    date_updated TIMESTAMP WITH TIME ZONE DEFAULT (now() AT TIME ZONE 'UTC'::text),
    CONSTRAINT uq_vehicle_designation UNIQUE (vehicle_designation)
);

CREATE TRIGGER trigger_date_updated_tipo_designacion
BEFORE UPDATE ON tipo_designacion
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

CREATE TABLE tipo_vehiculo
(
    vehicle_type_id SERIAL PRIMARY KEY,
    vehicle_type TEXT NOT NULL,
    date_created TIMESTAMP WITH TIME ZONE DEFAULT (now() AT TIME ZONE 'UTC'::text),
    date_updated TIMESTAMP WITH TIME ZONE DEFAULT (now() AT TIME ZONE 'UTC'::text),
    CONSTRAINT uq_vehicle_type UNIQUE (vehicle_type)
);


CREATE TRIGGER trigger_date_updated_tipo_vehiculo
BEFORE UPDATE ON tipo_vehiculo
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

CREATE TABLE vehiculo_marca
(
    vehicle_brand_id SERIAL PRIMARY KEY,
    vehicle_brand TEXT NOT NULL,
    date_created TIMESTAMP WITH TIME ZONE DEFAULT (now() AT TIME ZONE 'UTC'::text),
    date_updated TIMESTAMP WITH TIME ZONE DEFAULT (now() AT TIME ZONE 'UTC'::text),
    CONSTRAINT uq_vehicle_brand UNIQUE (vehicle_brand)
);


CREATE TRIGGER trigger_date_updated_vehiculo_marca
BEFORE UPDATE ON vehiculo_marca
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

CREATE TABLE vehiculo_modelo
(
    vehicle_model_id SERIAL PRIMARY KEY,
    vehicle_model TEXT NOT NULL,
    vehicle_brand_id INTEGER CONSTRAINT fk_vehiculo_marca REFERENCES vehiculo_marca (vehicle_brand_id),
    date_created TIMESTAMP WITH TIME ZONE DEFAULT (now() AT TIME ZONE 'UTC'::text),
    date_updated TIMESTAMP WITH TIME ZONE DEFAULT (now() AT TIME ZONE 'UTC'::text),
    CONSTRAINT uq_model UNIQUE (vehicle_model, vehicle_brand_id)
);

CREATE TRIGGER trigger_date_updated_vehiculo_modelo
BEFORE UPDATE ON vehiculo_modelo
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

CREATE TABLE vehiculo
(
    vehicle_id SERIAL PRIMARY KEY,
    registration_plate TEXT NOT NULL ,
    carrier_id INTEGER CONSTRAINT fk_empresa REFERENCES empresa (carrier_id),
    year_of_manufacture INTEGER,
    gps BOOLEAN,
    engine_number TEXT,
    chassis_number TEXT,
    vin TEXT,
    odometer_km INTEGER,
    cortina TEXT,
    instalacion_cortina DATE,
    parrilla BOOLEAN,
    peso NUMERIC,
    largo NUMERIC,
    ancho NUMERIC,
    alto NUMERIC,
    mop_clasification TEXT,
    nominal_pallet INTEGER,
    vehicle_type_id INTEGER CONSTRAINT fk_tipo_vehiculo REFERENCES tipo_vehiculo (vehicle_type_id),
    vehicle_designation_id INTEGER CONSTRAINT fk_tipo_designacion REFERENCES tipo_designacion (vehicle_designation_id),
    vehicle_model_id INTEGER CONSTRAINT fk_vehiculo_modelo REFERENCES vehiculo_modelo (vehicle_model_id),
    date_created TIMESTAMP WITH TIME ZONE DEFAULT (now() AT TIME ZONE 'UTC'::text),
    date_updated TIMESTAMP WITH TIME ZONE DEFAULT (now() AT TIME ZONE 'UTC'::text),
    CONSTRAINT uq_vehiculo UNIQUE (registration_plate)
);




CREATE TRIGGER trigger_date_vehiculo
BEFORE UPDATE ON vehiculo
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

CREATE TABLE certificado_anotaciones_vigentes
(
		certificado_anotaciones_vigentes_id SERIAL PRIMARY KEY,
    vehicle_id INTEGER CONSTRAINT fk_vehiculo REFERENCES vehiculo (vehicle_id),
    folio TEXT,
    codigo_verificacion TEXT,
    fecha_emision DATE,
    limitaciones_al_dominio TEXT,
    nombre_propietario TEXT,
    rut_propietario TEXT,
    fecha_adquisicion DATE,
    date_created TIMESTAMP WITH TIME ZONE DEFAULT (now() AT TIME ZONE 'UTC'::text),
    date_updated TIMESTAMP WITH TIME ZONE DEFAULT (now() AT TIME ZONE 'UTC'::text)
);

CREATE TRIGGER trigger_certificado_anotaciones_vigentes
BEFORE UPDATE ON certificado_anotaciones_vigentes
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

CREATE TABLE soap
(
		soap_id SERIAL PRIMARY KEY,
    vehicle_id INTEGER CONSTRAINT fk_vehiculo REFERENCES vehiculo (vehicle_id),
    numero_poliza BIGINT,
    institucion_aseguradora TEXT,
    fecha_vencimiento_poliza DATE,
    date_created TIMESTAMP WITH TIME ZONE DEFAULT (now() AT TIME ZONE 'UTC'::text),
    date_updated TIMESTAMP WITH TIME ZONE DEFAULT (now() AT TIME ZONE 'UTC'::text)
);

CREATE TRIGGER trigger_soap
BEFORE UPDATE ON soap
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

CREATE TABLE permiso_circulacion
(
		permiso_circulacion_id SERIAL PRIMARY KEY,
    vehicle_id INTEGER CONSTRAINT fk_vehiculo REFERENCES vehiculo (vehicle_id),
    municipalidad TEXT,
    fecha_emision DATE,
    fecha_vencimiento DATE,
    date_created TIMESTAMP WITH TIME ZONE DEFAULT (now() AT TIME ZONE 'UTC'::text),
    date_updated TIMESTAMP WITH TIME ZONE DEFAULT (now() AT TIME ZONE 'UTC'::text)
);

CREATE TRIGGER trigger_permiso_circulacion
BEFORE UPDATE ON permiso_circulacion
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

CREATE TABLE revision_tecnica
(
		revision_tecnica_id SERIAL PRIMARY KEY,
    vehicle_id INTEGER CONSTRAINT fk_vehiculo REFERENCES vehiculo (vehicle_id),
    fecha_revision_tecnica DATE,
    fecha_vencimiento_revision_tecnica DATE,
    emissions_crt_status BOOLEAN,
    identification_status BOOLEAN,
    visual_status BOOLEAN,
    lights_status BOOLEAN,
    alignment_status BOOLEAN,
    brakes_status BOOLEAN,
    clearances_status BOOLEAN,
    emissions_status BOOLEAN,
    opacity_status BOOLEAN,
    steering_angle_status BOOLEAN,
    noise_status BOOLEAN,
    suspension_status BOOLEAN,
    date_created TIMESTAMP WITH TIME ZONE DEFAULT (now() AT TIME ZONE 'UTC'::text),
    date_updated TIMESTAMP WITH TIME ZONE DEFAULT (now() AT TIME ZONE 'UTC'::text)
);

CREATE TRIGGER trigger_revision_tecnica
BEFORE UPDATE ON revision_tecnica
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();
----------------------------------------------------------------------------------


----------------------------------------------------------------------------------
CREATE TABLE conductor_rol
(
		conductor_rol_id SERIAL PRIMARY KEY,
    conductor_rol TEXT NOT NULL,
    date_created TIMESTAMP WITH TIME ZONE DEFAULT (now() AT TIME ZONE 'UTC'::text),
    date_updated TIMESTAMP WITH TIME ZONE DEFAULT (now() AT TIME ZONE 'UTC'::text),
    CONSTRAINT uq_conductor_rol UNIQUE (conductor_rol)
);

CREATE TRIGGER trigger_conductor_rol
BEFORE UPDATE ON conductor_rol
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

CREATE TABLE conductor
(
		conductor_id SERIAL PRIMARY KEY,
    carrier_id INTEGER CONSTRAINT fk_empresa REFERENCES empresa (carrier_id),
    conductor_rol_id INTEGER CONSTRAINT fk_conductor_rol REFERENCES conductor_rol (conductor_rol_id),
    conductor_nombre TEXT,
    conductor_rut TEXT NOT NULL ,
    conductor_fecha_nacimiento DATE,
    conductor_telefono TEXT,
    conductor_email TEXT,
    date_created TIMESTAMP WITH TIME ZONE DEFAULT (now() AT TIME ZONE 'UTC'::text),
    date_updated TIMESTAMP WITH TIME ZONE DEFAULT (now() AT TIME ZONE 'UTC'::text),
    CONSTRAINT uq_conductor UNIQUE (conductor_rut)
);


CREATE TRIGGER trigger_conductor
BEFORE UPDATE ON conductor
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

CREATE TABLE hoja_vida
(
		hoja_vida_id SERIAL PRIMARY KEY,
    conductor_id INTEGER CONSTRAINT fk_conductor REFERENCES conductor (conductor_id),
    folio TEXT,
    codigo_verificacion TEXT,
    fecha_emision DATE,
    comuna TEXT,
    domicilio TEXT,
    date_created TIMESTAMP WITH TIME ZONE DEFAULT (now() AT TIME ZONE 'UTC'::text),
    date_updated TIMESTAMP WITH TIME ZONE DEFAULT (now() AT TIME ZONE 'UTC'::text)
);

CREATE TRIGGER trigger_hoja_vida
BEFORE UPDATE ON hoja_vida
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

CREATE TABLE hoja_vida_restriccion
(
		hoja_vida_restriccion_id SERIAL PRIMARY KEY,
    hoja_vida_id INTEGER CONSTRAINT fk_hoja_vida REFERENCES hoja_vida (hoja_vida_id),
    fecha_anotacion DATE,
    restriccion TEXT,
    date_created TIMESTAMP WITH TIME ZONE DEFAULT (now() AT TIME ZONE 'UTC'::text),
    date_updated TIMESTAMP WITH TIME ZONE DEFAULT (now() AT TIME ZONE 'UTC'::text)
);

CREATE TRIGGER trigger_hoja_vida_restriccion
BEFORE UPDATE ON hoja_vida_restriccion
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

CREATE TABLE hoja_vida_infraccion
(
		hoja_vida_infraccion_id SERIAL PRIMARY KEY,
    hoja_vida_id INTEGER CONSTRAINT fk_hoja_vida REFERENCES hoja_vida (hoja_vida_id),
    proceso TEXT,
    tribunal TEXT,
    fecha_denuncia DATE,
    infraccion TEXT,
    resolucion TEXT,
    date_created TIMESTAMP WITH TIME ZONE DEFAULT (now() AT TIME ZONE 'UTC'::text),
    date_updated TIMESTAMP WITH TIME ZONE DEFAULT (now() AT TIME ZONE 'UTC'::text)
);

CREATE TRIGGER trigger_hoja_vida_infraccion
BEFORE UPDATE ON hoja_vida_infraccion
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

CREATE TABLE clase_licencia
(
		clase_licencia_id SERIAL PRIMARY KEY,
    clase_licencia TEXT,
    date_created TIMESTAMP WITH TIME ZONE DEFAULT (now() AT TIME ZONE 'UTC'::text),
    date_updated TIMESTAMP WITH TIME ZONE DEFAULT (now() AT TIME ZONE 'UTC'::text),
    CONSTRAINT uq_clase_licencia UNIQUE (clase_licencia)
);

CREATE TRIGGER trigger_clase_licencia
BEFORE UPDATE ON clase_licencia
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

CREATE TABLE licencia
(
		licencia_id SERIAL PRIMARY KEY,
    conductor_id INTEGER CONSTRAINT fk_conductor REFERENCES conductor (conductor_id),
    municipalidad TEXT,
    fecha_de_control DATE,
    fecha_ultimo_control DATE,
    codigo TEXT,
    date_created TIMESTAMP WITH TIME ZONE DEFAULT (now() AT TIME ZONE 'UTC'::text),
    date_updated TIMESTAMP WITH TIME ZONE DEFAULT (now() AT TIME ZONE 'UTC'::text)
);

CREATE TRIGGER trigger_licencia
BEFORE UPDATE ON licencia
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

CREATE TABLE licencia_clase
(
		licencia_clase_id SERIAL PRIMARY KEY,
    licencia_id INTEGER CONSTRAINT fk_licencia REFERENCES licencia (licencia_id),
    clase_licencia_id INTEGER CONSTRAINT fk_clase_licencia REFERENCES clase_licencia (clase_licencia_id),
    date_created TIMESTAMP WITH TIME ZONE DEFAULT (now() AT TIME ZONE 'UTC'::text),
    date_updated TIMESTAMP WITH TIME ZONE DEFAULT (now() AT TIME ZONE 'UTC'::text)
);

CREATE TRIGGER trigger_licencia_clase
BEFORE UPDATE ON licencia_clase
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();
----------------------------------------------------------------------------------
