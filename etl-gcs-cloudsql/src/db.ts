import {Connector, IpAddressTypes} from '@google-cloud/cloud-sql-connector';
import {Pool} from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const {DB_USER, DB_PASS, DB_NAME, DB_SCHEMA, INSTANCE_CONNECTION_NAME} =
  process.env;

if (
  !DB_USER ||
  !DB_PASS ||
  !DB_NAME ||
  !DB_SCHEMA ||
  !INSTANCE_CONNECTION_NAME
) {
  throw new Error(
    'Faltan variables de entorno críticas para la base de datos.',
  );
}

const connector = new Connector();
let dbPool: Pool;

async function initDbPool(): Promise<Pool> {
  const clientOpts = await connector.getOptions({
    instanceConnectionName: INSTANCE_CONNECTION_NAME!,
    ipType: IpAddressTypes.PUBLIC,
  });

  return new Pool({
    ...clientOpts,
    user: DB_USER,
    password: DB_PASS,
    database: DB_NAME,
    max: 5,
    options: `-c search_path=${DB_SCHEMA}`,
  });
}

export const getDbPool = async (): Promise<Pool> => {
  if (!dbPool) {
    console.log('Inicializando pool de conexiones...');
    dbPool = await initDbPool();
  }
  return dbPool;
};
