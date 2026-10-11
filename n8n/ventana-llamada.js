const d = $('Score').first().json;
const VENTANAS = { morning: [9, 12], afternoon: [12, 17], evening: [17, 20] };
const [ini, fin] = VENTANAS[d.horario];

const tz = "America/New_York";
const ahora = DateTime.now().setZone(tz);
const inicio = ahora.set({ hour: ini, minute: 0, second: 0, millisecond: 0 });
const cierre = ahora.set({ hour: fin, minute: 0, second: 0, millisecond: 0 });

let callAt;
if (ahora >= inicio && ahora < cierre) callAt = ahora;
else if (ahora < inicio) callAt = inicio;
else callAt = inicio.plus({ days: 1 });

return [{ json: { callAt: callAt.toUTC().toISO() } }];
