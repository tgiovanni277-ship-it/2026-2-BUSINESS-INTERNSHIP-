const call = $input.first().json.body.call;
const a = call.call_analysis?.custom_analysis_data ?? {};
const meta = call.metadata ?? {};

const NO_CONTESTO = ["dial_no_answer", "dial_busy", "dial_failed", "voicemail_reached"];
const contestada = !NO_CONTESTO.includes(call.disconnection_reason);

let resultado;
if (!contestada) resultado = "no_contesto";
else if (a.no_llamar === true) resultado = "no_llamar";
else if (a.interesado === true && a.confirma_requisitos === true) resultado = "calificado";
else if (a.interesado === false) resultado = "no_interesado";
else resultado = "revision";

return [{
  json: {
    resultado,
    ghlContactId: meta.ghlContactId,
    applicationId: meta.applicationId,
    resumen: call.call_analysis?.call_summary ?? "",
    transcripcion: call.transcript ?? "",
    nota: `Resultado: ${resultado}\n\nResumen: ${call.call_analysis?.call_summary ?? ""}\n\nTranscripción:\n${call.transcript ?? ""}`,
  },
}];
