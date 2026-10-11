import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";

export function application(overrides = {}) {
  const now = new Date().toISOString();
  return {
    schemaVersion: 1, applicationId: randomUUID(), receivedAt: now,
    vacanteId: "WH-001", vacanteTitulo: "Warehouse Associate", idioma: "es",
    nombre: "Test Candidate", email: "test@example.com", telefono: "+19195550123",
    ubicacion: { ciudad: "Raleigh", estado: "NC", zip: "27601", lat: 35.7796, lng: -78.6382 },
    horario: "morning", respuestas: { autorizacion: "yes", transporte: "yes", disponibilidad: "full_time", experiencia: "3_plus" },
    consentimiento: { aceptado: true, version: "draft-v1", idioma: "es", fecha: now },
    atribucion: { eventId: randomUUID(), utm: {} },
    tecnico: { ip: "private-ip", userAgent: "private-agent" }, ...overrides,
  };
}

export const rules = JSON.parse(await readFile(new URL("../src/config/prequalification.json", import.meta.url), "utf8"));
const code = await readFile(new URL("../../n8n/score.js", import.meta.url), "utf8");
const score = new Function("$input", code);
export function classify(payload) {
  return score({ first: () => ({ json: { body: { ...payload, reglas: payload.reglas || rules[payload.vacanteId] } } }) })[0].json;
}
