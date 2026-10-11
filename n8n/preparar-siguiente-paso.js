// This node plans the next action. It does not place calls or modify GHL.
const d = $input.first().json;
const siguienteAccion = d.estado === "precalificado"
  ? "preparar_llamada"
  : d.estado === "revision"
    ? "revision_humana"
    : "cerrar_sin_llamada";

return [{
  json: {
    ...d,
    siguienteAccion,
    ventanaPreferida: d.horario,
    origenDatos: "postgresql",
  },
}];

