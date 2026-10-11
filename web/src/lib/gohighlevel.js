const API_BASE = "https://services.leadconnectorhq.com";

export class GoHighLevelError extends Error {
  constructor(code, status = 502) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

async function request(path, token, body) {
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        Authorization: `Bearer ${token}`, Version: "v3",
        Accept: "application/json", "Content-Type": "application/json",
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new GoHighLevelError("ghl_unavailable");
  }
  if (!response.ok) throw new GoHighLevelError("ghl_http_error", response.status);
  return response.json().catch(() => ({}));
}

/** Called only by the durable worker AFTER classification, never by intake. */
export async function syncGhlApplication(application, classification, {
  contactId: savedContactId,
  onContactSaved = async () => {},
} = {}) {
  if ((process.env.GHL_MODE || "live") === "mock") {
    if (process.env.RELAY_ENV !== "development" && process.env.RELAY_ENV !== "test") {
      throw new GoHighLevelError("ghl_mock_forbidden", 500);
    }
    const { createHash } = await import("node:crypto");
    return {
      contactId: `mock-${createHash("sha256").update(application.email).digest("hex").slice(0, 24)}`,
      noteId: `mock-${application.applicationId}`, mocked: true,
    };
  }
  if (process.env.GHL_MODE && process.env.GHL_MODE !== "live") {
    throw new GoHighLevelError("ghl_invalid_mode", 500);
  }
  const token = process.env.GHL_PRIVATE_INTEGRATION_TOKEN;
  const locationId = process.env.GHL_LOCATION_ID;
  if (!token || !locationId) throw new GoHighLevelError("ghl_configuration_incomplete", 500);

  let contactId = savedContactId;
  if (!contactId) {
    const nameParts = application.nombre.trim().split(/\s+/);
    const firstName = nameParts.shift();
    const result = await request("/contacts/upsert", token, {
      locationId, name: application.nombre.trim(), firstName, lastName: nameParts.join(" "),
      email: application.email, phone: application.telefono,
      city: application.ubicacion.ciudad, state: application.ubicacion.estado,
      postalCode: application.ubicacion.zip, country: "US", timezone: "America/New_York",
      source: "Relay Careers",
    });
    contactId = result?.contact?.id;
    if (typeof contactId !== "string" || !contactId) throw new GoHighLevelError("ghl_invalid_contact");
    await onContactSaved(contactId);
  }

  const path = `/contacts/${encodeURIComponent(contactId)}`;
  const marker = `[relay-application:${application.applicationId}]`;
  // Reconcile uncertain writes: a note may have been saved before a timeout.
  const existing = await request(`${path}/notes`, token);
  if (!Array.isArray(existing.notes)) throw new GoHighLevelError("ghl_invalid_notes");
  let noteId = existing.notes.find((note) =>
    typeof note.body === "string" && note.body.split("\n")[0] === marker,
  )?.id;
  if (!noteId) {
    const { applicationId, receivedAt, vacanteId, vacanteTitulo, idioma, nombre,
      email, telefono, ubicacion, horario, respuestas, consentimiento, atribucion } = application;
    const record = { applicationId, receivedAt, vacanteId, vacanteTitulo, idioma, nombre,
      email, telefono, ubicacion, horario, respuestas, consentimiento, atribucion, classification };
    const result = await request(`${path}/notes`, token, {
      body: `${marker}\n\n${JSON.stringify(record, null, 2)}`,
    });
    noteId = result?.note?.id;
  }
  if (typeof noteId !== "string" || !noteId) throw new GoHighLevelError("ghl_invalid_note");

  await request(`${path}/tags`, token, {
    tags: [`vacante-${application.vacanteId}`, `lang-${application.idioma}`,
      `relay-${application.vacanteId}-${classification.estado}`],
  });
  return { contactId, noteId, mocked: false };
}
