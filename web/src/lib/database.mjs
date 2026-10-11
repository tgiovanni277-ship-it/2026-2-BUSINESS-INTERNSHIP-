import pg from "pg";

const { Pool } = pg;

export function getDatabase() {
  if (!globalThis.relayDatabase) {
    if (!process.env.RELAY_DATABASE_URL && !process.env.RELAY_DB_HOST) {
      throw new Error("relay_database_not_configured");
    }
    globalThis.relayDatabase = new Pool({
      ...(process.env.RELAY_DATABASE_URL
        ? { connectionString: process.env.RELAY_DATABASE_URL }
        : {
            host: process.env.RELAY_DB_HOST,
            port: Number(process.env.RELAY_DB_PORT || 5432),
            database: process.env.RELAY_DB_NAME || "relay",
            user: process.env.RELAY_DB_USER || "relay",
            password: process.env.RELAY_DB_PASSWORD,
          }),
      max: Number(process.env.RELAY_DB_POOL_MAX || 5),
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
      // PgBouncer rejects statement_timeout as a startup parameter. Enforce the
      // same limit in the client so connections remain compatible with
      // transaction pooling.
      query_timeout: 10000,
    });
    globalThis.relayDatabase.on("error", () => {
      console.error("relay_database_connection_error");
    });
  }
  return globalThis.relayDatabase;
}

export async function transaction(database, operation) {
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    const result = await operation(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
