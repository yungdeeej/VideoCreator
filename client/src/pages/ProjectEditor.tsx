import { useCallback, useEffect, useMemo, useState } from "react";
import {
  isScene,
  isTitleCard,
  type Project,
  type PublicConfig,
  type UpdateProjectInput,
  type UpdateSceneInput,
  type UpdateTitleCardInput,
} from "@storyforge/shared";
import { api } from "../api";
import { navigate } from "../lib/router";
import { projectCost } from "../lib/cost";
import { Spinner } from "../components/ui";
import { TopBar } from "../components/TopBar";
import { SceneCard } from "../components/SceneCard";
import { TitleCardItem } from "../components/TitleCardItem";
import { useStatusPolling } from "../hooks/useStatusPolling";
import { mergeStatus } from "../lib/mergeStatus";

export function ProjectEditor({
  projectId,
  config,
}: {
  projectId: string;
  config: PublicConfig;
}) {
  const [project, setProject] = useState<Project | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { status, poke } = useStatusPolling(projectId);

  useEffect(() => {
    api
      .getProject(projectId)
      .then(setProject)
      .catch((e) => setError(e.message));
  }, [projectId]);

  // Canonical project carries editable fields; live status overlays progress.
  const view = useMemo(
    () => (project ? mergeStatus(project, status) : null),
    [project, status],
  );
  const busy = status?.busy ?? false;

  const sorted = useMemo(
    () => (view ? [...view.items].sort((a, b) => a.order - b.order) : []),
    [view],
  );

  const cost = useMemo(
    () => (project ? projectCost(project, config).total : 0),
    [project, config],
  );

  async function generateAll() {
    try {
      await api.generateAll(projectId);
      poke();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function regenerate(itemId: string, stage: "all" | "video") {
    try {
      await api.regenerateItem(projectId, itemId, stage);
      poke();
    } catch (e: any) {
      setError(e.message);
    }
  }

  // ---- mutations (server is source of truth; response replaces local) ----
  const guard = useCallback(
    async (fn: () => Promise<Project>) => {
      try {
        setProject(await fn());
      } catch (e: any) {
        setError(e.message);
      }
    },
    [],
  );

  const patchProject = (patch: UpdateProjectInput) =>
    guard(() => api.updateProject(projectId, patch));
  const patchScene = (sceneId: string, patch: UpdateSceneInput) =>
    guard(() => api.updateScene(projectId, sceneId, patch));
  const patchTitle = (titleId: string, patch: UpdateTitleCardInput) =>
    guard(() => api.updateTitleCard(projectId, titleId, patch));
  const removeItem = (itemId: string) =>
    guard(() => api.deleteItem(projectId, itemId));

  async function insertAt(kind: "scene" | "title", index: number) {
    const before = sorted.map((i) => i.id);
    const updated =
      kind === "scene"
        ? await api.addScene(projectId, { imagePrompt: "" })
        : await api.addTitleCard(projectId, { text: "New title" });
    const newId = updated.items.find((i) => !before.includes(i.id))?.id;
    const ids = [...updated.items]
      .sort((a, b) => a.order - b.order)
      .map((i) => i.id)
      .filter((x) => x !== newId);
    if (newId && index <= ids.length) {
      ids.splice(index, 0, newId);
      setProject(await api.reorder(projectId, ids));
    } else {
      setProject(updated);
    }
  }

  function move(itemId: string, dir: -1 | 1) {
    const ids = sorted.map((i) => i.id);
    const idx = ids.indexOf(itemId);
    const j = idx + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[idx], ids[j]] = [ids[j], ids[idx]];
    guard(() => api.reorder(projectId, ids));
  }

  async function uploadReference(file: File) {
    try {
      const url = await api.uploadReference(file);
      await patchProject({ characterRefImageUrl: url });
    } catch (e: any) {
      setError(e.message);
    }
  }

  if (error && !project) {
    return (
      <div className="p-8 text-red-400">
        {error}{" "}
        <button className="underline" onClick={() => navigate({ name: "list" })}>
          back
        </button>
      </div>
    );
  }
  if (!project || !view) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <Spinner className="text-accent" />
      </div>
    );
  }
  const v = view;

  return (
    <div className="min-h-full">
      <TopBar
        project={v}
        config={config}
        cost={cost}
        busy={busy}
        onPatch={patchProject}
        onUploadReference={uploadReference}
        onGenerateAll={generateAll}
        exportStatus={v.exportStatus}
        exportProgress={v.exportProgress}
        exportUrl={v.exportUrl}
        onBack={() => navigate({ name: "list" })}
        // onCombine wired in Phase 6
      />

      <div className="mx-auto max-w-5xl px-6 py-6 space-y-1">
        {error && <p className="text-sm text-red-400">{error}</p>}

        <InsertRow onInsert={(k) => insertAt(k, 0)} />

        {sorted.map((item, i) => {
          const sceneNumber =
            sorted.slice(0, i + 1).filter(isScene).length;
          return (
            <div key={item.id} className="space-y-1">
              {isScene(item) ? (
                <SceneCard
                  scene={item}
                  index={sceneNumber}
                  config={config}
                  aspect={v.aspectRatio}
                  onChange={(patch) => patchScene(item.id, patch)}
                  onDelete={() => removeItem(item.id)}
                  onMoveUp={i > 0 ? () => move(item.id, -1) : undefined}
                  onMoveDown={
                    i < sorted.length - 1 ? () => move(item.id, 1) : undefined
                  }
                  onRegenerateImage={() => regenerate(item.id, "all")}
                  onRegenerateVideo={() => regenerate(item.id, "video")}
                  disabled={busy}
                />
              ) : isTitleCard(item) ? (
                <TitleCardItem
                  card={item}
                  onChange={(patch) => patchTitle(item.id, patch)}
                  onDelete={() => removeItem(item.id)}
                  onMoveUp={i > 0 ? () => move(item.id, -1) : undefined}
                  onMoveDown={
                    i < sorted.length - 1 ? () => move(item.id, 1) : undefined
                  }
                />
              ) : null}
              <InsertRow onInsert={(k) => insertAt(k, i + 1)} />
            </div>
          );
        })}

        {sorted.length === 0 && (
          <p className="py-12 text-center text-slate-500">
            Empty storyboard — add your first scene or title card above.
          </p>
        )}
      </div>
    </div>
  );
}

function InsertRow({ onInsert }: { onInsert: (kind: "scene" | "title") => void }) {
  return (
    <div className="flex items-center gap-2 py-1 opacity-40 hover:opacity-100 transition">
      <div className="h-px flex-1 bg-ink-700" />
      <button
        className="rounded-full border border-ink-700 bg-ink-900 px-3 py-0.5 text-xs text-slate-300 hover:border-accent hover:text-accent"
        onClick={() => onInsert("scene")}
      >
        + Scene
      </button>
      <button
        className="rounded-full border border-ink-700 bg-ink-900 px-3 py-0.5 text-xs text-slate-300 hover:border-accent hover:text-accent"
        onClick={() => onInsert("title")}
      >
        + Title card
      </button>
      <div className="h-px flex-1 bg-ink-700" />
    </div>
  );
}
