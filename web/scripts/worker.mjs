import { setTimeout as sleep } from "node:timers/promises";
import { readFile } from "node:fs/promises";
import { getDatabase } from "../src/lib/database.mjs";
import { processNextJob } from "../src/lib/processor.mjs";

const config = {
  n8nUrl: process.env.N8N_WEBHOOK_URL,
  n8nSecret: process.env.N8N_WEBHOOK_SECRET,
  maxAttempts: Number(process.env.RELAY_MAX_ATTEMPTS || 8),
  rules: JSON.parse(await readFile(new URL("../src/config/prequalification.json", import.meta.url), "utf8")),
};
const pollMs = Number(process.env.RELAY_POLL_MS || 5000);
if (!Number.isInteger(config.maxAttempts) || config.maxAttempts < 1 ||
    !Number.isInteger(pollMs) || pollMs < 100) throw new Error("invalid_worker_configuration");

const database = getDatabase();
const abort = new AbortController();
let stopping = false;
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => { stopping = true; abort.abort(); });
}
console.log("relay_worker_started");
try {
  while (!stopping) {
    let found = false;
    try {
      found = await processNextJob(database, config);
    } catch {
      console.error("relay_worker_database_or_lease_error");
    }
    if (!found && !stopping) await sleep(pollMs, undefined, { signal: abort.signal }).catch(() => {});
  }
} finally {
  await database.end();
}
