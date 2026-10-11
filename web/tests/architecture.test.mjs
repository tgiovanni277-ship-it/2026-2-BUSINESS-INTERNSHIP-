import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parse } from "yaml";

test("Compose isolates intake credentials and uses separate durable databases", async () => {
  const compose = parse(await readFile(new URL("../../docker-compose.yml", import.meta.url), "utf8"), { merge: true });
  const { services } = compose;
  assert.equal(services.web.environment.GHL_PRIVATE_INTEGRATION_TOKEN, undefined);
  assert.equal(services.web.environment.N8N_WEBHOOK_SECRET, undefined);
  assert.equal(services.web.environment.RELAY_DB_HOST, "pgbouncer");
  assert.equal(services.web.environment.REDIS_URL, "redis://redis:6379");
  assert.equal(services.n8n.environment.DB_POSTGRESDB_HOST, "postgres");
  assert.equal(services.web.depends_on["relay-migrate"].condition, "service_completed_successfully");
  assert.equal(services["relay-worker"].environment.GHL_MODE, "live");
  assert.ok(!services.n8n.image.includes("latest"));
  assert.equal(services.pgbouncer.environment.POOL_MODE, "transaction");
});
