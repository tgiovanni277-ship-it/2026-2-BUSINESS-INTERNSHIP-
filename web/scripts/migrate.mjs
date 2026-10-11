import { readFile, readdir } from "node:fs/promises";
import { getDatabase, transaction } from "../src/lib/database.mjs";

const database = getDatabase();
try {
  await transaction(database, async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(74192301)");
    await client.query(`CREATE TABLE IF NOT EXISTS relay_migrations (
      name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now()
    )`);
    const directory = new URL("../db/migrations/", import.meta.url);
    for (const name of (await readdir(directory)).filter((name) => name.endsWith(".sql")).sort()) {
      const applied = await client.query("SELECT name FROM relay_migrations WHERE name = $1", [name]);
      if (applied.rowCount) continue;
      await client.query(await readFile(new URL(name, directory), "utf8"));
      await client.query("INSERT INTO relay_migrations (name) VALUES ($1)", [name]);
      console.log("migration_applied", name);
    }
    const n8nReaderPassword = process.env.RELAY_N8N_DB_PASSWORD;
    if (!n8nReaderPassword) throw new Error("relay_n8n_database_password_missing");
    const passwordStatement = await client.query(
      "SELECT format('ALTER ROLE relay_n8n_reader PASSWORD %L', $1::text) AS sql",
      [n8nReaderPassword],
    );
    await client.query(passwordStatement.rows[0].sql);
  });
} catch {
  console.error("relay_migration_failed");
  process.exitCode = 1;
} finally {
  await database.end();
}
