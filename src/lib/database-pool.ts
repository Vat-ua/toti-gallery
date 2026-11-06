import { Pool } from "pg";
import { attachDatabasePool } from "@vercel/functions";
import { logServerError } from "./server-log";

export function createDatabasePool(connectionString: string) {
  const pool = new Pool({
    connectionString, max: 5, connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 10_000, maxLifetimeSeconds: 300, keepAlive: true,
    // The server cancels work before the client stops waiting. No automatic write retries.
    statement_timeout: 30_000, query_timeout: 35_000, lock_timeout: 10_000,
    idle_in_transaction_session_timeout: 60_000,
    application_name: "toti-gallery",
  });
  pool.on("error", error => { logServerError("database.pool.error", error); });
  if (process.env.VERCEL === "1") attachDatabasePool(pool);
  return pool;
}
