const endpoint = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export async function verifyTurnstile(token, ip, fetcher = fetch) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return process.env.RELAY_ENV !== "production";
  if (typeof token !== "string" || token.length < 1 || token.length > 2048) return false;

  const body = new URLSearchParams({ secret, response: token });
  if (ip && ip !== "unknown") body.set("remoteip", ip);
  try {
    const response = await fetcher(endpoint, {
      method: "POST", body, signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) return false;
    const result = await response.json();
    return result.success === true;
  } catch {
    console.error("relay_turnstile_verification_failed");
    return false;
  }
}
