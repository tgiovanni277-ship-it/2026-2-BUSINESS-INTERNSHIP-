import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import zipcodes from "zipcodes";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { getVacante } from "../src/config/vacantes.js";
import { buildServerSchema } from "../src/features/apply/build-schema.js";
import { IdempotencyConflict } from "../src/lib/applications.mjs";
import { application } from "./helpers.mjs";

const source = await readFile(new URL("../src/app/api/apply/route.js", import.meta.url), "utf8");
const createHandler = new Function("NextResponse", "after", "zipcodes", "parsePhoneNumberFromString",
  "getVacante", "buildServerSchema", "rateLimit", "verifyTurnstile", "sendLead", "IdempotencyConflict", "saveApplication",
  source.replace(/^import .+;\r?\n/gm, "").replace(/^export const runtime = .+;\r?\n/m, "")
    .replace("export async function POST", "async function POST") + "\nreturn POST;");

function request(overrides = {}) {
  const data = application();
  return new Request("http://localhost/api/apply", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...data, slug: "warehouse-associate", zip: "27601",
      consentimiento: true, eventId: data.atribucion.eventId, ...overrides }),
  });
}

function handler(save, { limit = async () => ({ allowed: true, retryAfter: 1 }), turnstile = async () => true } = {}) {
  return createHandler({ json: (body, options) => Response.json(body, options) },
    () => {}, zipcodes, parsePhoneNumberFromString, getVacante, buildServerSchema,
    limit, turnstile, () => {}, IdempotencyConflict, save);
}

test("intake confirms only after durable save and never invokes n8n/GHL", async () => {
  const oldFetch = globalThis.fetch;
  globalThis.fetch = () => { throw Error("intake must not contact upstream services"); };
  try {
    let committed = false;
    const post = handler(async (payload) => {
      assert.equal(payload.telefono, "+19195550123");
      assert.equal(payload.consentimiento.aceptado, true);
      committed = true;
      return { applicationId: payload.applicationId, duplicate: false };
    });
    const response = await post(request());
    assert.equal(committed, true);
    assert.equal(response.status, 202);
    assert.equal((await response.json()).ok, true);
  } finally { globalThis.fetch = oldFetch; }
});
test("database failure does not falsely accept a submission", async () => {
  const response = await handler(async () => { throw Error("database unavailable"); })(request());
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { ok: false, code: "storage" });
});
test("changed answers with the same key return a conflict", async () => {
  const response = await handler(async () => { throw new IdempotencyConflict(); })(request());
  assert.equal(response.status, 409);
});
test("invalid submissions never reach the database", async () => {
  let saved = false;
  const response = await handler(async () => { saved = true; })(request({ consentimiento: false }));
  assert.equal(response.status, 400);
  assert.equal(saved, false);
});
test("shared rate limit returns retry guidance before storing", async () => {
  let saved = false;
  const response = await handler(async () => { saved = true; }, {
    limit: async () => ({ allowed: false, retryAfter: 42 }),
  })(request());
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("retry-after"), "42");
  assert.equal(saved, false);
});
test("failed bot challenge never reaches the database", async () => {
  let saved = false;
  const response = await handler(async () => { saved = true; }, {
    turnstile: async () => false,
  })(request());
  assert.equal(response.status, 403);
  assert.equal(saved, false);
});
