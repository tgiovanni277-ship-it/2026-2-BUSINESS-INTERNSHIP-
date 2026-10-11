import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import pg from "pg";
import { PGlite } from "@electric-sql/pglite";
import { saveApplication, claimJob, finishClassification, failJob, loadApplication } from "../../src/lib/applications.mjs";
import { processNextJob } from "../../src/lib/processor.mjs";
import { application, classify, rules } from "../helpers.mjs";

async function testDatabase() {
  const migration = await readFile(new URL("../../db/migrations/001_intake.sql", import.meta.url), "utf8");
  if (process.env.RELAY_TEST_DATABASE_URL) {
    const pool = new pg.Pool({ connectionString: process.env.RELAY_TEST_DATABASE_URL });
    // Isolate from all existing tables. This role must have CREATE SCHEMA permission.
    const schema = `relay_test_${randomUUID().replaceAll("-", "")}`;
    await pool.query(`CREATE SCHEMA ${schema}`);
    await pool.end();
    const database = new pg.Pool({ connectionString: process.env.RELAY_TEST_DATABASE_URL, options: `-c search_path=${schema}` });
    await database.query(migration);
    return { database, close: async () => { await database.query(`DROP SCHEMA ${schema} CASCADE`); await database.end(); } };
  }
  // Actual PostgreSQL engine compiled to WASM. Does not prove native multi-connection locking.
  const engine = new PGlite();
  await engine.exec(migration);
  const query = async (sql, params) => {
    const result = await engine.query(sql, params);
    return { rows: result.rows, rowCount: result.rows.length || result.affectedRows || 0 };
  };
  return { database: { query, connect: async () => ({ query, release() {} }) }, close: () => engine.close() };
}

