import { createHash, randomUUID } from "node:crypto";
import { getDatabase, transaction } from "./database.mjs";

export class IdempotencyConflict extends Error {
  constructor() {
    super("idempotency_conflict");
    this.code = "idempotency_conflict";
  }
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort()
      .filter((key) => value[key] !== undefined)
      .map((key) => [key, canonical(value[key])]));
  }
  return value;
}

export function submissionHash(payload) {
  // Metadata can change between retries; candidate answers cannot.
  const { vacanteId, idioma, nombre, email, telefono, ubicacion, horario, respuestas } = payload;
  const consentimiento = {
    aceptado: payload.consentimiento.aceptado,
    version: payload.consentimiento.version,
    idioma: payload.consentimiento.idioma,
  };
  return createHash("sha256").update(JSON.stringify(canonical({
    vacanteId, idioma, nombre, email, telefono, ubicacion, horario, respuestas, consentimiento,
  }))).digest("hex");
}

export async function saveApplication(payload, database = getDatabase()) {
  const hash = submissionHash(payload);
  return transaction(database, async (client) => {
    const inserted = await client.query(
      `INSERT INTO relay_applications (id, event_id, payload_hash, payload, received_at)
       VALUES ($1, $2, $3, $4::jsonb, $5)
       ON CONFLICT (event_id) DO NOTHING RETURNING id`,
      [payload.applicationId, payload.atribucion.eventId, hash, JSON.stringify(payload), payload.receivedAt],
    );
    if (!inserted.rowCount) {
      const existing = await client.query(
        "SELECT id, payload_hash FROM relay_applications WHERE event_id = $1",
        [payload.atribucion.eventId],
      );
      if (existing.rows[0].payload_hash !== hash) throw new IdempotencyConflict();
      return { applicationId: existing.rows[0].id, duplicate: true };
    }
    await client.query(
      "INSERT INTO relay_jobs (application_id, kind) VALUES ($1, 'classify')",
      [payload.applicationId],
    );
    await client.query(
      "INSERT INTO relay_events (application_id, kind) VALUES ($1, 'received')",
      [payload.applicationId],
    );
    return { applicationId: payload.applicationId, duplicate: false };
  });
}

export async function claimJob(database = getDatabase(), leaseSeconds = 120) {
  const token = randomUUID();
  const result = await database.query(
    `WITH next_job AS (
       SELECT id FROM relay_jobs
       WHERE (status = 'pending' AND available_at <= now())
          OR (status = 'processing' AND locked_until <= now())
       ORDER BY available_at, id FOR UPDATE SKIP LOCKED LIMIT 1
     )
     UPDATE relay_jobs j SET status = 'processing', attempts = attempts + 1,
       lease_token = $1, locked_until = now() + $2 * interval '1 second', updated_at = now()
     FROM next_job WHERE j.id = next_job.id RETURNING j.*`,
    [token, leaseSeconds],
  );
  return result.rows[0] ?? null;
}

export async function loadApplication(id, database = getDatabase()) {
  const result = await database.query("SELECT * FROM relay_applications WHERE id = $1", [id]);
  if (!result.rowCount) throw new Error("application_not_found");
  return result.rows[0];
}

async function lockOwnedJob(client, job) {
  const result = await client.query(
    `SELECT id FROM relay_jobs WHERE id = $1 AND lease_token = $2
     AND status = 'processing' AND locked_until > now() FOR UPDATE`,
    [job.id, job.lease_token],
  );
  if (!result.rowCount) throw new Error("job_lease_lost");
}

export async function finishClassification(job, classification, database = getDatabase()) {
  await transaction(database, async (client) => {
    await lockOwnedJob(client, job);
    await client.query(
      `UPDATE relay_applications SET classification = $2::jsonb, status = $3, updated_at = now()
       WHERE id = $1`,
      [job.application_id, JSON.stringify(classification), classification.estado],
    );
    await client.query(
      "INSERT INTO relay_jobs (application_id, kind) VALUES ($1, 'sync_ghl') ON CONFLICT DO NOTHING",
      [job.application_id],
    );
    await completeJob(client, job, "classified", classification);
  });
}

export async function rememberContact(job, contactId, database = getDatabase()) {
  await transaction(database, async (client) => {
    await lockOwnedJob(client, job);
    await client.query(
      "UPDATE relay_applications SET ghl_contact_id = $2, updated_at = now() WHERE id = $1",
      [job.application_id, contactId],
    );
  });
}

export async function finishCrm(job, result, database = getDatabase()) {
  await transaction(database, async (client) => {
    await lockOwnedJob(client, job);
    await client.query(
      `UPDATE relay_applications SET ghl_contact_id = $2, ghl_note_id = $3,
       crm_status = $4, updated_at = now() WHERE id = $1`,
      [job.application_id, result.contactId, result.noteId, result.mocked ? "mocked" : "synced"],
    );
    await completeJob(client, job, result.mocked ? "crm_mocked" : "crm_synced", {
      contactId: result.contactId, noteId: result.noteId,
    });
  });
}

async function completeJob(client, job, kind, details) {
  await client.query(
    `UPDATE relay_jobs SET status = 'done', lease_token = NULL, locked_until = NULL,
     last_error = NULL, updated_at = now() WHERE id = $1`, [job.id],
  );
  await client.query(
    "INSERT INTO relay_events (application_id, kind, details) VALUES ($1, $2, $3::jsonb)",
    [job.application_id, kind, JSON.stringify(details)],
  );
}

export async function failJob(job, code, maxAttempts = 8, database = getDatabase()) {
  const dead = job.attempts >= maxAttempts;
  const delay = Math.min(3600, 15 * 2 ** Math.min(job.attempts - 1, 8));
  await transaction(database, async (client) => {
    await lockOwnedJob(client, job);
    await client.query(
      `UPDATE relay_jobs SET status = $2, available_at = now() + $3 * interval '1 second',
       last_error = $4, lease_token = NULL, locked_until = NULL, updated_at = now() WHERE id = $1`,
      [job.id, dead ? "dead" : "pending", delay, code],
    );
    await client.query(
      "INSERT INTO relay_events (application_id, kind, details) VALUES ($1, $2, $3::jsonb)",
      [job.application_id, dead ? "job_dead" : "job_retry", JSON.stringify({ jobId: job.id, code, attempt: job.attempts })],
    );
  });
}
