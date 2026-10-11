import { classifyApplication, ProcessingError } from "./classification.mjs";
import { syncGhlApplication } from "./gohighlevel.js";
import { claimJob, loadApplication, finishClassification, rememberContact, finishCrm, failJob } from "./applications.mjs";

export async function processNextJob(database, config, adapters = {}) {
  const job = await claimJob(database);
  if (!job) return false;
  try {
    if (job.attempts > config.maxAttempts) throw new Error("retry_limit_exceeded");
    const application = await loadApplication(job.application_id, database);
    if (job.kind === "classify") {
      const reglas = config.rules?.[application.payload.vacanteId];
      if (!reglas) throw new ProcessingError("n8n_rules_missing");
      const classification = await (adapters.classify || classifyApplication)({
        schemaVersion: 1,
        applicationId: application.id,
        reglas,
      }, {
        url: config.n8nUrl, secret: config.n8nSecret,
      });
      await finishClassification(job, classification, database);
    } else {
      if (!application.classification) throw new Error("classification_missing");
      const result = await (adapters.syncCrm || syncGhlApplication)(application.payload, application.classification, {
        contactId: application.ghl_contact_id,
        onContactSaved: (contactId) => rememberContact(job, contactId, database),
      });
      await finishCrm(job, result, database);
    }
    console.log("relay_job_done", job.id, job.kind);
  } catch (error) {
    const code = typeof error.code === "string" && /^(ghl_|n8n_)[a-z_]+$/.test(error.code)
      ? error.code : "processing_failed";
    await failJob(job, code, config.maxAttempts, database);
    console.warn("relay_job_retry", job.id, job.kind, code);
  }
  return true;
}
