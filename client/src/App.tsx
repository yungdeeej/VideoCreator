import { useEffect, useState } from "react";

// Phase 1 placeholder: verifies the frontend can reach the backend.
// Replaced by the full project list / editor in Phase 4.
interface Health {
  ok: boolean;
  falConfigured: boolean;
  mockMode: boolean;
  ready: boolean;
  time: string;
}

export default function App() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then(setHealth)
      .catch((e) => setError(String(e)));
  }, []);

  return (
    <div className="min-h-full flex items-center justify-center p-8">
      <div className="max-w-md w-full rounded-2xl border border-ink-700 bg-ink-900 p-8 shadow-xl">
        <h1 className="text-2xl font-semibold tracking-tight">
          Story<span className="text-accent">Forge</span>
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Parallel AI story-video generator
        </p>

        <div className="mt-6 rounded-lg bg-ink-850 border border-ink-700 p-4 text-sm">
          {error && <p className="text-red-400">Backend unreachable: {error}</p>}
          {!error && !health && <p className="text-slate-400">Connecting…</p>}
          {health && (
            <ul className="space-y-1 font-mono text-xs">
              <li>backend: <span className="text-green-400">online</span></li>
              <li>
                fal:{" "}
                {health.mockMode ? (
                  <span className="text-accent">mock mode</span>
                ) : health.falConfigured ? (
                  <span className="text-green-400">configured</span>
                ) : (
                  <span className="text-red-400">no FAL_KEY</span>
                )}
              </li>
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
