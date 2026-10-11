import { createHash } from "crypto";

const sha = (v) =>
  createHash("sha256").update(String(v).trim().toLowerCase()).digest("hex");

// Envía el evento Lead a Meta desde el servidor.
// Usa el mismo eventId que el Pixel para que Meta no cuente doble.
export async function sendLead({
  eventId, email, phone, zip, ip, userAgent, sourceUrl, fbp, fbc, vacanteId,
}) {
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  const token = process.env.META_CAPI_TOKEN;
  if (!pixelId || !token) return;

  const body = {
    data: [{
      event_name: "Lead",
      event_time: Math.floor(Date.now() / 1000),
      event_id: eventId,
      action_source: "website",
      event_source_url: sourceUrl,
      user_data: {
        em: [sha(email)], ph: [sha(phone.replace(/\D/g, ""))], zp: [sha(zip)],
        client_ip_address: ip, client_user_agent: userAgent, fbp, fbc,
      },
      custom_data: { content_name: vacanteId },
    }],
  };

  try {
    // Verifica en la documentación de Meta la versión vigente de la Graph API
    const response = await fetch(`https://graph.facebook.com/v21.0/${pixelId}/events?access_token=${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) console.warn("meta_capi_http_error", response.status);
  } catch {
    console.error("meta_capi_unavailable");
  }
}
