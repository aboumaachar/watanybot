/**
 * PostgreSQL connection pool for gateway-api.
 *
 * Uses the `pg` driver. Connection string comes from DATABASE_URL or individual
 * DB_HOST / DB_PORT / DB_USER / DB_PASS / DB_NAME vars. Falls back to a local
 * XAMPP-compatible default.
 */
import pg from "pg";

const DATABASE_URL = process.env.DATABASE_URL;
const DB_PASSWORD = process.env.DB_PASS || process.env.DB_PASSWORD || "";

const pool = new pg.Pool(
  DATABASE_URL
    ? {
        connectionString: DATABASE_URL,
        allowExitOnIdle: process.env.NODE_ENV === "test",
      }
    : {
        host: process.env.DB_HOST || "localhost",
        port: Number(process.env.DB_PORT || "5433"),
        user: process.env.DB_USER || "postgres",
        password: DB_PASSWORD,
        database: process.env.DB_NAME || "watany",
        allowExitOnIdle: process.env.NODE_ENV === "test",
      },
);

/** Run a single parameterised query. */
export async function query<T extends pg.QueryResultRow = any>(
  text: string,
  params?: unknown[],
): Promise<pg.QueryResult<T>> {
  return pool.query<T>(text, params);
}

/** Obtain a client for multi-statement transactions. */
export async function getClient() {
  return pool.connect();
}

/** Graceful shutdown. */
export async function closePool() {
  await pool.end();
}

export default pool;
