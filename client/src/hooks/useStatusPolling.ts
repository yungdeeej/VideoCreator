import { useEffect, useRef, useState } from "react";
import type { ProjectStatus } from "@storyforge/shared";
import { api } from "../api";

/**
 * Polls /projects/:id/status every `intervalMs`. Polling auto-stops when the
 * project goes idle (not busy and not rendering) and resumes when `active`
 * is bumped (e.g. right after Generate All / Combine is clicked).
 */
export function useStatusPolling(
  projectId: string,
  intervalMs = 3000,
): {
  status: ProjectStatus | null;
  poke: () => void;
} {
  const [status, setStatus] = useState<ProjectStatus | null>(null);
  const timer = useRef<number | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function tick() {
      try {
        const s = await api.getStatus(projectId);
        if (cancelled) return;
        setStatus(s);
        const stillWorking = s.busy || s.exportStatus === "running";
        if (stillWorking) {
          timer.current = window.setTimeout(tick, intervalMs);
        } else {
          timer.current = null;
        }
      } catch {
        if (!cancelled) timer.current = window.setTimeout(tick, intervalMs);
      }
    }

    tick();
    return () => {
      cancelled = true;
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [projectId, intervalMs, nonce]);

  // Force the polling loop to (re)start immediately.
  const poke = () => {
    if (timer.current) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    setNonce((n) => n + 1);
  };

  return { status, poke };
}
