const canonicalRows = rows => rows.map(row => JSON.stringify(row)).sort();

async function schemaContract(client, schema) {
  const columns = (await client.query(`SELECT table_name, column_name, data_type, is_nullable, column_default
    FROM information_schema.columns WHERE table_schema = $1 AND table_name LIKE 'gallery_%'
    ORDER BY table_name, column_name`, [schema])).rows;
  const constraints = (await client.query(`SELECT t.relname AS table_name, c.contype,
    ARRAY(SELECT a.attname FROM unnest(c.conkey) WITH ORDINALITY k(num,ord)
      JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k.num ORDER BY k.ord) AS columns,
    f.relname AS foreign_table, c.confdeltype, c.confupdtype,
    ARRAY(SELECT a.attname FROM unnest(c.confkey) WITH ORDINALITY k(num,ord)
      JOIN pg_attribute a ON a.attrelid=c.confrelid AND a.attnum=k.num ORDER BY k.ord) AS foreign_columns,
    CASE WHEN c.contype='c' THEN pg_get_constraintdef(c.oid) ELSE NULL END AS expression
    FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid
    JOIN pg_namespace n ON n.oid=t.relnamespace LEFT JOIN pg_class f ON f.oid=c.confrelid
    WHERE n.nspname=$1 AND t.relname LIKE 'gallery_%'`, [schema])).rows;
  const indexes = (await client.query(`SELECT t.relname AS table_name, i.indisunique, i.indisprimary,
    ARRAY(SELECT pg_get_indexdef(i.indexrelid,k,true) FROM generate_series(1,i.indnkeyatts) k) AS keys
    FROM pg_index i JOIN pg_class t ON t.oid=i.indrelid JOIN pg_namespace n ON n.oid=t.relnamespace
    WHERE n.nspname=$1 AND t.relname LIKE 'gallery_%'`, [schema])).rows;
  const normalize = rows => canonicalRows(rows.map(row => Object.fromEntries(Object.entries(row).map(([key, value]) =>
    [key, typeof value === "string" ? value.replaceAll('"', "").replaceAll(/\s+/g, " ") : value]))));
  return { columns: normalize(columns), constraints: normalize(constraints), indexes: normalize(indexes) };
}


module.exports = { schemaContract };
