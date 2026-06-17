import { useEffect, useState } from "react";
import type { PublicConfig } from "@storyforge/shared";
import { api } from "./api";
import { parseHash, type Route } from "./lib/router";
import { Spinner } from "./components/ui";
import { ProjectList } from "./pages/ProjectList";
import { ProjectEditor } from "./pages/ProjectEditor";

export default function App() {
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [route, setRoute] = useState<Route>(parseHash());

  useEffect(() => {
    api.getConfig().then(setConfig).catch((e) => setError(String(e)));
  }, []);

  useEffect(() => {
    const onHash = () => setRoute(parseHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  if (error) {
    return (
      <Centered>
        <p className="text-red-400">Could not reach backend: {error}</p>
      </Centered>
    );
  }
  if (!config) {
    return (
      <Centered>
        <Spinner className="text-accent" />
        <span className="ml-3 text-slate-400">Loading…</span>
      </Centered>
    );
  }

  return route.name === "editor" ? (
    <ProjectEditor projectId={route.id} config={config} />
  ) : (
    <ProjectList config={config} />
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-full flex items-center justify-center p-8">
      {children}
    </div>
  );
}
