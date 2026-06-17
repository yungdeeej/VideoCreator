/**
 * Thin wrapper around @fal-ai/client. ALL fal access funnels through here so
 * the FAL_KEY never leaves the backend. Uses the queue/async pattern (submit
 * -> poll -> result) rather than blocking calls.
 */

import { fal } from "@fal-ai/client";
import { env } from "../env.js";

let configured = false;

function ensureConfigured() {
  if (configured) return;
  if (!env.FAL_KEY) {
    throw new Error(
      "FAL_KEY is not set. Set it in the backend env, or use FAL_MOCK=1 for placeholder generation.",
    );
  }
  fal.config({ credentials: env.FAL_KEY });
  configured = true;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface FalRunOptions {
  modelId: string;
  input: Record<string, unknown>;
  /** Called with the fal queue status on each poll ("IN_QUEUE"/"IN_PROGRESS"...). */
  onStatus?: (status: string) => void;
  pollIntervalMs?: number;
  timeoutMs?: number;
}

/**
 * Submit a fal job, poll until it completes, and return its `data` payload.
 * Throws on failure or timeout.
 */
export async function runFalJob<T = any>(opts: FalRunOptions): Promise<T> {
  ensureConfigured();
  const pollInterval = opts.pollIntervalMs ?? 3000;
  const timeout = opts.timeoutMs ?? 10 * 60 * 1000; // 10 min ceiling
  const startedAt = Date.now();

  const { request_id } = await fal.queue.submit(opts.modelId, {
    input: opts.input,
  });

  // Poll the queue until the job leaves the IN_QUEUE/IN_PROGRESS states.
  for (;;) {
    if (Date.now() - startedAt > timeout) {
      throw new Error(`fal job timed out after ${Math.round(timeout / 1000)}s (${opts.modelId})`);
    }
    const status = await fal.queue.status(opts.modelId, {
      requestId: request_id,
      logs: false,
    });
    opts.onStatus?.(status.status);
    if (status.status === "COMPLETED") break;
    await sleep(pollInterval);
  }

  const result = await fal.queue.result(opts.modelId, {
    requestId: request_id,
  });
  return result.data as T;
}

/** Upload a buffer to fal storage and return a public URL fal can fetch. */
export async function uploadToFalStorage(
  buffer: Buffer,
  contentType: string,
): Promise<string> {
  ensureConfigured();
  const blob = new Blob([buffer], { type: contentType });
  return fal.storage.upload(blob as any);
}
