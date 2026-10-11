import http from "k6/http";
import { check } from "k6";
import { Rate, Trend } from "k6/metrics";

const failed = new Rate("relay_failed");
const intakeDuration = new Trend("relay_intake_duration", true);
const baseUrl = __ENV.BASE_URL || "http://localhost:3000";

export const options = {
  scenarios: {
    page_views: { executor: "constant-arrival-rate", rate: Number(__ENV.PAGE_RPS || 40), timeUnit: "1s", duration: __ENV.DURATION || "2m", preAllocatedVUs: 20, maxVUs: 150, exec: "page" },
    submissions: { executor: "constant-arrival-rate", rate: Number(__ENV.APPLY_RPS || 10), timeUnit: "1s", duration: __ENV.DURATION || "2m", preAllocatedVUs: 10, maxVUs: 100, exec: "apply" },
  },
  thresholds: { http_req_failed: ["rate<0.01"], relay_failed: ["rate<0.01"], relay_intake_duration: ["p(95)<500", "p(99)<1000"] },
};

function uuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    return (c === "x" ? r : (r & 3) | 8).toString(16);
  });
}

export function page() {
  const response = http.get(`${baseUrl}/warehouse-associate?lang=es`);
  check(response, { "page responds": (r) => r.status === 200 });
}

export function apply() {
  const payload = JSON.stringify({
    slug: "warehouse-associate", idioma: "es", eventId: uuid(),
    nombre: "Prueba Carga", email: `load-${__VU}-${__ITER}-${Date.now()}@example.com`,
    telefono: "+19195550123", zip: "27601", horario: "morning",
    respuestas: { autorizacion: "yes", transporte: "yes", disponibilidad: "full_time", experiencia: "3_plus" },
    consentimiento: true, website: "", utm: { source: "load-test" },
  });
  const response = http.post(`${baseUrl}/api/apply`, payload, { headers: { "Content-Type": "application/json" } });
  intakeDuration.add(response.timings.duration);
  const ok = check(response, { "application accepted": (r) => r.status === 202 });
  failed.add(!ok);
}
