import { getDatabase } from "@/lib/database.mjs";
import { checkRateLimitStore } from "@/lib/ratelimit";

export const runtime = "nodejs";

export async function GET() {
  try {
    await Promise.all([
      getDatabase().query("SELECT 1 FROM relay_applications LIMIT 1"),
      checkRateLimitStore(),
    ]);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
