import { readFile, mkdir, writeFile } from "node:fs/promises";

const root = new URL("../../n8n/", import.meta.url);
const code = await readFile(new URL("score.js", root), "utf8");
const validationCode = await readFile(new URL("validar-candidato.js", root), "utf8");
const nextStepCode = await readFile(new URL("preparar-siguiente-paso.js", root), "utf8");
const workflow = {
  id: "relayClassifyWorkflow1",
  name: "Relay - Clasificar solicitud",
  active: false,
  nodes: [
    {
      id: "relay-webhook", name: "Solicitud", type: "n8n-nodes-base.webhook",
      typeVersion: 2, position: [0, 0], webhookId: "relay-classify",
      parameters: {
        httpMethod: "POST", path: "relay-classify", authentication: "headerAuth",
        responseMode: "responseNode", options: {},
      },
      credentials: {
        httpHeaderAuth: { id: "relayHeaderAuth1", name: "Relay webhook secret" },
      },
    },
    {
      id: "relay-load-candidate", name: "Buscar lead en PostgreSQL", type: "n8n-nodes-base.postgres",
      typeVersion: 2.7, position: [240, 0],
      parameters: {
        resource: "database",
        operation: "executeQuery",
        query: "SELECT payload || jsonb_build_object('reglas', $2::jsonb) AS body FROM relay_n8n_candidates WHERE application_id = $1::uuid",
        options: {
          queryReplacement: "={{ [$('Solicitud').first().json.body.applicationId, JSON.stringify($('Solicitud').first().json.body.reglas)] }}",
        },
      },
      credentials: {
        postgres: { id: "relayPostgresReader1", name: "Relay PostgreSQL read-only" },
      },
    },
    {
      id: "relay-validate", name: "Validar candidato", type: "n8n-nodes-base.code",
      typeVersion: 2, position: [500, 0],
      parameters: { mode: "runOnceForAllItems", jsCode: validationCode },
    },
    {
      id: "relay-score", name: "Calcular puntaje", type: "n8n-nodes-base.code",
      typeVersion: 2, position: [740, 0],
      parameters: { mode: "runOnceForAllItems", jsCode: code },
    },
    {
      id: "relay-next-step", name: "Preparar siguiente paso", type: "n8n-nodes-base.code",
      typeVersion: 2, position: [980, 0],
      parameters: { mode: "runOnceForAllItems", jsCode: nextStepCode },
    },
    {
      id: "relay-response", name: "Devolver clasificación",
      type: "n8n-nodes-base.respondToWebhook", typeVersion: 1.4, position: [1220, 0],
      parameters: { respondWith: "json", responseBody: "={{ JSON.stringify($json) }}", options: { responseCode: 200 } },
    },
  ],
  connections: {
    Solicitud: { main: [[{ node: "Buscar lead en PostgreSQL", type: "main", index: 0 }]] },
    "Buscar lead en PostgreSQL": { main: [[{ node: "Validar candidato", type: "main", index: 0 }]] },
    "Validar candidato": { main: [[{ node: "Calcular puntaje", type: "main", index: 0 }]] },
    "Calcular puntaje": { main: [[{ node: "Preparar siguiente paso", type: "main", index: 0 }]] },
    "Preparar siguiente paso": { main: [[{ node: "Devolver clasificación", type: "main", index: 0 }]] },
  },
  settings: { executionOrder: "v1", saveDataErrorExecution: "none" },
  pinData: {},
};
await mkdir(new URL("workflows/", root), { recursive: true });
await writeFile(new URL("workflows/relay-classify.json", root), JSON.stringify(workflow, null, 2) + "\n");
console.log("workflow_generated", "relay-classify.json");
