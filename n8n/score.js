// n8n Code node, Run Once for All Items. Authentication belongs to the Webhook node.
const input = $input.first().json;
const d = input.body ?? input;
const cfg = d?.reglas;
if (!d || d.schemaVersion !== 1 || typeof d.applicationId !== "string" ||
    !cfg || typeof cfg.version !== "string" || !Number.isFinite(cfg.lat) ||
    !Number.isFinite(cfg.lng) || !Number.isFinite(cfg.radioOk) ||
    !Number.isFinite(cfg.radioRev) || cfg.radioOk < 0 || cfg.radioRev < cfg.radioOk ||
    !Number.isFinite(cfg.minScore) || cfg.minScore < 0 || cfg.minScore > 100 ||
    !Number.isFinite(d.ubicacion?.lat) || !Number.isFinite(d.ubicacion?.lng) ||
    !d.consentimiento?.aceptado || !d.respuestas) {
  throw new Error("Invalid classification contract");
}
const r = d.respuestas;
if (!["yes", "no"].includes(r.autorizacion) || !["yes", "no"].includes(r.transporte) ||
    !["full_time", "part_time"].includes(r.disponibilidad) ||
    !["0_1", "1_3", "3_plus"].includes(r.experiencia)) {
  throw new Error("Invalid answers");
}
const rad = (x) => (x * Math.PI) / 180;
function millas(lat1, lng1, lat2, lng2) {
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.sqrt(Math.min(1, a)));
}
const dist = millas(d.ubicacion.lat, d.ubicacion.lng, cfg.lat, cfg.lng);
const motivos = [];
let estado = "precalificado";
if (r.autorizacion === "no") { estado = "no_elegible"; motivos.push("sin autorización de trabajo"); }
if (dist > cfg.radioRev) { estado = "no_elegible"; motivos.push("fuera de radio"); }
if (dist > cfg.radioOk && dist <= cfg.radioRev) {
  if (estado === "precalificado") estado = "revision";
  motivos.push("distancia intermedia");
}
if (r.transporte === "no") {
  if (estado === "precalificado") estado = "revision";
  motivos.push("sin transporte confiable");
}
const score = (dist <= cfg.radioOk ? 40 : 15) +
  (r.transporte === "yes" ? 20 : 0) + (r.disponibilidad === "full_time" ? 20 : 10) +
  (r.experiencia === "3_plus" ? 20 : r.experiencia === "1_3" ? 10 : 0);
if (score < cfg.minScore) {
  if (estado === "precalificado") estado = "revision";
  motivos.push("puntaje inferior al umbral");
}
return [{ json: {
  applicationId: d.applicationId, estado, score,
  distanciaMi: Math.round(dist * 10) / 10, motivos, rulesVersion: cfg.version,
  horario: d.horario,
} }];
