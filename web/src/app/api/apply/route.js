import { after, NextResponse } from "next/server";
import zipcodes from "zipcodes";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { getVacante } from "@/config/vacantes";
import { buildServerSchema } from "@/features/apply/build-schema";
import { rateLimit } from "@/lib/ratelimit";
import { verifyTurnstile } from "@/lib/turnstile";
import { sendLead } from "@/lib/meta-capi";
import { IdempotencyConflict, saveApplication } from "@/lib/applications.mjs";

export const runtime = "nodejs";

const fail = (code, status) => NextResponse.json({ ok: false, code }, { status });
const cookie = (header, name) => header?.match(new RegExp(`(?:^|; )${name}=([^;]*)`))?.[1];

export async function POST(req) {
  const cloudflareIp = process.env.TRUST_CLOUDFLARE === "true" ? req.headers.get("cf-connecting-ip") : null;
  const ip = cloudflareIp?.trim() || req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  let limit;
  try {
    limit = await rateLimit(ip);
  } catch {
    console.error("relay_rate_limit_unavailable");
    return fail("unavailable", 503);
  }
  if (!limit.allowed) {
    const response = fail("rate", 429);
    response.headers.set("Retry-After", String(limit.retryAfter));
    return response;
  }
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return fail("generic", 400);
  if (body.website) return NextResponse.json({ ok: true });
  if (!(await verifyTurnstile(body.turnstileToken, ip))) return fail("challenge", 403);
  const vacante = getVacante(body.slug);
  if (!vacante) return fail("generic", 404);
  const parsed = buildServerSchema(vacante).safeParse(body);
  if (!parsed.success) return fail("generic", 400);
  const d = parsed.data;
  const phone = parsePhoneNumberFromString(d.telefono, "US");
  if (!phone?.isValid() || phone.country !== "US") return fail("phone", 400);
  const loc = zipcodes.lookup(d.zip);
  if (!loc) return fail("zip", 400);
  const referer = req.headers.get("referer") ?? undefined;
  const userAgent = req.headers.get("user-agent") ?? undefined;
  const payload = { schemaVersion: 1, applicationId: crypto.randomUUID(), receivedAt: new Date().toISOString(), vacanteId: vacante.vacanteId, vacanteTitulo: vacante.titulo[d.idioma], idioma: d.idioma, nombre: d.nombre, email: d.email.toLowerCase(), telefono: phone.number, ubicacion: { zip: d.zip, ciudad: loc.city, estado: loc.state, lat: loc.latitude, lng: loc.longitude }, horario: d.horario, respuestas: d.respuestas, consentimiento: { aceptado: true, version: vacante.consentimientoVersion, idioma: d.idioma, fecha: new Date().toISOString() }, atribucion: { utm: d.utm ?? {}, fbclid: d.fbclid, eventId: d.eventId, url: referer }, tecnico: { ip, userAgent } };
  let saved;
  try {
    saved = await saveApplication(payload);
  } catch (error) {
    if (error instanceof IdempotencyConflict) return fail("conflict", 409);
    console.error("relay_application_save_failed", payload.applicationId);
    return fail("storage", 503);
  }
  const cookies = req.headers.get("cookie");
  if (!saved.duplicate) {
    after(() => sendLead({ eventId: d.eventId, email: payload.email, phone: payload.telefono, zip: d.zip, ip, userAgent, sourceUrl: referer, fbp: cookie(cookies, "_fbp"), fbc: cookie(cookies, "_fbc"), vacanteId: vacante.vacanteId }));
  }
  return NextResponse.json({ ok: true, applicationId: saved.applicationId, duplicate: saved.duplicate }, { status: 202 });
}