test("durable intake and recovery using PostgreSQL", async (t) => {
  const { database, close } = await testDatabase();
  async function reset() {
    await database.query("TRUNCATE relay_events, relay_jobs, relay_applications RESTART IDENTITY CASCADE");
  }
  try {
    await t.test("receipt commits both records; metadata-only retry returns original id", async () => {
      await reset();
      const payload = application();
      const saved = await saveApplication(payload, database);
      assert.equal(saved.duplicate, false);
      const retry = await saveApplication({ ...payload, applicationId: randomUUID(), receivedAt: new Date().toISOString(), tecnico: { ip: "different" } }, database);
      assert.deepEqual(retry, { applicationId: payload.applicationId, duplicate: true });
      assert.equal((await database.query("SELECT * FROM relay_jobs")).rowCount, 1);
      await assert.rejects(saveApplication({ ...payload, nombre: "Changed" }, database), { code: "idempotency_conflict" });
    });
    await t.test("job insertion failure rolls back application as well", async () => {
      await reset();
      const broken = { connect: async () => {
        const client = await database.connect();
        return { release: () => client.release(), query: (sql, params) => {
          if (sql.startsWith("INSERT INTO relay_jobs")) throw Error("forced job failure");
          return client.query(sql, params);
        } };
      } };
      await assert.rejects(saveApplication(application(), broken));
      assert.equal((await database.query("SELECT * FROM relay_applications")).rowCount, 0);
    });
    await t.test("n8n outage retains application, delays retry and does not call CRM", async () => {
      await reset();
      const payload = application();
      await saveApplication(payload, database);
      let crmCalled = false;
      await processNextJob(database, { rules, maxAttempts: 8 }, {
        classify: async () => { throw Object.assign(Error("secret upstream details"), { code: "n8n_unavailable" }); },
        syncCrm: async () => { crmCalled = true; },
      });
      const job = (await database.query("SELECT * FROM relay_jobs")).rows[0];
      assert.equal(job.status, "pending");
      assert.equal(job.last_error, "n8n_unavailable");
      assert.equal(crmCalled, false);
      assert.equal((await loadApplication(payload.applicationId, database)).status, "nuevo");
      assert.equal(await claimJob(database), null);
    });
    await t.test("classification commits before CRM and failed CRM never reclassifies", async () => {
      await reset();
      const payload = application();
      await saveApplication(payload, database);
      const config = { rules, maxAttempts: 8 };
      await processNextJob(database, config, { classify: async (data) => {
        assert.deepEqual(Object.keys(data).sort(), ["applicationId", "reglas", "schemaVersion"]);
        return classify({ ...payload, reglas: data.reglas });
      } });
      const classified = await loadApplication(payload.applicationId, database);
      assert.equal(classified.status, "precalificado");
      assert.equal(classified.crm_status, "pending");
      await processNextJob(database, config, { syncCrm: async (data, result, options) => {
        await options.onContactSaved("contact-known");
        throw Object.assign(Error("failure"), { code: "ghl_unavailable" });
      } });
      assert.equal((await loadApplication(payload.applicationId, database)).ghl_contact_id, "contact-known");
      await database.query("UPDATE relay_jobs SET available_at = now() WHERE kind = 'sync_ghl'");
      await processNextJob(database, config, { syncCrm: async (data, result, options) => {
        assert.equal(options.contactId, "contact-known");
        return { contactId: options.contactId, noteId: "note-known", mocked: false };
      } });
      assert.equal((await loadApplication(payload.applicationId, database)).crm_status, "synced");
      assert.equal((await database.query("SELECT attempts FROM relay_jobs WHERE kind = 'classify'")).rows[0].attempts, 1);
    });
    await t.test("expired lease is reclaimed; stale worker cannot commit", async () => {
      await reset();
      const payload = application();
      await saveApplication(payload, database);
      const oldJob = await claimJob(database);
      assert.equal(await claimJob(database), null);
      await database.query("UPDATE relay_jobs SET locked_until = now() - interval '1 second'");
      const recovered = await claimJob(database);
      assert.notEqual(recovered.lease_token, oldJob.lease_token);
      await assert.rejects(finishClassification(oldJob, classify(payload), database), /job_lease_lost/);
      await finishClassification(recovered, classify(payload), database);
    });
    await t.test("exhausted attempts move to review queue without losing data", async () => {
      await reset();
      const payload = application();
      await saveApplication(payload, database);
      const job = await claimJob(database);
      await failJob(job, "n8n_unavailable", 1, database);
      assert.equal((await database.query("SELECT status FROM relay_jobs")).rows[0].status, "dead");
      assert.equal(await claimJob(database), null);
      assert.equal((await loadApplication(payload.applicationId, database)).payload.email, payload.email);
    });
    await t.test("HTTP classification and explicit GHL simulation complete the pipeline", async () => {
      await reset();
      const oldEnv = { GHL_MODE: process.env.GHL_MODE, RELAY_ENV: process.env.RELAY_ENV };
      process.env.GHL_MODE = "mock";
      process.env.RELAY_ENV = "test";
      const payload = application();
      const server = createServer(async (request, response) => {
        assert.equal(request.headers["x-relay-secret"], "test-secret");
        let body = "";
        for await (const chunk of request) body += chunk;
        const data = JSON.parse(body);
        assert.equal(data.reglas.version, rules["WH-001"].version);
        assert.deepEqual(Object.keys(data).sort(), ["applicationId", "reglas", "schemaVersion"]);
        response.writeHead(200, { "Content-Type": "application/json" });
        response.end(JSON.stringify(classify({ ...payload, reglas: data.reglas })));
      });
      await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
      try {
        await saveApplication(payload, database);
        const config = { rules, maxAttempts: 8, n8nSecret: "test-secret",
          n8nUrl: `http://127.0.0.1:${server.address().port}/webhook/relay-classify` };
        await processNextJob(database, config);
        await processNextJob(database, config);
        const stored = await loadApplication(payload.applicationId, database);
        assert.equal(stored.crm_status, "mocked");
        assert.equal(stored.status, "precalificado");
        assert.equal((await database.query("SELECT * FROM relay_jobs WHERE status = 'done'")).rowCount, 2);
        assert.equal(await processNextJob(database, config), false);
      } finally {
        await new Promise((resolve) => server.close(resolve));
        for (const key of ["GHL_MODE", "RELAY_ENV"]) {
          if (oldEnv[key] === undefined) delete process.env[key]; else process.env[key] = oldEnv[key];
        }
      }
    });
  } finally {
    await close();
  }
});
