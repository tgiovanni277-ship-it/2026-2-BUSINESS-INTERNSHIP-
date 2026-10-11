import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { application, classify, rules } from "./helpers.mjs";
import { classifyApplication, validateClassification } from "../src/lib/classification.mjs";

test("business requirements override a high score", () => {
  const data = application();
  assert.equal(classify(data).score, 100);
  const result = classify({ ...data, respuestas: { ...data.respuestas, autorizacion: "no" } });
  assert.equal(result.score, 100);
  assert.equal(result.estado, "no_elegible");
});
test("transport and configurable score threshold route to human review", () => {
  const data = application();
  assert.equal(classify({ ...data, respuestas: { ...data.respuestas, transporte: "no" } }).estado, "revision");
  const result = classify({ ...data, reglas: { ...rules["WH-001"], minScore: 95 },
    respuestas: { ...data.respuestas, experiencia: "0_1" } });
  assert.equal(result.estado, "revision");
});
test("distance excludes profiles outside the configured radius", () => {
  const result = classify(application({ ubicacion: { lat: 40.7128, lng: -74.006 } }));
  assert.equal(result.estado, "no_elegible");
});
test("rejects a successful webhook that returns the wrong contract or application", async () => {
  const payload = application();
  const options = { url: "http://localhost/webhook", secret: "test", fetchImpl: async () => Response.json({ ok: true }) };
  await assert.rejects(classifyApplication(payload, options), { code: "n8n_invalid_classification" });
  assert.throws(() => validateClassification({ ...classify(payload), applicationId: "other" }, payload.applicationId));
});
test("network failure and HTTP failure have controlled retry codes", async () => {
  const payload = application();
  await assert.rejects(classifyApplication(payload, {
    url: "http://localhost", secret: "test", fetchImpl: async () => { throw Error("sensitive details"); },
  }), { code: "n8n_unavailable" });
  await assert.rejects(classifyApplication(payload, {
    url: "http://localhost", secret: "test", fetchImpl: async () => new Response("private", { status: 500 }),
  }), { code: "n8n_http_error" });
});
test("workflow export uses authenticated webhook and current scoring code", async () => {
  const flow = JSON.parse(await readFile(new URL("../../n8n/workflows/relay-classify.json", import.meta.url), "utf8"));
  assert.equal(flow.active, false);
  assert.equal(flow.nodes[0].parameters.authentication, "headerAuth");
  assert.equal(flow.nodes[0].parameters.responseMode, "responseNode");
  const source = (await readFile(new URL("../../n8n/score.js", import.meta.url), "utf8"))
    .replace(/\r\n/g, "\n");
  const exportedCode = flow.nodes.find((node) => node.id === "relay-score").parameters.jsCode
    .replace(/\r\n/g, "\n");
  assert.equal(exportedCode, source);
});
