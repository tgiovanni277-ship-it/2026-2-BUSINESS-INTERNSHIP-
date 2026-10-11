// n8n Code node, Run Once for All Items.
const row = $input.first().json;
const d = row?.body;
const cfg = d?.reglas;

if (!d || d.schemaVersion !== 1 || typeof d.applicationId !== "string" ||
    !cfg || typeof cfg.version !== "string" || !Number.isFinite(cfg.lat) ||
    !Number.isFinite(cfg.lng) || !Number.isFinite(cfg.radioOk) ||
    !Number.isFinite(cfg.radioRev) || cfg.radioOk < 0 || cfg.radioRev < cfg.radioOk ||
    !Number.isFinite(cfg.minScore) || cfg.minScore < 0 || cfg.minScore > 100 ||
    !Number.isFinite(d.ubicacion?.lat) || !Number.isFinite(d.ubicacion?.lng) ||
    !d.consentimiento?.aceptado || !d.respuestas) {
  throw new Error("Invalid candidate contract");
}

const r = d.respuestas;
if (!["yes", "no"].includes(r.autorizacion) || !["yes", "no"].includes(r.transporte) ||
    !["full_time", "part_time"].includes(r.disponibilidad) ||
    !["0_1", "1_3", "3_plus"].includes(r.experiencia) ||
    !["morning", "afternoon", "evening"].includes(d.horario)) {
  throw new Error("Invalid candidate answers");
}

return [{ json: d }];

