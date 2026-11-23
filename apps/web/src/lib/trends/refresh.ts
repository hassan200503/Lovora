import "server-only";
import { after } from "next/server";
import { runIngest } from "./ingest";
import { staleness, unattemptedTopics } from "./query";

const STALE_MS = 75 * 60 * 1000;
const g = globalThis as unknown as { __ingesting?: boolean };

/**
 * Self-healing freshness: if the scheduled job hasn't run for a while (cron
 * down, laptop asleep in development), the next visitor's request schedules a
 * refresh of due sources after the response is sent. Visitors never wait on
 * external APIs. Topics with sources that were never attempted (newly added
 * sections) jump the queue so their first visit isn't empty until cron.
 */
export async function refreshIfStale() {
  if (g.__ingesting) return;
  const fresh = await unattemptedTopics().catch(() => []);
  if (fresh.length === 0 && (await staleness()) < STALE_MS) return;
  g.__ingesting = true;
  after(async () => {
    try {
      // Short budget: serverless hosts cut background work off quickly.
      await runIngest({ topics: fresh.length ? fresh : undefined, budgetMs: 8_000 });
    } catch (e) {
      console.error("[trends] background refresh failed", e);
    } finally {
      g.__ingesting = false;
    }
  });
}
