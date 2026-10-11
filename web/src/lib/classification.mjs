export class ProcessingError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

export function validateClassification(result, applicationId) {
  if (!result || result.applicationId !== applicationId ||
      !["precalificado", "revision", "no_elegible"].includes(result.estado) ||
      !Number.isFinite(result.score) || result.score < 0 || result.score > 100 ||
      !Number.isFinite(result.distanciaMi) || result.distanciaMi < 0 ||
      !Array.isArray(result.motivos) || result.motivos.length > 20 ||
      result.motivos.some((value) => typeof value !== "string" || value.length > 500) ||
      typeof result.rulesVersion !== "string" || result.rulesVersion.length > 100) {
    throw new ProcessingError("n8n_invalid_classification");
  }
  return {
    applicationId, estado: result.estado, score: result.score,
    distanciaMi: result.distanciaMi, motivos: result.motivos,
    rulesVersion: result.rulesVersion,
  };
}

export async function classifyApplication(payload, { url, secret, fetchImpl = fetch }) {
  if (!url || !secret) throw new ProcessingError("n8n_configuration_incomplete");
  let response;
  try {
    response = await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-relay-secret": secret },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new ProcessingError("n8n_unavailable");
  }
  if (!response.ok) throw new ProcessingError("n8n_http_error");
  const result = await response.json().catch(() => null);
  return validateClassification(result, payload.applicationId);
}
