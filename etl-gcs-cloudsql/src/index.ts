import * as dotenv from 'dotenv';
dotenv.config();
import {getDbPool} from './db';
import {procesarEmpresas} from './services/empresa';
import {procesarConductores} from './services/conductor';
import {procesarVehiculos} from './services/vehiculo';

export const etlGcsACloudSql = async (event: any, context: any) => {
  console.log(`Iniciando ETL...`);
  const gcsFile = event;
  const bucketName = gcsFile.bucket;
  const fileName = gcsFile.name;

  console.log(`Archivo recibido: ${fileName} en bucket ${bucketName}`);

  if (!fileName || !fileName.startsWith('ingesta_drive/')) {
    console.log(`Archivo ${fileName} ignorado (no está en ingesta_drive/).`);
    return;
  }

  try {
    await getDbPool();

    const lowerFileName = fileName.toLowerCase();

    if (lowerFileName.includes('empresa') && lowerFileName.endsWith('.csv')) {
      console.log(
        'Archivo identificado como "empresa". Iniciando procesamiento.',
      );
      await procesarEmpresas(bucketName, fileName);
    } else if (
      lowerFileName.includes('conductor') &&
      lowerFileName.endsWith('.csv')
    ) {
      console.log(
        'Archivo identificado como "conductor". Iniciando procesamiento.',
      );
      await procesarConductores(bucketName, fileName);
    } else if (
      lowerFileName.includes('vehiculo') &&
      lowerFileName.endsWith('.csv')
    ) {
      console.log(
        'Archivo identificado como "vehiculo". Iniciando procesamiento.',
      );
      await procesarVehiculos(bucketName, fileName);
    } else {
      console.log(`Archivo ${fileName} no reconocido, omitiendo.`);
    }
  } catch (error) {
    console.error('Error fatal en el router del ETL:', error);
  }
};
