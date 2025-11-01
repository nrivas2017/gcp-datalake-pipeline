import {Storage} from '@google-cloud/storage';
import {parse} from 'csv-parse';
import {getDbPool} from '../db';
import {validateAndFormatRut} from '../utils/validations';
import {safeParseDate} from '../utils/date';
import {normalizeSpaces} from '../utils/string';
import {getOrCreateSimpleCatalog} from '../utils/sql';

const storage = new Storage();

export async function procesarConductores(
  bucketName: string,
  fileName: string,
) {
  const dbPool = await getDbPool();
  const client = await dbPool.connect();

  let rowCount = 0;
  let processedCount = 0;
  let errorCount = 0;

  console.log(`Iniciando procesamiento de conductores: ${fileName}`);

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

    // Cache de Roles de Conductor
    const rolCache = new Map<string, number>();
    const resRoles = await client.query(
      'SELECT conductor_rol_id, conductor_rol FROM conductor_rol',
    );
    for (const row of resRoles.rows) {
      rolCache.set(row.conductor_rol, row.conductor_rol_id);
    }
    console.log(
      `Cache 'conductor_rol' cargado con ${rolCache.size} registros.`,
    );

    // Cache de Clases de Licencia
    const claseLicenciaCache = new Map<string, number>();
    const resClases = await client.query(
      'SELECT clase_licencia_id, clase_licencia FROM clase_licencia',
    );
    for (const row of resClases.rows) {
      claseLicenciaCache.set(row.clase_licencia, row.clase_licencia_id);
    }
    console.log(
      `Cache 'clase_licencia' cargado con ${claseLicenciaCache.size} registros.`,
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
      const carrierBp = normalizeSpaces(record.carrier_bp);
      const rutValidation = validateAndFormatRut(record.national_id, false);

      await client.query('BEGIN');
      console.log(`[Fila ${rowCount + 1}] Transacción iniciada.`);

      try {
        if (!rutValidation.valid) {
          throw new Error(`RUT inválido: '${record.national_id}'`);
        }
        const conductorRut = rutValidation.value!;

        const carrierId =
          typeof carrierBp === 'string'
            ? empresaCache.get(carrierBp)
            : undefined;
        if (!carrierId) {
          throw new Error(
            `Empresa con carrier_bp '${carrierBp}' no encontrada.`,
          );
        }

        const driverRole =
          typeof record.driver_role === 'string'
            ? (normalizeSpaces(record.driver_role) as string)
            : undefined;
        if (!driverRole) {
          throw new Error(`'driver_role' está vacío.`);
        }

        const conductorRolId = await getOrCreateSimpleCatalog(
          client,
          rolCache,
          driverRole,
          'conductor_rol',
          'conductor_rol',
          'conductor_rol_id',
        );

        const upsertQuery = `
          INSERT INTO conductor (
            conductor_rut, carrier_id, conductor_rol_id, conductor_nombre,
            conductor_fecha_nacimiento, conductor_telefono, conductor_email
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (conductor_rut) 
          DO UPDATE SET
            carrier_id = EXCLUDED.carrier_id,
            conductor_rol_id = EXCLUDED.conductor_rol_id,
            conductor_nombre = EXCLUDED.conductor_nombre,
            conductor_fecha_nacimiento = EXCLUDED.conductor_fecha_nacimiento,
            conductor_telefono = EXCLUDED.conductor_telefono,
            conductor_email = EXCLUDED.conductor_email
          RETURNING conductor_id;
        `;

        const condRes = await client.query(upsertQuery, [
          conductorRut, // $1
          carrierId, // $2
          conductorRolId, // $3
          normalizeSpaces(record.driver_name) || null, // $4
          safeParseDate(record.birth_date), // $5
          normalizeSpaces(record.phone_number) || null, // $6
          normalizeSpaces(record.email) || null, // $7
        ]);

        const conductorId = condRes.rows[0].conductor_id;

        // Hoja de Vida (JSON)
        if (record.hoja_de_vida_data) {
          const data: HojaVidaData = JSON.parse(record.hoja_de_vida_data);

          if (data.certificado) {
            const hvQuery = `
              INSERT INTO hoja_vida (
                conductor_id, folio, codigo_verificacion, fecha_emision, comuna, domicilio
              ) VALUES ($1, $2, $3, $4, $5, $6)
              RETURNING hoja_vida_id;
            `;
            const hvRes = await client.query(hvQuery, [
              conductorId,
              data.certificado.folio || null,
              data.certificado.codigoVerificacion || null,
              safeParseDate(data.certificado.fechaEmision),
              data.persona?.comuna || null,
              data.persona?.domicilio || null,
            ]);

            const hojaVidaId = hvRes.rows[0].hoja_vida_id;

            // Restricciones
            const restQuery = `
              INSERT INTO hoja_vida_restriccion (hoja_vida_id, fecha_anotacion, restriccion) 
              VALUES ($1, $2, $3);
            `;
            if (data.persona?.restriccionesLicencia) {
              for (const item of data.persona.restriccionesLicencia) {
                await client.query(restQuery, [
                  hojaVidaId,
                  safeParseDate(item.fechaAnotacion),
                  item.bloqueRestriccionLicencia || null,
                ]);
              }
            }
            if (data.persona?.duracionesRestringidas) {
              for (const item of data.persona.duracionesRestringidas) {
                await client.query(restQuery, [
                  hojaVidaId,
                  safeParseDate(item.fechaAnotacion),
                  item.bloqueDuracionRestringida || null,
                ]);
              }
            }

            // Infracciones
            if (data.persona?.infraccionesRegistradas) {
              const infrQuery = `
                INSERT INTO hoja_vida_infraccion (
                  hoja_vida_id, proceso, tribunal, fecha_denuncia, infraccion, resolucion
                ) VALUES ($1, $2, $3, $4, $5, $6);
              `;
              for (const item of data.persona.infraccionesRegistradas) {
                await client.query(infrQuery, [
                  hojaVidaId,
                  item.procesoNumero || null,
                  item.tribunal || null,
                  safeParseDate(item.fechaDenuncia),
                  item.infraccion || null,
                  item.resolucion || null,
                ]);
              }
            }
          }
        }

        // Licencia (JSONs)
        if (record.licencia_frontal_data && record.licencia_reverso_data) {
          const frontal: LicenciaFrontalData = JSON.parse(
            record.licencia_frontal_data,
          );
          const reverso: LicenciaReversoData = JSON.parse(
            record.licencia_reverso_data,
          );

          const licQuery = `
              INSERT INTO licencia (
                conductor_id, municipalidad, fecha_de_control, fecha_ultimo_control, codigo
              ) VALUES ($1, $2, $3, $4, $5)
              RETURNING licencia_id;
            `;
          const licRes = await client.query(licQuery, [
            conductorId,
            frontal.municipalidad || null,
            safeParseDate(frontal.fecha_de_control),
            safeParseDate(frontal.fecha_ultimo_control),
            reverso.codigo || null,
          ]);

          const licenciaId = licRes.rows[0].licencia_id;

          // Clases de Licencia
          if (frontal.clase && frontal.clase.length > 0) {
            for (const claseNombre of frontal.clase) {
              // Get-or-Create Clase
              const claseId = await getOrCreateSimpleCatalog(
                client,
                claseLicenciaCache,
                claseNombre,
                'clase_licencia',
                'clase_licencia',
                'clase_licencia_id',
              );

              // Ttabla intermedia
              await client.query(
                'INSERT INTO licencia_clase (licencia_id, clase_licencia_id) VALUES ($1, $2)',
                [licenciaId, claseId],
              );
            }
          }
        }

        await client.query('COMMIT');
        processedCount++;
      } catch (rowError) {
        await client.query('ROLLBACK');
        console.error(
          `[Fila ${rowCount + 1}] Error procesando RUT ${record.national_id}. Revirtiendo fila. Error: ${(rowError as Error).message}`,
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
}
