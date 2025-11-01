import * as dotenv from 'dotenv';
dotenv.config();
import {Request, Response} from '@google-cloud/functions-framework';
import {google, drive_v3} from 'googleapis';
import {Storage} from '@google-cloud/storage';
import {Readable} from 'stream';

const {DRIVE_FOLDER_ID, BUCKET_NAME} = process.env;

if (!DRIVE_FOLDER_ID || !BUCKET_NAME) {
  throw new Error(
    'Faltan variables de entorno críticas para la ingesta de datos.',
  );
}

const FILE_MIME_TYPE = 'text/csv';

const NUEVOS_FOLDER_NAME = 'nuevos';
const PROCESADOS_FOLDER_NAME = 'procesados';

const storage = new Storage();

const findFolderId = async (
  drive: drive_v3.Drive,
  parentFolderId: string,
  folderName: string,
): Promise<string> => {
  const res = await drive.files.list({
    q: `'${parentFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and name='${folderName}'`,
    fields: 'files(id)',
    pageSize: 1,
  });
  if (!res.data.files || res.data.files.length === 0) {
    throw new Error(
      `No se encontró la carpeta "${folderName}" dentro de ${parentFolderId}`,
    );
  }
  return res.data.files[0].id!;
};

export const ingestarDriveAGcs = async (req: Request, res: Response) => {
  try {
    console.log('Iniciando ingesta desde Drive...');

    const auth = new google.auth.GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/drive'],
    });
    const drive = google.drive({version: 'v3', auth: auth});

    const nuevosFolderId = await findFolderId(
      drive,
      DRIVE_FOLDER_ID,
      NUEVOS_FOLDER_NAME,
    );
    const procesadosFolderId = await findFolderId(
      drive,
      DRIVE_FOLDER_ID,
      PROCESADOS_FOLDER_NAME,
    );

    console.log(`Buscando archivos en la carpeta: ${NUEVOS_FOLDER_NAME}`);
    const fileListResponse = await drive.files.list({
      q: `'${nuevosFolderId}' in parents and mimeType='${FILE_MIME_TYPE}'`,
      fields: 'files(id, name)',
      pageSize: 1000,
    });

    if (
      !fileListResponse.data.files ||
      fileListResponse.data.files.length === 0
    ) {
      console.warn('No se encontraron archivos en la carpeta "nuevos".');
      res.status(200).send('No se encontraron archivos para procesar.');
      return;
    }

    const files = fileListResponse.data.files;
    console.log(`Se encontraron ${files.length} archivos para procesar.`);

    let processedCount = 0;
    const today = new Date().toISOString().split('T')[0]; // Fecha de hoy en YYYY-MM-DD

    const transferPromises = files.map(async file => {
      if (!file.id || !file.name) {
        return;
      }

      const fileId = file.id;
      const fileName = file.name;
      const gcsFileName = `ingesta_drive/${fileName}`;
      const gcsFile = storage.bucket(BUCKET_NAME).file(gcsFileName);

      console.log(`Procesando ${fileName}...`);

      const driveStream = await drive.files.get(
        {fileId, alt: 'media'},
        {responseType: 'stream'},
      );

      // Metadata
      const gcsMetadata = {
        metadata: {
          fecha_carga: today,
          nombre_archivo_origen: fileName,
        },
      };

      const gcsStream = gcsFile.createWriteStream(gcsMetadata);

      await new Promise((resolve, reject) => {
        (driveStream.data as Readable)
          .pipe(gcsStream)
          .on('finish', resolve)
          .on('error', reject);
      });

      console.log(`Archivo ${fileName} copiado a GCS.`);

      await drive.files.update({
        fileId: fileId,
        addParents: procesadosFolderId,
        removeParents: nuevosFolderId,
        fields: 'id, parents',
      });

      console.log(`Archivo ${fileName} movido a "procesados" en Drive.`);
      processedCount++;
    });

    await Promise.all(transferPromises);

    const summary = `Ingesta completada. ${processedCount} archivos procesados y movidos.`;
    console.log(summary);
    res.status(200).send(summary);
  } catch (error) {
    console.error('Error durante la ingesta:', error);
    res.status(500).send(`Error en la ingesta`);
  }
};
