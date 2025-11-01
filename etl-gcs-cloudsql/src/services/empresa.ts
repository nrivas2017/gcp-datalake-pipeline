import {Storage} from '@google-cloud/storage';
import {parse} from 'csv-parse';
import {getDbPool} from '../db';
import {normalizeSpaces} from '../utils/string';
import {validateAndFormatRut} from '../utils/validations';

const storage = new Storage();

export async function procesarEmpresas(bucketName: string, fileName: string) {
  const dbPool = await getDbPool();
  const client = await dbPool.connect();

  let rowCount = 0;
  let processedCount = 0;
  let errorCount = 0;

  try {
    const [metadata] = await storage
      .bucket(bucketName)
      .file(fileName)
      .getMetadata();
    const fechaCarga =
      metadata.metadata?.fecha_carga || new Date().toISOString();
    console.log(`Metadatos del archivo: Fecha Carga ${fechaCarga}`);

    const tipoEmpresaCache = new Map<string, number>();
    const {rows} = await client.query(
      'SELECT carrier_type_id, carrier_type FROM tipo_empresa',
    );
    for (const row of rows) {
      tipoEmpresaCache.set(row.carrier_type, row.carrier_type_id);
    }
    console.log(
      `Caché de 'tipo_empresa' cargado con ${tipoEmpresaCache.size} registros.`,
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

      const carrierType = normalizeSpaces(record.carrier_type) as string;
      const carrierName = normalizeSpaces(record.carrier_name) as string;
      const rutValidation = validateAndFormatRut(record.carrier_tin, false);
      const carrierBp = normalizeSpaces(record.carrier_bp) as string;

      await client.query('BEGIN');
      console.log(`[Fila ${rowCount + 1}] Transacción iniciada.`);

      if (!carrierType || !carrierName || !rutValidation.valid || !carrierBp) {
        console.warn(
          `[Fila ${rowCount + 1}] Datos inválidos. RUT: '${record.carrier_tin}', Nombre: '${carrierName}'. Omitiendo.`,
        );
        errorCount++;
        continue;
      }

      const carrierRut = rutValidation.value!;

      let typeId: number;

      const cachedTypeId = tipoEmpresaCache.get(carrierType);

      try {
        if (cachedTypeId) {
          typeId = cachedTypeId;
        } else {
          console.log(`Creando nuevo tipo_empresa: '${carrierType}'`);
          const res = await client.query(
            'INSERT INTO tipo_empresa (carrier_type) VALUES ($1) RETURNING carrier_type_id',
            [carrierType],
          );

          typeId = res.rows[0].carrier_type_id as number;

          tipoEmpresaCache.set(carrierType, typeId);
        }

        const upsertQuery = `
        INSERT INTO empresa (carrier_name, carrier_rut, carrier_type_id, carrier_bp)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (carrier_rut) DO UPDATE SET
          carrier_name = EXCLUDED.carrier_name,
          carrier_type_id = EXcluded.carrier_type_id,
          carrier_bp = EXcluded.carrier_bp;
      `;

        await client.query(upsertQuery, [
          carrierName,
          carrierRut,
          typeId,
          carrierBp,
        ]);

        await client.query('COMMIT');
        processedCount++;
      } catch (rowError) {
        await client.query('ROLLBACK');
        console.error(
          `[Fila ${rowCount + 1}] Error procesando la Empresa ${carrierRut}. Revirtiendo fila. Error: ${(rowError as Error).message}`,
        );
        errorCount++;
      }
    }

    console.log(
      `Procesamiento de ${fileName} completado. Total filas: ${rowCount}, Procesadas: ${processedCount}, Errores: ${errorCount}.`,
    );
  } catch (error) {
    console.error(
      `Error fatal procesando ${fileName}. Revirtiendo transacción.`,
      error,
    );
  } finally {
    client.release();
    console.log('Cliente de base de datos liberado.');
  }
}
