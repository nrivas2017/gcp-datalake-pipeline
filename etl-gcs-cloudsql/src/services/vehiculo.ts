import {getDbPool} from '../db';
import {Storage} from '@google-cloud/storage';
import {parse} from 'csv-parse';
import {normalizeSpaces} from '../utils/string';
import {safeParseDate} from '../utils/date';
import {statusToBoolean, stringToBoolean} from '../utils/parser';
import {getOrCreateSimpleCatalog} from '../utils/sql';

const storage = new Storage();

export const procesarVehiculos = async (
  bucketName: string,
  fileName: string,
) => {
  const dbPool = await getDbPool();
  const client = await dbPool.connect();

  let rowCount = 0;
  let processedCount = 0;
  let errorCount = 0;

  console.log(`Iniciando procesamiento de vehículos: ${fileName}`);

  try {
    console.log('Cargando cachés de catálogos...');

    // Cache de Empresas (carrier_bp -> carrier_id)
    const empresaCache = new Map<string, number>();
    const resEmpresas = await client.query(
      'SELECT carrier_id, carrier_bp FROM empresa WHERE carrier_bp IS NOT NULL',
    );
    for (const row of resEmpresas.rows) {
      empresaCache.set(row.carrier_bp, row.carrier_id);
    }
    console.log(`Cache 'empresa' cargado con ${empresaCache.size} registros.`);

    // Cache de Tipos de Vehículo
    const tipoVehiculoCache = new Map<string, number>();
    const resTipos = await client.query(
      'SELECT vehicle_type_id, vehicle_type FROM tipo_vehiculo',
    );
    for (const row of resTipos.rows) {
      tipoVehiculoCache.set(row.vehicle_type, row.vehicle_type_id);
    }
    console.log(
      `Cache 'tipo_vehiculo' cargado con ${tipoVehiculoCache.size} registros.`,
    );

    // Cache de Designaciones
    const tipoDesignacionCache = new Map<string, number>();
    const resDesignaciones = await client.query(
      'SELECT vehicle_designation_id, vehicle_designation FROM tipo_designacion',
    );
    for (const row of resDesignaciones.rows) {
      tipoDesignacionCache.set(
        row.vehicle_designation,
        row.vehicle_designation_id,
      );
    }
    console.log(
      `Cache 'tipo_designacion' cargado con ${tipoDesignacionCache.size} registros.`,
    );

    // Cache de Marcas
    const marcaCache = new Map<string, number>();
    const resMarcas = await client.query(
      'SELECT vehicle_brand_id, vehicle_brand FROM vehiculo_marca',
    );
    for (const row of resMarcas.rows) {
      marcaCache.set(row.vehicle_brand, row.vehicle_brand_id);
    }
    console.log(
      `Cache 'vehiculo_marca' cargado con ${marcaCache.size} registros.`,
    );

    // Cache de Modelos (Clave: "Marca|Modelo" -> model_id)
    const modeloCache = new Map<string, number>();
    const resModelos = await client.query(`
      SELECT m.vehicle_model_id, m.vehicle_model, b.vehicle_brand
      FROM vehiculo_modelo m
      JOIN vehiculo_marca b ON m.vehicle_brand_id = b.vehicle_brand_id
    `);
    for (const row of resModelos.rows) {
      modeloCache.set(
        `${row.vehicle_brand}|${row.vehicle_model}`,
        row.vehicle_model_id,
      );
    }
    console.log(
      `Cache 'vehiculo_modelo' cargado con ${modeloCache.size} registros.`,
    );

    const parser = storage
      .bucket(bucketName)
      .file(fileName)
      .createReadStream()
      .pipe(
        parse({
          columns: true,
          skip_empty_lines: true,
          trim: true,
          relax_column_count: true,
          bom: true,
          delimiter: ';',
        }),
      );

    for await (const record of parser) {
      rowCount++;
      const plate = normalizeSpaces(record.registration_plate) as string;
      const carrierBp = normalizeSpaces(record.carrier_bp) as string;

      await client.query('BEGIN');
      console.log(`[Fila ${rowCount + 1}] Transacción iniciada.`);

      const carrierId = empresaCache.get(carrierBp);
      if (!carrierId) {
        console.warn(
          `[Fila ${rowCount + 1}] Empresa con carrier_bp '${carrierBp}' no encontrada para patente '${plate}'. Omitiendo.`,
        );
        errorCount++;
        continue;
      }

      if (!plate) {
        console.warn(
          `[Fila ${rowCount + 1}] Patente no encontrada. Omitiendo.`,
        );
        errorCount++;
        continue;
      }

      try {
        const vehicleTypeId = await getOrCreateSimpleCatalog(
          client,
          tipoVehiculoCache,
          normalizeSpaces(record.vehicle_type) as string,
          'tipo_vehiculo',
          'vehicle_type',
          'vehicle_type_id',
        );

        const designationId = await getOrCreateSimpleCatalog(
          client,
          tipoDesignacionCache,
          normalizeSpaces(record.vehicle_designation) as string,
          'tipo_designacion',
          'vehicle_designation',
          'vehicle_designation_id',
        );

        const brandId = await getOrCreateSimpleCatalog(
          client,
          marcaCache,
          normalizeSpaces(record.vehicle_make) as string,
          'vehiculo_marca',
          'vehicle_brand',
          'vehicle_brand_id',
        );

        const brandName = normalizeSpaces(record.vehicle_make);
        const modelName = normalizeSpaces(record.vehicle_model);
        const modelKey = `${brandName}|${modelName}`;

        let modelId = modeloCache.get(modelKey);
        if (!modelId) {
          console.log(
            `Creando nuevo vehiculo_modelo: '${modelName}' para marca '${brandName}'`,
          );
          const res = await client.query(
            'INSERT INTO vehiculo_modelo (vehicle_brand_id, vehicle_model) VALUES ($1, $2) RETURNING vehicle_model_id',
            [brandId, modelName],
          );
          modelId = res.rows[0].vehicle_model_id as number;
          modeloCache.set(modelKey, modelId);
        }

        const upsertQuery = `
          INSERT INTO vehiculo (
            registration_plate, year_of_manufacture, gps, engine_number, chassis_number, 
            vin, odometer_km, cortina, instalacion_cortina, parrilla, 
            peso, largo, ancho, alto, mop_clasification, 
            nominal_pallet, vehicle_type_id, vehicle_designation_id, 
            vehicle_model_id, carrier_id
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 
            $14, $15, $16, $17, $18, $19, $20
          )
          ON CONFLICT (registration_plate) 
          DO UPDATE SET
            year_of_manufacture = EXCLUDED.year_of_manufacture,
            gps = EXCLUDED.gps,
            engine_number = EXCLUDED.engine_number,
            chassis_number = EXCLUDED.chassis_number,
            vin = EXCLUDED.vin,
            odometer_km = EXCLUDED.odometer_km,
            cortina = EXCLUDED.cortina,
            instalacion_cortina = EXCLUDED.instalacion_cortina,
            parrilla = EXCLUDED.parrilla,
            peso = EXCLUDED.peso,
            largo = EXCLUDED.largo,
            ancho = EXCLUDED.ancho,
            alto = EXCLUDED.alto,
            mop_clasification = EXCLUDED.mop_clasification,
            nominal_pallet = EXCLUDED.nominal_pallet,
            vehicle_type_id = EXCLUDED.vehicle_type_id,
            vehicle_designation_id = EXCLUDED.vehicle_designation_id,
            vehicle_model_id = EXCLUDED.vehicle_model_id
            -- No actualizamos 'carrier_id' en conflicto
          RETURNING vehicle_id;
        `;

        const vehicleRes = await client.query(upsertQuery, [
          plate, // $1
          parseInt(record.year_of_manufacture) || null, // $2
          stringToBoolean(record.gps), // $3
          record.engine_number || null, // $4
          record.chassis_number || null, // $5
          record.vin || null, // $6
          parseInt(record.odometer_km) || null, // $7
          record.cortina || null, // $8
          safeParseDate(record.instalacion_cortina), // $9
          stringToBoolean(record.parrilla), // $10
          parseFloat(record.peso) || null, // $11
          parseFloat(record.largo) || null, // $12
          parseFloat(record.ancho) || null, // $13
          parseFloat(record.alto) || null, // $14
          record.mop_clasification || null, // $15
          parseInt(record.nominal_pallet) || null, // $16
          vehicleTypeId, // $17
          designationId, // $18
          modelId, // $19
          carrierId, // $20
        ]);

        const vehicleId = vehicleRes.rows[0].vehicle_id;

        // Revisión Técnica
        const rtQuery = `
            INSERT INTO revision_tecnica (
              vehicle_id, fecha_revision_tecnica, fecha_vencimiento_revision_tecnica,
              emissions_crt_status, identification_status, visual_status, lights_status,
              alignment_status, brakes_status, clearances_status, emissions_status,
              opacity_status, steering_angle_status, noise_status, suspension_status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15);
          `;
        await client.query(rtQuery, [
          vehicleId,
          safeParseDate(record.fecha_revision_tecnica),
          safeParseDate(record.fecha_vencimiento_revision_tecnica),
          statusToBoolean(record.emissions_crt_status),
          statusToBoolean(record.identification_status),
          statusToBoolean(record.visual_status),
          statusToBoolean(record.lights_status),
          statusToBoolean(record.alignment_status),
          statusToBoolean(record.brakes_status),
          statusToBoolean(record.clearances_status),
          statusToBoolean(record.emissions_status),
          statusToBoolean(record.opacity_status),
          statusToBoolean(record.steering_angle_status),
          statusToBoolean(record.noise_status),
          statusToBoolean(record.suspension_status),
        ]);

        // Permiso Circulación (JSON)
        if (record.permiso_circulacion_data) {
          const data: PermisoCirculacionData = JSON.parse(
            record.permiso_circulacion_data,
          );
          const pcQuery = `
              INSERT INTO permiso_circulacion (vehicle_id, municipalidad, fecha_emision, fecha_vencimiento)
              VALUES ($1, $2, $3, $4);
            `;
          await client.query(pcQuery, [
            vehicleId,
            data.municipalidad || null,
            safeParseDate(data.fecha_emision),
            safeParseDate(data.fecha_vencimiento),
          ]);
        }

        // SOAP (JSON)
        if (record.soap_data) {
          const data: SoapData = JSON.parse(record.soap_data);
          const soapQuery = `
              INSERT INTO soap (vehicle_id, numero_poliza, institucion_aseguradora, fecha_vencimiento_poliza)
              VALUES ($1, $2, $3, $4);
            `;
          await client.query(soapQuery, [
            vehicleId,
            data.numero_poliza || null,
            data.institucion_aseguradora || null,
            safeParseDate(data.fecha_vencimiento_poliza),
          ]);
        }

        // Certificado Anotaciones (JSON)
        if (record.certificado_anotaciones_vigentes_data) {
          const data: CertificadoAnotacionesData = JSON.parse(
            record.certificado_anotaciones_vigentes_data,
          );
          const certQuery = `
              INSERT INTO certificado_anotaciones_vigentes (
                vehicle_id, folio, codigo_verificacion, fecha_emision, 
                limitaciones_al_dominio, nombre_propietario, rut_propietario, fecha_adquisicion
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8);
            `;
          await client.query(certQuery, [
            vehicleId,
            data.folio || null,
            data.codigo_verificacion || null,
            safeParseDate(data.fecha_emision),
            data.limitaciones_al_dominio || null,
            data.datos_propietario_actual?.nombre || null,
            data.datos_propietario_actual?.rut || null,
            safeParseDate(data.datos_propietario_actual?.fecha_adquisicion),
          ]);
        }

        await client.query('COMMIT');
        processedCount++;
      } catch (rowError) {
        await client.query('ROLLBACK');
        console.error(
          `[Fila ${rowCount + 1}] Error procesando patente ${plate}. Revirtiendo fila. Error: ${(rowError as Error).message}`,
        );
        errorCount++;
      }
    }

    console.log(
      `Procesamiento de ${fileName} completado. Total filas: ${rowCount}, Procesadas: ${processedCount}, Errores: ${errorCount}.`,
    );
  } catch (error) {
    console.error(
      `Error fatal procesando ${fileName}. El proceso se detuvo.`,
      error,
    );
  } finally {
    client.release();
    console.log('Cliente de base de datos liberado.');
  }
};
