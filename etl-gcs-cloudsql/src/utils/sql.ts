import {PoolClient} from 'pg';

/**
 * Generic function to obtain or create an ID from a simple catalog.
 */
export const getOrCreateSimpleCatalog = async (
  client: PoolClient,
  cache: Map<string, number>,
  value: string,
  tableName: string,
  columnName: string,
  idColumnName: string,
): Promise<number> => {
  let id = cache.get(value);
  if (id) {
    return id;
  }

  // If it is not in the cache, create it.
  console.log(`Creando nuevo ${tableName}: '${value}'`);
  const query = `INSERT INTO ${tableName} (${columnName}) VALUES ($1) ON CONFLICT (${columnName}) DO UPDATE SET ${columnName} = EXCLUDED.${columnName} RETURNING ${idColumnName}`;
  const res = await client.query(query, [value]);

  id = res.rows[0][idColumnName] as number;
  cache.set(value, id); // Cache
  return id;
};
