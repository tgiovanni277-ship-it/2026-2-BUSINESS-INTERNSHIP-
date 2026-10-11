import { getDatabase, transaction } from "../src/lib/database.mjs";

const database = getDatabase();
try {
  const [command = "status", id] = process.argv.slice(2);
  if (command === "retry") {
    if (!/^\d+$/.test(id || "")) throw new Error("job_id_required");
    await transaction(database, async (client) => {
      const result = await client.query(
        `UPDATE relay_jobs SET status = 'pending', attempts = 0, available_at = now(),
         lease_token = NULL, locked_until = NULL, last_error = NULL, updated_at = now()
         WHERE id = $1 AND status = 'dead' RETURNING application_id`, [id],
      );
      if (!result.rowCount) throw new Error("job_not_dead_or_missing");
      await client.query(
        "INSERT INTO relay_events (application_id, kind, details) VALUES ($1, 'manual_retry', $2::jsonb)",
        [result.rows[0].application_id, JSON.stringify({ jobId: id })],
      );
    });
    console.log("job_requeued", id);
  } else if (command === "status") {
    const [summary, result] = await Promise.all([
      database.query(`SELECT kind, status, count(*)::integer AS jobs,
        round(extract(epoch FROM (now() - min(created_at))))::integer AS oldest_seconds
        FROM relay_jobs WHERE status <> 'done' GROUP BY kind, status ORDER BY kind, status`),
      database.query(`SELECT id, application_id, kind, status, attempts,
      available_at, last_error FROM relay_jobs ORDER BY id DESC LIMIT 50`),
    ]);
    console.log("queue_summary");
    console.table(summary.rows);
    console.log("latest_jobs");
    console.table(result.rows);
  } else {
    throw new Error("use_status_or_retry");
  }
} catch (error) {
  const safe = ["job_id_required", "job_not_dead_or_missing", "use_status_or_retry"];
  console.error(safe.includes(error.message) ? error.message : "jobs_command_failed");
  process.exitCode = 1;
} finally {
  await database.end();
}
