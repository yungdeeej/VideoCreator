import { useEffect, useState } from "react";
import type { Project, PublicConfig } from "@storyforge/shared";
import { api } from "../api";
import { navigate } from "../lib/router";
import { Button, Input } from "../components/ui";

export function ProjectList({ config }: { config: PublicConfig }) {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      setProjects(await api.listProjects());
    } catch (e: any) {
      setError(e.message);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function create() {
    if (!name.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const p = await api.createProject({ name: name.trim() });
      navigate({ name: "editor", id: p.id });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this project? This cannot be undone.")) return;
    await api.deleteProject(id);
    refresh();
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <header className="mb-10">
        <h1 className="text-3xl font-semibold tracking-tight">
          Story<span className="text-accent">Forge</span>
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Define a storyboard once → generate every clip in parallel → stitch &
          export.
          {config.mockMode && (
            <span className="ml-2 rounded bg-accent/15 px-1.5 py-0.5 text-[11px] text-accent">
              MOCK MODE
            </span>
          )}
        </p>
      </header>

      <div className="mb-8 flex gap-2">
        <Input
          placeholder="New story name…"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && create()}
        />
        <Button variant="primary" onClick={create} disabled={creating || !name.trim()}>
          Create
        </Button>
      </div>

      {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

      <div className="space-y-2">
        {projects === null && <p className="text-slate-500">Loading…</p>}
        {projects?.length === 0 && (
          <p className="text-slate-500">No projects yet. Create one above.</p>
        )}
        {projects?.map((p) => {
          const scenes = p.items.filter((i) => i.kind === "scene").length;
          const titles = p.items.filter((i) => i.kind === "title").length;
          return (
            <div
              key={p.id}
              className="group flex items-center justify-between rounded-xl border border-ink-700 bg-ink-900 px-5 py-4 hover:border-ink-600 transition"
            >
              <button
                className="flex-1 text-left"
                onClick={() => navigate({ name: "editor", id: p.id })}
              >
                <div className="font-medium text-slate-100">{p.name}</div>
                <div className="mt-0.5 text-xs text-slate-500">
                  {scenes} scene{scenes !== 1 ? "s" : ""} · {titles} title card
                  {titles !== 1 ? "s" : ""} · {p.aspectRatio} · updated{" "}
                  {new Date(p.updatedAt).toLocaleDateString()}
                </div>
              </button>
              <Button
                variant="danger"
                className="opacity-0 group-hover:opacity-100"
                onClick={() => remove(p.id)}
              >
                Delete
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
